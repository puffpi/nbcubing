'use strict';

// BLE packet formats: csTimer's gantimer.js and qiyitimer.js.
const nbBluetoothTimers = {
    gan: {name:'GAN 星环计时器', service:0xfff0, read:0xfff5},
    adapter: {name:'蓝牙发射器', service:0xfd50, read:'00000002-0000-1001-8001-00805f9b07d0',
        write:'00000001-0000-1001-8001-00805f9b07d0'}
};
let nbBluetoothTimerLink = null;
let nbQiyiAddressDevice = null;
let nbAndroidTimerScan = null;
const nbBluetoothTimerDevices = new Map();

function nbTimerSource() {
    const source = uiSettings.nbTimerSource;
    return currentTimerMode !== 'smart' && (!window.NBApp || window.scanAndroidExternalTimer) &&
        Object.hasOwn(nbBluetoothTimers, source) ? source : 'timer';
}

function nbBluetoothTimerOptions() {
    return Object.entries(nbBluetoothTimers).map(([id, {name}]) => currentTimerMode === 'smart' ||
        (window.NBApp && !window.scanAndroidExternalTimer) ? [null, name] : [id, name]);
}

function selectNbTimerSource(source) {
    if (currentTimerMode === 'smart' || (source !== 'timer' && !Object.hasOwn(nbBluetoothTimers, source))) return;
    if (source !== nbTimerSource() && timerState !== 'IDLE') return;
    uiSettings.nbTimerSource = source;
    syncNbBluetoothTimer();
    queueTimerOptionSave();
}

function syncNbBluetoothTimer() {
    const source = nbTimerSource();
    const active = document.getElementById('timer-page').classList.contains('active');
    if (nbBluetoothTimerLink && (!active || source !== nbBluetoothTimerLink.source)) disconnectNbBluetoothTimer();
    if (!active || source === 'timer') closeNbBluetoothTimerCard();
    document.getElementById('nb-timer-source-label').textContent = nbBluetoothTimers[source]?.name || '计时器';
    document.getElementById('nb-external-timer-status').hidden = source === 'timer';
    renderNbBluetoothTimer();
}

function renderNbBluetoothTimer(message) {
    const status = document.getElementById('nb-external-timer-status');
    const link = nbBluetoothTimerLink;
    status.classList.toggle('connected', Boolean(link?.ready));
    status.querySelector('span').textContent = link?.ready ? '已连接' : link?.subscribed ? '等待设备数据' : '未连接';
    const card = document.getElementById('nb-external-timer-card');
    if (card.hidden) return;
    document.getElementById('nb-external-timer-title').textContent =
        message || nbBluetoothTimers[nbTimerSource()]?.name || '蓝牙计时器';
    const list = document.getElementById('nb-external-timer-devices');
    list.replaceChildren();
    for (const [device, source] of nbBluetoothTimerDevices) {
        if (source !== nbTimerSource()) continue;
        const row = document.createElement('div');
        row.className = 'timer-bluetooth-device-row';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = device.name || nbBluetoothTimers[source].name;
        button.onclick = () => {
            nbAndroidTimerScan?.abort();
            if (source === 'adapter' && link?.device === device && !link.ready) showNbBluetoothTimerAddress(device, link.mac);
            else void connectNbBluetoothTimer(device, source);
        };
        row.append(button);
        if (link?.device === device && link.subscribed) {
            const disconnect = document.createElement('button');
            disconnect.type = 'button';
            disconnect.className = 'timer-bluetooth-disconnect';
            disconnect.setAttribute('aria-label', '断开连接');
            disconnect.innerHTML = bluetoothDisconnectIcon;
            disconnect.onclick = disconnectNbBluetoothTimer;
            row.append(disconnect);
        }
        list.append(row);
    }
}

function openNbBluetoothTimerCard() {
    if (nbTimerSource() === 'timer') return;
    document.getElementById('nb-external-timer-card').hidden = false;
    renderNbBluetoothTimer();
}

function closeNbBluetoothTimerCard() {
    nbAndroidTimerScan?.abort();
    document.getElementById('nb-external-timer-card').hidden = true;
    document.getElementById('nb-external-timer-address').hidden = true;
    nbQiyiAddressDevice = null;
    if (nbBluetoothTimerLink && !nbBluetoothTimerLink.ready) disconnectNbBluetoothTimer();
}

