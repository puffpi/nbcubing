// Smart-cube presentation and Bluetooth transport. Move decoding starts after device testing.
let currentTimerMode = 'wca';
let timerTempMode = 'wca';
let timerSmartEvent = '333';
let timerTempSmartEvent = '333';
let timerBluetoothDevice = null;
let timerBluetoothCandidates = [];
let timerMoyuSession = null;
let timerBluetoothConnecting = false;
let timerBluetoothIdleTimer=null;
const timerCubeBattery={level:null,deviceId:null,pending:0,shown:0,noticeTimer:null,showTimer:null};
function closeTimerBatteryNotice(){
    clearTimeout(timerCubeBattery.noticeTimer);clearTimeout(timerCubeBattery.showTimer);
    timerCubeBattery.noticeTimer=null;timerCubeBattery.showTimer=null;
    const card=document.getElementById('timer-battery-notice');if(card)card.hidden=true;
}
function resetTimerCubeBattery(device){
    closeTimerBatteryNotice();Object.assign(timerCubeBattery,{level:null,deviceId:device?.id||device?.name||null,pending:0,shown:0});
}
function renderTimerCubeBattery(connected=Boolean(timerBluetoothDevice?.gatt?.connected)){
    const icon=document.getElementById('timer-bluetooth-icon'),battery=document.getElementById('timer-cube-battery'),status=document.getElementById('timer-bluetooth-status');
    if(!icon||!battery)return;
    const known=connected&&timerCubeBattery.level!==null;
    icon.classList.toggle('has-battery',known);battery.hidden=!known;
    status?.classList.toggle('has-battery',known);status?.setAttribute('data-power',known?(timerCubeBattery.level<=10?'critical':timerCubeBattery.level<=20?'warning':'normal'):'unknown');
    if(known){const value=timerCubeBattery.level,percent=battery.querySelector?.('.timer-battery-percent');if(percent)percent.textContent=String(value);battery.style?.setProperty('--battery-level',value+'%');battery.classList.toggle('low',value<=20);battery.setAttribute('data-power',value<=10?'critical':value<=20?'warning':'normal');}
    document.getElementById('timer-bluetooth-status')?.setAttribute('aria-label',connected?(known?`已连接，魔方剩余电量 ${timerCubeBattery.level}%`:'已连接，打开蓝牙设备'): '未连接，打开蓝牙设备');
}
function scheduleTimerBatteryNotice(){
    if(!timerCubeBattery.pending||timerCubeBattery.showTimer!==null||timerCubeBattery.pending<=timerCubeBattery.shown)return;
    if(!timerSmartContextActive()||timerSmartAttempt.phase!=='RESULT'||document.getElementById('timer-smart-result')?.hidden!==false)return;
    // Let the result card finish appearing before showing the non-blocking reminder.
    timerCubeBattery.showTimer=setTimeout(()=>{
        timerCubeBattery.showTimer=null;
        if(!timerSmartContextActive()||timerSmartAttempt.phase!=='RESULT'||document.getElementById('timer-smart-result')?.hidden!==false)return;
        const notice=document.getElementById('timer-battery-notice');if(!notice)return;
        const severity=timerCubeBattery.pending;if(!severity||severity<=timerCubeBattery.shown)return;
        document.getElementById('timer-battery-notice-text').textContent=severity===2?'电量不足，请充电':'电量偏低，请及时充电';
        timerCubeBattery.shown=severity;notice.hidden=false;clearTimeout(timerCubeBattery.noticeTimer);timerCubeBattery.noticeTimer=setTimeout(closeTimerBatteryNotice,3000);
    },160);
}
function acceptTimerCubeBattery(level){
    if(!Number.isInteger(level)||level<0||level>100)return false;
    timerCubeBattery.level=level;
    if(level>=20){timerCubeBattery.pending=0;timerCubeBattery.shown=0;closeTimerBatteryNotice();}
    else timerCubeBattery.pending=Math.max(timerCubeBattery.pending,level===0?2:1);
    renderTimerCubeBattery();scheduleTimerBatteryNotice();return true;
}
function handleTimerCubeBatteryDisconnect(){
    // Loss of signal alone does not establish an empty battery. Only escalate a known low reading.
    if(timerCubeBattery.level!==null&&timerCubeBattery.level<20)timerCubeBattery.pending=2;
    scheduleTimerBatteryNotice();
}
const timerBluetoothIdleOptions=[[0,'切换界面自动断开'],[3,'3 分钟'],[5,'5 分钟'],[10,'10 分钟'],[-1,'保持连接']];
function timerBluetoothIdleMinutes(){const value=Number(uiSettings.bluetoothAutoDisconnect??5);return timerBluetoothIdleOptions.some(([n])=>n===value)?value:5;}
function updateTimerBluetoothIdleLabel(){const label=document.getElementById('timer-bluetooth-idle-label');if(label)label.textContent=timerBluetoothIdleOptions.find(([n])=>n===timerBluetoothIdleMinutes())[1];}
function timerSmartContextActive(){return currentTimerMode==='smart'&&timerSmartEvent==='333'&&document.getElementById('timer-page')?.classList.contains?.('active');}
function disconnectTimerBluetooth(){
    if(timerBluetoothIdleTimer!==null)clearTimeout(timerBluetoothIdleTimer);timerBluetoothIdleTimer=null;
    const device=timerBluetoothDevice;timerBluetoothDevice=null;stopTimerMoyu();if(device?.gatt?.connected)device.gatt.disconnect();
    updateTimerBluetoothStatus(false);document.getElementById('timer-bluetooth-card-title').textContent='连接已断开';renderTimerBluetoothCandidates();
}
function updateTimerBluetoothContext(){
    const active=timerSmartContextActive();
    if(!active&&timerSmartAnalysis.open)closeTimerSmartAnalysis();
    if(!active&&timerSmartAttempt.phase!=='IDLE')cancelTimerSmartAttempt();
    if(active||!timerBluetoothDevice?.gatt?.connected){if(timerBluetoothIdleTimer!==null)clearTimeout(timerBluetoothIdleTimer);timerBluetoothIdleTimer=null;return;}
    const minutes=timerBluetoothIdleMinutes();if(minutes===-1)return;if(minutes===0){disconnectTimerBluetooth();return;}
    if(timerBluetoothIdleTimer===null)timerBluetoothIdleTimer=setTimeout(()=>{timerBluetoothIdleTimer=null;if(!timerSmartContextActive())disconnectTimerBluetooth();},minutes*60000);
}
function openTimerBluetoothIdleModal(){
    document.getElementById('nb-timing-modal-title').textContent='蓝牙自动断开';const list=document.getElementById('nb-timing-options');list.replaceChildren();
    for(const [value,label]of timerBluetoothIdleOptions){const button=document.createElement('button');button.type='button';button.className='chal-event-item'+(value===timerBluetoothIdleMinutes()?' active':'');button.style.cssText='padding:14px 15px;text-align:center;cursor:pointer;border:0';button.textContent=label;button.onclick=()=>{uiSettings.bluetoothAutoDisconnect=value;queueTimerOptionSave();updateTimerBluetoothIdleLabel();if(timerBluetoothIdleTimer!==null)clearTimeout(timerBluetoothIdleTimer);timerBluetoothIdleTimer=null;updateTimerBluetoothContext();closeNbTimingModal();};list.append(button);}
    const modal=document.getElementById('nb-timing-modal');if(modal.parentElement!==document.body)document.body.append(modal);modal.classList.add('timer-setting-overlay');modal.style.display='flex';
}
const timerMoyuAddresses = new Map();
let timerMoyuCleanup = Promise.resolve();
const timerMoyuDiagnostic = {stage:'未开始',addressSource:'未读取',advertisements:0,packets:0,lengths:[],types:[],error:''};
function timerMoyuStage(stage){timerMoyuDiagnostic.stage=stage;}
function timerSmartClockNow(){
    const session=timerMoyuSession;
    if(session?.active&&Number.isFinite(session.lastMoveStamp)&&Number.isFinite(session.lastPacketReceivedAt))return session.lastMoveStamp+Math.max(0,performance.now()-session.lastPacketReceivedAt);
    return performance.now();
}
function resetTimerMoyuClock(session){session.lastMoveStamp=null;session.lastPacketReceivedAt=null;}
function timerMoyuNotificationStamp(event){
    if(typeof nbTimerInputStamp==='function')return nbTimerInputStamp(event);
    const now=performance.now();let stamp=event?.timeStamp;
    if(stamp>1e12)stamp-=performance.timeOrigin;
    return Number.isFinite(stamp)&&stamp>=0&&stamp<=now?stamp:now;
}
function timerMoyuMoveStamps(session,intervals,receivedAt){
    // MY32 reports a 16-bit millisecond interval for each move, newest first.
    // Keep that device timeline across notifications: receive/decrypt jitter
    // must not become solve time. Only the first packet needs a local anchor.
    if(Number.isFinite(session.lastPacketReceivedAt)&&receivedAt-session.lastPacketReceivedAt>65535){
        // A silent gap beyond the interval range cannot distinguish an on-cube
        // counter wrap from a long pause. Do not save an unverifiable solve.
        if(['INSPECTION','SOLVING'].includes(timerSmartAttempt.phase)){
            cancelTimerSmartAttempt();
            document.getElementById('timer-bluetooth-card-title').textContent='转动间隔过长，请重新开始本次还原';
        }
        resetTimerMoyuClock(session);
    }
    let stamp=Number.isFinite(session.lastMoveStamp)?session.lastMoveStamp:receivedAt-intervals.slice(0,-1).reduce((sum,n)=>sum+n,0)-intervals.at(-1);
    const stamps=[];
    for(let i=intervals.length-1;i>=0;i--){stamp+=intervals[i];stamps.push(stamp);}
    session.lastMoveStamp=stamp;session.lastPacketReceivedAt=receivedAt;
    return stamps;
}
function timerMoyuManufacturerIds(){
    const ids=Array.from({length:255},(_,i)=>(i+1)<<8);
    const oldChrome=navigator.userAgentData?.brands?.some(b=>['Google Chrome','Chromium'].includes(b.brand)&&parseInt(b.version,10)<130);
    if(!oldChrome)ids.unshift(0);return ids;
}
async function timerMoyuAdvertisementMac(device){
    if(timerMoyuAddresses.get(device.id))return timerMoyuAddresses.get(device.id);
    if(typeof device.watchAdvertisements!=='function'){timerMoyuDiagnostic.advertising='浏览器未提供广播读取接口';return null;}
    timerMoyuStage('自动读取设备广播');
    const controller=new AbortController();let timer,listener;
    try{return await new Promise(resolve=>{
        const finish=mac=>resolve(mac);
        listener=event=>{timerMoyuDiagnostic.advertisements++;for(const [id,data]of event.manufacturerData||[]){if(!timerMoyuManufacturerIds().includes(id)||data.byteLength<6)continue;
            const mac=Array.from({length:6},(_,i)=>data.getUint8(data.byteLength-1-i).toString(16).padStart(2,'0')).join(':').toUpperCase();
            timerMoyuAddresses.set(device.id,mac);timerMoyuDiagnostic.addressSource='设备广播';finish(mac);break;}};
        device.addEventListener('advertisementreceived',listener);
        timer=setTimeout(()=>{timerMoyuDiagnostic.advertising='等待广播超时';finish(null);},4500);
        Promise.resolve(device.watchAdvertisements({signal:controller.signal})).catch(error=>{timerMoyuDiagnostic.advertising=error.name+': '+error.message;finish(null);});
    });}catch{return null;}finally{clearTimeout(timer);controller.abort();if(listener)device.removeEventListener('advertisementreceived',listener);}
}
const timerLiveCube = {state:null,queue:[],running:false,epoch:0};
const timerCubeGyro={reference:null,frames:0};
const timerCubeView={x:-25,y:-32};
function timerQuaternionProduct(a,b){return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];}
function timerMoyuGyro(data){
    // MY32 0xAB: signed little-endian Q30 values in (w,x,-z,y) order.
    if(data.length!==20||data[0]!==171)return false;
    const view=new DataView(data.buffer,data.byteOffset,data.byteLength),scale=2**30;
    let q=[view.getInt32(5,true)/scale,view.getInt32(13,true)/scale,-view.getInt32(9,true)/scale,view.getInt32(1,true)/scale];
    const length=Math.hypot(...q);if(!Number.isFinite(length)||length<.75||length>1.25)return false;q=q.map(v=>v/length);
    timerCubeGyro.last=q;
    if(!timerCubeGyro.reference)timerCubeGyro.reference=q;
    const base=timerCubeGyro.reference,relative=timerQuaternionProduct([-base[0],-base[1],-base[2],base[3]],q);
    // Physical Y points up; CSS Y points down. Reflect the quaternion's axial part.
    const [x,y,z,w]=[-relative[0],relative[1],-relative[2],relative[3]];
    const matrix=[1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w),0,2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w),0,2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y),0,0,0,0,1];
    document.getElementById('timer-virtual-cube')?.style?.setProperty('--cube-gyro-transform',`matrix3d(${matrix.join(',')})`);
    timerCubeGyro.frames++;timerMoyuDiagnostic.gyro='已收到姿态数据';return true;
}
function resetTimerCubeGyro(){timerCubeGyro.reference=null;timerCubeGyro.last=null;timerCubeGyro.frames=0;document.getElementById('timer-virtual-cube')?.style?.removeProperty('--cube-gyro-transform');}
function timerLiveContactCap(axis,offset){
    const cap=document.createElement('div');cap.className='timer-live-contact';
    const orientation=axis[0]?'rotateY(90deg)':axis[1]?'rotateX(90deg)':'';
    cap.style.transform=`translate3d(calc(var(--cube-side) / 3 * ${axis[0]*offset}),calc(var(--cube-side) / 3 * ${-axis[1]*offset}),calc(var(--cube-side) / 3 * ${axis[2]*offset})) ${orientation}`;
    return cap;
}

