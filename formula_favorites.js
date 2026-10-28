/* Account-scoped favorites. Stars respond immediately; persistence is serialized per formula. */
(() => {
    let owner=null, favorites=new Map(), loading=null, generation=0, mutation=0, loaded=false;
    const pending=new Map(), changes=new Map(), key=(type,name)=>type+':'+name;
    const star='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.3.9-4.55 4.45 1.07 6.28L12 17.37l-5.62 2.96 1.07-6.28L2.9 9.6l6.3-.9Z"/></svg>';
    const identity=()=>typeof accountProfile!=='undefined'?accountProfile?.user_id:null;
    const variantName=(name,index)=>index ? String(name)+'::v'+(index+1) : String(name);
    function decode(name){const match=String(name).match(/^(.*)::v(\d+)$/);return match?{name:match[1],index:Number(match[2])-1}:{name:String(name),index:0};}
    function resetOwner(){const next=identity();if(next===owner)return;owner=next;favorites=new Map();loading=null;loaded=false;changes.clear();generation++;paint();}
    function message(text){document.querySelectorAll('.formula-favorite-status').forEach(n=>n.textContent=text);}
    function paint(){document.querySelectorAll('[data-favorite-key]').forEach(b=>{const selected=!!owner&&favorites.has(b.dataset.favoriteKey);b.setAttribute('aria-pressed',String(selected));b.setAttribute('aria-label',selected?'取消收藏':'收藏公式');b.title=selected?'取消收藏':'收藏公式';b.disabled=false;});}
    async function load(force=false){resetOwner();if(!owner||loaded&&!force)return;if(loading)return loading;const expected=owner,version=generation,stamp=mutation,inflight=[...pending.values()].filter(job=>job.owner===owner);
        const task=(async()=>{const client=await accountClient();const {data,error}=await client.from('formula_favorites').select('category,case_name,created_at').eq('user_id',expected).order('created_at',{ascending:false});if(error)throw error;if(version!==generation||identity()!==expected)return;
            const next=new Map((data||[]).map(r=>[key(r.category,r.case_name),r]));for(const [id,version] of changes)if(version>stamp){if(favorites.has(id))next.set(id,favorites.get(id));else next.delete(id);}for(const job of [...inflight,...pending.values()])if(job.owner===owner){if(job.failed){if(favorites.has(job.id))next.set(job.id,favorites.get(job.id));else next.delete(job.id);}else if(job.desired)next.set(job.id,job.row);else next.delete(job.id);}favorites=next;loaded=true;paint();})();
        loading=task;try{await task;}finally{if(loading===task)loading=null;}
    }
    async function ready(force=false){if(!identity())await refreshAccount();resetOwner();if(!owner)return false;await load(force);return true;}
    async function persist(job){
        try{const client=await accountClient();while(job.saved!==job.desired){const desired=job.desired;
            const query=desired?client.from('formula_favorites').insert(job.row):client.from('formula_favorites').delete().eq('user_id',job.owner).eq('category',job.type).eq('case_name',job.name);
            const {error}=await query;if(error&&!(desired&&error.code==='23505'))throw error;job.saved=desired;
        }
        if(identity()===job.owner&&generation===job.generation){message(job.desired?'已收藏':'已取消收藏');if(document.getElementById('formula-favorites-page')?.classList.contains('active'))await renderList();}
        }catch(error){job.failed=true;if(identity()===job.owner&&generation===job.generation){if(job.saved)favorites.set(job.id,job.row);else favorites.delete(job.id);mutation++;changes.set(job.id,mutation);paint();message('收藏同步失败，已恢复。请检查网络后重试。');}console.warn('公式收藏同步失败',error);}
        finally{pending.delete(job.lock);}
    }
    function toggle(type,name){resetOwner();if(!owner){message('登录后即可收藏公式。');void openAccountPage();return;}
        const id=key(type,name),lock=owner+'|'+id,selected=favorites.has(id),existing=pending.get(lock);
        const row={...(favorites.get(id)||{category:type,case_name:name,created_at:new Date().toISOString()}),user_id:owner};
        if(selected)favorites.delete(id);else favorites.set(id,row);mutation++;paint();message('正在同步收藏…');
        if(existing){existing.desired=!selected;return;}
        const job={id,lock,owner,type,name,row,desired:!selected,saved:selected,generation};pending.set(lock,job);void persist(job);
    }
    function makeButton(type,name){const b=document.createElement('button');b.type='button';b.className='formula-favorite-star';b.dataset.favoriteKey=key(type,String(name));b.innerHTML=star;b.setAttribute('aria-label','收藏公式');b.setAttribute('aria-pressed','false');b.onclick=e=>{e.stopPropagation();toggle(type,String(name));};return b;}
    const starRows=new Set();let starCleanup=0;
    const starResize=new ResizeObserver(entries=>{for(const entry of entries)entry.target.style.setProperty('--favorite-center',entry.target.getBoundingClientRect().height/2+'px');});
    function watchStar(row){starRows.add(row);starResize.observe(row);if(!starCleanup)starCleanup=requestAnimationFrame(()=>{starCleanup=0;for(const old of starRows)if(!old.isConnected){starResize.unobserve(old);starRows.delete(old);}});}
    function decorate(card,type,name){const wrap=document.createElement('div');wrap.className='formula-favorite-row';wrap.append(card,makeButton(type,name));watchStar(wrap);return wrap;}
    function variant(card,type,name,index){const wrap=document.createElement('div');wrap.className='formula-variant-shell';wrap.append(card,makeButton(type,variantName(name,index)));watchStar(wrap);paint();return wrap;}
    async function renderList(){const list=document.getElementById('formula-favorites-list');const expected=owner,version=generation;if(!expected){list.textContent='登录后查看和同步你的公式收藏。';return;}
        const [cfop,coll,viewer]=await Promise.all([preloadCfopData(),preloadCollData(),preloadFormulaViewer()]);if(version!==generation||expected!==identity())return;
        const fragment=document.createDocumentFragment();let count=0;
        for(const row of [...favorites.values()].sort((a,b)=>b.created_at.localeCompare(a.created_at))){const data=row.category.startsWith('coll_')?coll:cfop,decoded=decode(row.case_name),item=data[row.category]?.find(i=>String(i.name)===decoded.name);if(!item)continue;const alg=(item.algs?.length?item.algs:[item.alg])[decoded.index];if(!alg)continue;count++;
            const card=document.createElement('button');card.type='button';card.className='formula-case-card';card.onclick=async()=>{await openFormulaCase(row.category,item.name);document.querySelectorAll('#formula-variants .formula-variant')[decoded.index]?.click();};
            const label=document.createElement('div');label.className='formula-case-label';label.textContent=row.category.replace('coll_','COLL ').toUpperCase()+' '+item.name;
            const image=document.createElement('div');image.className='formula-case-diagram';image.innerHTML=formulaCaseDiagram(row.category,item);
            const moves=document.createElement('div');moves.className='formula-case-alg';const caption=document.createElement('small');caption.className='formula-favorite-variant';caption.textContent='公式 '+(decoded.index+1);moves.append(caption,document.createTextNode(alg));card.append(label,image,moves);fragment.append(decorate(card,row.category,row.case_name));}
        if(!count)list.textContent='还没有收藏。点击公式卡片内的黄色五角星即可收藏。';else list.replaceChildren(fragment);paint();
    }
    async function open(){if(!document.getElementById('formula-favorites-page').classList.contains('active'))navigateTo('formula-favorites-page',true);const list=document.getElementById('formula-favorites-list');list.textContent='载入中...';message('');try{if(!await ready(true)){list.textContent='登录后查看和同步你的公式收藏。';const b=document.createElement('button');b.type='button';b.className='btn btn-outline';b.textContent='登录';b.onclick=openAccountPage;list.append(document.createElement('br'),b);return;}await renderList();}catch{list.textContent='收藏加载失败，请检查网络。';const b=document.createElement('button');b.type='button';b.className='btn btn-outline';b.textContent='重试';b.onclick=()=>void open();list.append(b);}}
    window.addEventListener('account-identity-changed',()=>{if(identity()===owner)return;resetOwner();if(document.getElementById('formula-favorites-page')?.classList.contains('active'))void load().then(renderList).catch(()=>message('收藏暂时无法同步。'));});
    window.FormulaFavorites={variant,decorate,open,refresh:()=>{resetOwner();paint();return ready().then(paint).catch(()=>message('收藏暂时无法同步，请稍后重试。'));}};
})();