function showNbBluetoothTimerAddress(device, address = '') {
    nbQiyiAddressDevice = device;
    const input = document.getElementById('nb-external-timer-mac');
    input.value = address;
    input.setCustomValidity('');
    document.getElementById('nb-external-timer-address').hidden = false;
    input.focus();
}

function submitNbBluetoothTimerAddress(event) {
    event.preventDefault();
    const device = nbQiyiAddressDevice;
    if (!device || nbTimerSource() !== 'adapter') return;
    const input = document.getElementById('nb-external-timer-mac');
    const address = input.value.trim();
    if (!nbBluetoothMacBytes(address)) {
        renderNbBluetoothTimer('蓝牙地址格式有误，请输入完整地址');
        input.focus();
        return;
    }
    disconnectNbBluetoothTimer();
    event.currentTarget.hidden = true;
    nbQiyiAddressDevice = null;
    void connectNbBluetoothTimer(device, 'adapter', address);
}

async function scanNbBluetoothTimer() {
    const source = nbTimerSource(), protocol = nbBluetoothTimers[source];
    if (!protocol) return;
    if (window.scanAndroidExternalTimer) {
        nbAndroidTimerScan?.abort();
        const controller = new AbortController();
        nbAndroidTimerScan = controller;
        renderNbBluetoothTimer('正在搜寻设备…');
        try {
            await window.scanAndroidExternalTimer(source, device => {
                if (controller.signal.aborted || nbBluetoothTimerDevices.get(device) === source) return;
                nbBluetoothTimerDevices.set(device, source);
                renderNbBluetoothTimer('请选择设备');
            }, controller.signal);
            if (!controller.signal.aborted) renderNbBluetoothTimer(
                [...nbBluetoothTimerDevices.values()].includes(source) ? '请选择设备' : '未找到设备');
        } catch (error) {
            if (!controller.signal.aborted) renderNbBluetoothTimer(error.message || '搜寻失败');
        } finally {
            if (nbAndroidTimerScan === controller) nbAndroidTimerScan = null;
        }
        return;
    }
    if (!navigator.bluetooth?.requestDevice) {
        renderNbBluetoothTimer('当前浏览器未提供蓝牙连接');
        return;
    }
    try {
        const filters = source === 'gan'
            ? ['GAN', 'Gan', 'gan'].map(namePrefix => ({namePrefix, services:[protocol.service]}))
            : [{namePrefix:'QY-Adapter'}];
        const device = await navigator.bluetooth.requestDevice({filters, optionalServices:[protocol.service],
            ...(source === 'adapter' && {optionalManufacturerData:[0x0504]})});
        if (source !== nbTimerSource() || !document.getElementById('timer-page').classList.contains('active') ||
            document.getElementById('nb-external-timer-card').hidden) return;
        if (source === 'adapter' && !/^QY-Adapter/i.test(device.name || '')) {
            renderNbBluetoothTimer('请选择奇艺蓝牙发射器');
            return;
        }
        if (source === 'gan' && !/^gan/i.test(device.name || '')) {
            renderNbBluetoothTimer('请选择 GAN 计时器');
            return;
        }
        nbBluetoothTimerDevices.set(device, source);
        await connectNbBluetoothTimer(device, source);
    } catch (error) {
        if (source === nbTimerSource()) renderNbBluetoothTimer(error.name === 'NotFoundError' ? '未选择设备' : (error.message || '搜寻失败'));
    }
}

function disconnectNbBluetoothTimer() {
    const link = nbBluetoothTimerLink;
    if (!link) return;
    nbBluetoothTimerLink = null;
    clearTimeout(link.connectTimeout);
    link.device.removeEventListener('gattserverdisconnected', link.disconnected);
    link.read?.removeEventListener('characteristicvaluechanged', link.notify);
    if (link.device.gatt.connected) link.device.gatt.disconnect();
    if (link.inspecting) resetInspection();
    document.getElementById('timer-display').classList.remove('waiting', 'ready');
    if (link.attempt && timerState === 'RUNNING') {
        timerState = 'IDLE';
        cancelAnimationFrame(requestAnimFrameId);
        const display = document.getElementById('timer-display');
        display.classList.remove('nb-status-text');
        display.textContent = formatNbTimerOutput(0);
    }
    renderNbBluetoothTimer();
}