// MY32 wire-format constants: documented in csTimer's moyu32cube.js.
// Transport, WebCrypto block adapter and sticker renderer below are implemented here.
function timerCubeSlots(){
    const slots=[];
    for(const face of 'URFDLB')for(let row=0;row<3;row++)for(let col=0;col<3;col++){
        const a=col-1,b=1-row;
        const p={U:[a,1,row-1],R:[1,b,1-col],F:[a,b,1],D:[a,-1,1-row],L:[-1,b,a],B:[1-col,b,-1]}[face];
        const n={U:[0,1,0],R:[1,0,0],F:[0,0,1],D:[0,-1,0],L:[-1,0,0],B:[0,0,-1]}[face];
        slots.push({face,p,n});
    }
    return slots;
}
function timerCubeTurn(state,move){
    const slots=timerCubeSlots(),axis=slots.find(s=>s.face===move[0]).n;
    const sign=move.endsWith("'")?1:-1;
    const rotate=v=>{const d=v.reduce((sum,x,i)=>sum+x*axis[i],0);const c=[axis[1]*v[2]-axis[2]*v[1],axis[2]*v[0]-axis[0]*v[2],axis[0]*v[1]-axis[1]*v[0]];return v.map((x,i)=>axis[i]*d+c[i]*sign);};
    const next=state.split('');
    slots.forEach((s,i)=>{if(s.p.reduce((d,x,k)=>d+x*axis[k],0)!==1)return;const p=rotate(s.p),n=rotate(s.n);const j=slots.findIndex(t=>t.p.every((x,k)=>x===p[k])&&t.n.every((x,k)=>x===n[k]));next[j]=state[i];});
    return next.join('');
}
function renderTimerLiveCube(){
    if(!timerLiveCube.state||timerSmartEvent!=='333')return;
    const body=document.querySelector('#timer-virtual-cube .timer-cube-body');if(!body)return;
    body.replaceChildren();
    const colors={U:'#ffffff',R:'#e74745',F:'#29b85e',D:'#f7da2d',L:'#f69335',B:'#3174cf'};
    const rotations={U:'rotateX(90deg)',D:'rotateX(-90deg)',R:'rotateY(90deg)',L:'rotateY(-90deg)',F:'',B:'rotateY(180deg)'};
    timerCubeSlots().forEach((s,i)=>{const tile=document.createElement('div');tile.className='timer-live-sticker';tile.dataset.index=i;tile.dataset.cell=String(i%9);
        const position=s.p.map((x,k)=>(x+s.n[k]*.5)*(k===1?-1:1));
        tile.style.transform=`translate3d(calc(var(--cube-side) / 3 * ${position[0]}),calc(var(--cube-side) / 3 * ${position[1]}),calc(var(--cube-side) / 3 * ${position[2]})) ${rotations[s.face]}`;
        tile.style.setProperty('--sticker',colors[timerLiveCube.state[i]]);
        if(s.face==='U'&&i===4)tile.classList.add('timer-live-logo');body.append(tile);
    });
}
function setTimerLiveState(state){
    if(!/^[URFDLB]{54}$/.test(state)||[...'URFDLB'].some(face=>[...state].filter(c=>c===face).length!==9))throw Error('魔方状态数据无效');
    timerLiveCube.epoch++;timerLiveCube.state=state;timerLiveCube.queue=[];timerLiveCube.running=false;renderTimerLiveCube();
}
async function animateTimerLiveMoves(){
    if(timerLiveCube.running)return;timerLiveCube.running=true;const epoch=timerLiveCube.epoch;
    while(timerLiveCube.queue.length&&epoch===timerLiveCube.epoch){
        const move=timerLiveCube.queue.shift(),slots=timerCubeSlots(),axis=slots.find(s=>s.face===move[0]).n;
        const body=document.querySelector('#timer-virtual-cube .timer-cube-body');
        if(body&&currentTimerMode==='smart'&&timerSmartEvent==='333'){
            const group=document.createElement('div');group.className='timer-live-layer';body.append(group);
            body.append(timerLiveContactCap(axis,.49));group.append(timerLiveContactCap(axis,.51));
            [...body.querySelectorAll('.timer-live-sticker')].forEach(tile=>{const s=slots[Number(tile.dataset.index)];if(s.p.reduce((d,x,k)=>d+x*axis[k],0)===1)group.append(tile);});
            if(group.animate)await group.animate([{transform:'rotate3d(1,0,0,0deg)'},{transform:`rotate3d(${axis[0]},${-axis[1]},${axis[2]},${move.endsWith("'")?-90:90}deg)`}],{duration:timerLiveCube.queue.length>3?75:120,easing:'ease-out'}).finished.catch(()=>{});
        }
        if(epoch!==timerLiveCube.epoch)return;
        timerLiveCube.state=timerCubeTurn(timerLiveCube.state,move);renderTimerLiveCube();
    }
    if(epoch===timerLiveCube.epoch)timerLiveCube.running=false;
}
function queueTimerLiveMove(move){timerLiveCube.queue.push(move);void animateTimerLiveMoves();}

