/* Cube Space's own training generators. No external scramble engine. */
/* Cube Space Pyraminx: geometric move model and breadth-first core distances.
 * Written for this project; no csTimer solver or move tables are used.
 * Core = six edges and four axial centres. Independent tips are not counted.
 */
(function(root) {
    'use strict';
    const names = ['U','L','R','B'];
    const vertices = [[0,1,0],[-Math.sqrt(2/3),-1/3,Math.sqrt(2/9)],
        [Math.sqrt(2/3),-1/3,Math.sqrt(2/9)],[0,-1/3,-Math.sqrt(8/9)]];
    const edges = [];
    for (let a=0;a<4;a++) for(let b=a+1;b<4;b++) edges.push([a,b]);
    const faces = edges.map(edge => [0,1,2,3].filter(v=>!edge.includes(v)));
    function rotate(point,axis) {
        const dot = point.reduce((sum,x,i)=>sum+x*axis[i],0);
        const cross = [axis[1]*point[2]-axis[2]*point[1],axis[2]*point[0]-axis[0]*point[2],axis[0]*point[1]-axis[1]*point[0]];
        return point.map((x,i)=>-.5*x-Math.sqrt(3)/2*cross[i]+1.5*dot*axis[i]);
    }
    const moves = vertices.map((axis,vertex)=> {
        const mapping = vertices.map(point=> {
            const rotated = rotate(point,axis);
            return vertices.findIndex(target=>target.every((x,i)=>Math.abs(x-rotated[i])<1e-8));
        });
        const destinations = edges.map(edge=> {
            if (!edge.includes(vertex)) return edges.indexOf(edge);
            const target = edge.map(v=>mapping[v]).sort((a,b)=>a-b);
            return edges.findIndex(candidate=>candidate[0]===target[0]&&candidate[1]===target[1]);
        });
        const flips = edges.map((edge,source)=>edge.includes(vertex) && mapping[faces[source][0]]!==faces[destinations[source]][0] ? 1 : 0);
        return {destinations,flips};
    });
    const factorial = [1,1,2,6,24,120,720];
    function rank(permutation) {
        let result=0;
        for(let i=0;i<6;i++) for(let j=i+1;j<6;j++) if(permutation[j]<permutation[i]) result+=factorial[5-i];
        return result;
    }
    function unrank(value) {
        const remaining=[0,1,2,3,4,5],result=[];
        for(let i=5;i>=0;i--) { const index=Math.floor(value/factorial[i]); value%=factorial[i];result.push(remaining.splice(index,1)[0]); }
        return result;
    }
    function flipBits(value) {
        const bits=Array.from({length:5},(_,i)=>(value>>i)&1);
        bits.push(bits.reduce((parity,x)=>parity^x,0)); return bits;
    }
    function applyEdge(permutation,orientation,move) {
        const nextPermutation=Array(6),nextOrientation=Array(6);
        for(let source=0;source<6;source++) {
            const destination=move.destinations[source];
            nextPermutation[destination]=permutation[source];
            nextOrientation[destination]=orientation[source]^move.flips[source];
        }
        return [nextPermutation,nextOrientation];
    }
    let edgeTable,centreTable,distances,states,eligibleStart;
    function initialise() {
        if(distances) return;
        edgeTable=new Uint16Array(720*32*8);
        centreTable=new Uint8Array(81*8);
        for(let permutation=0;permutation<720;permutation++) for(let orientation=0;orientation<32;orientation++) {
            const original=unrank(permutation),flips=flipBits(orientation),offset=(permutation*32+orientation)*8;
            for(let vertex=0;vertex<4;vertex++) {
                let current=[original,flips];
                for(let turn=0;turn<2;turn++) {
                    current=applyEdge(...current,moves[vertex]);
                    const bits=current[1].slice(0,5).reduce((value,x,i)=>value|(x<<i),0);
                    edgeTable[offset+vertex*2+turn]=rank(current[0])*32+bits;
                }
            }
        }
        for(let centre=0;centre<81;centre++) for(let vertex=0;vertex<4;vertex++) {
            const power=3**vertex,digit=Math.floor(centre/power)%3;
            for(let turn=1;turn<=2;turn++) centreTable[centre*8+vertex*2+turn-1]=centre+(((digit+turn)%3)-digit)*power;
        }
        distances=new Uint8Array(720*32*81);distances.fill(255);
        states=new Uint32Array(360*32*81);
        distances[0]=0;states[0]=0;
        let head=0,tail=1;
        while(head<tail) {
            const state=states[head++],edge=Math.floor(state/81),centre=state%81;
            for(let move=0;move<8;move++) {
                const next=edgeTable[edge*8+move]*81+centreTable[centre*8+move];
                if(distances[next]!==255) continue;
                distances[next]=distances[state]+1;states[tail++]=next;
            }
        }
        if(tail!==states.length) throw new Error('金字塔状态空间校验失败');
        eligibleStart=states.findIndex(state=>distances[state]>=7);
    }
    function step(state,move) {
        initialise();return edgeTable[Math.floor(state/81)*8+move]*81+centreTable[state%81*8+move];
    }
    function coreState(algorithm) {
        let state=0;
        for(const token of algorithm.trim().split(/\s+/).filter(Boolean)) {
            if(/^[ulrb]'?$/.test(token)) continue;
            const match=/^([ULRB])('?)$/.exec(token);
            if(!match) throw new Error('金字塔转动格式错误：'+token);
            state=step(state,names.indexOf(match[1])*2+(match[2]?1:0));
        }
        return state;
    }
    function randomInt(bound) {
        const range=0x100000000,limit=range-range%bound,buffer=new Uint32Array(1);
        do { root.crypto.getRandomValues(buffer); } while(buffer[0]>=limit);
        return buffer[0]%bound;
    }
    function generate() {
        initialise();
        const target=states[eligibleStart+randomInt(states.length-eligibleStart)];
        const solution=[];
        // TNoodle uses exactly 11 main turns. Search for that length, rather
        // than padding a short solution with cancelling moves or tip turns.
        function search(state,remaining,previousAxis) {
            if(distances[state]>remaining) return false;
            if(!remaining) return state===0;
            const options=[];
            for(let move=0;move<8;move++) if((move>>1)!==previousAxis) {
                const next=step(state,move);
                if(distances[next]<=remaining-1) options.push({move,next,priority:distances[next]+randomInt(2)});
            }
            options.sort((a,b)=>a.priority-b.priority);
            for(const {move,next} of options) {
                solution.push(move);
                if(search(next,remaining-1,move>>1)) return true;
                solution.pop();
            }
            return false;
        }
        if(!search(target,11,-1)) throw new Error('金字塔十一主体步生成失败');
        const scramble=solution.reverse().map(move=>names[move>>1]+((move^1)&1?"'":''));
        for(const name of names) {const tip=randomInt(3);if(tip) scramble.push(name.toLowerCase()+(tip===2?"'":''));}
        return scramble.join(' ');
    }
    const api={generate,coreState,distance(algorithm){initialise();return distances[coreState(algorithm)];},
        diagnostics(){initialise();return {reachable:states.length,minCoreDepth:7,maxCoreDepth:distances[states.at(-1)],eligible:states.length-eligibleStart};}};
    root.nbPyraminx=api;
    if(typeof module!=='undefined') module.exports=api;
})(globalThis);

/* Geometric training-state checks; no third-party solver. */
(function(root){
    const normals=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
    function rotate(point,axis,angle) {
        const length=Math.hypot(...axis),unit=axis.map(x=>x/length),c=Math.cos(angle),s=Math.sin(angle),projection=dot(point,unit);
        const cross=[unit[1]*point[2]-unit[2]*point[1],unit[2]*point[0]-unit[0]*point[2],unit[0]*point[1]-unit[1]*point[0]];
        return point.map((x,i)=>Math.round(x*c+cross[i]*s+unit[i]*projection*(1-c)));
    }
    function makeModel(kind) {
        const slots=[];
        if(kind!=='222') normals.forEach((normal,color)=>slots.push({point:normal,normal,color}));
        for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]) {
            const point=[x,y,z];normals.forEach((normal,color)=>{if(dot(point,normal)===1)slots.push({point,normal,color});});
        }
        if(kind==='333') for(let zero=0;zero<3;zero++)for(const a of [-1,1])for(const b of [-1,1]) {
            const point=[a,b];point.splice(zero,0,0);
            normals.forEach((normal,color)=>{if(dot(point,normal)===1)slots.push({point,normal,color});});
        }
        const identity=slots.map((_,i)=>i);
        const key=slot=>slot.point.join(',')+'|'+slot.normal.join(',');
        const lookup=new Map(slots.map((slot,i)=>[key(slot),i]));
        function permutation(axis,angle,all=false) {
            const map=identity.slice();slots.forEach((slot,source)=>{
                if(!all && dot(slot.point,axis)<=0)return;
                const target=lookup.get(key({point:rotate(slot.point,axis,angle),normal:rotate(slot.normal,axis,angle)}));
                if(target===undefined)throw new Error('打乱状态模型转动不合法');map[target]=source;
            });return map;
        }
        const apply=(state,map)=>map.map(index=>state[index]).join('');
        const compose=(a,b)=>b.map(index=>a[index]);
        const rotations=[identity],seen=new Set([identity.join(',')]);
        const turnAxes=[[1,0,0],[0,1,0],[0,0,1]].map(axis=>permutation(axis,Math.PI/2,true));
        for(let i=0;i<rotations.length;i++)for(const turn of turnAxes){const next=compose(rotations[i],turn),id=next.join(',');if(!seen.has(id)){seen.add(id);rotations.push(next);}}
        if(rotations.length!==24)throw new Error('朝向数量校验失败');
        const prefix=kind==='222'?3:6;
        function canonical(state) {
            let best,selected;
            for(const rotation of rotations){const head=rotation.slice(0,prefix).map(index=>state[index]).join('');if(best===undefined||head<best){best=head;selected=rotation;}}
            return apply(state,selected);
        }
        const axes=kind==='skewb'?{R:[1,-1,1],L:[-1,-1,-1],U:[-1,1,1],B:[1,1,-1]}:
            {R:[1,0,0],L:[-1,0,0],U:[0,1,0],D:[0,-1,0],F:[0,0,1],B:[0,0,-1]};
        const moves={};
        for(const [name,axis]of Object.entries(axes)) {
            const turn=permutation(axis,-2*Math.PI/(kind==='skewb'?3:4));
            moves[name]=turn;moves[name+"'"]=kind==='skewb'?compose(turn,turn):compose(compose(turn,turn),turn);
            if(kind!=='skewb')moves[name+'2']=compose(turn,turn);
        }
        const solved=slots.map(slot=>String(slot.color)).join('');
        const distanceLimit={222:3,333:1,skewb:6}[kind],easy=new Set([canonical(solved)]);
        let layer=[canonical(solved)];
        for(let depth=1;depth<=distanceLimit;depth++) {
            const next=[];for(const state of layer)for(const move of Object.values(moves)) {
                const target=canonical(apply(state,move));if(easy.has(target))continue;easy.add(target);next.push(target);
            }layer=next;
        }
        function state(algorithm){let result=solved;for(const token of algorithm.trim().split(/\s+/)){if(!moves[token])throw new Error('打乱记号错误：'+token);result=apply(result,moves[token]);}return result;}
        return {accepts:algorithm=>!easy.has(canonical(state(algorithm))),easyCount:easy.size};
    }
    const models={};
    root.nbScrambleQuality={accepts(kind,algorithm){return (models[kind]||=makeModel(kind)).accepts(algorithm);},diagnostics(kind){return (models[kind]||=makeModel(kind)).easyCount;}};
    if(typeof module!=='undefined')module.exports=root.nbScrambleQuality;
})(globalThis);