async function connectNbBluetoothTimer(device, source, address = null) {
    if (source !== nbTimerSource() || nbBluetoothTimerLink?.device === device) return;
    disconnectNbBluetoothTimer();
    const protocol = nbBluetoothTimers[source];
    const link = {source, device, ready:false, attempt:null};
    nbBluetoothTimerLink = link;
    link.connectTimeout = setTimeout(() => {
        if (nbBluetoothTimerLink !== link || link.ready) return;
        // Preserve an active subscription for manual retry.
        if (!link.subscribed) disconnectNbBluetoothTimer();
        renderNbBluetoothTimer('未收到计时器响应，可重试或关闭');
        if (source === 'adapter') showNbBluetoothTimerAddress(device, link.mac);
    }, 9000);
    link.disconnected = () => { if (nbBluetoothTimerLink === link) disconnectNbBluetoothTimer(); };
    device.addEventListener('gattserverdisconnected', link.disconnected);
    renderNbBluetoothTimer('连接中…');
    try {
        const mac = source === 'adapter' ? nbBluetoothMacBytes(address) || await nbQiyiTimerMac(device) : null;
        if (nbBluetoothTimerLink !== link) return;
        if (source === 'adapter' && !mac) {
            disconnectNbBluetoothTimer();
            renderNbBluetoothTimer('未读到发射器广播地址，请填写完整蓝牙地址');
            showNbBluetoothTimerAddress(device);
            return;
        }
        if (mac) link.mac = [...mac].reverse().map(byte => byte.toString(16).padStart(2,'0')).join(':');
        if (nbBluetoothTimerLink !== link) return;
        const server = await device.gatt.connect();
        if (nbBluetoothTimerLink !== link) {
            if (nbBluetoothTimerLink?.device !== device) server.disconnect();
            return;
        }
        const service = await server.getPrimaryService(protocol.service);
        link.read = await service.getCharacteristic(protocol.read);
        const onState = (state, ms, stamp) => acceptNbBluetoothTimerState(link, state, ms, stamp);
        link.notify = source === 'adapter'
            ? await nbQiyiTimerNotifications(service, protocol, onState, link)
            : event => decodeNbGanTimer(event.target.value, (state, ms) => onState(state, ms, nbTimerInputStamp(event)));
        if (nbBluetoothTimerLink !== link) return;
        link.read.addEventListener('characteristicvaluechanged', link.notify);
        await link.read.startNotifications();
        if (nbBluetoothTimerLink !== link) return;
        if (mac) {
            await link.send(1, 0, 1, [0,0,0,0,0,33,8,0,1,5,90,...mac]);
        }
        if (nbBluetoothTimerLink !== link) return;
        link.subscribed = true;
        if (source === 'gan') {
            link.ready = true;
            clearTimeout(link.connectTimeout);
        }
        renderNbBluetoothTimer(link.ready ? undefined : '等待发射器计时数据');
        if (link.ready) closeNbBluetoothTimerCard();
    } catch (error) {
        if (nbBluetoothTimerLink !== link) return;
        disconnectNbBluetoothTimer();
        renderNbBluetoothTimer(error.message || '连接失败，请重试');
    }
}

function acceptNbBluetoothTimerState(link, state, ms, stamp = performance.now()) {
    if (nbBluetoothTimerLink !== link || nbTimerSource() !== link.source ||
        !document.getElementById('timer-page').classList.contains('active')) return;
    const display = document.getElementById('timer-display');
    const resultOpen = document.getElementById('post-solve-modal').style.display === 'flex';
    // GAN observation starts only on the shared two-pad contact event.
    if (link.source === 'gan' && (state === 'inspection' || (state === 'ready' && !link.inspecting))) return;
    if (['inspection', 'hands', 'ready', 'released'].includes(state)) {
        if (link.source === 'adapter') {
            if (timerState === 'IDLE' && !link.running && timerScrambleReady && !resultOpen) {
                display.classList.toggle('ready', state === 'ready');
            }
            return;
        }
        if (resultOpen || !timerScrambleReady || (timerState !== 'IDLE' && !link.inspecting)) return;
        if (!link.inspecting && state !== 'released') {
            beginInspection(stamp, true);
            link.inspecting = true;
        }
        if (link.inspecting) {
            if (state === 'hands') {
                timerState = 'WAITING_INSPECTION';
                setInspectionColor('inspection-holding');
            } else if (state === 'ready') {
                timerState = 'READY_INSPECTION';
                setInspectionColor('inspection-ready');
            } else if (state === 'released') {
                timerState = 'OBSERVING';
                setInspectionColor('inspecting');
            }
        }
        return;
    }
    display.classList.remove('waiting', 'ready');
    if (state === 'running' && !link.running) {
        link.running = true;
        if ((timerState !== 'IDLE' && !link.inspecting) || !timerScrambleReady || resultOpen) return;
        if (link.inspecting) timerState = 'READY_INSPECTION';
        link.inspecting = false;
        startTimer(stamp);
        link.attempt = {history:getTimerHistoryKey(), scramble:timerScrambleRequest};
    } else if (state === 'stopped' && Number.isInteger(ms) && ms > 0 && ms < 86400000) {
        link.running = false;
        const attempt = link.attempt;
        link.attempt = null;
        if (attempt && timerState === 'RUNNING') {
            if (attempt.history === getTimerHistoryKey() && attempt.scramble === timerScrambleRequest) stopTimer(performance.now(), ms, link.source);
            else resetNbBluetoothTimerDisplay();
        }
    } else if (state === 'reset') {
        link.running = false;
        if (link.inspecting) resetInspection();
        link.inspecting = false;
        if (link.attempt) resetNbBluetoothTimerDisplay();
        link.attempt = null;
    }
}

