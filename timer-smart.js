// Smart-cube presentation and Bluetooth transport. Move decoding starts after device testing.
let currentTimerMode = 'wca';
let timerTempMode = 'wca';
let timerSmartEvent = '333';
let timerTempSmartEvent = '333';
let timerBluetoothDevice = null;
let timerBluetoothCandidates = [];

function cycleTimerCategory(direction){const modes=['wca','smart','other'];setTimerTempMode(modes[(modes.indexOf(timerTempMode)+direction+modes.length)%modes.length]);}
function setTimerTempMode(mode) {
    timerTempMode=['wca','smart','other'].includes(mode)?mode:'wca';
    renderTimerEventGrid();
}

function renderSmartTimerEventGrid() {
    const grid = document.getElementById('timer-event-grid');
    grid.innerHTML = '';
    for (const [maker, enabled, events] of [['魔域智能', true, ['333', '222']], ['GAN 智能', false, ['333', '222']], ['奇艺智能', false, ['333']]]) {
        const title = document.createElement('div');
        title.className = 'timer-smart-group-title';
        title.textContent = maker;
        grid.appendChild(title);
        for (const id of events) {
            const item = eventDict.find(event => event.id === id);
            const button = document.createElement('div');
            button.className = 'chal-event-item' + (enabled && timerTempSmartEvent === id ? ' active' : '') + (enabled ? '' : ' timer-smart-disabled');
            button.setAttribute('aria-disabled', enabled ? 'false' : 'true');
            button.innerHTML = `<span class="cubing-icon event-${id}" style="font-size:24px;display:block;margin-bottom:5px"></span><span style="font-size:12px;font-weight:600">${item.name}</span>`;
            if (enabled) button.onclick = () => { timerTempSmartEvent = id; renderTimerEventGrid(); };
            grid.appendChild(button);
        }
    }
}

function renderTimerModeChoice(){const select=document.getElementById('timer-category-select');if(select){select.dataset.value=timerTempMode;document.getElementById('timer-category-label').textContent={wca:'WCA',smart:'智能魔方',other:'其他'}[timerTempMode];}}

function renderTimerVirtualCube() {
    const order = timerSmartEvent === '222' ? 2 : 3;
    const root = document.getElementById('timer-virtual-cube');
    root.innerHTML = '';
    root.dataset.order = String(order);
    root.dataset.logo = uiSettings.smartCubeLogo === 'none' ? 'none' : 'puffpi';
    const body = document.createElement('div');
    body.className = 'timer-cube-body';
    for (const [face, color] of Object.entries({top:'#ffffff', bottom:'#f7da2d', front:'#29b85e', back:'#3174cf', left:'#f69335', right:'#e74745'})) {
        const side = document.createElement('div');
        side.className = `timer-cube-face ${face}`;
        side.style.gridTemplateColumns = `repeat(${order},1fr)`;
        side.style.setProperty('--sticker', color);
        for (let i = 0; i < order * order; i++) side.appendChild(document.createElement('span'));
        body.appendChild(side);
    }
    root.appendChild(body);
    root.setAttribute('aria-label', `虚拟${order}阶魔方，可拖动旋转`);
}

function applyTimerMode() {
    const smart = currentTimerMode === 'smart';
    const main = document.getElementById('timer-tab-main');
    main.classList.toggle('smart-cube-mode', smart);
    document.getElementById('timer-page').classList.toggle('smart-cube-page', smart);
    const eventId = smart ? timerSmartEvent : currentTimerEvent;
    const item = eventDict.find(event => event.id === eventId)||timerOtherEvents.find(e=>e.id===eventId);
    document.getElementById('timer-event-watermark').className = `cubing-icon event-${eventId}`;
    document.getElementById('timer-event-icon').className = `cubing-icon event-${eventId}`;
    document.getElementById('timer-bottom-event-icon').className = `cubing-icon event-${eventId}`;
    document.getElementById('timer-event-name').textContent = item?.name || '三阶';
    document.getElementById('timer-event-title').textContent = `${smart ? '魔域智能' : currentTimerMode==='other'?'其他':'WCA'} - ${getTimerRelayEvents(eventId)?'连拧 - ':''}${item?.name || '三阶'}`;
    document.getElementById('timer-relay-navigation').hidden=smart||!timerRelayScrambles.length||!getTimerRelayEvents(currentTimerEvent);
    const other=timerOtherEvents.find(e=>e.id===eventId);
    for(const id of ['timer-event-icon','timer-bottom-event-icon']){const icon=document.getElementById(id);icon.textContent=id==='timer-bottom-event-icon'&&other?.fullName?(eventId==='guildford'?'GC':'Mini GC'):other?other.icon:'';icon.hidden=id==='timer-event-icon'&&!!other?.fullName;if(other)icon.className=other.iconClass?'cubing-icon '+other.iconClass:'timer-other-event-icon';}
    if (smart) {
        renderTimerVirtualCube();
        updateTimerBluetoothStatus(Boolean(timerBluetoothDevice?.gatt?.connected));
    } else {
        closeTimerBluetoothCard();
    }
}

