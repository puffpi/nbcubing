/* Cube Space training generators run locally in a worker. */
window.nbScrambleEngine = (() => {
    const events = Object.fromEntries(['222','333','333oh','333ft','333fm','333bf','333mbf','444','444bf','555','555bf','666','777','pyram','skewb','minx','sq1','clock','fto','888','999','101010','111111','121212','131313','mirror','gear'].map(event=>[event,[event]]));
    let worker, sequence = 0;
    const pending = new Map();
    const pools = new Map();
    function fail(error) {
        worker?.terminate(); worker = null;
        for (const request of pending.values()) { clearTimeout(request.timer); request.reject(error); }
        pending.clear(); pools.clear();
    }
    function getWorker() {
        if (!worker) {
            worker = new Worker('scramble-worker.js?v=1.40.0-integrated');
            worker.onmessage = ({data}) => {
                const request = pending.get(data[0]);
                if (!request) return;
                clearTimeout(request.timer); pending.delete(data[0]);
                const result = data[2];
                if (typeof result !== 'string' || !result.trim()) request.reject(new Error('打乱生成失败'));
                else request.resolve(result.trim());
            };
            worker.onerror = () => fail(new Error('打乱引擎加载失败，请重新生成'));
        }
        return worker;
    }
    async function createScramble(event) {
        const args = events[event];
        if (!args) throw new Error('不支持的打乱项目：' + event);
        const text = await new Promise((resolve,reject) => {
            try {
                const instance = getWorker(), id = ++sequence;
                const timer = setTimeout(() => fail(new Error('打乱生成超时，请重新生成')), 120000);
                pending.set(id,{resolve,reject,timer});
                instance.postMessage([id,'scramble',args]);
            } catch (error) { fail(error); reject(error); }
        });
        // Only inject our own line breaks; engine output is plain text.
        const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        return event === 'minx' ? escaped.replace(/\r?\n/g,'<br>') : escaped.replace(/\s+/g,' ');
    }
    async function getScramble(event) {
        if(!events[event]) throw new Error('不支持的打乱项目：'+event);
        const pool=pools.get(event)||[];pools.set(event,pool);
        while(pool.length<3)pool.push(createScramble(event).then(value=>({value}),error=>({error})));
        const result=await pool.shift();
        if(result.error)throw result.error;
        return result.value;
    }
    return {getScramble, events};
})();