function resetNbBluetoothTimerDisplay() {
    timerState = 'IDLE';
    cancelAnimationFrame(requestAnimFrameId);
    const display = document.getElementById('timer-display');
    display.classList.remove('nb-status-text');
    display.textContent = formatNbTimerOutput(0);
}

function nbBluetoothTimerCrc(bytes, modbus) {
    let crc = 0xffff;
    for (const byte of bytes) {
        crc ^= modbus ? byte : byte << 8;
        for (let i = 0; i < 8; i++) {
            crc = modbus ? (crc >>> 1) ^ (crc & 1 ? 0xa001 : 0)
                : ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff;
        }
    }
    return crc;
}

function decodeNbGanTimer(data, onState) {
    if (data.byteLength < 6 || data.getUint8(0) !== 0xfe) return;
    const payload = new Uint8Array(data.buffer, data.byteOffset + 2, data.byteLength - 4);
    if (nbBluetoothTimerCrc(payload, false) !== data.getUint16(data.byteLength - 2, true)) return;
    const code = data.getUint8(3);
    if (code === 6) onState('hands');
    if (code === 1) onState('ready');
    if (code === 2) onState('released');
    if (code === 3) onState('running');
    if (code === 5) onState('reset');
    if (code === 4 && data.byteLength >= 10 && data.getUint8(5) < 60 && data.getUint16(6, true) < 1000) {
        onState('stopped', data.getUint8(4) * 60000 + data.getUint8(5) * 1000 + data.getUint16(6, true));
    }
}

function nbBluetoothMacBytes(address) {
    return /^(?:[a-f\d]{2}:){5}[a-f\d]{2}$/i.test(address || '')
        ? address.split(':').reverse().map(byte => parseInt(byte, 16)) : null;
}

async function nbQiyiTimerMac(device) {
    const saved = nbBluetoothMacBytes(localStorage.getItem('nbQiyiTimerMac:' + device.id));
    if (saved) return saved;
    if (device.nativeMac) return nbBluetoothMacBytes(device.nativeMac);
    if (device.watchAdvertisements) {
        const controller = new AbortController();
        let timeout, listener;
        try {
            const address = await new Promise(resolve => {
                listener = event => {
                    const data = event.manufacturerData?.get(0x0504);
                    if (data?.byteLength >= 6) resolve(Array.from({length:6}, (_, i) => data.getUint8(i)));
                };
                device.addEventListener('advertisementreceived', listener);
                timeout = setTimeout(resolve, 1400);
                Promise.resolve(device.watchAdvertisements({signal:controller.signal})).catch(() => resolve());
            });
            if (address) return address;
        } finally {
            clearTimeout(timeout);
            controller.abort();
            device.removeEventListener('advertisementreceived', listener);
        }
    }
    const suffix = /-([a-f\d]{2})([a-f\d]{2})$/i.exec(device.name || '');
    const fallback = suffix ? ['CC','A8','00','00', suffix[1], suffix[2]].join(':') : '';
    return nbBluetoothMacBytes(fallback);
}

