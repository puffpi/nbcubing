importScripts('vendor/lz-string-1.5.0.min.js');
self.onmessage=({data:{revision,config}})=>{
 const history=JSON.stringify(config.history);
 if(history.length>1000000){config.historyCompressed=LZString.compressToUTF16(history);delete config.history;}
 self.postMessage({revision,text:JSON.stringify(config)});
};