async function timerMoyuCipher(mac){
    const bytes=mac.split(':').map(v=>parseInt(v,16)).reverse();
    const baseKey=[21,119,58,92,103,14,45,31,23,103,42,19,155,103,82,87];
    const baseIv=[17,35,38,37,134,42,44,59,85,6,127,49,126,103,33,87];
    for(let i=0;i<6;i++){baseKey[i]=(baseKey[i]+bytes[i])%255;baseIv[i]=(baseIv[i]+bytes[i])%255;}
    const key=await crypto.subtle.importKey('raw',new Uint8Array(baseKey),'AES-CBC',false,['encrypt','decrypt']);
    const zero=new Uint8Array(16),iv=new Uint8Array(baseIv);
    // WebCrypto handles PKCS#7. Append a valid encrypted padding block to decrypt
    // one raw AES block without introducing a second crypto implementation.
    async function block(data,decrypt){
        if(!decrypt)return new Uint8Array(await crypto.subtle.encrypt({name:'AES-CBC',iv:zero},key,data)).slice(0,16);
        const pad=new Uint8Array(await crypto.subtle.encrypt({name:'AES-CBC',iv:data},key,new Uint8Array(0)));
        const joined=new Uint8Array(32);joined.set(data);joined.set(pad,16);
        return new Uint8Array(await crypto.subtle.decrypt({name:'AES-CBC',iv:zero},key,joined));
    }
    async function transform(value,decrypt){
        const result=new Uint8Array(value);if(result.length!==20)throw Error('MY32 数据长度不符');
        const part=async offset=>{let data=result.slice(offset,offset+16);if(!decrypt)data=data.map((x,i)=>x^iv[i]);data=await block(data,decrypt);if(decrypt)data=data.map((x,i)=>x^iv[i]);result.set(data,offset);};
        if(decrypt){await part(4);await part(0);}else{await part(0);await part(4);}return result;
    }
    return {encode:v=>transform(v,false),decode:v=>transform(v,true)};
}
async function startTimerMoyu(device){
    if(!/^WCU_MY32_[0-9A-F]{4}$/i.test(device.name||''))throw Error('当前转动同步仅适配 MY32 三阶');
    if(timerSmartEvent!=='333')throw Error('这只设备是三阶，请先选择智能三阶');
    let mac=`CF:30:16:00:${device.name.slice(-4,-2)}:${device.name.slice(-2)}`;
    const remembered=localStorage.getItem('moyu-mac-'+device.name);if(remembered&&/^([\da-f]{2}:){5}[\da-f]{2}$/i.test(remembered))mac=remembered;
    timerMoyuDiagnostic.addressSource=remembered?'已保存地址':'设备名称推算';
    const advertised=timerMoyuAddresses.get(device.id);if(advertised){mac=advertised;timerMoyuDiagnostic.addressSource='设备广播';}
    timerMoyuStage('读取蓝牙服务');
    const cipher=await timerMoyuCipher(mac),server=device.gatt.connected?device.gatt:await device.gatt.connect();
    const service=await server.getPrimaryService('0783b03e-7735-b5a0-1760-a305d2795cb0');
    const read=await service.getCharacteristic('0783b03e-7735-b5a0-1760-a305d2795cb1'),write=await service.getCharacteristic('0783b03e-7735-b5a0-1760-a305d2795cb2');
    let resolveInitial,rejectInitial;const initial=new Promise((resolve,reject)=>{resolveInitial=resolve;rejectInitial=reject;});
    initial.catch(()=>{});
    const session={read,write,cipher,count:null,active:true,chain:Promise.resolve(),ready:false};timerMoyuSession=session;
    session.writeChain=Promise.resolve();
    const send=(opcode,gyroEnabled)=>{const task=session.writeChain.then(async()=>{if(!session.active)return;const request=new Uint8Array(20);request[0]=opcode;if(gyroEnabled!==undefined)request[2]=gyroEnabled?1:0;const data=await cipher.encode(request);if(!session.active)return;if(write.properties.write)await write.writeValueWithResponse(data);else await write.writeValueWithoutResponse(data);});session.writeChain=task.catch(()=>{});return task;};
    session.send=send;
    session.listener=event=>{const receivedAt=timerMoyuNotificationStamp(event),value=event.target.value,raw=new Uint8Array(value.buffer,value.byteOffset,value.byteLength).slice();
        session.chain=session.chain.then(async()=>{if(!session.active)return;timerMoyuDiagnostic.packets++;if(!timerMoyuDiagnostic.lengths.includes(raw.length))timerMoyuDiagnostic.lengths.push(raw.length);const data=await cipher.decode(raw);if(!session.active)return;
            if(!timerMoyuDiagnostic.types.includes(data[0]))timerMoyuDiagnostic.types.push(data[0]);
            const bits=[...data].map(v=>v.toString(2).padStart(8,'0')).join(''),number=(offset,len)=>parseInt(bits.slice(offset,offset+len),2);
            if(data[0]===163){let state='';for(const face of [2,5,0,3,4,1])for(let j=0;j<8;j++){const color=number(8+face*24+j*3,3);if(color>5)throw Error('无法解码魔方状态');state+='FBUDLR'[color];if(j===3)state+='FBUDLR'[face];}setTimerLiveState(state);timerSmartPhysicalState=state;session.count=data[19];resetTimerMoyuClock(session);session.ready=true;resolveInitial();}
            else if(data[0]===165&&session.count!==null){const count=data[11],diff=(count-session.count)&255;if(!diff)return;if(diff>5){cancelTimerSmartAttempt();session.count=null;resetTimerMoyuClock(session);await send(163);return;}const moves=[],intervals=[];for(let i=diff-1;i>=0;i--){const code=number(96+i*5,5);if(code>=12)throw Error('转动数据无效');moves.push('FBUDLR'[code>>1]+(code&1?"'":''));}for(let i=0;i<diff;i++)intervals.push(number(8+i*16,16));session.count=count;const stamps=timerMoyuMoveStamps(session,intervals,receivedAt);for(let index=0;index<moves.length;index++){timerSmartPhysicalState=timerCubeTurn(timerSmartPhysicalState,moves[index]);handleTimerSmartMove(moves[index],stamps[index]);queueTimerLiveMove(moves[index]);}}
            else if(data[0]===171){if(!timerMoyuGyro(data))timerMoyuDiagnostic.gyro='姿态数据无效，保留普通转动';}
            else if(data[0]===164&&data.length===20){if(acceptTimerCubeBattery(data[1]))timerMoyuDiagnostic.battery=data[1]+'%';}
        }).catch(error=>{if(!session.active)return;rejectInitial(error);if(session.ready){stopTimerMoyu();updateTimerBluetoothStatus(Boolean(device.gatt?.connected));document.getElementById('timer-bluetooth-label').textContent=device.gatt?.connected?'已连接，转动未同步':'未连接';document.getElementById('timer-bluetooth-card').hidden=false;}document.getElementById('timer-bluetooth-card-title').textContent='数据同步失败，请重新连接';console.warn('MY32 同步失败',error);});};
    read.addEventListener('characteristicvaluechanged',session.listener);
    const timeout=setTimeout(()=>rejectInitial(Error(timerMoyuDiagnostic.packets?'收到了数据，但未取得有效魔方状态':'未收到魔方通知数据')),8000);
    let retry;
    try{
        timerMoyuStage('订阅转动通知');await read.startNotifications();
        timerMoyuStage('请求设备信息');await send(161);
        timerMoyuStage('请求魔方状态');await send(163);
        retry=setInterval(()=>{if(session.active&&!session.ready)send(163).catch(rejectInitial);},1800);
        await initial;timerMoyuStage('转动同步成功');
        // MY32 0xA4 reports battery percentage in byte 1, on the same encrypted transport.
        const requestBattery=()=>{if(session.active)void send(164).catch(()=>{timerMoyuDiagnostic.battery='电量读取暂不可用';});};
        requestBattery();session.batteryTimer=setInterval(()=>{if(!['SOLVING','INSPECTION'].includes(timerSmartAttempt.phase))requestBattery();},60000);
        // Optional probe only after move synchronization succeeds. Unsupported
        // gyro hardware must never turn a working connection into a failure.
        timerMoyuDiagnostic.gyro='等待可选陀螺仪数据';
        void send(172,true).catch(()=>{timerMoyuDiagnostic.gyro='陀螺仪请求不支持，保留普通转动';});
    }finally{clearTimeout(timeout);clearInterval(retry);}
}
function stopTimerMoyu(preserveResult=false){
    const session=timerMoyuSession;timerMoyuSession=null;if(session){session.active=false;clearInterval(session.batteryTimer);session.read.removeEventListener('characteristicvaluechanged',session.listener);timerMoyuCleanup=timerMoyuCleanup.then(()=>session.read.stopNotifications()).catch(()=>{});}
    timerLiveCube.epoch++;timerLiveCube.queue=[];timerLiveCube.running=false;
    resetTimerCubeGyro();
    if(!preserveResult||timerSmartAttempt.phase!=='RESULT')cancelTimerSmartAttempt();
    return timerMoyuCleanup;
}

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
    if(order===3)renderTimerLiveCube();
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
    document.getElementById('timer-event-name').textContent = (smart ? '智能' : '') + (item?.name || '三阶');
    document.getElementById('timer-event-title').textContent = `${smart ? '魔域智能' : currentTimerMode==='other'?'其他':'WCA'} - ${getTimerRelayEvents(eventId)?'连拧 - ':''}${item?.name || '三阶'}`;
    document.getElementById('timer-relay-navigation').hidden=smart||!timerRelayScrambles.length||!getTimerRelayEvents(currentTimerEvent);
    const other=timerOtherEvents.find(e=>e.id===eventId);
    for(const id of ['timer-event-icon','timer-bottom-event-icon']){const icon=document.getElementById(id);icon.textContent=id==='timer-bottom-event-icon'&&other?.fullName?(eventId==='guildford'?'GC':'Mini GC'):other?other.icon:'';icon.hidden=id==='timer-event-icon'&&!!other?.fullName;if(other)icon.className=other.iconClass?'cubing-icon '+other.iconClass:'timer-other-event-icon';icon.classList.toggle('timer-word-event-icon',!!other&&/[a-z]/i.test(other.icon));}
    if (smart) {
        if(timerSmartEvent!=='333')cancelTimerSmartAttempt();
        renderTimerVirtualCube();
        updateTimerBluetoothStatus(Boolean(timerBluetoothDevice?.gatt?.connected));
    } else {
        cancelTimerSmartAttempt();
        closeTimerBluetoothCard();
    }
    updateTimerBluetoothContext();
}

function installTimerCubeRotation() {
    const cube = document.getElementById('timer-virtual-cube');
    let pointer = null;
    let lastX = 0;
    let lastY = 0;

    const draw = () => {
        cube.style.setProperty('--cube-x', `${timerCubeView.x}deg`);
        cube.style.setProperty('--cube-y', `${timerCubeView.y}deg`);
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
        timerCubeView.y += (event.clientX - lastX) * .65;
        timerCubeView.x -= (event.clientY - lastY) * .65;
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
        timerCubeView.y += (touch.clientX - lastX) * .65;
        timerCubeView.x -= (touch.clientY - lastY) * .65;
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
        timerCubeView.x -= turns[event.key][0];
        timerCubeView.y += turns[event.key][1];
        draw();
    });
    draw();
}

function updateTimerBluetoothStatus(connected) {
    const status = document.getElementById('timer-bluetooth-status');
    status.classList.toggle('connected', connected);
    document.getElementById('timer-bluetooth-label').textContent = connected ? '已连接' : '未连接';
    document.getElementById('timer-bluetooth-icon').classList.toggle('disconnected', !connected);
    renderTimerCubeBattery(connected);
    document.getElementById('timer-virtual-cube').setAttribute('aria-label', `虚拟${timerSmartEvent === '222' ? 2 : 3}阶魔方，${connected ? '已连接' : '未连接'}，可拖动旋转`);
}

function closeTimerBluetoothCard() {
    document.getElementById('timer-bluetooth-card').hidden = true;
}