async function nbQiyiTimerNotifications(service, protocol, onState, link) {
    const writer = await service.getCharacteristic(protocol.write);
    const cipher = await timerCubePacketCipher('00:00:00:00:00:00', Array(16).fill(0x77), Array(16).fill(0));
    let writes = Promise.resolve(), notifications = Promise.resolve();
    let frame = [], frameLength = 0, nextPart = 0;
    link.send = (sequence, ack, command, payload) => {
        const task = writes.then(async () => {
            const msg = new Uint8Array(14 + payload.length), view = new DataView(msg.buffer);
            view.setUint32(0, sequence);
            view.setUint32(4, ack);
            view.setUint16(8, command);
            view.setUint16(10, payload.length);
            msg.set(payload, 12);
            view.setUint16(msg.length - 2, nbBluetoothTimerCrc(msg.subarray(0,-2), true));
            for (let offset = 0; offset < msg.length && nbBluetoothTimerLink === link; offset += 16) {
                const block = new Uint8Array(16).fill(1);
                block.set(msg.subarray(offset, offset + 16));
                const prefix = offset ? [offset / 16] : [0,msg.length + 2,0x40,0];
                const bytes = new Uint8Array([...prefix,...await cipher.encode(block)]);
                await (writer.properties.write ? writer.writeValueWithResponse(bytes) : writer.writeValueWithoutResponse(bytes));
            }
        });
        writes = task.catch(() => {});
        return task;
    };
    return event => {
        const receivedAt = nbTimerInputStamp(event);
        const data = event.target.value;
        const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
        notifications = notifications.then(async () => {
            if (nbBluetoothTimerLink !== link || !bytes.length) return;
            const part = bytes[0], start = part ? 1 : 4;
            if (!part) {
                frame = [];
                nextPart = 0;
                frameLength = bytes[1] - 2;
            }
            if (part !== nextPart || frameLength < 14 || bytes.length <= start || (bytes.length - start) % 16) {
                nextPart = 0;
                frame = [];
                return;
            }
            for (let offset = start; offset < bytes.length; offset += 16) {
                frame.push(...await cipher.decode(bytes.subarray(offset, offset + 16)));
            }
            if (frame.length < frameLength) { nextPart++; return; }
            const msg = Uint8Array.from(frame.slice(0,frameLength)), view = new DataView(msg.buffer);
            nextPart = 0;
            frame = [];
            const length = view.getUint16(10);
            const end = length + 12;
            const command = view.getUint16(8);
            const valid = end + 2 <= msg.length &&
                nbBluetoothTimerCrc(msg.subarray(0,end),true) === view.getUint16(end);
            if (!valid || command !== 0x1003 || length < 5) return;
            if (!link.ready) {
                link.ready = true;
                clearTimeout(link.connectTimeout);
                try { localStorage.setItem('nbQiyiTimerMac:' + link.device.id, link.mac); } catch {}
                renderNbBluetoothTimer();
            }
            for (let i = 12; i + 4 < end;) {
                const id = msg[i], type = msg[i+1], size = view.getUint16(i+2);
                if (id === 1 && type === 1 && i + 16 <= end) {
                    onState('stopped', view.getUint32(i+8), receivedAt);
                    await link.send(view.getUint32(4) + 1, view.getUint32(0), 0x1003, [0]);
                } else if (id === 4 && type === 4) {
                    const state = msg[i+4];
                    if (state === 1) onState('inspection', undefined, receivedAt);
                    if (state === 2) onState('ready', undefined, receivedAt);
                    if (state === 3) onState('running', undefined, receivedAt);
                    if (state === 5 && i + 9 <= end) onState('stopped', view.getUint32(i+5), receivedAt);
                    if (state === 0) onState('reset', undefined, receivedAt);
                }
                i += 4 + size;
            }
        }).catch(error => {
            if (nbBluetoothTimerLink !== link) return;
            disconnectNbBluetoothTimer();
            openNbBluetoothTimerCard();
            renderNbBluetoothTimer(error.message || '蓝牙发射器同步失败');
        });
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const page = document.getElementById('timer-page');
    const display = document.getElementById('timer-display');
    new ResizeObserver(() => page.style.setProperty('--nb-external-offset', display.offsetHeight / 2 + 'px')).observe(display);
    new MutationObserver(syncNbBluetoothTimer).observe(page, {attributes:true, attributeFilter:['class']});
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !document.getElementById('nb-external-timer-card').hidden) closeNbBluetoothTimerCard();
    });
    syncNbBluetoothTimer();
});