function randomMoves(moves,length,modifiers=['',"'",'2']) {
    const opposites={R:'L',L:'R',U:'D',D:'U',F:'B',B:'F'};
    const result=[];let previous='',beforePrevious='';
    for(let step=0;step<length;step++) {
        const choices=moves.filter(move=>{
            const face=move.match(/[RLUDFB]/)?.[0]||move;
            return face!==previous && !(face===beforePrevious && opposites[face]===previous);
        });
        const move=choices[randomInt(choices.length)];
        beforePrevious=previous;previous=move.match(/[RLUDFB]/)?.[0]||move;
        result.push(move+modifiers[randomInt(modifiers.length)]);
    }
    return result.join(' ');
}
function checkedMoves(kind,moves,length,modifiers) {
    for(let attempt=0;attempt<256;attempt++) {
        const algorithm=randomMoves(moves,length,modifiers);
        if(nbScrambleQuality.accepts(kind,algorithm)) return algorithm;
    }
    throw new Error('无法生成满足难度要求的打乱');
}
// Six choices for the up face, then four choices for the front face.
function randomOrientation(right,up,front) {
    const vertical=['',right,right+'2',right+"'",front,front+"'"][randomInt(6)];
    const horizontal=['',up,up+'2',up+"'"][randomInt(4)];
    return [vertical,horizontal].filter(Boolean).join(' ');
}
function generate(event) {
 if(event==='mirror')return generate('333');
 if(event==='gear')return randomMoves(['R','U','F'],10,['','2','3','4','5','6',"5'","4'","3'","2'","'"]);
 const n={'888':8,'999':9,'101010':10,'111111':11,'121212':12,'131313':13}[event];
 if(n){const moves=['R','L','U','D','F','B'];for(let w=2;w<=Math.floor(n/2);w++)for(const f of(n%2===0&&w===n/2?['R','U','F']:['R','L','U','D','F','B']))moves.push((w===2?'':w)+f+'w');return randomMoves(moves,20*(n-2)+randomInt(9));}
    const faces=['R','L','U','D','F','B'],wide=['Rw','Lw','Uw','Dw','Fw','Bw'];
    if(event==='pyram') return nbPyraminx.generate();
    if(event==='222') return checkedMoves('222',['R','U','F'],11);
    if(['333','333oh','333ft','333bf','333mbf','333fm'].includes(event)) {
        let text=checkedMoves('333',faces,18+randomInt(4));
        if(['333bf','333mbf'].includes(event)) text+=' '+randomOrientation('Rw','Uw','Fw');
        if(event==='333fm') text="R' U' F "+text+" R' U' F";
        return text.trim();
    }
    if(['444','444bf','555','555bf','666','777'].includes(event)) {
        const size=Number(event[0]),length=size===4?40+randomInt(9):{5:60,6:80,7:100}[size];
        const moves=faces.concat(size===4?['Rw','Uw','Fw']:wide,size===6?['3Rw','3Uw','3Fw']:size===7?wide.map(face=>'3'+face):[]);
        let text=randomMoves(moves,length);
        if(event==='444bf') text+=' '+randomOrientation('x','y','z');
        if(event==='555bf') text+=' '+randomOrientation('3Rw','3Uw','3Fw');
        return text.trim();
    }
    if(event==='skewb') return checkedMoves('skewb',['R','L','U','B'],11,['',"'"]);
    if(event==='sq1') return getSquare1Scramble();
    if(event==='fto') return getFtoScramble();
    if(event==='minx') return Array.from({length:7},()=>{
        const turns=Array.from({length:10},(_,i)=>(i%2?'D':'R')+(randomInt(2)?'++':'--'));
        return turns.join(' ')+(turns.at(-1)==='D++'?" U":" U'");
    }).join('\n');
    if(event==='clock') {
        const turn=face=>{const amount=randomInt(12)-5;return face+Math.abs(amount)+(amount<0?'-':'+');};
        return ['UR','DR','DL','UL','U','R','D','L','ALL'].map(turn).join(' ')+' y2 '+['U','R','D','L','ALL'].map(turn).join(' ');
    }
    throw new Error('不支持的打乱项目：'+event);
}
self.onmessage=({data:[id,type,args]})=>{
    try { self.postMessage([id,type,generate(args[0])]); }
    catch(error) { self.postMessage([id,type,null,error.message]); }
};
function randomInt(bound) {
 const range=0x100000000,limit=range-range%bound,buffer=new Uint32Array(1);
 do { crypto.getRandomValues(buffer); } while(buffer[0]>=limit);
 return buffer[0]%bound;
}
function randomUnit(){return randomInt(0x100000000)/0x100000000;}
function rotateSquare1Layer(layer, amount) {
    const shift = ((amount % 12) + 12) % 12;
    return shift ? layer.slice(12 - shift).concat(layer.slice(0, 12 - shift)) : layer.slice();
}

