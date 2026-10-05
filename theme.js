/* Palette overlay keeps layout, cube stickers and accent colors intact. */
const themeSystem=matchMedia('(prefers-color-scheme: dark)');
function themeColor(value,property){
 return value.replace(/#[\da-f]{3,8}\b|rgba?\([^)]*\)|\bwhite\b|\bblack\b/gi,token=>{
  let rgb,alpha=1;
  if(token==='white')rgb=[255,255,255];else if(token==='black')rgb=[0,0,0];
  else if(token[0]==='#'){let hex=token.slice(1);if(hex.length===3||hex.length===4)hex=hex.split('').map(c=>c+c).join('');rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));if(hex.length===8)alpha=parseInt(hex.slice(6),16)/255;}
  else{const nums=token.match(/[\d.]+/g).map(Number);rgb=nums.slice(0,3);alpha=nums[3]??1;}
  const [r,g,b]=rgb;
  // UI accents need their own dark palette; preserve their meaning without glare.
  const blue=b>r+30&&b>g+15;
  const green=g>r+35&&g>b+10;
  if(blue||green){
   let accent;
   if(property==='color')accent=blue?[174,194,219]:[99,196,159];
   else if(/border/.test(property))accent=blue?[115,135,158]:[69,128,104];
   else if(/background/.test(property)&&(r+g+b)/3>155)accent=blue?[37,42,49]:[32,45,39];
   if(accent)return `rgba(${accent.join(',')},${alpha})`;
  }
  if(Math.max(...rgb)-Math.min(...rgb)>85)return token;
  const brightness=(r+g+b)/3;let out;
  if(property==='color'){if(brightness<110)out=[229,229,231];else if(brightness<210)out=[158,158,163];}
  else if(/border|shadow/.test(property)){if(brightness>170)out=[53,53,56];}
  else if(/background/.test(property)&&brightness>190)out=brightness>247?[28,28,30]:[38,38,40];
  return out?`rgba(${out.join(',')},${alpha})`:token;
 });
}
function buildDarkPalette(){
 const overlay=document.createElement('style');overlay.id='dark-palette';let css='';
 const walk=rules=>{for(const rule of rules){if(rule.selectorText&&rule.style){if(/data-theme|cube-appearance-swatch|cube-logo-swatch|cubing-icon/.test(rule.selectorText))continue;let declarations='';for(const property of rule.style){if(!/^(color|background.*|border.*|box-shadow)$/.test(property))continue;const value=rule.style.getPropertyValue(property),mapped=themeColor(value,property);if(mapped!==value)declarations+=`${property}:${mapped}${rule.style.getPropertyPriority(property)?' !important':''};`;}
 if(declarations){const selector=rule.selectorText.split(',').map(s=>s.trim()===':root'?'html[data-theme="dark"]':`html[data-theme="dark"] ${s.trim()}`).join(',');css+=`${selector}{${declarations}}`;}}
 else if(rule.cssRules&&!/^@(?:-webkit-)?keyframes/i.test(rule.cssText)){const before=css;css='';walk(rule.cssRules);const inner=css;css=before+rule.cssText.slice(0,rule.cssText.indexOf('{')+1)+inner+'}';}}};
 for(const sheet of [...document.styleSheets]){try{walk(sheet.cssRules);}catch{}}overlay.textContent=css;document.head.append(overlay);
}
function themeInline(root=document){
 for(const element of root.querySelectorAll('[style]')){
  if(element.closest('svg,.cubing-icon,.cube-appearance-swatch'))continue;
  if(element.style.position==='fixed'&&/modal|overlay|popup/.test(element.id+' '+element.className)&&(/100(vw|%)/.test(element.style.width)||element.style.inset==='0px'))element.dataset.themeBackdrop='';
  for(const [property,key] of [['background','surface'],['background-color','surface'],['color','ink'],['border-color','edge']]){const value=element.style.getPropertyValue(property);if(!value)continue;const mapped=themeColor(value,property);if(mapped!==value){element.dataset['theme'+key[0].toUpperCase()+key.slice(1)]='';const variable='--theme-'+key;if(element.style.getPropertyValue(variable)!==mapped)element.style.setProperty(variable,mapped);}}
 }
}
function applyDisplayMode(){
 const mode=localStorage.getItem('displayMode')||'light';document.documentElement.dataset.theme=mode==='system'?(themeSystem.matches?'dark':'light'):mode;
 const label=document.getElementById('display-mode-label');if(label)label.textContent={light:'浅色',dark:'深色',system:'跟随系统'}[mode];
 if(window.Chart){const dark=document.documentElement.dataset.theme==='dark';Chart.defaults.color=dark?'#a0a0a5':'#666';Chart.defaults.borderColor=dark?'#353538':'rgba(0,0,0,.1)';for(const chart of Object.values(Chart.instances||{})){for(const scale of Object.values(chart.options.scales||{})){scale.ticks.color=Chart.defaults.color;scale.grid.color=Chart.defaults.borderColor;if(scale.title)scale.title.color=Chart.defaults.color;}chart.update('none');}}
}
function openDisplayModeModal(){
 const modal=document.getElementById('cube-appearance-modal');modal.classList.remove('timer-settings-context');document.getElementById('cube-appearance-title').textContent='显示模式';const list=document.getElementById('cube-appearance-options');list.replaceChildren();
 for(const [value,label] of [['light','浅色'],['dark','深色'],['system','跟随系统']]){const button=document.createElement('button');button.type='button';button.className='cube-appearance-option'+((localStorage.getItem('displayMode')||'light')===value?' active':'');button.textContent=label;button.onclick=()=>{localStorage.setItem('displayMode',value);applyDisplayMode();closeCubeAppearanceModal();};list.append(button);}modal.hidden=false;
}
buildDarkPalette();themeInline();applyDisplayMode();themeSystem.addEventListener('change',applyDisplayMode);
let themeFrame;new MutationObserver(()=>{if(themeFrame)return;themeFrame=requestAnimationFrame(()=>{themeFrame=null;themeInline();});}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});
