/* DC Timer detailed text exports. Pure parsing: never reads or changes saved records. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.DcTimerImport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const MAX_BYTES = 32 * 1024 * 1024;
    const BATCH_SIZE = 200;
    class DcTimerImportError extends Error {
        constructor(message, code = 'INVALID_FORMAT', lineNumber = null) {
            super(message);
            this.name = 'DcTimerImportError';
            this.code = code;
            this.lineNumber = lineNumber;
        }
    }
    function invalidRow(lineNumber) {
        return new DcTimerImportError(`第 ${lineNumber} 行成绩格式无法识别，请检查导出文件。`, 'INVALID_ROW', lineNumber);
    }
    function checkCancelled(options) {
        if (options?.isCancelled?.()) {
            const error = new Error('已取消导入。');
            error.name = 'AbortError';
            throw error;
        }
    }
    function report(options, phase, processed, total, count) {
        options?.onProgress?.({ phase, processed, total, count });
    }
    const yieldToPage = () => new Promise(resolve => setTimeout(resolve, 0));
    function timeToMilliseconds(value, lineNumber) {
        if (!/^\d+(?::\d{1,2}){0,2}(?:\.\d{1,3})?$/.test(value)) throw invalidRow(lineNumber);
        const pieces = value.split(':'), last = pieces.pop(), [seconds, fraction = ''] = last.split('.');
        if (pieces.length && Number(seconds) >= 60) throw invalidRow(lineNumber);
        if (pieces.length === 2 && Number(pieces[1]) >= 60) throw invalidRow(lineNumber);
        let totalSeconds = Number(seconds), multiplier = 60;
        while (pieces.length) { totalSeconds += Number(pieces.pop()) * multiplier; multiplier *= 60; }
        const milliseconds = totalSeconds * 1000 + Number(fraction.padEnd(3, '0'));
        if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) throw invalidRow(lineNumber);
        return milliseconds;
    }
    function makeState(text) {
        if (typeof text !== 'string') throw new DcTimerImportError('请选择 DC Timer 导出的文本文件。');
        if (!text.trim()) throw new DcTimerImportError('文件内容为空。', 'EMPTY_FILE');
        if (text.length > MAX_BYTES || text.includes('\u0000') || !/DCTimer/i.test(text)) throw new DcTimerImportError('未识别为 DC Timer 详细成绩文件。');
        const declared = text.match(/完成次数\s*[/／]\s*尝试次数\s*[：:]\s*\d+\s*[/／]\s*(\d+)/);
        return { lines: text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/), records: [], declaredCount: declared ? Number(declared[1]) : null };
    }
    function consumeLine(state, index) {
        const lineNumber = index + 1, line = state.lines[index].trim();
        if (!line) return;
        const row = line.match(/^(\d+)[.．、]\s+(.+)$/);
        if (!row) {
            if (state.records.length) throw invalidRow(lineNumber);
            return; // Statistics, generated date and other export headers are not solves.
        }
        if (Number(row[1]) !== state.records.length + 1 || line.length > 32768) throw invalidRow(lineNumber);
        const score = row[2].match(/^(?:DNF\s*\(\s*([\d:.]+)\s*\)|([\d:.]+)(\+)?)(?=\s|\[|$)/i);
        if (!score) throw invalidRow(lineNumber);
        const penalty = score[1] !== undefined ? 'DNF' : score[3] ? '+2' : '';
        let rawMs = timeToMilliseconds(score[1] ?? score[2], lineNumber);
        // Official Result#getTimeAt exports the effective (raw + 2000) value
        // followed by '+'. Convert it back so NB Timer does not add it twice.
        // https://github.com/MeigenChou/DCTimer-Android/blob/master/app/src/main/java/com/dctimer/model/Result.java
        if (penalty === '+2') { rawMs -= 2000; if (rawMs < 0) throw invalidRow(lineNumber); }
        let scramble = row[2].slice(score[0].length).trim();
        // DC Timer may include an optional per-solve comment before its scramble.
        if (scramble.startsWith('[')) {
            const end = scramble.indexOf(']');
            if (end < 0) throw invalidRow(lineNumber);
            scramble = scramble.slice(end + 1).trim();
        }
        state.records.push({ rawMs, penalty, timestamp: '', scramble: scramble.replace(/\s+/g, ' '), importSource: 'dc-timer' });
    }
    function finish(state) {
        if (!state.records.length) throw new DcTimerImportError('文件中没有可导入的详细成绩。', 'EMPTY_RECORDS');
        if (state.declaredCount !== null && state.declaredCount !== state.records.length) throw new DcTimerImportError('文件记录数与统计数量不一致，请重新完整导出。', 'INCOMPLETE_FILE');
        return state.records;
    }
    function parseDcTimerText(text) {
        const state = makeState(text);
        state.lines.forEach((_, index) => consumeLine(state, index));
        return finish(state);
    }
    async function parseDcTimerTextAsync(text, options = {}) {
        checkCancelled(options);
        const state = makeState(text), total = state.lines.length;
        report(options, 'parsing', 0, total, 0);
        for (let start = 0; start < total; start += BATCH_SIZE) {
            checkCancelled(options);
            const end = Math.min(total, start + BATCH_SIZE);
            for (let index = start; index < end; index++) consumeLine(state, index);
            report(options, 'parsing', end, total, state.records.length);
            if (end < total) await yieldToPage();
        }
        checkCancelled(options);
        return finish(state);
    }
    function decodeDcTimerBytes(value) {
        const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
        if (!bytes.byteLength) throw new DcTimerImportError('文件内容为空。', 'EMPTY_FILE');
        if (bytes.byteLength > MAX_BYTES) throw new DcTimerImportError('文件过大，请分组导出后导入。', 'TOO_LARGE');
        const bom = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : null;
        for (const encoding of bom ? [bom] : ['utf-8', 'gb18030']) {
            try {
                const text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
                if (/DCTimer/i.test(text) && !text.includes('\u0000')) return { text, encoding };
            } catch (_) { /* Try the next common text-file encoding. */ }
        }
        throw new DcTimerImportError('文件编码或格式无法识别，请重新导出为文本。', 'ENCODING');
    }
    async function readDcTimerFile(file, options = {}) {
        checkCancelled(options);
        if (!file || typeof file.arrayBuffer !== 'function') throw new DcTimerImportError('请选择 DC Timer 导出的文本文件。');
        if (file.size > MAX_BYTES) throw new DcTimerImportError('文件过大，请分组导出后导入。', 'TOO_LARGE');
        report(options, 'reading', 0, file.size || 0, 0);
        await yieldToPage();
        checkCancelled(options);
        const bytes = await file.arrayBuffer();
        checkCancelled(options);
        const { text } = decodeDcTimerBytes(bytes);
        report(options, 'reading', bytes.byteLength, bytes.byteLength, 0);
        await yieldToPage();
        return parseDcTimerTextAsync(text, options);
    }
    return Object.freeze({ DcTimerImportError, parseDcTimerText, parseDcTimerTextAsync, decodeDcTimerBytes, readDcTimerFile });
});
