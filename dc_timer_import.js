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
    // DC Timer DBHelper: sessions 0..14 have separate result tables; later
    // sessions share resultstb.sid. Unknown practice types must never be guessed.
    const EVENT_TYPES = Object.freeze({'-32':'333','-31':'444','-30':'555','-29':'222','-28':'333bf','-27':'333oh','-24':'minx','-23':'pyram','-22':'sq1','-21':'clock','-20':'skewb','-19':'666','-18':'777','-17':'444bf','-16':'555bf','362':'888','363':'999','364':'101010','365':'111111','517':'fto'});
    async function parseDcTimerDatabase(bytes, SQL, options = {}) {
        checkCancelled(options);
        if (bytes.byteLength > MAX_BYTES || new TextDecoder().decode(bytes.slice(0,16)) !== 'SQLite format 3\u0000') throw new DcTimerImportError('未识别为有效的 SQLite 数据库文件。');
        let db;
        try {
            db = new SQL.Database(bytes);
            const tables = new Set(db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0]?.values.map(r=>r[0]) || []);
            if (!tables.has('sessiontb')) throw new DcTimerImportError('没有找到 DC Timer 项目分组信息。');
            const sessions = db.exec('SELECT id,name,type FROM sessiontb ORDER BY id')[0]?.values || [];
            if (!sessions.length || sessions.length > 2000) throw new DcTimerImportError('数据库项目分组信息为空或超出支持范围。');
            const allowed = new Set(options.allowedEvents || Object.values(EVENT_TYPES)), groups = {}, skipped = [];
            let total = 0, imported = 0;
            const ids = new Set();
            for (const [id, name, type] of sessions) {
                checkCancelled(options);
                if (!Number.isSafeInteger(id) || id < 0 || ids.has(id)) throw new DcTimerImportError('数据库项目编号异常。');
                ids.add(id);
                const table = id < 15 ? (id === 0 ? 'resulttb' : 'result'+(id+1)) : 'resultstb';
                if (!tables.has(table)) continue;
                const where = id >= 15 ? ' WHERE sid='+id : '';
                const count = db.exec('SELECT count(*) FROM '+table+where)[0].values[0][0];
                if (!count) continue;
                total += count;
                if (total > 200000) throw new DcTimerImportError('数据库记录过多，请分批导入。');
                const key = EVENT_TYPES[type], label = typeof name === 'string' && name.trim() ? name.trim().slice(0,160) : '未命名分组 '+id;
                if (!key || !allowed.has(key)) { skipped.push({ name: label, count, reason: '网站暂不支持此项目' }); continue; }
                const records = groups[key] || (groups[key] = []), statement = db.prepare('SELECT id,rest,resp,resd,scr,time,note FROM '+table+where+' ORDER BY id DESC');
                try {
                    while (statement.step()) {
                        const [rowId,rawMs,resp,resd,scr,time,note] = statement.get();
                        if (!Number.isSafeInteger(rawMs) || rawMs < 0 || rawMs > 2147483647 || ![0,1].includes(resp) || ![0,1].includes(resd)) throw new DcTimerImportError('分组「'+label+'」中有无法识别的成绩（编号 '+rowId+'），本次未写入任何数据。');
                        records.push({rawMs,penalty:resd===0?'DNF':resp===1?'+2':'',scramble:typeof scr==='string'?scr:'',timestamp:typeof time==='string'?time:'',...(note?{note:String(note)}:{}),importSource:'dc-timer'});
                        imported++;
                    }
                } finally { statement.free(); }
                report(options,'database',total,total,imported);
            }
            // Report records whose shared-table session metadata was lost, too.
            if (tables.has('resultstb')) {
                const orphan = db.exec('SELECT sid,count(*) FROM resultstb GROUP BY sid')[0]?.values || [];
                for (const [id,count] of orphan) if (!ids.has(id)) skipped.push({name:'未识别分组 '+id,count,reason:'缺少项目分组信息'});
            }
            if (!total && !skipped.length) throw new DcTimerImportError('数据库中没有可导入的成绩。');
            for (const records of Object.values(groups)) records.sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
            return {groups,skipped,imported,total};
        } catch (error) {
            if (error instanceof DcTimerImportError || error.name==='AbortError') throw error;
            throw new DcTimerImportError('数据库损坏或不是支持的 DC Timer 数据库，成绩未导入。');
        } finally { db?.close(); }
    }
    function runWorker(message, options = {}, transfer = []) {
        return new Promise((resolve,reject)=>{
            if (typeof Worker==='undefined') { reject(new DcTimerImportError('当前浏览器不支持后台数据库导入，请使用新版浏览器。')); return; }
            const worker = new Worker(new URL('dc_timer_import.js?v=1.48.2',document.baseURI));
            let timer,watch;
            const finish = (error,value) => { clearTimeout(timer);clearInterval(watch);worker.terminate();error?reject(error):resolve(value); };
            timer=setTimeout(()=>finish(new DcTimerImportError('数据库处理超时，请检查文件后重试。')),90000);
            watch=setInterval(()=>{if(options.isCancelled?.())finish(Object.assign(new Error('已取消导入。'),{name:'AbortError'}));},100);
            worker.onmessage=event=>{if(event.data.error)finish(new DcTimerImportError(event.data.error));else finish(null,event.data.result);};
            worker.onerror=()=>finish(new DcTimerImportError('数据库组件加载失败，请刷新页面后重试。'));
            worker.postMessage(message,transfer);
        });
    }
    async function readDatabase(file, options = {}) {
        if (!file || file.size > MAX_BYTES) throw new DcTimerImportError('数据库文件过大（上限 32 MB）。');
        const buffer=await file.arrayBuffer();checkCancelled(options);
        return runWorker({action:'database',buffer,allowedEvents:options.allowedEvents},options,[buffer]);
    }
    async function isDatabase(file) {
        if (/\.db$/i.test(file.name||'')) return true;
        const bytes=await file.slice(0,16).arrayBuffer();return new TextDecoder().decode(bytes)==='SQLite format 3\u0000';
    }
    const encodeConfig = (config,options={}) => runWorker({action:'encode',config},options);
    return Object.freeze({ DcTimerImportError, parseDcTimerText, parseDcTimerTextAsync, decodeDcTimerBytes, readDcTimerFile,parseDcTimerDatabase,readDatabase,isDatabase,encodeConfig,EVENT_TYPES });
});

// The same file is the dedicated worker entry; SQLite/WASM is loaded only here.
if (typeof self!=='undefined' && typeof document==='undefined' && typeof importScripts==='function') {
    self.onmessage=async event=>{
        try {
            if(event.data.action==='encode') {
                importScripts('vendor/lz-string-1.5.0.min.js');
                const config=event.data.config,history=JSON.stringify(config.history);
                if(history.length>1000000){config.historyCompressed=LZString.compressToUTF16(history);delete config.history;}
                self.postMessage({result:JSON.stringify(config)});return;
            }
            importScripts('vendor/sql-wasm.js');
            const SQL=await initSqlJs({locateFile:file=>new URL('vendor/'+file,self.location.href).href});
            const result=await self.DcTimerImport.parseDcTimerDatabase(new Uint8Array(event.data.buffer),SQL,{allowedEvents:event.data.allowedEvents});
            self.postMessage({result});
        } catch(error) { self.postMessage({error:error.message||'数据库读取失败。'}); }
    };
}
