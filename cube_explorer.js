/* Cube Explorer state engine. U/R/F/D/L/B facelets, row-major, viewed from outside. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExplorerCube=api;})(typeof self!=='undefined'?self:globalThis,function(){
 'use strict';
 const faces='URFDLB',solved=faces.split('').map(face=>face.repeat(9)).join('');
 const normals={U:[0,1,0],R:[1,0,0],F:[0,0,1],D:[0,-1,0],L:[-1,0,0],B:[0,0,-1]};
 const colors={U:'#f8fafc',R:'#df5554',F:'#42a878',D:'#edca48',L:'#ed994d',B:'#508bc8'};
 const moves={U:[1,1,-1],R:[0,1,-1],F:[2,1,-1],D:[1,-1,1],L:[0,-1,1],B:[2,-1,1],M:[0,0,1],E:[1,0,1],S:[2,0,-1],x:[0,null,-1],y:[1,null,-1],z:[2,null,-1]};
 function position(face,row,col){switch(face){case'U':return[col-1,1,row-1];case'R':return[1,1-row,1-col];case'F':return[col-1,1-row,1];case'D':return[col-1,-1,1-row];case'L':return[-1,1-row,col-1];default:return[1-col,1-row,-1];}}
 const slots=[];for(const face of faces)for(let row=0;row<3;row++)for(let col=0;col<3;col++)slots.push({face,row,col,p:position(face,row,col),n:normals[face]});
 const key=(p,n)=>p.join(',')+'|'+n.join(','),indices=new Map(slots.map((s,i)=>[key(s.p,s.n),i])),permutations=new Map();
 function rotate(v,axis,quarter){let out=v.slice();for(let i=0;i<(quarter%4+4)%4;i++){const[x,y,z]=out;out=axis===0?[x,-z,y]:axis===1?[z,y,-x]:[-y,x,z];}return out;}
 function inverse(tokens){return tokens.slice().reverse().map(token=>token.endsWith('2')?token:token.endsWith("'")?token.slice(0,-1):token+"'");}
 function parse(input){
  if(typeof input!=='string'||input.length>8192)throw Error('公式过长，请控制在 8192 个字符以内。');
  const text=input.replace(/[’‘′`]/g,"'").replace(/\/\/[^\n]*/g,'');let at=0;
  const skip=()=>{while(/\s/.test(text[at]||'')&&at<text.length)at++;};
  const append=(target,more)=>{target.push(...more);if(target.length>512)throw Error('展开后最多支持 512 步，请缩短公式。');};
  function sequence(stops='',depth=0){
   if(depth>12)throw Error('公式嵌套过深。');const output=[];
   while(at<text.length){skip();if(at>=text.length||stops.includes(text[at]))break;let group;
    if(text[at]==='('){at++;group=sequence(')',depth+1);if(text[at++]!==')')throw Error('括号没有配对。');}
    else if(text[at]==='['){at++;const a=sequence(',:]',depth+1),separator=text[at++];if(separator!==','&&separator!==':')throw Error('请使用 [A,B] 或 [A:B]。');const b=sequence(']',depth+1);if(text[at++]!==']')throw Error('方括号没有配对。');group=[...a,...b,...inverse(a),...(separator===','?inverse(b):[])];}
    else{
     const match=/^([URFDLB]w?|[MESxyzurfdlb])(2'?|')?/.exec(text.slice(at));if(!match)throw Error('无法识别第 '+(at+1)+' 个字符附近的公式。');
     at+=match[0].length;let face=match[1];if(face.endsWith('w'))face=face[0].toLowerCase();append(output,[face+(match[2]?.startsWith('2')?'2':match[2]||'')]);continue;
    }
    const count=/^\d+/.exec(text.slice(at));let repeat=1;if(count){repeat=Number(count[0]);at+=count[0].length;if(repeat<1||repeat>99)throw Error('重复次数需为 1–99。');}
    if(text[at]==="'"){group=inverse(group);at++;}for(let i=0;i<repeat;i++)append(output,group);
   }return output;
  }
  const result=sequence();skip();if(at!==text.length)throw Error('公式括号或符号不完整。');return result;
 }
 function permutation(token){
  if(permutations.has(token))return permutations.get(token);
  const letter=token[0],wide=/[urfdlb]/.test(letter),[axis,layer,sign]=moves[wide?letter.toUpperCase():letter]||[];
  if(axis===undefined)throw Error('不支持的转动。');const quarter=sign*(token.endsWith('2')?2:token.endsWith("'")?-1:1);
  const result=slots.map(s=>{const selected=layer===null||(wide?s.p[axis]!==-layer:s.p[axis]===layer);return selected?indices.get(key(rotate(s.p,axis,quarter),rotate(s.n,axis,quarter))):indices.get(key(s.p,s.n));});
  permutations.set(token,result);return result;
 }
 function apply(state,algorithm){if(typeof state!=='string'||state.length!==54||/[^URFDLB]/.test(state))throw Error('魔方状态无效。');let out=state;for(const token of typeof algorithm==='string'?parse(algorithm):algorithm){const next=Array(54),perm=permutation(token);for(let i=0;i<54;i++)next[perm[i]]=out[i];out=next.join('');}return out;}
 function canonical(state){const centers=faces.split('').map((_,i)=>state[i*9+4]);if(new Set(centers).size!==6)throw Error('六个中心色必须各不相同。');return state.split('').map(color=>faces[centers.indexOf(color)]||'?').join('');}
 function isSolved(state){return state.length===54&&faces.split('').every((_,i)=>state.slice(i*9,i*9+9)===state[i*9+4].repeat(9));}
 function randomScramble(length=25){const result=[];let lastAxis=-1;const axes=[0,1,2,0,1,2];for(let i=0;i<length;i++){let index;do{index=Math.floor(Math.random()*6);}while(axes[index]===lastAxis);lastAxis=axes[index];result.push(faces[index]+['',"'",'2'][Math.floor(Math.random()*3)]);}return result.join(' ');}
 return{faces,solved,slots,colors,normals,parse,inverse,apply,canonical,isSolved,randomScramble};
});