function canSliceSquare1(layer) {
    return layer[2] !== layer[3] && layer[8] !== layer[9];
}

function hasSquare1CubeShape(layer) {
    const start = layer.findIndex((piece, i) => piece !== layer[(i + 11) % 12]);
    if (start < 0) return false;
    const widths = [];
    for (let offset = 0; offset < 12;) {
        const piece = layer[(start + offset) % 12];
        let width = 1;
        while (offset + width < 12 && layer[(start + offset + width) % 12] === piece) width++;
        widths.push(width);
        offset += width;
    }
    return widths.length === 8 && widths.every((width, i) =>
        (width === 1 || width === 2) && width !== widths[(i + 1) % widths.length]);
}

function sliceSquare1(top, bottom) {
    const nextTop = top.slice(), nextBottom = bottom.slice();
    for (const slot of [9, 10, 11, 0, 1, 2]) {
        nextTop[11 - slot] = bottom[slot];
        nextBottom[11 - slot] = top[slot];
    }
    return [nextTop, nextBottom];
}

function getSquare1Scramble() {
    let top = [0, 0, 8, 1, 1, 9, 2, 2, 10, 3, 3, 11];
    let bottom = [4, 4, 12, 5, 5, 13, 6, 6, 14, 7, 7, 15];
    const moves = [];
    const length=12+randomInt(5);let variedOpeningMoves=0;

    for (let step = 0; step < length; step++) {
        const candidates = [];
        for (let upper = -5; upper <= 6; upper++) {
            for (let lower = -5; lower <= 6; lower++) {
                if (upper === 0 && lower === 0) continue;
                const nextTop = rotateSquare1Layer(top, upper);
                const nextBottom = rotateSquare1Layer(bottom, -lower);
                if (!canSliceSquare1(nextTop) || !canSliceSquare1(nextBottom)) continue;
                const [slicedTop, slicedBottom] = sliceSquare1(nextTop, nextBottom);
 if(step<5&&(!hasSquare1CubeShape(slicedTop)||!hasSquare1CubeShape(slicedBottom)))continue;
 const isVaried=upper%3!==0||lower%3!==0;
 if(step<5&&step>=3&&variedOpeningMoves<2&&!isVaried)continue;
 if (moves.length && moves[moves.length - 1] === `(${upper},${lower})`) continue;
                candidates.push({ upper, lower, slicedTop, slicedBottom, isVaried });
            }
        }
        const move = candidates[Math.floor(randomUnit() * candidates.length)];
        if (!move) throw new Error('SQ1 无法生成合法的后续斜切');
        moves.push(`(${move.upper},${move.lower})`);
        if(step<5&&move.isVaried)variedOpeningMoves++;top = move.slicedTop;
        bottom = move.slicedBottom;
    }
    return moves.join(' / ') + ' /';
}

function getFtoScramble() {
    const faces = ['U', 'D', 'F', 'B', 'L', 'R', 'BL', 'BR'];
    const opposite = { U:'D', D:'U', F:'B', B:'F', L:'BR', BR:'L', R:'BL', BL:'R' };
    const result = [];
    const length=25+randomInt(6);
    let previous = '', beforePrevious = '';
    for (let index = 0; index < length; index++) {
        const choices = faces.filter(face => face !== previous &&
            !(face === beforePrevious && opposite[face] === previous));
        const face = choices[Math.floor(randomUnit() * choices.length)];
        result.push(face + (randomUnit() < .5 ? "'" : ''));
        beforePrevious = previous;
        previous = face;
    }
    return result.join(' ');
}