const timerSmartSolved=[...'URFDLB'].map(face=>face.repeat(9)).join('');
let timerSmartPhysicalState=timerSmartSolved;
const timerSmartAttempt={phase:'IDLE',generation:0,tokens:[],index:0,partial:null,errors:[],lastGesture:null,started:0,inspectionEnd:0,groups:[],lastMove:null,pauseMs:0,frame:null,result:null};
let timerBluetoothFeedback;
function timerBluetoothSuccess(text){
    const title=document.getElementById('timer-bluetooth-card-title');
    if(timerBluetoothFeedback){clearTimeout(timerBluetoothFeedback.timer);title.textContent=timerBluetoothFeedback.original;}
    const original=title.textContent;title.textContent=text;
    const feedback={original,timer:setTimeout(()=>{if(title.textContent===text)title.textContent=original;if(timerBluetoothFeedback===feedback)timerBluetoothFeedback=null;},3000)};
    timerBluetoothFeedback=feedback;
}
function syncTimerSmartSolved(){
    if(!timerMoyuSession?.ready)return;
    
    cancelTimerSmartAttempt();timerSmartPhysicalState=timerSmartSolved;setTimerLiveState(timerSmartSolved);
    timerBluetoothSuccess('复原同步成功');
}
function resetTimerSmartGyro(){
    timerCubeGyro.reference=timerCubeGyro.last?timerCubeGyro.last.slice():null;
    timerCubeView.x=0;timerCubeView.y=0;
    const cube=document.getElementById('timer-virtual-cube');
    cube.style.setProperty('--cube-x','0deg');cube.style.setProperty('--cube-y','0deg');cube.style.removeProperty('--cube-gyro-transform');
    timerBluetoothSuccess('重置陀螺仪成功');
}
function timerSmartInverse(move){return move.endsWith("'")?move[0]:move+"'";}
function renderTimerSmartScramble(){
    const attempt=timerSmartAttempt,element=document.getElementById('scramble-text');if(!element)return;
    element.replaceChildren();
    if(['IDLE','RESULT'].includes(attempt.phase)){document.getElementById('timer-page')?.classList.remove('smart-attempt-active');return;}
    document.getElementById('timer-page')?.classList.add('smart-attempt-active');
    const add=(text,kind)=>{const token=document.createElement('span');token.className='smart-scramble-token '+kind;token.textContent=text;element.append(token,document.createTextNode(' '));};
    attempt.tokens.slice(0,attempt.index).forEach(token=>add(token,'smart-correct'));
    attempt.errors.forEach(move=>add(move,'smart-wrong'));
    [...attempt.errors].reverse().forEach((move,i)=>add(timerSmartInverse(move),i===0?'smart-current smart-undo':'smart-undo'));
    attempt.tokens.slice(attempt.index).forEach((token,i)=>add(token,i===0&&!attempt.errors.length?'smart-current':''));
    // Let the stage yield space to the actual wrapped scramble, on all screen sizes.
    requestAnimationFrame(layoutTimerSmartStage);
}
function layoutTimerSmartStage(){
    const stage=document.querySelector('.timer-main.smart-cube-mode .timer-smart-stage');if(stage)stage.style.removeProperty('top');
}
function cancelTimerSmartAttempt(){
    closeTimerBatteryNotice();
    resetTimerSmartAbortHold();
    const attempt=timerSmartAttempt;attempt.generation++;attempt.phase='IDLE';attempt.lastGesture=null;attempt.tokens=[];attempt.errors=[];attempt.partial=null;attempt.result=null;
    if(attempt.frame!==null&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(attempt.frame);attempt.frame=null;
    const page=document.getElementById('timer-page');page?.classList?.remove?.('smart-attempt-active');
    const result=document.getElementById('timer-smart-result');if(result)result.hidden=true;if(typeof timerSmartDeleteRecord!=='undefined'){timerSmartDeleteRecord=null;const confirmation=document.getElementById('smart-result-delete-confirm');if(confirmation)confirmation.hidden=true;}
    const display=document.getElementById('timer-display');if(display){display.classList?.remove?.('inspecting','nb-status-text');display.textContent=typeof formatNbTimerOutput==='function'?formatNbTimerOutput(0):'0.00';}
    const stage=document.querySelector('.timer-main.smart-cube-mode .timer-smart-stage');if(stage)stage.style.removeProperty('top');
}
async function timerSmartGenerateTokens(count){
    const tokens=[];
    do{const text=await window.nbScrambleEngine.getScramble('333');const batch=text.trim().split(/\s+/).filter(token=>/^[URFDLB](?:2|')?$/.test(token));if(!batch.length)throw Error('打乱公式无效');tokens.push(...batch);}while(count&&tokens.length<count);
    return count?tokens.slice(0,count):tokens;
}
async function beginTimerSmartScramble(){
    const attempt=timerSmartAttempt;cancelTimerSmartAttempt();attempt.phase='GENERATING';attempt.generatingMoves=[];const generation=attempt.generation;
    try{const tokens=await timerSmartGenerateTokens();if(attempt.generation!==generation||attempt.phase!=='GENERATING')return;
        Object.assign(attempt,{phase:'SCRAMBLING',tokens,index:0,partial:null,errors:attempt.generatingMoves||[],lastGesture:null,groups:[],lastMove:null,pauseMs:0,result:null});
        if(attempt.errors.length>6){void replaceTimerSmartScrambleTail();return;}renderTimerSmartScramble();
    }catch(error){if(attempt.generation!==generation)return;cancelTimerSmartAttempt();document.getElementById('timer-bluetooth-card-title').textContent='打乱生成失败，请来回转动重试';document.getElementById('timer-bluetooth-card').hidden=false;}
}
async function replaceTimerSmartScrambleTail(){
    const attempt=timerSmartAttempt,count=attempt.tokens.length-attempt.index+attempt.errors.length,generation=++attempt.generation;
    attempt.phase='GENERATING';attempt.generatingMoves=[];
    try{const suffix=await timerSmartGenerateTokens(count);if(attempt.generation!==generation)return;
        attempt.tokens=attempt.tokens.slice(0,attempt.index).concat(suffix);attempt.partial=null;attempt.errors=attempt.generatingMoves||[];attempt.phase='SCRAMBLING';if(attempt.errors.length>6){void replaceTimerSmartScrambleTail();return;}renderTimerSmartScramble();
    }catch{if(attempt.generation===generation)cancelTimerSmartAttempt();}
}
function updateTimerSmartClock(){
    const attempt=timerSmartAttempt;if(!['INSPECTION','SOLVING'].includes(attempt.phase))return;
    const now=timerSmartClockNow(),display=document.getElementById('timer-display');
    if(attempt.phase==='INSPECTION'){
        if(now>=attempt.inspectionEnd){startTimerSmartSolve(attempt.inspectionEnd);return;}
        const hidden=uiSettings.nbDisplayMode==='hidden';display.classList.toggle('nb-status-text',hidden);display.classList.add('inspecting');display.textContent=hidden?'观察中':String(Math.ceil((attempt.inspectionEnd-now)/1000));
    }else{display.classList.remove('inspecting');display.classList.toggle('nb-status-text',['hidden','onlyInspection'].includes(uiSettings.nbDisplayMode));display.textContent=formatNbRunningTime(Math.max(0,now-attempt.started));}
    attempt.frame=requestAnimationFrame(updateTimerSmartClock);
}
function beginTimerSmartInspection(stamp=timerSmartClockNow()){
    const attempt=timerSmartAttempt;attempt.phase='INSPECTION';attempt.inspectionEnd=stamp+15000;attempt.partial=null;attempt.errors=[];attempt.lastGesture=null;
    renderTimerSmartScramble();updateTimerSmartClock();
}
function startTimerSmartSolve(stamp,initialState=timerSmartPhysicalState){
    const attempt=timerSmartAttempt;if(attempt.frame!==null)cancelAnimationFrame(attempt.frame);
    attempt.phase='SOLVING';attempt.started=stamp;attempt.initialState=initialState;attempt.trace=[];attempt.groups=[];attempt.lastMove=null;attempt.pauseMs=0;attempt.lastGesture=null;updateTimerSmartClock();
}
function timerSmartSolveStats(stamp){
    const attempt=timerSmartAttempt,ms=Math.max(1,stamp-attempt.started),steps=attempt.groups.length;
    return {ms,steps,tps:(steps/(ms/1000)).toFixed(1),pausePercent:Math.min(100,attempt.pauseMs/ms*100).toFixed(1)};
}
function finishTimerSmartSolve(stamp,aborted=false){
    resetTimerSmartAbortHold();
    const attempt=timerSmartAttempt;attempt.result=timerSmartSolveStats(stamp);attempt.phase='RESULT';attempt.lastGesture=null;cancelAnimationFrame(attempt.frame);attempt.frame=null;
    const result=attempt.result;document.getElementById('timer-display').classList.remove('inspecting','nb-status-text');document.getElementById('timer-display').textContent=aborted?'DNF':formatNbTimerOutput(result.ms);
    attempt.record={rawMs:result.ms,penalty:aborted?'DNF':'',smartAborted:aborted,timestamp:getNowFormatted(),scramble:attempt.tokens.join(' '),smartStats:{steps:result.steps,tps:Number(result.tps),pausePercent:Number(result.pausePercent)},smartTrace:{version:1,initialState:attempt.initialState,moves:attempt.trace.map(item=>({...item}))}};
    if(aborted)delete attempt.record.smartTrace;configureTimerSmartAnalysisEntry(document.querySelector('.smart-result-analysis'),attempt.record);const card=document.getElementById('timer-smart-result');card.hidden=false;card.querySelector('.smart-result-card').animate([{opacity:0,transform:'scale(.96)'},{opacity:1,transform:'scale(1)'}],{duration:120,easing:'cubic-bezier(.1,.9,.2,1)'});
    document.getElementById('timer-smart-result-time').textContent=aborted?'DNF':formatNbTimerOutput(result.ms);document.getElementById('timer-smart-result-time').classList.toggle('smart-result-dnf',aborted);
    document.getElementById('timer-smart-result-steps').textContent=String(result.steps);
    document.getElementById('timer-smart-result-tps').textContent=result.tps;
    document.getElementById('timer-smart-result-pause').textContent=result.pausePercent+'%';
    if(typeof timerHistoryData!=='undefined'){
        const key='smart-333';if(!timerHistoryData[key])timerHistoryData[key]=[];
        timerHistoryData[key].unshift(attempt.record);
        recalculateSessionStats();saveTimerData();
    }
    renderTimerSmartScramble();
    scheduleTimerBatteryNotice();
}
function configureTimerSmartAnalysisEntry(button,record){if(!button)return;const disabled=Boolean(record?.smartAborted);button.disabled=disabled;button.textContent=disabled?'无法分析':'数据分析';}
const timerSmartAbortHold={started:null,timeout:null,pointer:null,source:null};
function resetTimerSmartAbortHold(){clearTimeout(timerSmartAbortHold.timeout);Object.assign(timerSmartAbortHold,{started:null,timeout:null,pointer:null,source:null});document.getElementById('timer-display')?.classList.remove('smart-abort-warning','smart-abort-ready');document.getElementById('timer-tab-main')?.classList.remove('smart-abort-holding');}
function canTimerSmartAbort(){return currentTimerMode==='smart'&&timerSmartEvent==='333'&&timerSmartAttempt.phase==='SOLVING'&&document.getElementById('timer-page')?.classList.contains('active')&&!timerSmartAnalysis.open;}
function beginTimerSmartAbortHold(source,pointer=null){if(!canTimerSmartAbort()||timerSmartAbortHold.started!==null)return;Object.assign(timerSmartAbortHold,{started:performance.now(),source,pointer});document.getElementById('timer-tab-main')?.classList.add('smart-abort-holding');document.getElementById('timer-display').classList.add('smart-abort-warning');timerSmartAbortHold.timeout=setTimeout(()=>{if(canTimerSmartAbort()&&timerSmartAbortHold.started!==null){const display=document.getElementById('timer-display');display.classList.remove('smart-abort-warning');display.classList.add('smart-abort-ready');}},1000);}
function releaseTimerSmartAbortHold(){const abort=canTimerSmartAbort()&&timerSmartAbortHold.started!==null&&performance.now()-timerSmartAbortHold.started>=1000;resetTimerSmartAbortHold();if(abort)finishTimerSmartSolve(timerSmartClockNow(),true);}
function installTimerSmartAbortGesture(){
    const interactive='input,textarea,select,button,a,[contenteditable="true"],[role="button"],.edit-score-popup,.timer-bluetooth-card,.smart-result-overlay';
    document.addEventListener('keydown',event=>{if(event.code!=='Space'||!canTimerSmartAbort()||event.target.closest?.(interactive))return;event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)beginTimerSmartAbortHold('keyboard');},true);
    document.addEventListener('keyup',event=>{if(event.code==='Space'&&timerSmartAbortHold.source==='keyboard'){event.preventDefault();event.stopImmediatePropagation();releaseTimerSmartAbortHold();}},true);
    document.addEventListener('pointerdown',event=>{if(window.innerWidth>768||event.pointerType==='mouse'||!event.isPrimary||!canTimerSmartAbort()||!event.target.closest?.('#timer-tab-main')||event.target.closest?.(interactive))return;if(event.cancelable)event.preventDefault();event.stopImmediatePropagation();beginTimerSmartAbortHold('touch',event.pointerId);},true);
    document.addEventListener('pointerup',event=>{if(timerSmartAbortHold.source==='touch'&&event.pointerId===timerSmartAbortHold.pointer){if(event.cancelable)event.preventDefault();event.stopImmediatePropagation();releaseTimerSmartAbortHold();}},true);
    document.addEventListener('pointercancel',event=>{if(event.pointerId===timerSmartAbortHold.pointer)resetTimerSmartAbortHold();},true);
    document.addEventListener('touchstart',event=>{if(timerSmartAbortHold.source==='touch'&&event.touches.length===1){if(event.cancelable)event.preventDefault();event.stopImmediatePropagation();}},{capture:true,passive:false});
    for(const type of ['contextmenu','selectstart'])document.addEventListener(type,event=>{if(canTimerSmartAbort()&&event.target.closest?.('#timer-tab-main')&&!event.target.closest?.(interactive))event.preventDefault();},true);
    window.addEventListener('blur',resetTimerSmartAbortHold);
}
let timerSmartDeleteRecord=null;
function requestTimerSmartResultDelete(){const record=timerSmartAttempt.record;if(!record||timerSmartAttempt.phase!=='RESULT')return;timerSmartDeleteRecord=record;document.getElementById('smart-result-delete-confirm').hidden=false;document.querySelector('#smart-result-delete-confirm button').focus();}
function cancelTimerSmartResultDelete(){timerSmartDeleteRecord=null;document.getElementById('smart-result-delete-confirm').hidden=true;document.querySelector('.smart-result-delete')?.focus();}
function confirmTimerSmartResultDelete(){const record=timerSmartDeleteRecord;cancelTimerSmartResultDelete();if(!record)return;const history=timerHistoryData['smart-333']||[],index=history.indexOf(record);if(index>=0){history.splice(index,1);recalculateSessionStats();saveTimerData();}closeTimerSmartResult();}
function closeTimerSmartResult(){cancelTimerSmartResultDelete();cancelTimerSmartAttempt();}
const timerSmartAnalysis={open:false,record:null,report:null,tab:'data',cursor:0,playing:null,replayEpoch:0,animation:null,clockFrame:null,replayTime:0,returnResult:false};
function timerSmartOrientation(bottom){
    const normals={U:[0,1,0],R:[1,0,0],F:[0,0,1],D:[0,-1,0],L:[-1,0,0],B:[0,0,-1]},down=normals[bottom],up=down.map(v=>-v),front=normals['FB'.includes(bottom)?'U':'F'];
    const right=[up[1]*front[2]-up[2]*front[1],up[2]*front[0]-up[0]*front[2],up[0]*front[1]-up[1]*front[0]],dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0),rotate=v=>[dot(v,right),dot(v,up),dot(v,front)];
    const mapping={};for(const face of 'URFDLB')mapping[face]=Object.keys(normals).find(f=>normals[f].every((v,i)=>v===rotate(normals[face])[i]));
    const slots=timerCubeSlots();return {bottom,front:Object.keys(normals).find(f=>normals[f].every((v,i)=>v===front[i])),mapping,normalise(state){const out=[];slots.forEach((slot,i)=>{const p=rotate(slot.p),n=rotate(slot.n),j=slots.findIndex(other=>other.p.every((v,k)=>v===p[k])&&other.n.every((v,k)=>v===n[k]));out[j]=mapping[state[i]];});return out.join('');}};
}
function timerSmartGroupedMoves(moves){
    const groups=[];for(const item of moves){const previous=groups.at(-1);if(previous&&previous.move===item.move&&previous.power===1&&item.t-previous.last<=120){previous.power=2;previous.last=item.t;}else groups.push({move:item.move,power:1,last:item.t});}
    return groups.map(group=>group.power===2?group.move[0]+'2':group.move);
}
function analyseTimerSmartRecord(record){
    const trace=record?.smartTrace;if(!trace||!/^([URFDLB]){54}$/.test(trace.initialState)||!Array.isArray(trace.moves)||!trace.moves.length||trace.moves.some((item,i)=>!item||!/^[URFDLB]'?$/.test(item.move)||!Number.isFinite(item.t)||item.t<0||(i&&item.t<trace.moves[i-1].t)))return null;
    const moves=trace.moves,states=[trace.initialState];for(const item of moves)states.push(timerCubeTurn(states.at(-1),item.move));if(states.at(-1)!==timerSmartSolved)return null;
    const slots=timerCubeSlots(),dot=(p,n)=>p.reduce((sum,v,i)=>sum+v*n[i],0),correct=(state,indices)=>indices.every(i=>state[i]===timerSmartSolved[i]);
    const candidates=[];
    for(const bottom of 'UDRLF B'.replace(/ /g,'')){
        const normal=slots.find(s=>s.face===bottom).n,edge=slots.flatMap((s,i)=>dot(s.p,normal)===1&&s.p.filter(v=>v!==0).length===2?[i]:[]),layer=slots.flatMap((s,i)=>dot(s.p,normal)>=0?[i]:[]);
        const f2lEnd=states.findIndex(state=>correct(state,layer));if(f2lEnd<0)continue;
        const crossEnd=states.findIndex((state,i)=>i<=f2lEnd&&correct(state,edge));
        const corners=slots.filter(s=>dot(s.p,normal)===1&&s.p.every(v=>v!==0));const keys=[...new Set(corners.map(s=>s.p.map((v,i)=>normal[i]?0:v).join(',')))];
        const pairEnds=keys.map(key=>{const coordinate=key.split(',').map(Number);const indices=slots.flatMap((s,i)=>s.p.every((v,k)=>normal[k]?dot(s.p,normal)>=0:v===coordinate[k])?[i]:[]);let lastBad=-1;for(let i=crossEnd;i<=f2lEnd;i++)if(correct(states[i],edge)&&!correct(states[i],indices))lastBad=i;return lastBad<0?crossEnd:states.findIndex((state,i)=>i>lastBad&&i<=f2lEnd&&correct(state,edge)&&correct(state,indices));}).sort((a,b)=>a-b);
        candidates.push({bottom,f2lEnd,crossEnd,pairEnds,layer});
    }
    candidates.sort((a,b)=>a.crossEnd-b.crossEnd||a.f2lEnd-b.f2lEnd);const chosen=candidates[0];if(!chosen)return null;
    const orientation=timerSmartOrientation(chosen.bottom),normalised=states.map(state=>orientation.normalise(state)),upFace=slots.flatMap((s,i)=>s.face==='U'?[i]:[]),f2l=slots.flatMap((s,i)=>s.p[1]<=0?[i]:[]),oriented=state=>correct(state,upFace)&&correct(state,f2l);
    const isAuf=state=>{for(let i=0;i<4;i++){if(state===timerSmartSolved)return true;state=timerCubeTurn(state,'U');}return false;};
    let ollEnd=chosen.f2lEnd;while(ollEnd<states.length-1&&!oriented(normalised[ollEnd]))ollEnd++;
    const ollSkip=oriented(normalised[chosen.f2lEnd]);
    if(ollSkip&&!isAuf(normalised[ollEnd]))while(ollEnd<moves.length&&orientation.mapping[moves[ollEnd].move[0]]==='U')ollEnd++;
    const pllSkip=isAuf(normalised[ollEnd]),xc=chosen.crossEnd>0?chosen.pairEnds.filter(end=>end<=chosen.crossEnd).length:0;
    const boundaries=[chosen.crossEnd,...chosen.pairEnds.map(end=>Math.max(end,chosen.crossEnd)),ollEnd,moves.length];
    // Keep a fast half turn together when a stage boundary falls between its quarters.
    for(let i=0;i<boundaries.length;i++){let end=boundaries[i];if(end>0&&end<moves.length&&moves[end-1].move===moves[end].move&&moves[end].t-moves[end-1].t<=120)end++;boundaries[i]=Math.max(i?boundaries[i-1]:0,end);}
    const ms=Math.max(1,record.rawMs),stages=[];let previous=0,previousTime=0;
    const labels=[xc?'XC':'C','F1','F2','F3','F4','OLL','PLL'];
    boundaries.forEach((end,index)=>{const time=index===6?ms:end>0?Math.min(ms,moves[end-1].t):0,elapsed=Math.max(0,time-previousTime),slice=moves.slice(previous,end),mapped=slice.map(item=>({...item,move:orientation.mapping[item.move[0]]+item.move.slice(1)})),algorithm=timerSmartGroupedMoves(mapped);
        let pauseMs=0;for(let i=previous;i<end;i++){const gap=moves[i].t-(i?moves[i-1].t:0);if(gap>350)pauseMs+=gap-150;}
        const skip=previous===end||(index===5&&ollSkip)||(index===6&&pllSkip);
        stages.push({label:labels[index],start:previous,end,ms:elapsed,percent:elapsed/ms*100,steps:algorithm.length,tps:elapsed?algorithm.length/(elapsed/1000):0,pausePercent:elapsed?Math.min(100,pauseMs/elapsed*100):0,algorithm:algorithm.join(' ')+(skip?(algorithm.length?' (skip)':'skip'):''),skip});previous=end;previousTime=time;
    });
    return {orientation,stages,states:normalised,moves:moves.map(item=>({...item,move:orientation.mapping[item.move[0]]+item.move.slice(1)})),ms,initialState:normalised[0]};
}
function stopTimerSmartReplay(){cancelAnimationFrame(timerSmartAnalysis.clockFrame);timerSmartAnalysis.playing=null;timerSmartAnalysis.replayEpoch++;timerSmartAnalysis.animation?.cancel();timerSmartAnalysis.animation=null;const button=document.getElementById('smart-analysis-play');if(button){button.textContent='播放';button.setAttribute('aria-pressed','false');}}
function setTimerSmartAnalysisTab(tab){if(tab==='data'){stopTimerSmartReplay();seekTimerSmartReplay(timerSmartAnalysis.cursor);}timerSmartAnalysis.tab=tab;document.getElementById('smart-analysis-data').hidden=tab!=='data';document.getElementById('smart-analysis-solution').hidden=tab!=='solution';for(const name of ['data','solution']){const button=document.getElementById('smart-analysis-tab-'+name);button.classList.toggle('active',tab===name);button.setAttribute('aria-pressed',String(tab===name));}}
let timerSmartCardMorph=null,timerSmartCardMorphCancel=null;
function morphTimerSmartCards(sourceOverlay,targetOverlay,sourceSelector,targetSelector){
    if(timerSmartCardMorph)return timerSmartCardMorph;
    const source=sourceOverlay.querySelector(sourceSelector),target=targetOverlay.querySelector(targetSelector),from=source.getBoundingClientRect();
    const previous=source.cloneNode(true);previous.removeAttribute('id');for(const node of previous.querySelectorAll('[id]'))node.removeAttribute('id');previous.classList.add('smart-card-morph-content');previous.setAttribute('aria-hidden','true');
    Object.assign(previous.style,{position:'fixed',left:from.x+'px',top:from.y+'px',width:from.width+'px',height:from.height+'px',margin:'0',maxHeight:'none',zIndex:'3400',pointerEvents:'none',animation:'none',overflow:'hidden'});
    previous.style.setProperty('background','transparent','important');previous.style.setProperty('border-color','transparent','important');previous.style.setProperty('box-shadow','none','important');document.body.append(previous);
    targetOverlay.hidden=false;target.classList.add('smart-card-morph-target','smart-card-morph');const to=target.getBoundingClientRect();sourceOverlay.hidden=true;
    const dx=from.x-to.x,dy=from.y-to.y,sx=from.width/to.width,sy=from.height/to.height;
    const motion=target.animate([{transform:`translate3d(${dx}px,${dy}px,0) scale(${sx},${sy})`},{transform:'translate3d(0,0,0) scale(1,1)'}],{duration:360,easing:'cubic-bezier(.45,0,.2,1)',fill:'both'});
    const fades=[previous.animate([{opacity:1},{opacity:0}],{duration:220,easing:'ease-in-out',fill:'forwards'})];
    for(const child of target.children)fades.push(child.animate([{opacity:0},{opacity:1}],{delay:60,duration:280,easing:'ease-in-out',fill:'both'}));
    const cleanup=()=>{previous.remove();motion.cancel();for(const fade of fades)fade.cancel();target.classList.remove('smart-card-morph-target','smart-card-morph');};
    timerSmartCardMorphCancel=()=>{cleanup();sourceOverlay.hidden=true;targetOverlay.hidden=true;};
    timerSmartCardMorph=motion.finished.catch(()=>{}).then(()=>{cleanup();timerSmartCardMorph=null;timerSmartCardMorphCancel=null;});return timerSmartCardMorph;
}
function openTimerSmartAnalysis(record=timerSmartAttempt.record){
    if(!record||record.smartAborted||timerSmartCardMorph)return;if(timerSmartAttempt.phase!=='RESULT')cancelTimerSmartAttempt();timerSmartAnalysis.open=true;timerSmartAnalysis.record=record;timerSmartAnalysis.report=analyseTimerSmartRecord(record);timerSmartAnalysis.cursor=0;const result=document.getElementById('timer-smart-result');timerSmartAnalysis.returnResult=!result.hidden;
    renderTimerSmartAnalysis();setTimerSmartAnalysisTab('data');const overlay=document.getElementById('smart-analysis-overlay');
    if(timerSmartAnalysis.returnResult)void morphTimerSmartCards(result,overlay,'.smart-result-card','.smart-analysis-card');else{overlay.hidden=false;overlay.querySelector('.smart-analysis-card').animate([{opacity:0,transform:'scale(.96)'},{opacity:1,transform:'scale(1)'}],{duration:120,easing:'cubic-bezier(.1,.9,.2,1)'});}timerSmartAttempt.lastGesture=null;
}
function closeTimerSmartAnalysis(){
    if(timerSmartCardMorph){if(timerSmartAttempt.phase==='RESULT'&&document.getElementById('timer-page')?.classList.contains('active'))return;timerSmartCardMorphCancel?.();timerSmartAnalysis.open=false;}stopTimerSmartReplay();timerSmartAttempt.lastGesture=null;const overlay=document.getElementById('smart-analysis-overlay'),result=document.getElementById('timer-smart-result');
    if(timerSmartAnalysis.returnResult&&timerSmartAttempt.phase==='RESULT'&&document.getElementById('timer-page')?.classList.contains('active')){void morphTimerSmartCards(overlay,result,'.smart-analysis-card','.smart-result-card').then(()=>{timerSmartAnalysis.open=false;timerSmartAttempt.lastGesture=null;if(timerSmartAttempt.phase!=='RESULT')result.hidden=true;});}
    else{timerSmartAnalysis.open=false;overlay.hidden=true;}
}
function openTimerSmartHistoryAnalysis(){const record=timerHistoryData[getTimerHistoryKey()]?.[editScoreIndex];if(!getTimerHistoryKey().startsWith('smart-'))return;closeEditPopup();openTimerSmartAnalysis(record);}
function layoutTimerSmartOrbitLabels(ring){
    const labels=[...ring.querySelectorAll('.smart-analysis-orbit-label')],size=240,halfWidth=34,halfHeight=28,clearance=92;
    const positioned=[];
    for(const label of labels){let x=parseFloat(label.style.left)/100*size,y=parseFloat(label.style.top)/100*size;const dx=x-120,dy=y-120;
        // The closest corner of the label must clear the ring's outer edge.
        const nearX=Math.max(0,Math.abs(dx)-halfWidth),nearY=Math.max(0,Math.abs(dy)-halfHeight),distance=Math.hypot(nearX,nearY);
        if(distance<clearance){const factor=1+(clearance-distance)/Math.max(1,Math.hypot(dx,dy));x=120+dx*factor;y=120+dy*factor;}
        x=Math.max(0,Math.min(size,x));const closestX=Math.max(0,Math.abs(x-120)-halfWidth),closestY=Math.max(0,Math.abs(y-120)-halfHeight);if(Math.hypot(closestX,closestY)<clearance)y=120+(dy>=0?1:-1)*(halfHeight+Math.sqrt(Math.max(0,clearance*clearance-closestX*closestX)));
        for(const prior of positioned)if(Math.abs(x-prior.x)<halfWidth*2+5&&Math.abs(y-prior.y)<halfHeight*2+5)y=prior.y+(dy>=0?1:-1)*(halfHeight*2+6);
        positioned.push({x,y});label.style.left=(x/size*100)+'%';label.style.setProperty('--orbit-label-x',(x/size*100)+'%');label.style.top=(y/size*100)+'%';
    }
}
function renderTimerSmartAnalysis(){
    const report=timerSmartAnalysis.report,record=timerSmartAnalysis.record,data=document.getElementById('smart-analysis-data'),solution=document.getElementById('smart-analysis-solution');data.replaceChildren();solution.replaceChildren();
    const footer=document.getElementById('smart-analysis-scramble');footer.replaceChildren();const scrambleText=document.createElement('p');scrambleText.className='smart-analysis-scramble';scrambleText.textContent=record.scramble||'未保存打乱';footer.append(scrambleText);
    if(!report){for(const area of [data,solution]){const message=document.createElement('p');message.className='smart-analysis-empty';message.textContent='这条成绩没有完整转动记录，无法还原阶段解法。新的智能练习会自动保存转动数据。';area.append(message);}return;}
    const colors=['#528bce','#5db6ab','#a49ad5','#e6b469'],summary=document.createElement('div');summary.className='smart-analysis-chart';
    const groups=[{label:'C',percent:report.stages[0].steps?report.stages[0].percent:0},{label:'F',percent:report.stages.slice(1,5).reduce((sum,stage)=>sum+(stage.steps?stage.percent:0),0)},{label:'O',percent:report.stages[5].steps?report.stages[5].percent:0},{label:'P',percent:report.stages[6].steps?report.stages[6].percent:0}];const visibleTotal=groups.reduce((sum,group)=>sum+group.percent,0);if(visibleTotal)groups.forEach(group=>group.percent=group.percent/visibleTotal*100);
    const ring=document.createElement('div');ring.className='smart-analysis-orbit';const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 240 240');svg.setAttribute('role','img');svg.setAttribute('aria-label',groups.map(g=>g.label+' '+g.percent.toFixed(1)+'%').join(', '));
    const circumference=2*Math.PI*72;let offset=0;
    function arc(color,length,position){const circle=document.createElementNS(ns,'circle');for(const [key,value]of Object.entries({cx:120,cy:120,r:72,fill:'none',stroke:color,'stroke-width':11,transform:'rotate(-90 120 120)'}))circle.setAttribute(key,value);if(length!==null){circle.setAttribute('stroke-dasharray',Math.max(0,length-5)+' '+circumference);circle.setAttribute('stroke-dashoffset',-position);circle.setAttribute('stroke-linecap','round');}svg.append(circle);}
    arc('var(--border-color)',null,0);groups.forEach((group,i)=>{const length=circumference*group.percent/100;if(length>5)arc(colors[i],length,offset);offset+=length;});ring.append(svg);
    const centre=document.createElement('div');centre.className='smart-analysis-orbit-centre';centre.textContent='CFOP';ring.append(centre);
    let angle=-Math.PI/2;groups.forEach((group,i)=>{const mid=angle+Math.PI*group.percent/100;angle+=2*Math.PI*group.percent/100;if(group.percent<.001)return;const label=document.createElement('div');label.className='smart-analysis-orbit-label';label.dataset.stage=group.label;label.style.setProperty('--stage-color',colors[i]);label.style.left=(50+49*Math.cos(mid))+'%';label.style.top=(50+49*Math.sin(mid))+'%';const name=document.createElement('span');name.textContent=group.label;const value=document.createElement('strong');value.textContent=group.percent.toFixed(1)+'%';label.append(name,value);ring.append(label);});const frame=document.createElement('div');frame.className='smart-analysis-orbit-frame';frame.append(ring);summary.append(frame);layoutTimerSmartOrbitLabels(ring);
    const stats=document.createElement('div');stats.className='smart-analysis-summary';const time=document.createElement('div');time.className='smart-analysis-summary-time';time.textContent=formatNbTimerOutput(record.rawMs);const metrics=document.createElement('div');metrics.className='smart-analysis-summary-metrics';const steps=record.smartStats?.steps??report.stages.reduce((sum,stage)=>sum+stage.steps,0),pause=record.smartStats?.pausePercent??report.stages.reduce((sum,stage)=>sum+stage.pausePercent*stage.percent/100,0);
    for(const [label,value]of [['步数',steps],['停顿率',pause.toFixed(1)+'%']]){const item=document.createElement('div'),name=document.createElement('span'),number=document.createElement('strong');name.textContent=label;number.textContent=value;item.append(name,number);metrics.append(item);}stats.append(time,metrics);summary.append(stats);data.append(summary);
    const table=document.createElement('table');table.className='smart-analysis-table';table.innerHTML='<thead><tr><th>阶段</th><th>时间</th><th>占比</th><th>步数</th><th>TPS</th><th>停顿</th></tr></thead>';const body=document.createElement('tbody');for(const stage of report.stages){const row=document.createElement('tr');for(const value of [stage.label,stage.skip&&stage.ms===0?'skip':formatNbTimerOutput(stage.ms),stage.percent.toFixed(1)+'%',stage.steps,stage.tps.toFixed(1),stage.pausePercent.toFixed(1)+'%']){const cell=document.createElement('td');cell.textContent=String(value);cell.title=String(value);row.append(cell);}body.append(row);}table.append(body);const scroll=document.createElement('div');scroll.className='smart-analysis-table-scroll';scroll.append(table);data.append(scroll);
    const replay=document.createElement('div');replay.className='smart-analysis-replay';const model=document.createElement('div');model.id='smart-analysis-cube';model.className='timer-virtual-cube';replay.append(model);
    const controls=document.createElement('div');controls.className='smart-analysis-controls';for(const [label,title,action]of [['<<','回到初始状态',()=>seekTimerSmartReplay(0)],['<','上一步',()=>stepTimerSmartReplay(-1)],['播放','播放或暂停',toggleTimerSmartReplay],['>','下一步',()=>stepTimerSmartReplay(1)],['>>','前往复原状态',()=>seekTimerSmartReplay(report.moves.length)]]){const button=document.createElement('button');button.type='button';button.textContent=label;button.title=title;button.setAttribute('aria-label',title);button.onclick=action;if(label==='播放')button.id='smart-analysis-play';controls.append(button);}const slider=document.createElement('input');slider.id='smart-analysis-replay-slider';slider.type='range';slider.min=0;slider.max=report.moves.length;slider.value=0;slider.setAttribute('aria-label','解法回放进度');slider.oninput=()=>seekTimerSmartReplay(Number(slider.value));const clock=document.createElement('div');clock.id='smart-analysis-replay-time';clock.className='smart-analysis-replay-time';clock.textContent=formatNbTimerOutput(0);replay.append(clock,controls,slider);solution.append(replay);bindTimerSmartReplayView(model);
    const algorithms=document.createElement('div');algorithms.className='smart-analysis-algorithms';report.stages.forEach(stage=>{const row=document.createElement('button');row.type='button';row.className='smart-analysis-stage';const name=document.createElement('strong');name.textContent=stage.label;const alg=document.createElement('span');alg.textContent=stage.algorithm;row.append(name,alg);row.onclick=()=>seekTimerSmartReplay(stage.start);algorithms.append(row);});solution.append(algorithms);seekTimerSmartReplay(0);
}
function seekTimerSmartReplay(cursor,internal=false){
    if(!internal)stopTimerSmartReplay();
    const report=timerSmartAnalysis.report;if(!report)return;timerSmartAnalysis.cursor=Math.max(0,Math.min(report.moves.length,cursor));const model=document.getElementById('smart-analysis-cube');if(!model)return;model.replaceChildren();model.dataset.order='3';model.dataset.appearance=uiSettings.smartCubeAppearance||'black';const body=document.createElement('div');body.className='timer-cube-body';model.append(body);
    const palette={U:'#fff',R:'#e74745',F:'#29b85e',D:'#f7da2d',L:'#f69335',B:'#3174cf'},mapped={};for(const [original,normalised]of Object.entries(report.orientation.mapping))mapped[normalised]=palette[original];
    const rotations={U:'rotateX(90deg)',D:'rotateX(-90deg)',R:'rotateY(90deg)',L:'rotateY(-90deg)',F:'',B:'rotateY(180deg)'},state=report.states[timerSmartAnalysis.cursor];timerCubeSlots().forEach((slot,i)=>{const tile=document.createElement('div');tile.className='timer-live-sticker';tile.dataset.index=String(i);tile.dataset.cell=String(i%9);const p=slot.p.map((v,k)=>(v+slot.n[k]*.5)*(k===1?-1:1));tile.style.transform=`translate3d(calc(var(--cube-side)/3 * ${p[0]}),calc(var(--cube-side)/3 * ${p[1]}),calc(var(--cube-side)/3 * ${p[2]})) ${rotations[slot.face]}`;tile.style.setProperty('--sticker',mapped[state[i]]);body.append(tile);});document.getElementById('smart-analysis-replay-slider').value=timerSmartAnalysis.cursor;if(!internal){timerSmartAnalysis.replayTime=timerSmartAnalysis.cursor===report.moves.length?report.ms:timerSmartAnalysis.cursor?report.moves[timerSmartAnalysis.cursor-1].t:0;updateTimerSmartReplayClock(timerSmartAnalysis.replayTime);}
}
async function animateTimerSmartReplayStep(direction,duration=95,epoch=timerSmartAnalysis.replayEpoch){
    const report=timerSmartAnalysis.report,cursor=timerSmartAnalysis.cursor,target=cursor+direction;if(!report||target<0||target>report.moves.length)return;
    const move=direction>0?report.moves[cursor].move:timerSmartInverse(report.moves[target].move),slots=timerCubeSlots(),axis=slots.find(s=>s.face===move[0]).n,body=document.querySelector('#smart-analysis-cube .timer-cube-body');
    if(body){const group=document.createElement('div');group.className='timer-live-layer';body.append(group);body.append(timerLiveContactCap(axis,.49));group.append(timerLiveContactCap(axis,.51));for(const tile of body.querySelectorAll('.timer-live-sticker')){const slot=slots[Number(tile.dataset.index)];if(slot.p.reduce((sum,v,k)=>sum+v*axis[k],0)===1)group.append(tile);}const animation=group.animate([{transform:'rotate3d(1,0,0,0deg)'},{transform:`rotate3d(${axis[0]},${-axis[1]},${axis[2]},${move.endsWith("'")?-90:90}deg)`}],{duration,easing:'linear',fill:'forwards'});timerSmartAnalysis.animation=animation;await animation.finished.catch(()=>{});}
    if(epoch===timerSmartAnalysis.replayEpoch){timerSmartAnalysis.animation=null;seekTimerSmartReplay(target,true);timerSmartAnalysis.replayTime=target===report.moves.length?report.ms:target?report.moves[target-1].t:0;updateTimerSmartReplayClock(timerSmartAnalysis.replayTime);}
}
function stepTimerSmartReplay(direction){stopTimerSmartReplay();seekTimerSmartReplay(timerSmartAnalysis.cursor,true);void animateTimerSmartReplayStep(direction);}
function updateTimerSmartReplayClock(ms){const clock=document.getElementById('smart-analysis-replay-time');if(clock)clock.textContent=formatNbTimerOutput(Math.min(timerSmartAnalysis.report?.ms||0,Math.max(0,ms)));}
function toggleTimerSmartReplay(){
    const replay=timerSmartAnalysis,report=replay.report;if(!report)return;
    if(replay.playing!==null){stopTimerSmartReplay();seekTimerSmartReplay(replay.cursor,true);return;}
    if(replay.cursor>=report.moves.length)seekTimerSmartReplay(0);
    const epoch=replay.replayEpoch,base=replay.replayTime,anchor=performance.now(),times=report.moves.map(m=>Math.min(report.ms,Math.max(0,m.t)));
    // BLE batches can carry identical times. Spread their turns over that batch's
    // real interval instead of adding animation delays to the recorded duration.
    for(let i=0;i<times.length;){let j=i+1;while(j<times.length&&times[j]===times[i])j++;const previous=i?times[i-1]:0,end=times[i];for(let k=i;k<j;k++)times[k]=previous+(end-previous)*(k-i+1)/(j-i);i=j;}
    let layer=null,layerIndex=-1;replay.playing=true;const button=document.getElementById('smart-analysis-play');button.textContent='暂停';button.setAttribute('aria-pressed','true');
    function frame(now){if(epoch!==replay.replayEpoch)return;const elapsed=Math.min(report.ms,base+now-anchor);replay.replayTime=elapsed;updateTimerSmartReplayClock(elapsed);
        const segmentEnd=index=>index+1<times.length&&report.moves[index].move===report.moves[index+1].move&&times[index+1]-times[index]<=120?index+2:index+1;let cursor=replay.cursor;while(cursor<times.length&&times[segmentEnd(cursor)-1]<=elapsed)cursor=segmentEnd(cursor);
        if(cursor!==replay.cursor){seekTimerSmartReplay(cursor,true);layer=null;layerIndex=-1;}
        if(cursor<times.length){const previous=cursor?times[cursor-1]:0,target=segmentEnd(cursor),end=times[target-1],duration=Math.min(200,Math.max(1,end-previous)),start=end-duration;
            if(elapsed>=start){if(layerIndex!==cursor){const body=document.querySelector('#smart-analysis-cube .timer-cube-body'),slots=timerCubeSlots(),axis=slots.find(slot=>slot.face===report.moves[cursor].move[0]).n;layer=document.createElement('div');layer.className='timer-live-layer';layer.dataset.axis=axis.join(',');body.append(layer);body.append(timerLiveContactCap(axis,.49));layer.append(timerLiveContactCap(axis,.51));for(const tile of body.querySelectorAll('.timer-live-sticker'))if(slots[Number(tile.dataset.index)].p.reduce((sum,v,k)=>sum+v*axis[k],0)===1)layer.append(tile);layerIndex=cursor;}
                const axis=layer.dataset.axis.split(',').map(Number),angle=(report.moves[cursor].move.endsWith("'")?-90:90)*(target-cursor)*Math.min(1,(elapsed-start)/duration);layer.style.transform=`rotate3d(${axis[0]},${-axis[1]},${axis[2]},${angle}deg)`;
            }
        }
        if(elapsed>=report.ms){seekTimerSmartReplay(report.moves.length,true);stopTimerSmartReplay();replay.replayTime=report.ms;updateTimerSmartReplayClock(report.ms);return;}
        replay.clockFrame=requestAnimationFrame(frame);
    }
    replay.clockFrame=requestAnimationFrame(frame);
}
function bindTimerSmartReplayView(model){
    let drag=null;
    const consume=event=>{if(event.cancelable)event.preventDefault();event.stopPropagation();};
    const begin=(id,x,y)=>{drag={id,x,y,axis:null};model.classList.add('dragging');};
    const move=(id,x,y)=>{if(!drag||drag.id!==id)return;const dx=x-drag.x,dy=y-drag.y;if(!drag.axis&&Math.hypot(dx,dy)>5)drag.axis=Math.abs(dx)>=Math.abs(dy)?'y':'x';if(drag.axis==='y')model.style.setProperty('--cube-y',(-32+dx*.65)+'deg');if(drag.axis==='x')model.style.setProperty('--cube-x',(-25-dy*.65)+'deg');};
    const reset=()=>{drag=null;model.classList.remove('dragging');model.style.removeProperty('--cube-x');model.style.removeProperty('--cube-y');};
    model.onpointerdown=event=>{if(drag||(event.pointerType!=='touch'&&event.button!==0)||event.isPrimary===false)return;consume(event);begin(event.pointerId,event.clientX,event.clientY);try{model.setPointerCapture(event.pointerId);}catch{reset();}};
    model.onpointermove=event=>{if(!drag||drag.id!==event.pointerId)return;consume(event);move(event.pointerId,event.clientX,event.clientY);};
    const stop=event=>{if(!drag||drag.id!==event.pointerId)return;consume(event);reset();};model.onpointerup=stop;model.onpointercancel=stop;model.onlostpointercapture=stop;
    // A non-passive touch listener also keeps older embedded browsers from
    // treating a drag on the 3D stickers as a page swipe. Pointer capture stays
    // on the model so replacing animated stickers cannot terminate the gesture.
    model.addEventListener('touchstart',event=>{consume(event);if(!window.PointerEvent&&!drag&&event.touches.length===1){const t=event.changedTouches[0];begin(t.identifier,t.clientX,t.clientY);}},{passive:false});
    model.addEventListener('touchmove',event=>{consume(event);if(window.PointerEvent||!drag)return;const t=Array.from(event.changedTouches).find(t=>t.identifier===drag.id);if(t)move(t.identifier,t.clientX,t.clientY);},{passive:false});
    const stopTouch=event=>{consume(event);if(!window.PointerEvent&&drag&&Array.from(event.changedTouches).some(t=>t.identifier===drag.id))reset();};model.addEventListener('touchend',stopTouch,{passive:false});model.addEventListener('touchcancel',stopTouch,{passive:false});
}
function handleTimerSmartMove(move,stamp=timerSmartClockNow()){
    if(timerSmartAnalysis.open||timerSmartDeleteRecord)return;
    if(currentTimerMode!=='smart'||timerSmartEvent!=='333')return;
    if(!document.getElementById('timer-page')?.classList.contains('active')){if(timerSmartAttempt.phase!=='IDLE')cancelTimerSmartAttempt();return;}
    const attempt=timerSmartAttempt;
    if(['IDLE','RESULT'].includes(attempt.phase)){
        if(attempt.lastGesture&&move===timerSmartInverse(attempt.lastGesture)){void beginTimerSmartScramble();return;}
        attempt.lastGesture=move;return;
    }
    if(attempt.phase==='GENERATING'){(attempt.generatingMoves||=[]).push(move);return;}
    if(attempt.phase==='SCRAMBLING'){
        if(attempt.errors.length){if(move===timerSmartInverse(attempt.errors.at(-1)))attempt.errors.pop();else attempt.errors.push(move);}
        else{
            const expected=attempt.tokens[attempt.index];
            if(expected.endsWith('2')&&move[0]===expected[0]){
                if(!attempt.partial)attempt.partial=move;
                else if(move===attempt.partial){attempt.partial=null;attempt.index++;}
                else attempt.partial=null;
            }else if(move===expected){attempt.index++;attempt.partial=null;}
            else attempt.errors.push(move);
        }
        if(attempt.errors.length>6){void replaceTimerSmartScrambleTail();return;}
        renderTimerSmartScramble();if(attempt.index===attempt.tokens.length&&!attempt.errors.length)beginTimerSmartInspection(stamp);return;
    }
    if(attempt.phase==='INSPECTION')startTimerSmartSolve(Math.min(stamp,attempt.inspectionEnd),timerCubeTurn(timerSmartPhysicalState,timerSmartInverse(move)));
    if(attempt.phase==='SOLVING'){
        // The 15-second frame may run before a queued notification whose first
        // physical turn actually preceded that deadline. Retain the turn time.
        if(!attempt.trace.length&&stamp<attempt.started){attempt.started=stamp;attempt.initialState=timerCubeTurn(timerSmartPhysicalState,timerSmartInverse(move));}
        const last=attempt.lastMove,gap=last?Math.max(0,stamp-last.stamp):Math.max(0,stamp-attempt.started);
        if(gap>350)attempt.pauseMs+=gap-150;
        attempt.trace.push({move,t:Math.max(0,stamp-attempt.started)});
        const group=attempt.groups.at(-1);
        if(last&&move===last.move&&gap<=120&&group?.power===1){group.power=2;group.stamp=stamp;}
        else attempt.groups.push({move,power:1,stamp});
        attempt.lastMove={move,stamp};
        if(timerSmartPhysicalState===timerSmartSolved)finishTimerSmartSolve(stamp);
    }
}

function renderTimerBluetoothCandidates() {
    const list = document.getElementById('timer-bluetooth-devices');
    list.innerHTML = '';
    for (const device of timerBluetoothCandidates) {
        const line=document.createElement('div');line.className='timer-bluetooth-device-row';
        const row = document.createElement('button');
        row.type = 'button';
        row.textContent = `魔域智能魔方 · ${device.name || device.id.slice(0, 6)}`;
        row.onclick = () => connectTimerBluetoothDevice(device);
        line.appendChild(row);
        if(device===timerBluetoothDevice&&device.gatt?.connected){const disconnect=document.createElement('button');disconnect.type='button';disconnect.className='timer-bluetooth-disconnect';disconnect.title='断开蓝牙连接';disconnect.setAttribute('aria-label','断开蓝牙连接');disconnect.textContent='⏻';disconnect.onclick=disconnectTimerBluetooth;line.appendChild(disconnect);}
        list.appendChild(line);
    }
}

async function openTimerBluetoothCard() {
    if (currentTimerMode !== 'smart') return;
    const card=document.getElementById('timer-bluetooth-card'),title=document.getElementById('timer-bluetooth-card-title');
    card.hidden=false;
    if(timerBluetoothDevice?.gatt?.connected){title.textContent=timerMoyuSession?.ready?'已连接，转动已同步':'已连接，转动未同步';renderTimerBluetoothCandidates();return;}
    renderTimerBluetoothCandidates();
    if(timerBluetoothCandidates.length){title.textContent='选择已授权的智能魔方';return;}
    if(typeof navigator.bluetooth?.getDevices==='function'){
        title.textContent='读取已授权设备...';
        try{const devices=await navigator.bluetooth.getDevices();
            for(const device of devices)if(/^WCU_MY/i.test(device.name||'')&&!timerBluetoothCandidates.some(d=>d.id===device.id))timerBluetoothCandidates.push(device);
            if(card.hidden)return;renderTimerBluetoothCandidates();
            title.textContent=timerBluetoothCandidates.length?'选择已授权的智能魔方':'点击搜寻设备进行首次配对';
        }catch{title.textContent='点击搜寻设备进行配对';}
        return;
    }
    scanTimerBluetooth();
}

function showTimerBluetoothScanIssue(message,error){
    document.getElementById('timer-bluetooth-card-title').textContent=message;
    const list=document.getElementById('timer-bluetooth-devices');let help=document.getElementById('timer-bluetooth-scan-help');if(!help){help=document.createElement('p');help.id='timer-bluetooth-scan-help';help.style.cssText='font-size:13px;line-height:1.7;color:var(--text-main);margin:10px 0;overflow-wrap:anywhere';list.append(help);}
    help.textContent=error?error.name+': '+(error.message||'浏览器没有返回设备'):'Android 手机请使用 Chrome 直接打开 HTTPS 网站。微信等内置网页和未接入原生蓝牙的 App 可能无法提供蓝牙连接。';
}
function scanTimerBluetooth() {
    const title = document.getElementById('timer-bluetooth-card-title');
    document.getElementById('timer-bluetooth-scan-help')?.remove?.();
    if(globalThis.isSecureContext===false){showTimerBluetoothScanIssue('蓝牙连接需要 HTTPS 安全页面');return;}
    if (!navigator.bluetooth?.requestDevice) {showTimerBluetoothScanIssue('当前浏览器未提供网页蓝牙接口');return;}
    title.textContent = '搜寻魔域智能魔方...';
    // The browser's native chooser performs discovery. Web Bluetooth does not expose
    // an arbitrary nearby-device list to a website before the user grants access.
    let selection;try{selection=navigator.bluetooth.requestDevice({
        // The currently selectable smart-cube family is MoYu. Match its advertised
        // name or dedicated service; never use shared battery/device-info services.
        filters: [{namePrefix:'WCU_MY'}, {services:['0783b03e-7735-b5a0-1760-a305d2795cb0']}],
        optionalServices:['0783b03e-7735-b5a0-1760-a305d2795cb0'],
        optionalManufacturerData:timerMoyuManufacturerIds()
    });}catch(error){showTimerBluetoothScanIssue('浏览器拒绝启动蓝牙设备选择',error);return;}
    return Promise.resolve(selection).then(async device => {
        title.textContent='正在自动识别魔方...';
        timerMoyuDiagnostic.advertisements=0;
        await timerMoyuAdvertisementMac(device);
        if (!timerBluetoothCandidates.some(candidate => candidate.id === device.id)) timerBluetoothCandidates.push(device);
        renderTimerBluetoothCandidates();
        await connectTimerBluetoothDevice(device);
    }).catch(error => {
        const message=error.name==='NotFoundError'?'未返回设备：选择已取消，或浏览器未打开选择窗口':error.name==='SecurityError'||error.name==='NotAllowedError'?'浏览器限制或权限阻止了蓝牙请求':'蓝牙设备选择失败';showTimerBluetoothScanIssue(message,error);
    });
}

async function connectTimerBluetoothDevice(device) {
    if(/^WCU_MY32_/i.test(device.name||'')&&timerSmartEvent!=='333'){document.getElementById('timer-bluetooth-card-title').textContent='这是三阶魔方，请先切换到智能三阶';return;}
    if(timerBluetoothConnecting)return;timerBluetoothConnecting=true;
    const title = document.getElementById('timer-bluetooth-card-title');
    title.textContent = '连接中...';
    try {
        if(timerBluetoothDevice&&timerBluetoothDevice!==device&&timerBluetoothDevice.gatt?.connected)timerBluetoothDevice.gatt.disconnect();
        Object.assign(timerMoyuDiagnostic,{stage:'连接中',packets:0,lengths:[],types:[],error:''});
        await stopTimerMoyu();
        if(!timerMoyuAddresses.get(device.id))await timerMoyuAdvertisementMac(device);
        await device.gatt.connect();
        resetTimerCubeBattery(device);timerBluetoothDevice=device;updateTimerBluetoothStatus(true);
        timerCubeView.x=-25;timerCubeView.y=-32;const view=document.getElementById('timer-virtual-cube');view.style.setProperty('--cube-x','-25deg');view.style.setProperty('--cube-y','-32deg');
        if(!device.__nbDisconnectInstalled){device.__nbDisconnectInstalled=true;device.addEventListener('gattserverdisconnected',()=>{
            if(timerBluetoothDevice!==device)return;stopTimerMoyu(true);timerBluetoothDevice=null;if(timerBluetoothIdleTimer!==null)clearTimeout(timerBluetoothIdleTimer);timerBluetoothIdleTimer=null;updateTimerBluetoothStatus(false);title.textContent='连接已断开';handleTimerCubeBatteryDisconnect();
        });}
        title.textContent='已连接，正在同步转动数据...';
        try {
            await startTimerMoyu(device);
            if(timerBluetoothDevice!==device||!device.gatt.connected)return;
            title.textContent='已连接，转动已同步';closeTimerBluetoothCard();
            updateTimerBluetoothContext();
        } catch(error) {
            timerMoyuDiagnostic.error=error.name+': '+error.message;
            await stopTimerMoyu();
            if(device.gatt.connected){
                updateTimerBluetoothStatus(true);
                document.getElementById('timer-bluetooth-label').textContent='已连接，转动未同步';
                title.textContent='蓝牙已连接，转动数据暂未同步；点击设备重试';
                console.warn('MY32 初始化失败',error);
                renderTimerBluetoothCandidates();
                const list=document.getElementById('timer-bluetooth-devices'),copy=document.createElement('button');
                copy.type='button';copy.textContent='复制连接诊断';
                const diagnostic=()=>JSON.stringify({model:device.name,broadcastAPI:typeof device.watchAdvertisements==='function',...timerMoyuDiagnostic},null,2);
                copy.onclick=async()=>{try{await navigator.clipboard.writeText(diagnostic());copy.textContent='诊断已复制';}catch{const text=document.createElement('textarea');text.readOnly=true;text.value=diagnostic();text.setAttribute('aria-label','连接诊断信息');list.append(text);text.select();}};
                list.appendChild(copy);
            }else{updateTimerBluetoothStatus(false);title.textContent='连接已断开，请重试';}
        }
    }catch(error){updateTimerBluetoothStatus(false);title.textContent='蓝牙连接失败，请重试';console.warn('蓝牙连接失败',error);}
    finally{timerBluetoothConnecting=false;updateTimerBluetoothContext();}
}

document.addEventListener('DOMContentLoaded', () => {
    installTimerCubeRotation();
    installTimerSmartAbortGesture();
    updateTimerBluetoothIdleLabel();
    new MutationObserver(records=>{if(records.some(record=>record.target.classList?.contains('page-container')))updateTimerBluetoothContext();}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
    if(typeof ResizeObserver==='function'){
        const container=document.getElementById('scramble-text')?.closest('.scramble-container');
        if(container)new ResizeObserver(layoutTimerSmartStage).observe(container);
    }
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&['GENERATING','SCRAMBLING','INSPECTION','SOLVING'].includes(timerSmartAttempt.phase))cancelTimerSmartAttempt();});
});