// The same file is also the dedicated Worker entry; solver work never runs in the UI.
if(typeof importScripts==='function'&&typeof document==='undefined'){
(function(){
/* The entire two-phase search, including pruning initialization, stays off the UI thread. */
'use strict';
importScripts('vendor/min2phase-0.0.4.js');
let initialized=false;
self.onmessage=({data})=>{
 const{id,facelets,maxDepth,excluded=[]}=data||{};
 try{
  if(!Number.isInteger(maxDepth)||maxDepth<1||maxDepth>30||typeof facelets!=='string'||facelets.length!==54)throw Error('求解参数无效。');
  const start=performance.now();
  if(!initialized){postMessage({id,type:'progress',message:'首次使用，正在准备求解引擎…'});min2phase.initFull();initialized=true;}
  const seen=new Set(excluded.map(algorithm=>ExplorerCube.parse(algorithm).join(' '))),queue=[];
  // Public axis filters diversify paths; next() continues a bounded search rather than restarting the same answer.
  for(const first of [undefined,0,1,2])for(const last of [undefined,0,1,2])queue.push({search:new min2phase.Search(),first,last,started:false});
  let reported=start;
  while(queue.length&&performance.now()-start<29500){
   const task=queue.shift(),result=task.started?task.search.next(1000,0,0):task.search.solution(facelets,maxDepth,1000,0,0,task.first,task.last);task.started=true;
   if(result==='Error 7')continue;
   if(result!=='Error 8'){
    if(/^Error/.test(result))throw Error('这个配色不能组成合法魔方，请检查棱块、角块和中心色。');
    const tokens=ExplorerCube.parse(result.trim()),algorithm=tokens.join(' ');
    if(tokens.length>maxDepth||!ExplorerCube.isSolved(ExplorerCube.apply(facelets,tokens)))throw Error('解法校验失败，请重试。');
    if(!seen.has(algorithm)){postMessage({id,type:'solution',algorithm,length:tokens.length,elapsed:performance.now()-start});return;}
   }
   queue.push(task);
   if(performance.now()-reported>250){postMessage({id,type:'progress',message:seen.size?'正在跳过已有解法，寻找其他路径…':'正在寻找 '+maxDepth+' 步以内的解法…'});reported=performance.now();}
  }
  postMessage({id,type:queue.length?'timeout':seen.size?'no-new':'not-found'});
 }catch(error){postMessage({id,type:'error',message:error.message||'求解失败，请重试。'});}
};

})();
}else if(typeof window!=='undefined'&&typeof document!=='undefined'){
/* Loaded on entry only. Rendering is event-driven; search lives in a disposable Worker. */
(function(){
 'use strict';
 const C=window.ExplorerCube,$=id=>document.getElementById(id),page=$('cube-explorer-page');
 let initialized=false,state=C.solved,source='',paint=false,paintColor='U',model=null,modelLoading=null,modelRequest=0;
 let worker=null,job=0,busy=false,deadline=0,ticker=0,started=0,records=[],visibleRecords=30,dbPromise=null;
 let playback=null,playIndex=0,playSerial=0,playRunning=false,layoutFrame=0;
 const active=()=>page.classList.contains('active');
 function status(message,kind=''){const el=$('ce-status');el.textContent=message;el.dataset.kind=kind;}
 function setBusy(value){busy=value;$('ce-solve').disabled=false;$('ce-solve').dataset.busy=String(value);$('ce-solve').querySelector('.ce-spinner').hidden=!value;$('ce-solve-text').textContent=value?'停止搜索':'求解当前状态';page.setAttribute('aria-busy',String(value));}
 function database(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{const request=indexedDB.open('nb-cube-explorer',1);request.onupgradeneeded=()=>request.result.createObjectStore('solutions',{keyPath:'id',autoIncrement:true});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('记录库被另一个页面占用。'));});
  dbPromise.catch(()=>{dbPromise=null;});return dbPromise;
 }
 async function storage(mode,operation){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('solutions',mode),request=operation(tx.objectStore('solutions'));tx.oncomplete=()=>resolve(request.result);tx.onerror=tx.onabort=()=>reject(tx.error||Error('记录保存失败。'));});}
 function updateHighlights(){for(const item of $('ce-history').querySelectorAll('.ce-history-item'))for(const move of item.querySelectorAll('.ce-move'))move.classList.toggle('is-done',!!playback&&item.dataset.record===String(playback.id)&&Number(move.dataset.step)<playIndex);}
 function stopPlayback(clear=false){++playSerial;playRunning=false;model?.setState(state);if(clear){playback=null;playIndex=0;updateHighlights();}}
 function cancel(silent=false,dispose=false){job++;clearTimeout(deadline);clearInterval(ticker);if(busy||dispose){worker?.terminate();worker=null;}if(busy&&!silent)status('搜索已停止，已有记录已保留。');setBusy(false);}
 function stopForChange(){cancel(true);stopPlayback(true);}
 function drawModel(){if(model)model.setState(state);}
 function ensureModel(){
  if(model)return Promise.resolve();if(modelLoading)return modelLoading;const request=++modelRequest;
  $('ce-model').textContent='正在准备魔方…';
  modelLoading=(async()=>{await ensureThreeCore();const viewer=await preloadFormulaViewer();if(request!==modelRequest||!active())return;model=viewer.mountCube($('ce-model'),uiSettings.virtualCubeAppearance||'black',{colors:C.colors,isActive:active,scale:.9});if(!model)throw Error('模型未能初始化');model.setState(state);})().catch(error=>{if(request===modelRequest&&active()){$('ce-model').textContent='模型加载失败，点击“重置视角”重试';status('魔方模型加载失败，请重试。','error');}}).finally(()=>{if(request===modelRequest)modelLoading=null;});return modelLoading;
 }
 function updateLayout(){
  layoutFrame=0;if(!active())return;const frame=page.querySelector('.ce-net-frame'),style=getComputedStyle(frame);
  const width=frame.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height=frame.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
  $('ce-net').style.setProperty('--ce-face-size',Math.max(10,Math.floor(Math.min(82,(width-56-15)/4,(height-10)/3)))+'px');
  const list=$('ce-history'),track=$('ce-history-scrollbar'),maximum=Math.max(0,list.scrollHeight-list.clientHeight);
  track.hidden=list.clientHeight<=0||maximum<=1;track.setAttribute('aria-valuemax',String(Math.round(maximum)));track.setAttribute('aria-valuenow',String(Math.round(list.scrollTop)));
  if(!track.hidden){const height=Math.min(list.clientHeight,Math.max(30,list.clientHeight*list.clientHeight/list.scrollHeight));track.firstElementChild.style.height=height+'px';track.firstElementChild.style.transform='translateY('+(list.scrollTop/maximum*(list.clientHeight-height))+'px)';}
 }
 function scheduleLayout(){if(!layoutFrame)layoutFrame=requestAnimationFrame(updateLayout);}
 function setupScrollbar(){
  const list=$('ce-history'),track=$('ce-history-scrollbar');let drag=null;
  list.addEventListener('scroll',scheduleLayout,{passive:true});
  track.addEventListener('pointerdown',event=>{if(event.isPrimary===false||event.button>0)return;event.preventDefault();event.stopPropagation();const rect=track.getBoundingClientRect(),thumb=track.firstElementChild,maximum=list.scrollHeight-list.clientHeight,travel=rect.height-thumb.getBoundingClientRect().height;if(maximum<=0||travel<=0)return;if(event.target!==thumb)list.scrollTop=(event.clientY-rect.top-thumb.getBoundingClientRect().height/2)/travel*maximum;drag={id:event.pointerId,y:event.clientY,top:list.scrollTop,maximum,travel};track.setPointerCapture(event.pointerId);track.classList.add('is-dragging');scheduleLayout();});
  track.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;event.preventDefault();event.stopPropagation();list.scrollTop=drag.top+(event.clientY-drag.y)/drag.travel*drag.maximum;scheduleLayout();});
  const finish=()=>{drag=null;track.classList.remove('is-dragging');};track.addEventListener('pointerup',finish);track.addEventListener('pointercancel',finish);track.addEventListener('lostpointercapture',finish);
  track.addEventListener('wheel',event=>{event.preventDefault();event.stopPropagation();list.scrollTop+=event.deltaY*(event.deltaMode===1?40:event.deltaMode===2?list.clientHeight:1);scheduleLayout();},{passive:false});
  track.addEventListener('keydown',event=>{const delta={ArrowDown:40,ArrowUp:-40,PageDown:list.clientHeight,PageUp:-list.clientHeight,' ':(event.shiftKey?-1:1)*list.clientHeight}[event.key];if(delta===undefined&&!['Home','End'].includes(event.key))return;event.preventDefault();event.stopPropagation();list.scrollTop=event.key==='Home'?0:event.key==='End'?list.scrollHeight:list.scrollTop+delta;scheduleLayout();});
  const observer=new ResizeObserver(scheduleLayout);observer.observe(page.querySelector('.ce-net-frame'));observer.observe(page.querySelector('.ce-history-wrap'));
 }
 function drawNet(){
  const net=$('ce-net');if(!net.children.length){for(const face of C.faces){const area=document.createElement('div');area.className='ce-face';area.dataset.face=face;for(let i=0;i<9;i++){const button=document.createElement('button');button.type='button';button.className='ce-sticker';button.dataset.index=C.faces.indexOf(face)*9+i;button.textContent=i===4?face:'';area.appendChild(button);}net.appendChild(area);}}
  net.classList.toggle('is-editing',paint);for(const button of net.querySelectorAll('.ce-sticker')){const index=Number(button.dataset.index);button.style.setProperty('--ce-sticker-color',C.colors[state[index]]);button.style.backgroundColor='var(--ce-sticker-color)';button.setAttribute('aria-label',C.slots[index].face+' 面第 '+(index%9+1)+' 格，颜色 '+state[index]);button.tabIndex=paint?0:-1;}
 }
 function draw(){if(!active())return;drawModel();drawNet();scheduleLayout();}
 function showState(next,message){state=next;draw();if(message)status(message);}
 function applyScramble(){try{const tokens=C.parse($('ce-algorithm').value);stopForChange();source=tokens.join(' ');showState(C.apply(C.solved,tokens),tokens.length?'已应用 '+tokens.length+' 步打乱。':'当前为复原状态。');}catch(error){status(error.message,'error');}}
 function timeout(id,seekingNew=false){if(id!==job||!busy)return;cancel(true,true);status(seekingNew?'30 秒内未找到其他不重复的解法，搜索已停止，已有记录已保留。':'30 秒内未找到当前步数设置内的解法，搜索已停止。可提高步数或再次搜索。','error');}
 function hasMoves(record){try{return C.parse(record.algorithm).length>0;}catch(error){return false;}}
 function samePath(a,b){try{return C.canonical(a.state)===C.canonical(b.state)&&C.parse(a.algorithm).join(' ')===C.parse(b.algorithm).join(' ');}catch(error){return false;}}
 async function addRecord(record){
  if(!hasMoves(record)){status('已经复原，无需转动。','success');return;}
  if(records.some(existing=>samePath(existing,record))){status('这条解法已在记录中，没有重复添加。');return;}
  try{const db=await database();record.id=await new Promise((resolve,reject)=>{const tx=db.transaction('solutions','readwrite'),store=tx.objectStore('solutions');let key=null;const read=store.getAll();read.onsuccess=()=>{if(!read.result.some(existing=>samePath(existing,record))){const write=store.add(record);write.onsuccess=()=>{key=write.result;};}};tx.oncomplete=()=>resolve(key);tx.onerror=tx.onabort=()=>reject(tx.error||Error('记录保存失败。'));});if(record.id===null){status('这条解法已在记录中，没有重复添加。');return;}records.unshift(record);renderHistory();}
  catch(error){record.id='session-'+Date.now();records.unshift(record);renderHistory();status('解法已生成，但本机记录保存失败；离开前请复制解法。','error');}
 }
 function solve(){
  if(busy)return;
  if(C.isSolved(state)){stopPlayback(true);status('已经复原，无需转动。','success');return;}
  const depth=Number($('ce-depth').value);if(!Number.isInteger(depth)||depth<1||depth>30){status('步数设置请输入 1–30 的整数。','error');return;}
  let facelets;try{facelets=C.canonical(state);}catch(error){status(error.message,'error');return;}
  stopPlayback();const snapshot=state,scramble=source,id=++job,excluded=records.filter(record=>{try{return C.canonical(record.state)===facelets;}catch(error){return false;}}).map(record=>record.algorithm);started=performance.now();setBusy(true);status(excluded.length?'正在寻找不同的还原路径…':'正在准备搜索…');
  deadline=setTimeout(()=>timeout(id,excluded.length>0),30000);ticker=setInterval(()=>{if(id===job&&busy)$('ce-solve-text').textContent='停止搜索 · '+Math.floor((performance.now()-started)/1000)+' 秒';},500);
  try{
   if(!worker){worker=new Worker('cube_explorer.js?v=1.46.5');worker.onerror=()=>{const running=busy;cancel(true,true);if(running)status('求解引擎加载失败，请重试。','error');};}
   worker.onmessage=async({data})=>{
    if(data.id!==job||!busy)return;
    if(performance.now()-started>=30000){timeout(id,excluded.length>0);return;}
    if(data.type==='progress'){status(data.message);return;}
    clearTimeout(deadline);clearInterval(ticker);setBusy(false);
    if(data.type==='timeout'){cancel(true,true);status(excluded.length?'30 秒内未找到其他不重复的解法，搜索已停止，已有记录已保留。':'30 秒内未找到符合步数设置的解法，搜索已停止。可提高步数后重试。','error');return;}
    if(data.type==='not-found'){status('没有找到 '+depth+' 步以内的解法，可提高步数设置再试。','error');return;}
    if(data.type==='no-new'){status('没有找到其他不重复的解法，可调整步数设置再试。');return;}
    if(data.type==='error'){status(data.message,'error');return;}
    if(data.type==='solution'){
     try{const tokens=C.parse(data.algorithm);if(tokens.length>depth||!C.isSolved(C.apply(snapshot,tokens)))throw Error('解法校验失败，请重新搜索。');
      const elapsed=Math.round(performance.now()-started);status('找到 '+tokens.length+' 步解法 · '+(elapsed/1000).toFixed(2)+' 秒，已加入记录。','success');
      await addRecord({state:snapshot,scramble,algorithm:tokens.join(' '),length:tokens.length,limit:depth,elapsed,date:new Date().toISOString()});
     }catch(error){status(error.message,'error');}
    }
   };
   worker.postMessage({id,facelets,maxDepth:depth,excluded});
  }catch(error){cancel(true);status('浏览器暂时无法启动求解引擎，请重试。','error');}
 }
 function textElement(tag,cls,text){const el=document.createElement(tag);el.className=cls;el.textContent=text;return el;}
 function renderHistory(){
  $('ce-history-count').textContent=records.length;const list=$('ce-history'),scrollTop=list.scrollTop;list.replaceChildren();if(!records.length){list.appendChild(textElement('p','ce-empty','求解后，记录会保存在这里。'));scheduleLayout();return;}
  for(const record of records.slice(0,visibleRecords)){
   const item=document.createElement('article');item.className='ce-history-item';item.dataset.record=String(record.id);const top=document.createElement('div');top.className='ce-history-top';
   top.append(textElement('strong','',record.length+' 步 / 设置 '+record.limit),textElement('span','',new Date(record.date).toLocaleString('zh-CN',{hour12:false})+' · 用时 '+(record.elapsed/1000).toFixed(2)+' 秒'));item.appendChild(top);
   const algorithm=textElement('p','ce-history-alg',''),tokens=C.parse(record.algorithm);tokens.forEach((token,index)=>{if(index)algorithm.appendChild(document.createTextNode(' '));const span=textElement('span','ce-move',token);span.dataset.step=index;algorithm.appendChild(span);});item.appendChild(algorithm);
   const actions=document.createElement('div');actions.className='ce-history-actions';
   for(const [action,label]of[['copy','复制解法'],['restore','查看状态'],['play','播放还原'],['step','单步演示']]){const button=textElement('button','ce-text-button',label);button.type='button';button.onclick=()=>recordAction(record,action).catch(error=>status(error.message,'error'));actions.appendChild(button);}item.appendChild(actions);
   const original=textElement('p','ce-history-source',record.scramble||'自定义配色 / 复原状态');original.id='ce-original-'+record.id;original.hidden=true;
   const toggle=textElement('button','ce-text-button ce-original-toggle','查看原打乱'),arrow=textElement('span','ce-original-arrow','');arrow.setAttribute('aria-hidden','true');toggle.appendChild(arrow);let turns=0;toggle.type='button';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',original.id);toggle.onclick=()=>{if(playback&&playback!==record)stopPlayback(true);original.hidden=!original.hidden;toggle.setAttribute('aria-expanded',String(!original.hidden));toggle.style.setProperty('--ce-arrow-turn',++turns*180+'deg');scheduleLayout();};actions.appendChild(toggle);item.appendChild(original);list.appendChild(item);
  }
  if(records.length>visibleRecords){const more=textElement('button','ce-text-button','加载更多记录');more.type='button';more.onclick=()=>{visibleRecords+=30;renderHistory();};list.appendChild(more);}
  list.scrollTop=scrollTop;updateHighlights();scheduleLayout();
 }
 async function copy(text){if(!text){status('当前没有可复制的公式。');return;}try{await navigator.clipboard.writeText(text);status('已复制。','success');}catch(error){const input=document.createElement('textarea');input.value=text;input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();const ok=document.execCommand('copy');input.remove();status(ok?'已复制。':'复制失败，请手动选择公式复制。',ok?'success':'error');}}
 async function recordAction(record,action){
  if(playback&&playback!==record)stopPlayback(true);
  if(action==='copy'){await copy(record.algorithm);return;}
  cancel(true);
  if(action==='restore'){stopPlayback(true);source=record.scramble;$('ce-algorithm').value=source;showState(record.state,'已恢复这条解法的起始状态。');return;}
  if(action==='step'&&playback===record&&playRunning)return;
  const reset=playback!==record||action==='play'||playIndex>=C.parse(record.algorithm).length;
  stopPlayback(reset);
  if(reset){playback=record;playIndex=0;state=record.state;source=record.scramble;$('ce-algorithm').value=source;draw();}
  const serial=++playSerial;await ensureModel();if(serial!==playSerial||!active())return;if(!model?.animateMove){status('模型尚未准备好，请稍后重试。','error');return;}
  const tokens=C.parse(record.algorithm);playRunning=true;
  try{
   do{
    if(playIndex>=tokens.length)break;const move=tokens[playIndex],turned=await model.animateMove(move,1.2);
    if(serial!==playSerial||!active()||!turned)return;
    state=C.apply(state,[move]);playIndex++;drawNet();updateHighlights();status('演示 '+playIndex+' / '+tokens.length+' · '+move);
   }while(action==='play'&&serial===playSerial);
   if(playIndex===tokens.length)status('还原演示完成 · '+tokens.length+' 步。','success');
  }finally{if(serial===playSerial)playRunning=false;}
 }
 async function action(name){
  if(name==='reset-colors'){stopForChange();source='';$('ce-algorithm').value='';showState(C.solved,'已恢复六面复原配色。');}
  else if(name==='random'){stopForChange();const text=C.randomScramble();$('ce-algorithm').value=text;source=text;showState(C.apply(C.solved,text),'已生成并应用随机打乱。');}
  else if(name==='apply')applyScramble();
  else if(name==='reset'){stopForChange();source='';$('ce-algorithm').value='';showState(C.solved,'当前为复原状态，解法记录已保留。');}
  else if(name==='solve'){if(busy)cancel();else solve();}
  else if(name==='view'){if(model)model.resetView();else ensureModel();}
  else if(name==='copy-scramble')copy($('ce-algorithm').value.trim());
  else if(name==='minus'||name==='plus')$('ce-depth').value=Math.max(1,Math.min(30,(Number($('ce-depth').value)||20)+(name==='minus'?-1:1)));
  else if(name==='edit'){paint=!paint;$('ce-palette').hidden=!paint;$('ce-edit-colors').setAttribute('aria-expanded',String(paint));$('ce-edit-colors').textContent=paint?'完成编辑':'编辑配色';drawNet();}
  else if(name==='clear'){stopForChange();try{await storage('readwrite',store=>store.clear());records=[];renderHistory();status('解法记录已清空。');}catch(error){status('清空失败，请重试。','error');}}
 }
 function setup(){
  setupScrollbar();
  page.addEventListener('click',event=>{const button=event.target.closest('[data-ce]');if(button)action(button.dataset.ce).catch(error=>status(error.message,'error'));});
  $('ce-model').addEventListener('keydown',event=>{if(!event.key.startsWith('Arrow'))return;event.preventDefault();model?.turnView(event.key==='ArrowLeft'?-.12:event.key==='ArrowRight'?.12:0,event.key==='ArrowUp'?-.12:event.key==='ArrowDown'?.12:0);});
  for(const face of C.faces){const button=document.createElement('button');button.type='button';button.style.setProperty('--ce-ball-index',C.faces.indexOf(face));button.style.setProperty('--ce-palette-color',C.colors[face]);button.style.background='var(--ce-palette-color)';button.setAttribute('aria-label','选择 '+face+' 色');button.setAttribute('aria-pressed',String(face===paintColor));button.onclick=()=>{paintColor=face;for(const other of $('ce-palette').children)other.setAttribute('aria-pressed',String(other===button));};$('ce-palette').appendChild(button);}
  $('ce-net').addEventListener('click',event=>{const button=event.target.closest('[data-index]');if(!paint||!button)return;stopForChange();const index=Number(button.dataset.index);state=state.slice(0,index)+paintColor+state.slice(index+1);source='';draw();status('已修改配色。求解前会检查魔方是否合法。');});
  storage('readonly',store=>store.getAll()).then(rows=>{records=rows.reverse().filter(hasMoves);renderHistory();}).catch(()=>status('浏览器暂时无法读取本机解法记录；生成解法后请及时复制。','error'));
 }
 function enter(){if(!initialized){initialized=true;setup();}draw();ensureModel();scheduleLayout();}
 function leave(){cancel(true,true);stopPlayback(true);++modelRequest;modelLoading=null;model?.dispose();model=null;}
 window.CubeExplorer={enter,leave};
})();

}