function installTimerCubeRotation() {
    const cube = document.getElementById('timer-virtual-cube');
    let pointer = null;
    let lastX = 0;
    let lastY = 0;
    let angleX = -25;
    let angleY = -32;
    const draw = () => {
        cube.style.setProperty('--cube-x', `${angleX}deg`);
        cube.style.setProperty('--cube-y', `${angleY}deg`);
    };
    cube.addEventListener('pointerdown', event => {
        if (event.pointerType === 'touch') return;
        pointer = event.pointerId;
        lastX = event.clientX;
        lastY = event.clientY;
        cube.setPointerCapture(pointer);
        cube.classList.add('rotating');
    });
    cube.addEventListener('pointermove', event => {
        if (event.pointerType === 'touch') return;
        if (event.pointerId !== pointer) return;
        angleY += (event.clientX - lastX) * .65;
        angleX -= (event.clientY - lastY) * .65;
        lastX = event.clientX;
        lastY = event.clientY;
        draw();
    });
    const stop = event => {
        if (event.pointerId !== pointer) return;
        pointer = null;
        cube.classList.remove('rotating');
    };
    cube.addEventListener('pointerup', stop);
    cube.addEventListener('pointercancel', stop);
    cube.addEventListener('lostpointercapture', stop);
    let activeTouch = null;
    cube.addEventListener('touchstart', event => {
        if (activeTouch !== null) return;
        const touch = event.changedTouches[0];
        if (!touch) return;
        activeTouch = touch.identifier;
        lastX = touch.clientX;
        lastY = touch.clientY;
        cube.classList.add('rotating');
        if (event.cancelable) event.preventDefault();
    }, {passive: false});
    cube.addEventListener('touchmove', event => {
        if (activeTouch === null) return;
        const touch = Array.from(event.changedTouches).find(item => item.identifier === activeTouch);
        if (!touch) return;
        angleY += (touch.clientX - lastX) * .65;
        angleX -= (touch.clientY - lastY) * .65;
        lastX = touch.clientX;
        lastY = touch.clientY;
        draw();
        if (event.cancelable) event.preventDefault();
    }, {passive: false});
    const stopTouch = event => {
        if (activeTouch === null) return;
        if (!Array.from(event.changedTouches).some(item => item.identifier === activeTouch)) return;
        activeTouch = null;
        cube.classList.remove('rotating');
    };
    cube.addEventListener('touchend', stopTouch);
    cube.addEventListener('touchcancel', stopTouch);
    cube.addEventListener('keydown', event => {
        const turns = {ArrowLeft:[0,-15], ArrowRight:[0,15], ArrowUp:[-15,0], ArrowDown:[15,0]};
        if (!turns[event.key]) return;
        event.preventDefault();
        angleX += turns[event.key][0];
        angleY += turns[event.key][1];
        draw();
    });
    draw();
}

function updateTimerBluetoothStatus(connected) {
    const status = document.getElementById('timer-bluetooth-status');
    status.classList.toggle('connected', connected);
    document.getElementById('timer-bluetooth-label').textContent = connected ? '已连接' : '未连接';
    document.getElementById('timer-bluetooth-icon').classList.toggle('disconnected', !connected);
    document.getElementById('timer-virtual-cube').setAttribute('aria-label', `虚拟${timerSmartEvent === '222' ? 2 : 3}阶魔方，${connected ? '已连接' : '未连接'}，可拖动旋转`);
}

function closeTimerBluetoothCard() {
    document.getElementById('timer-bluetooth-card').hidden = true;
}

function renderTimerBluetoothCandidates() {
    const list = document.getElementById('timer-bluetooth-devices');
    list.innerHTML = '';
    for (const device of timerBluetoothCandidates) {
        const row = document.createElement('button');
        row.type = 'button';
        row.textContent = device.name || `智能魔方 ${device.id.slice(0, 6)}`;
        row.onclick = () => connectTimerBluetoothDevice(device);
        list.appendChild(row);
    }
}

function openTimerBluetoothCard() {
    if (currentTimerMode !== 'smart') return;
    const card = document.getElementById('timer-bluetooth-card');
    card.hidden = false;
    document.getElementById('timer-bluetooth-card-title').textContent = timerBluetoothDevice?.gatt?.connected ? '已连接' : '搜寻中...';
    renderTimerBluetoothCandidates();
    if (!timerBluetoothDevice?.gatt?.connected) scanTimerBluetooth();
}

function scanTimerBluetooth() {
    const title = document.getElementById('timer-bluetooth-card-title');
    if (!navigator.bluetooth?.requestDevice) {
        title.textContent = '当前浏览器不支持蓝牙连接';
        return;
    }
    title.textContent = '搜寻中...';
    // The browser's native chooser performs discovery. Web Bluetooth does not expose
    // an arbitrary nearby-device list to a website before the user grants access.
    navigator.bluetooth.requestDevice({acceptAllDevices:true}).then(device => {
        if (!timerBluetoothCandidates.some(candidate => candidate.id === device.id)) timerBluetoothCandidates.push(device);
        renderTimerBluetoothCandidates();
        title.textContent = '请选择智能魔方';
    }).catch(error => {
        title.textContent = error.name === 'NotFoundError' ? '未选择设备' : '搜寻失败，请重试';
    });
}

async function connectTimerBluetoothDevice(device) {
    const title = document.getElementById('timer-bluetooth-card-title');
    title.textContent = '连接中...';
    try {
        if (timerBluetoothDevice && timerBluetoothDevice !== device && timerBluetoothDevice.gatt?.connected) timerBluetoothDevice.gatt.disconnect();
        await device.gatt.connect();
        timerBluetoothDevice = device;
        device.addEventListener('gattserverdisconnected', () => {
            if (timerBluetoothDevice === device) {
                timerBluetoothDevice = null;
                updateTimerBluetoothStatus(false);
                title.textContent = '连接已断开';
            }
        }, {once:true});
        updateTimerBluetoothStatus(true);
        title.textContent = '已连接';
    } catch (error) {
        updateTimerBluetoothStatus(false);
        title.textContent = '连接失败，请重试';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    installTimerCubeRotation();
});
