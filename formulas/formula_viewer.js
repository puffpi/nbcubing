// CFOP case diagrams and animation. Loaded only after opening the formula library.
// Coordinates: U +Y, F +Z, R +X. The color order matches the requested cube.
(function () {
    const COLORS = { U: '#f5d935', D: '#f8fafc', F: '#3979d5', B: '#3bbd65', L: '#f49436', R: '#e94b48' };
    const NORMALS = { U:[0,1,0], D:[0,-1,0], F:[0,0,1], B:[0,0,-1], L:[-1,0,0], R:[1,0,0] };
    const MOVES = {
        U:['y',1,-1], D:['y',-1,1], R:['x',1,-1], L:['x',-1,1], F:['z',1,-1], B:['z',-1,1],
        M:['x',0,1], E:['y',0,1], S:['z',0,-1],
        u:['y',1,-1,true], d:['y',-1,1,true], r:['x',1,-1,true], l:['x',-1,1,true], f:['z',1,-1,true], b:['z',-1,1,true],
        x:['x',null,-1], y:['y',null,-1], z:['z',null,-1]
    };
    const AXIS = {x:0,y:1,z:2};
    let mounted = null;
    const orientationCache = new Map();

    function parse(algorithm) {
        const tokens = algorithm.replace(/[()\[\],:]/g, ' ').match(/(?:[URFDLBMESurfdlbxyz])(?:2'?|')?/g) || [];
        return tokens.map(token => {
            const move = MOVES[token[0]];
            if (!move) return null;
            const turns = token.includes('2') ? 2 : 1;
            return {axis:move[0], layer:move[1], wide:!!move[3], quarter:move[2] * turns * (token.includes("'") && turns !== 2 ? -1 : 1)};
        }).filter(Boolean);
    }
    function inverse(moves) { return moves.slice().reverse().map(move => ({...move,quarter:-move.quarter})); }
    function selected(position, move) {
        if (move.layer === null) return true;
        const value = position[AXIS[move.axis]];
        return move.wide ? value !== -move.layer : value === move.layer;
    }
    function rotateVector(vector, axis, quarter) {
        let output = vector.slice();
        const steps = ((quarter % 4) + 4) % 4;
        for (let i=0;i<steps;i++) {
            const [x,y,z] = output;
            output = axis === 'x' ? [x,-z,y] : axis === 'y' ? [z,y,-x] : [-y,x,z];
        }
        return output;
    }
    function faceletPosition(face,row,col) {
        switch(face) {
            case 'U': return [col-1,1,row-1];
            case 'D': return [col-1,-1,1-row];
            case 'F': return [col-1,1-row,1];
            case 'B': return [1-col,1-row,-1];
            case 'R': return [1,1-row,1-col];
            default: return [-1,1-row,col-1];
        }
    }
    function solvedStickers() {
        const stickers=[];
        for (const face of Object.keys(COLORS)) for(let row=0;row<3;row++) for(let col=0;col<3;col++) {
            stickers.push({position:faceletPosition(face,row,col),normal:NORMALS[face].slice(),color:COLORS[face]});
        }
        return stickers;
    }
    function turnStickers(stickers,move) {
        for(const sticker of stickers){
            if(!selected(sticker.position,move))continue;
            sticker.position=rotateVector(sticker.position,move.axis,move.quarter);
            sticker.normal=rotateVector(sticker.normal,move.axis,move.quarter);
        }
    }
    function centerKey(stickers) {
        return Object.keys(COLORS).map(face=>stickers.find(s=>s.position.every((v,i)=>v===NORMALS[face][i]) && s.normal.every((v,i)=>v===NORMALS[face][i]))?.color).join('|');
    }
    function targetOrientation(algorithm) {
        if(orientationCache.has(algorithm))return orientationCache.get(algorithm);
        const trial=solvedStickers();
        for(const move of parse(algorithm))turnStickers(trial,move);
        const target=centerKey(trial), queue=[{moves:[],stickers:solvedStickers()}], seen=new Set();
        let result=[];
        while(queue.length){
            const current=queue.shift(),key=centerKey(current.stickers);
            if(seen.has(key))continue;
            seen.add(key);
            if(key===target){result=current.moves;break;}
            for(const axis of ['x','y','z']){
                const move={axis,layer:null,wide:false,quarter:1};
                const next=current.stickers.map(s=>({position:s.position.slice(),normal:s.normal.slice(),color:s.color}));
                turnStickers(next,move);
                queue.push({moves:[...current.moves,move],stickers:next});
            }
        }
        orientationCache.set(algorithm,result);
        return result;
    }
    function caseState(algorithm, extraY=0) {
        const stickers=solvedStickers();
        for(const move of targetOrientation(algorithm))turnStickers(stickers,move);
        for(const move of inverse(parse(algorithm)))turnStickers(stickers,move);
        if(extraY)for(const sticker of stickers){
            sticker.position=rotateVector(sticker.position,'y',extraY);
            sticker.normal=rotateVector(sticker.normal,'y',extraY);
        }
        const colorAt=(face,row,col)=>{
            const pos=faceletPosition(face,row,col), normal=NORMALS[face];
            return stickers.find(s=>s.position.every((v,i)=>v===pos[i]) && s.normal.every((v,i)=>v===normal[i]))?.color || '#dbe3ee';
        };
        return colorAt;
    }
    function polygon(points,color,strokeWidth=1) { return `<polygon points="${points.map(p=>p.join(',')).join(' ')}" fill="${color}" stroke="#263242" stroke-width="${strokeWidth}"/>`; }
    function gridFace(face,origin,dx,dy,colorAt,margin=.10,strokeWidth=1) {
        let markup='';
        for(let row=0;row<3;row++) for(let col=0;col<3;col++) {
            const p=(r,c)=>[origin[0]+c*dx[0]+r*dy[0],origin[1]+c*dx[1]+r*dy[1]];
            markup+=polygon([p(row+margin,col+margin),p(row+margin,col+1-margin),p(row+1-margin,col+1-margin),p(row+1-margin,col+margin)],colorAt(face,row,col),strokeWidth);
        }
        return markup;
    }
    function diagram(algorithm,type) {
        const at=caseState(algorithm);
        let content='';
        if(type==='f2l') {
            // A taller, balanced isometric projection keeps the cube readable
            // at both list and detail sizes while retaining accurate stickers.
            content+='<polygon points="80,10 150,50 80,90 10,50" fill="#263242"/>';
            content+='<polygon points="10,50 80,90 80,158 10,118" fill="#263242"/>';
            content+='<polygon points="80,90 150,50 150,118 80,158" fill="#263242"/>';
            content+=gridFace('U',[80,10],[23.33,13.33],[-23.33,13.33],at,.035,.65);
            content+=gridFace('F',[10,50],[23.33,13.33],[0,22.67],at,.035,.65);
            content+=gridFace('R',[80,90],[23.33,-13.33],[0,22.67],at,.035,.65);
            return `<svg viewBox="0 0 160 168" role="img" aria-label="F2L 案例三面图">${content}</svg>`;
        }
        const show=color=>type==='oll' && color!==COLORS.U ? '#b9c3d1' : color;
        content+=gridFace('U',[24,22],[24,0],[0,24],(face,row,col)=>show(at(face,row,col)));
        for(let i=0;i<3;i++) {
            content+=polygon([[24+i*24,13],[47+i*24,13],[47+i*24,20],[24+i*24,20]],show(at('B',0,2-i)));
            content+=polygon([[24+i*24,96],[47+i*24,96],[47+i*24,103],[24+i*24,103]],show(at('F',0,i)));
            content+=polygon([[14,22+i*24],[21,22+i*24],[21,45+i*24],[14,45+i*24]],show(at('L',0,i)));
            content+=polygon([[97,22+i*24],[104,22+i*24],[104,45+i*24],[97,45+i*24]],show(at('R',0,2-i)));
        }
        return `<svg viewBox="0 0 118 115" role="img" aria-label="${type.toUpperCase()} 顶层案例图">${content}</svg>`;
    }
    function mountCube(container, appearance='black') {
        if(mounted) mounted.dispose();
        if(!window.THREE) { container.textContent='魔方模型暂不可用'; return; }
        const THREE=window.THREE, scene=new THREE.Scene();
        const camera=new THREE.PerspectiveCamera(35,1,.1,100);
        camera.position.set(0,0,11.2);
        const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
        renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
        container.replaceChildren(renderer.domElement);
        const root=new THREE.Group(); root.rotation.set(.45,-.55,0); scene.add(root);
        const cubies=[];
        const contactGeometry=new THREE.BoxGeometry(.97,.97,.97);
        const recessGeometry=new THREE.PlaneGeometry(1,1);
        const recessMaterial=new THREE.MeshBasicMaterial({color:appearance==='white'?0xe8eef2:0x19212c,side:THREE.FrontSide});
        const coloredGeometry={},backingGeometry={},outlineGeometry={};
        const roundedSticker=(size,topLeft,topRight,bottomRight,bottomLeft)=>{
            const h=size/2,s=new THREE.Shape();
            s.moveTo(-h+bottomLeft,-h);
            s.lineTo(h-bottomRight,-h);s.quadraticCurveTo(h,-h,h,-h+bottomRight);
            s.lineTo(h,h-topRight);s.quadraticCurveTo(h,h,h-topRight,h);
            s.lineTo(-h+topLeft,h);s.quadraticCurveTo(-h,h,-h,h-topLeft);
            s.lineTo(-h,-h+bottomLeft);s.quadraticCurveTo(-h,-h,-h+bottomLeft,-h);
            return {surface:new THREE.ShapeGeometry(s),outline:new THREE.BufferGeometry().setFromPoints(s.getPoints(12))};
        };
        const corners={center:[1,1,1,1],top:[1,1,0,0],bottom:[0,0,1,1],left:[1,0,0,1],right:[0,1,1,0],corner:[0,0,0,0]};
        for(const [kind,mask] of Object.entries(corners)){
            const color=roundedSticker(.945,...mask.map(value=>value*.27));
            const backing=roundedSticker(.99,...mask.map(value=>value*.29));
            coloredGeometry[kind]=color.surface;
            backingGeometry[kind]=backing.surface;
            outlineGeometry[kind]=backing.outline;
            color.outline.dispose();
        }
        const stickers=[];
        const bodyColors={black:0x19212c,white:0xedf2f5};
        const bodyMaterial=new THREE.MeshBasicMaterial({color:bodyColors[appearance] ?? bodyColors.black,side:THREE.FrontSide});
        const contactMaterial=new THREE.MeshBasicMaterial({color:appearance==='white'?0xd8e1e8:0x19212c,side:THREE.DoubleSide});
        const hiddenContactMaterial=new THREE.MeshBasicMaterial({visible:false});
        const outlineMaterial=new THREE.LineBasicMaterial({color:0x263244,transparent:true,opacity:.85});
        const setAppearance=id=>{
            bodyMaterial.color.setHex(bodyColors[id] ?? bodyColors.black);
            contactMaterial.color.setHex(id==='white'?0xd8e1e8:0x19212c);
            recessMaterial.color.setHex(id==='white'?0xe8eef2:0x19212c);
            for(const sticker of stickers){
                const {kind,backing,outline}=sticker.userData;
                sticker.geometry=id==='stickerless'?backingGeometry[kind]:coloredGeometry[kind];
                backing.visible=id!=='stickerless';
                outline.visible=id==='stickerless';
            }
            wake();
        };
        // 贴纸和同形底框分离；圆角缺口保持透明，不再由完整方块填充。
        const materials=Object.fromEntries(Object.entries(COLORS).map(([face,color])=>[face,new THREE.MeshBasicMaterial({
            color, side:THREE.FrontSide, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2
        })]));
        for(let x=-1;x<=1;x++) for(let y=-1;y<=1;y++) for(let z=-1;z<=1;z++) {
            if(x===0&&y===0&&z===0) continue;
            const piece=new THREE.Group(); piece.position.set(x,y,z);
            // BoxGeometry 材质顺序：右、左、上、下、前、后。只绘制朝向其他小块的接触面。
            piece.add(new THREE.Mesh(contactGeometry,[
                x===1?hiddenContactMaterial:contactMaterial,
                x===-1?hiddenContactMaterial:contactMaterial,
                y===1?hiddenContactMaterial:contactMaterial,
                y===-1?hiddenContactMaterial:contactMaterial,
                z===1?hiddenContactMaterial:contactMaterial,
                z===-1?hiddenContactMaterial:contactMaterial
            ]));
            const add=(face,position,rotation)=>{
                const sticker=new THREE.Mesh(coloredGeometry.corner,materials[face]);
                sticker.position.set(...position);sticker.rotation.set(...rotation);
                const onFace=[x,y,z].filter((_,axis)=>Math.abs(position[axis])<.01);
                let kind='corner';
                if(onFace.every(value=>value===0)) kind='center';
                else if(onFace.filter(value=>value!==0).length===1){
                    const inward=new THREE.Vector3(-x,-y,-z).applyQuaternion(new THREE.Quaternion().setFromEuler(sticker.rotation).invert());
                    kind=Math.abs(inward.x)>Math.abs(inward.y)?(inward.x>0?'right':'left'):(inward.y>0?'top':'bottom');
                }
                const backing=new THREE.Mesh(backingGeometry[kind],bodyMaterial);
                backing.position.z=-.006;
                // 缺口后方留出层次，并由对应外观的内壁遮住页面背景。
                const recess=new THREE.Mesh(recessGeometry,recessMaterial);
                recess.position.z=-.025;
                const outline=new THREE.LineLoop(outlineGeometry[kind],outlineMaterial);
                outline.position.z=.006;
                sticker.add(recess,backing,outline);
                sticker.userData={kind,backing,outline};
                sticker.geometry=appearance==='stickerless'?backingGeometry[kind]:coloredGeometry[kind];
                backing.visible=appearance!=='stickerless';
                outline.visible=appearance==='stickerless';
                stickers.push(sticker);piece.add(sticker);
            };
            if(y===1)add('U',[0,.502,0],[-Math.PI/2,0,0]);
            if(y===-1)add('D',[0,-.502,0],[Math.PI/2,0,0]);
            if(z===1)add('F',[0,0,.502],[0,0,0]);
            if(z===-1)add('B',[0,0,-.502],[0,Math.PI,0]);
            if(x===1)add('R',[.502,0,0],[0,Math.PI/2,0]);
            if(x===-1)add('L',[-.502,0,0],[0,-Math.PI/2,0]);
            root.add(piece); cubies.push({piece,home:[x,y,z],position:[x,y,z]});
        }
        scene.add(new THREE.HemisphereLight(0xffffff,0xc7d4e4,.9));
        const lamp=new THREE.DirectionalLight(0xffffff,.55);lamp.position.set(4,5,7);scene.add(lamp);
        let playToken=0,frame=0,drag=null,lastRun=Promise.resolve(),size='';
        const resize=()=>{const w=container.clientWidth||250,h=container.clientHeight||235,key=`${w}x${h}`;if(key===size)return;size=key;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};
        const draw=()=>{if(!document.getElementById('formula-detail-page')?.classList.contains('active')) {frame=0;return;}resize();renderer.render(scene,camera);frame=requestAnimationFrame(draw);};
        const wake=()=>{if(!frame) draw();};
        const onDown=e=>{e.preventDefault();drag=[e.pointerId,e.clientX,e.clientY];container.setPointerCapture(e.pointerId);};
        const onMove=e=>{if(!drag||drag[0]!==e.pointerId)return;e.preventDefault();root.rotation.y+=(e.clientX-drag[1])*.008;root.rotation.x+=(e.clientY-drag[2])*.008;drag=[drag[0],e.clientX,e.clientY];wake();};
        const onUp=e=>{if(drag?.[0]===e.pointerId)drag=null;};
        const onTouchMove=e=>e.preventDefault();
        container.addEventListener('pointerdown',onDown);container.addEventListener('pointermove',onMove);container.addEventListener('pointerup',onUp);container.addEventListener('pointercancel',onUp);
        container.addEventListener('touchmove',onTouchMove,{passive:false});
        const reset=()=>{for(const entry of cubies){root.remove(entry.piece);entry.position=entry.home.slice();entry.piece.position.set(...entry.home);entry.piece.rotation.set(0,0,0);root.add(entry.piece);}};
        async function apply(move,animate,token,speed) {
            const chosen=cubies.filter(entry=>selected(entry.position,move));
            const group=new THREE.Group();root.add(group);
            for(const entry of chosen) group.attach(entry.piece);
            const angle=move.quarter*Math.PI/2;
            if(animate){
                const start=performance.now(),duration=(Math.abs(move.quarter)===2?620:440)/speed;
                await new Promise(resolve=>{const step=now=>{if(token!==playToken){resolve();return;}const t=Math.min(1,(now-start)/duration);group.rotation[move.axis]=angle*(t*t*(3-2*t));if(t<1)requestAnimationFrame(step);else resolve();};requestAnimationFrame(step);});
            } else group.rotation[move.axis]=angle;
            for(const entry of chosen){root.attach(entry.piece);entry.position=rotateVector(entry.position,move.axis,move.quarter);entry.piece.position.set(...entry.position);}
            root.remove(group);
        }
        async function run(algorithm,token,speed) {
            const moves=parse(algorithm);
            reset();
            for(const move of targetOrientation(algorithm))await apply(move,false,token);
            for(const move of inverse(moves)) await apply(move,false,token);
            wake();
            await new Promise(resolve=>setTimeout(resolve,500));
            if(token!==playToken)return;
            for(const move of moves){if(token!==playToken)return;await apply(move,true,token,speed);}
        }
        function play(algorithm,speed=1) {
            const token=++playToken;
            lastRun=lastRun.catch(()=>{}).then(()=>run(algorithm,token,speed));
            return lastRun;
        }
        mounted={play,setAppearance,dispose(){++playToken;cancelAnimationFrame(frame);container.removeEventListener('pointerdown',onDown);container.removeEventListener('pointermove',onMove);container.removeEventListener('pointerup',onUp);container.removeEventListener('pointercancel',onUp);container.removeEventListener('touchmove',onTouchMove);renderer.dispose();contactGeometry.dispose();recessGeometry.dispose();Object.values(coloredGeometry).forEach(geometry=>geometry.dispose());Object.values(backingGeometry).forEach(geometry=>geometry.dispose());Object.values(outlineGeometry).forEach(geometry=>geometry.dispose());recessMaterial.dispose();bodyMaterial.dispose();contactMaterial.dispose();hiddenContactMaterial.dispose();outlineMaterial.dispose();Object.values(materials).forEach(material=>material.dispose());container.replaceChildren();}};
        wake();
        return mounted;
    }
    window.FormulaViewer={diagram,mountCube,caseState};
})();
