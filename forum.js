/* Forum is loaded only when visited; all permissions are enforced in Supabase. */
const forumSeedTopics = [
    { id: 'beginner-first-cube', tags: ['入门'], title: '新手学三阶，先练层先法还是直接学 CFOP？', body: '刚学会复原三阶，想练到一分钟以内。应该先把层先法练熟，还是直接学习 CFOP？大家会怎样安排公式和手法练习？' },
    { id: 'advanced-f2l-lookahead', tags: ['进阶'], title: 'F2L 观察和预判应该怎样练，才能减少停顿？', body: '已经掌握基础 F2L，但计时中常找不到下一组。大家如何分配慢拧、无停顿练习和手法优化？有没有判断观察能力提升的方法？' }
];
let forumTopics = [...forumSeedTopics], activeForumTopic = null, forumReplyTarget = null;
let forumChannel = null, forumChannelKey = '', forumReloadTimer = null;
let forumLoadSequence = 0, forumListSequence = 0, forumUser = null, forumAdmin = false;
let forumAuthPromise = null, forumModalReturnFocus = null, forumModalBusy = false, forumReportSequence = 0;
let forumClient = null;
const forumLikeStates = new Map();
let forumLikeRevision = 0;
async function ensureForumClient() {
    if (forumClient) return forumClient;
    await ensureSupabaseClient();
    return forumClient ||= window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storageKey: 'nbcubing-forum-auth', detectSessionInUrl: false }, global: { fetch: accountServiceFetch } });
}
const forumEl = id => document.getElementById(id);
function forumNode(tag, className, value) {
    const node = document.createElement(tag); if (className) node.className = className;
    if (value !== undefined) node.textContent = value; return node;
}
function forumError(error) {
    console.warn('论坛操作失败', error);
    if (/anonymous/i.test(error?.message || '')) return '请先在 Supabase 开启匿名登录，才能发布、点赞或举报。';
    if (/PGRST20[245]|42P01|42703/.test(error?.code || '')) return '论坛功能需要更新数据库，请执行 forum_features.sql。';
    if (error?.code === '23514') return '内容未通过校验，请检查长度及文明用语。';
    if (error?.code === '42501') return '没有操作权限，请先验证身份。';
    if (error?.code === 'P0001') return error.message;
    if(error?.message==='请先登录或选择游客登录。')return error.message;
    return '操作失败，请稍后重试。';
}
async function forumIdentity() {
    if (forumAuthPromise) return forumAuthPromise;
    forumAuthPromise = (async () => {
        const client = await ensureForumClient();
        const { data, error } = await client.auth.getSession(); if (error) throw error;
        if (data.session) forumUser = data.session.user;
        else { openMonthlyAccountModal(()=>forumEl('forum-comment-body').focus(),true); throw new Error('请先登录或选择游客登录。'); }
        return forumUser;
    })();
    try { return await forumAuthPromise; } finally { forumAuthPromise = null; }
}
function forumSaveNickname(nickname) {
    if (!uiSettings.username) { saveUsername(nickname); const input = forumEl('setting-username'); if (input) input.value = nickname; }
}
function forumHiddenIds() {
    try { return new Set(JSON.parse(localStorage.getItem('forumHiddenComments') || '[]').map(String)); } catch { return new Set(); }
}
// Deduplicate IDs and traverse each node once, including malformed/orphaned trees.
function forumCommentOrder(comments, hidden = new Set()) {
    const unique = new Map(comments.map(c => [String(c.id), c]));
    const children = new Map(), roots = [], result = [], visited = new Set();
    for (const c of unique.values()) {
        const parent = String(c.parent_id);
        if (c.parent_id && unique.has(parent) && parent !== String(c.id)) {
            if (!children.has(parent)) children.set(parent, []); children.get(parent).push(c);
        } else roots.push(c);
    }
    const walk = (c, depth, concealed) => {
        const id = String(c.id); if (visited.has(id)) return; visited.add(id);
        concealed ||= hidden.has(id); if (!concealed) result.push({ comment: c, depth });
        for (const child of children.get(id) || []) walk(child, depth + 1, concealed);
    };
    roots.forEach(c => walk(c, 0, false));
    for (const c of unique.values()) if (!visited.has(String(c.id))) walk(c, 0, false);
    return result;
}
function forumPageChanged(pageId) {
    ++forumLoadSequence; ++forumListSequence; ++forumReportSequence;
    clearTimeout(forumReloadTimer);
    if (forumChannel && forumClient) { forumClient.removeChannel(forumChannel); forumChannel = null; forumChannelKey = ''; }
    closeForumModal();
    scheduleForumComposerViewport();
    if (pageId === 'forum-page') setTimeout(loadForumTopics, 0);
    if (pageId === 'forum-topic-page' && activeForumTopic) setTimeout(loadForumComments, 0);
}
async function forumSubscribe(key, tables, reload) {
    if (forumChannelKey === key) return;
    const client = await ensureForumClient();
    if (key === 'topics' ? !forumEl('forum-page').classList.contains('active') : !forumEl('forum-topic-page').classList.contains('active') || activeForumTopic?.id !== key) return;
    if (forumChannel) client.removeChannel(forumChannel);
    forumChannelKey = key;
    forumChannel = client.channel(`forum-${key}`);
    for (const table of tables) forumChannel.on('postgres_changes', { event: '*', schema: 'public', table, ...(table === 'forum_activity' ? { filter: `topic_id=eq.${key}` } : {}) }, () => {
        clearTimeout(forumReloadTimer); forumReloadTimer = setTimeout(reload, 150);
    });
    forumChannel.subscribe();
}
function renderForumTopics() {
    const fragment = document.createDocumentFragment();
    for (const topic of forumTopics) {
        const button = forumNode('article', 'forum-topic-card'); button.tabIndex=0;button.setAttribute('role','link');button.setAttribute('aria-label',topic.title);
        const heading=forumNode('div','forum-topic-card-heading');
        const tags = forumNode('div', 'forum-tags');
        for (const tag of topic.tags || [topic.tag]) if (tag) tags.append(forumNode('span', 'forum-tag', tag));
        heading.append(tags,forumTopicMenu(topic));
        button.append(heading, forumNode('strong', '', topic.title), forumNode('small', '', topic.body));
        button.onkeydown=e=>{if(e.target===button && ['Enter',' '].includes(e.key)){e.preventDefault();openForumTopic(topic.id);}};
        button.addEventListener('click', () => openForumTopic(topic.id)); fragment.append(button);
    }
    forumEl('forum-topics').replaceChildren(fragment);
}
function openForum() { renderForumTopics(); navigateTo('forum-page', true); }
async function loadForumTopics() {
    const sequence = ++forumListSequence;
    forumEl('forum-list-status').textContent = '正在加载话题…';
    try {
        const client = await ensureForumClient();
        const session=await client.auth.getSession();forumUser=session.data?.session?.user || null;
        const admin=await client.rpc('is_forum_admin');forumAdmin=admin.data===true;
        const { data, error } = await client.from('forum_topics').select('id,tags,title,body,nickname,created_at,author_id').is('deleted_at',null).order('created_at', { ascending: false }).limit(100);
        if (sequence !== forumListSequence) return;
        if (error) throw error;
        forumTopics = data || []; renderForumTopics(); forumEl('forum-list-status').textContent = '';
        await forumSubscribe('topics', ['forum_topics'], loadForumTopics);
    } catch (error) { if (sequence === forumListSequence) forumEl('forum-list-status').textContent = forumError(error); }
}
function openForumTopic(topicId) {
    const topic = forumTopics.find(t => t.id === topicId); if (!topic) return;
    activeForumTopic = topic;
    const tags = forumEl('forum-topic-tag'); tags.replaceChildren(); tags.className = 'forum-tags';
    for (const tag of topic.tags || [topic.tag]) if (tag) tags.append(forumNode('span', 'forum-tag', tag));
    forumEl('forum-topic-title').textContent = topic.title; forumEl('forum-topic-body').textContent = topic.body;
    forumEl('forum-topic-menu').replaceChildren(forumTopicMenu(topic));
    clearForumReplyTarget();
    forumEl('forum-comments').replaceChildren();
    forumEl('forum-comments').closest('.forum-comments-card').hidden=true;
    forumEl('forum-comments-status').textContent='载入中...';
    forumEl('forum-comments-status').classList.add('forum-loading');
    navigateTo('forum-topic-page', true);
}
function setForumReplyTarget(comment) {
    if(!forumCanSpeak()){openMonthlyAccountModal(()=>setForumReplyTarget(comment),true);return;}
    forumReplyTarget = { id: comment.id, nickname: comment.nickname };
    const bar = forumEl('forum-reply-target'); bar.querySelector('span').textContent = `回复 ${comment.nickname}`; bar.hidden = false;
    forumEl('forum-comment-body').focus();
}
function clearForumReplyTarget() { forumReplyTarget = null; forumEl('forum-reply-target').hidden = true; }
function forumAction(icon, label, action) {
    const button = forumNode('button'); button.type = 'button'; button.setAttribute('aria-label', label); button.title = label;
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`;
    button.onclick = event => { event.stopPropagation(); action(button); }; return button;
}
function renderForumComments(comments, likes, readRevision = forumLikeRevision) {
    const fragment = document.createDocumentFragment(), counts = new Map((likes || []).map(l => [String(l.comment_id), l]));
    for (const { comment: c, depth } of forumCommentOrder(comments, forumHiddenIds())) {
        const row = forumNode('div', `forum-comment${depth || c.parent_id ? ' forum-comment-reply' : ''}`);
        row.tabIndex = 0; row.title = '点击回复这条留言'; row.onclick = () => setForumReplyTarget(c);
        row.onkeydown = e => { if (e.target === row && ['Enter',' '].includes(e.key)) { e.preventDefault(); setForumReplyTarget(c); } };
        const head = forumNode('div', 'forum-comment-head');
        const names=forumNode('strong','forum-comment-names',c.nickname);
        if(c.reply_to_nickname){const arrow=forumNode('span','forum-reply-arrow','▶');arrow.setAttribute('aria-label','回复');names.append(arrow,forumNode('span','',c.reply_to_nickname));}
        head.append(names, forumNode('time', '', new Date(c.created_at).toLocaleString('zh-CN')));
        const actions = forumNode('div', 'forum-comment-actions'), stat = counts.get(String(c.id));
        const like = forumAction('<path d="M12 20S3 14.5 3 8.8C3 4.2 8.5 2.7 12 7c3.5-4.3 9-2.8 9 1.8C21 14.5 12 20 12 20Z"/>', stat?.liked ? '取消点赞' : '点赞', b => likeForumComment(c.id,b));
        like.className = `forum-action-like${stat?.liked ? ' liked' : ''}`; like.setAttribute('aria-pressed', String(!!stat?.liked));
        like.append(forumNode('span', '', String(stat?.total || 0)));
        like.dataset.commentId=String(c.id);
        const likeState=forumLikeState(c.id,stat,readRevision);
        paintForumLikeButton(like,likeState);
        const reply = forumAction('<path d="M3 4h18v12H9l-6 4V4Z"/>', `回复 ${c.nickname}`, () => setForumReplyTarget(c));
        const menu = forumNode('div', 'forum-comment-menu');
        const more = forumAction('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>', '更多操作', () => {
            const wasOpen = !menu.hidden; document.querySelectorAll('.forum-comment-menu').forEach(n => n.hidden = true); menu.hidden = wasOpen; more.setAttribute('aria-expanded', String(!wasOpen));
        }); more.setAttribute('aria-expanded','false'); menu.hidden = true; menu.onclick = e => e.stopPropagation();
        if (forumAdmin || c.author_id && c.author_id === forumUser?.id) {
            const del = forumNode('button', 'forum-delete', '删除'); del.type='button'; del.onclick = () => confirmForumDelete(c); menu.append(del);
        }
        const report = forumNode('button', '', '举报'); report.type='button'; report.onclick = () => openForumReport(c); menu.append(report);
        actions.append(like, reply, more, menu); row.append(head, forumNode('p', '', c.body), actions); fragment.append(row);
    }
    // Atomic commit: never append to DOM across asynchronous requests.
    forumEl('forum-comments').replaceChildren(fragment);
    forumEl('forum-comments').closest('.forum-comments-card').hidden=!forumEl('forum-comments').children.length;
}
async function loadForumComments() {
    const topicId = activeForumTopic?.id; if (!topicId) return;
    const sequence = ++forumLoadSequence, status = forumEl('forum-comments-status'), readRevision=forumLikeRevision;
    const initial=!forumEl('forum-comments').children.length;
    status.textContent = initial?'载入中...':'';status.classList.remove('forum-empty');status.classList.toggle('forum-loading',initial);
    try {
        const client = await ensureForumClient();
        const session = await client.auth.getSession(); forumUser = session.data?.session?.user || null;
        const admin=await client.rpc('is_forum_admin');forumAdmin=admin.data===true;
        const stats = await client.rpc('forum_like_stats', { p_topic: topicId }); if (stats.error) throw stats.error;
        const comments = []; let cursor = 0;
        while (true) {
            if (sequence !== forumLoadSequence || activeForumTopic?.id !== topicId) return;
            const { data, error } = await client.from('forum_comments').select('id,nickname,body,created_at,parent_id,reply_to_nickname,author_id').eq('topic_id',topicId).is('deleted_at',null).gt('id',cursor).order('id',{ascending:true}).limit(200);
            if (error) throw error;
            if (sequence !== forumLoadSequence || activeForumTopic?.id !== topicId) return;
            comments.push(...(data || []));
            if (!data || data.length < 200) break;
            cursor = data[data.length - 1].id;
        }
        renderForumComments(comments, stats.data, readRevision);
        status.classList.remove('forum-loading');
        status.textContent = comments.length ? '' : '还没有留言，来分享第一个想法吧。';
        status.classList.toggle('forum-empty',!comments.length);
        await forumSubscribe(topicId, ['forum_activity'], loadForumComments);
    } catch (error) { if (sequence === forumLoadSequence) {status.classList.remove('forum-loading');status.textContent='留言加载失败，'+forumError(error);} }
}
function forumLikeState(id, stat, readRevision=forumLikeRevision) {
    const key=(forumUser?.id||'guest')+':'+activeForumTopic?.id+':'+id;
    let state=forumLikeStates.get(key);
    if(!state){state={key,id,topic:activeForumTopic?.id,user:forumUser?.id||null,confirmed:!!stat?.liked,desired:!!stat?.liked,total:Math.max(0,Number(stat?.total)||0),revision:0,running:false,timer:null,uncertain:false};forumLikeStates.set(key,state);}
    else if(!state.running&&!state.timer&&!state.uncertain&&state.revision<=readRevision){state.confirmed=state.desired=!!stat?.liked;state.total=Math.max(0,Number(stat?.total)||0);}
    return state;
}
function paintForumLikeButton(button,state){
    const label=state.desired?'取消点赞':'点赞';button.classList.toggle('liked',state.desired);button.setAttribute('aria-pressed',String(state.desired));button.setAttribute('aria-label',label);button.title=label;
    button.querySelector('span').textContent=String(Math.max(0,state.total+Number(state.desired)-Number(state.confirmed)));
}
function paintForumLike(state){
    if(activeForumTopic?.id!==state.topic||(forumUser?.id||null)!==state.user)return;
    for(const button of forumEl('forum-comments').querySelectorAll('.forum-action-like'))if(button.dataset.commentId===String(state.id))paintForumLikeButton(button,state);
}
function likeForumComment(id,button){
    const state=forumLikeState(id,{liked:button.getAttribute('aria-pressed')==='true',total:Number(button.querySelector('span').textContent)},-1);
    state.desired=!state.desired;state.revision=++forumLikeRevision;paintForumLikeButton(button,state);
    // Coalesce bursts while keeping every click visible. At most one toggle
    // request per comment is in flight; later clicks only change the target.
    if(!state.running){clearTimeout(state.timer);state.timer=setTimeout(()=>syncForumLike(state),100);}
}
async function readForumLike(client,state){
    const response=await client.rpc('forum_like_stats',{p_topic:state.topic});if(response.error)throw response.error;
    const stat=response.data?.find(s=>String(s.comment_id)===String(state.id));
    state.confirmed=!!stat?.liked;state.total=Math.max(0,Number(stat?.total)||0);state.uncertain=false;state.revision=++forumLikeRevision;
}
async function syncForumLike(state){
    if(state.running)return;state.timer=null;state.running=true;
    let client;
    try{
        const user=await forumIdentity();if(user.id!==state.user)throw new Error('登录状态已变化，请重新点赞。');client=await ensureForumClient();
        if(state.uncertain)await readForumLike(client,state);
        while(state.desired!==state.confirmed){
            const response=await client.rpc('forum_toggle_like',{p_comment:state.id});
            if(response.error)throw response.error;
            if(typeof response.data!=='boolean')throw new Error('点赞响应无法确认。');
            state.total=Math.max(0,state.total+Number(response.data)-Number(state.confirmed));state.confirmed=response.data;state.revision=++forumLikeRevision;paintForumLike(state);
        }
    }catch(error){
        // A failed response may already have committed. Read before ever
        // issuing another toggle; blind retry would invert a successful like.
        state.uncertain=true;
        let recovered=false;
        if(client){try{await readForumLike(client,state);recovered=true;}catch{}}
        state.desired=state.confirmed;state.revision=++forumLikeRevision;paintForumLike(state);
        if(activeForumTopic?.id===state.topic){const status=forumEl('forum-comments-status');status.classList.remove('forum-loading');status.textContent=recovered?'点赞未能完成，已恢复云端状态，请重试。':'点赞未能同步，已恢复上次确认的状态，请稍后重试。';}
    }finally{state.running=false;}
}
async function submitForumComment(event) {
    event.preventDefault(); const topic = activeForumTopic; if (!topic) return;
    const button = event.currentTarget.querySelector('button[type=submit]'); if (button.disabled) return;
    const nickname = forumDisplayName(), body = forumEl('forum-comment-body').value.trim(); if (!nickname || !body) return;
    button.disabled = true;
    try {
        await forumIdentity(); const client = await ensureForumClient();
        const { error } = await client.from('forum_comments').insert({ topic_id:topic.id,nickname,body,parent_id:forumReplyTarget?.id || null }); if(error) throw error;
        forumSaveNickname(nickname);
        if (activeForumTopic?.id === topic.id) { forumEl('forum-comment-body').value = ''; resizeForumComposer(); clearForumReplyTarget(); await loadForumComments(); }
    } catch(error) { forumEl('forum-comments-status').textContent = forumError(error); }
    finally { button.disabled = false; }
}
function showForumModal(title, content) {
    document.querySelectorAll('.forum-comment-menu').forEach(n => n.hidden = true);
    forumModalReturnFocus = document.activeElement; forumEl('forum-modal').classList.toggle('forum-modal-compact',title.startsWith('删除')); forumEl('forum-modal-title').textContent = title;
    forumEl('forum-modal-content').replaceChildren(content); forumEl('forum-modal').hidden = false;
    forumEl('forum-modal').querySelector('input,textarea,button').focus();
}
function closeForumModal() {
    if (!forumEl('forum-modal') || forumEl('forum-modal').hidden || forumModalBusy) return;
    forumEl('forum-modal').hidden = true;
    if(forumModalReturnFocus?.id !== 'forum-comment-body' || forumCanSpeak()) forumModalReturnFocus?.focus();
}
function forumFormField(form, label, tag = 'input', max = 100, required = true) {
    const wrapper = forumNode('label','forum-field',label), input = forumNode(tag); input.maxLength = max; input.required = required;
    wrapper.append(input); form.append(wrapper); return input;
}
function forumFormActions(form, publish = '发布') {
    const actions = forumNode('div','forum-modal-actions'), cancel = forumNode('button','btn','取消'), submit = forumNode('button','btn btn-primary',publish);
    cancel.type='button'; cancel.onclick=closeForumModal; submit.type='submit'; actions.append(cancel,submit); form.append(actions); return submit;
}
function forumNotice(title,message){
    const content=forumNode('div');content.append(forumNode('p','',message));
    const close=forumNode('button','btn','确定');close.type='button';close.onclick=closeForumModal;content.append(close);showForumModal(title,content);
}
function forumTopicMenu(topic){
    const holder=forumNode('div','forum-topic-actions');
    if(!forumAdmin && (!topic.author_id || topic.author_id!==forumUser?.id))return holder;
    const menu=forumNode('div','forum-comment-menu');menu.hidden=true;menu.onclick=e=>e.stopPropagation();
    const more=forumAction('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>','话题操作',()=>{
        const open=!menu.hidden;document.querySelectorAll('.forum-comment-menu').forEach(n=>n.hidden=true);menu.hidden=open;more.setAttribute('aria-expanded',String(!open));
    });more.setAttribute('aria-expanded','false');
    const del=forumNode('button','forum-delete','');del.type='button';del.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg><span>删除话题</span>';del.onclick=()=>confirmForumTopicDelete(topic);menu.append(del);holder.append(more,menu);return holder;
}
function confirmForumTopicDelete(topic){
    const form=forumNode('form');form.append(forumNode('p','','确认删除这个话题及其中的全部留言？'));
    const status=forumNode('p','forum-form-status');form.append(status);const submit=forumFormActions(form,'确认');
    form.onsubmit=async e=>{e.preventDefault();if(forumModalBusy)return;forumModalBusy=true;submit.disabled=true;
        try{await forumIdentity();const client=await ensureForumClient();const {error}=await client.rpc('forum_delete_topic',{p_topic:topic.id});if(error)throw error;
            forumTopics=forumTopics.filter(t=>t.id!==topic.id);renderForumTopics();forumModalBusy=false;closeForumModal();
            if(activeForumTopic?.id===topic.id){activeForumTopic=null;clearForumReplyTarget();navigateTo('forum-page',true);}await loadForumTopics();
        }catch(error){status.textContent=forumError(error);}finally{forumModalBusy=false;submit.disabled=false;}
    };showForumModal('删除话题',form);
}
function forumTagPicker(container, labels, custom = false) {
    const selected = new Set(), strip = forumNode('div','forum-tag-picker'); strip.setAttribute('aria-label','可选择多个标签');
    function add(label, active = false) {
        const button = forumNode('button','forum-tag',label); button.type='button'; button.setAttribute('aria-pressed','false');
        const toggle = () => { if(selected.has(label)) selected.delete(label); else if(selected.size < 5) selected.add(label); button.setAttribute('aria-pressed',String(selected.has(label))); };
        button.onclick=toggle; strip.append(button); if(active) toggle();
    }
    labels.forEach(label => add(label)); container.append(strip);
    if(custom) {
        const button=forumNode('button','forum-tag','＋ 自定义'), input=forumNode('input'); button.type='button'; input.placeholder='自定义标签（回车添加）'; input.maxLength=12; input.hidden=true;
        strip.append(button); container.append(input);
        button.onclick=() => { input.hidden=false; input.focus(); };
        input.onkeydown=e=>{ if(e.key==='Enter') { e.preventDefault(); const label=input.value.trim(); if(label && ![...strip.children].some(n=>n.textContent===label)) add(label,true); input.value=''; input.hidden=true; } };
        // Publish also accepts a custom tag still in the field.
        return () => [...new Set([...selected,...(input.value.trim() ? [input.value.trim()] : [])])].slice(0,5);
    }
    return () => [...selected];
}
function openNewForumTopic() {
    if(!forumCanSpeak()){openMonthlyAccountModal(openNewForumTopic,true);return;}
    const form=forumNode('form');
    const title=forumFormField(form,'标题','input',100);
    const tags=forumTagPicker(form,['入门','进阶','公式','练习','比赛','器材'],true);
    const body=forumFormField(form,'详细内容','textarea',5000); body.rows=6;
    const status=forumNode('p','forum-form-status'); status.setAttribute('role','status'); form.append(status); const submit=forumFormActions(form);
    form.onsubmit=async e=>{ e.preventDefault(); if(forumModalBusy) return; forumModalBusy=true; submit.disabled=true;
        try { await forumIdentity(); const client=await ensureForumClient(); const {error}=await client.from('forum_topics').insert({id:crypto.randomUUID(),nickname:forumDisplayName(),title:title.value.trim(),body:body.value.trim(),tags:tags()}); if(error) throw error;
             forumModalBusy=false; closeForumModal(); await loadForumTopics();
        } catch(error) { status.textContent=forumError(error); } finally {forumModalBusy=false;submit.disabled=false;}
    }; showForumModal('新话题',form);
}
function confirmForumDelete(comment, after = loadForumComments) {
    const form=forumNode('form'); form.append(forumNode('p','','删除这条留言及其全部回复？'));
    const status=forumNode('p','forum-form-status'); form.append(status); const submit=forumFormActions(form,'删除');
    form.onsubmit=async e=>{e.preventDefault(); if(forumModalBusy)return;forumModalBusy=true;submit.disabled=true;
        try {await forumIdentity();const client=await ensureForumClient();const {error}=await client.rpc('forum_delete_comment',{p_comment:comment.id});if(error)throw error;
            if(forumReplyTarget?.id===comment.id)clearForumReplyTarget();forumModalBusy=false;closeForumModal();await after();
        }catch(error){status.textContent=forumError(error);}finally{forumModalBusy=false;submit.disabled=false;}
    };showForumModal('删除留言',form);
}
function openForumReport(comment) {
    const form=forumNode('form'); form.append(forumNode('p','','请选择举报理由（可多选）'));
    const reasons=forumTagPicker(form,['攻击辱骂','广告推广','不当内容','泄露隐私','刷屏','其他']);
    const details=forumFormField(form,'补充说明（选填）','textarea',500,false);details.rows=3;
    const status=forumNode('p','forum-form-status');form.append(status);const submit=forumFormActions(form,'确定');
    form.onsubmit=async e=>{e.preventDefault();if(forumModalBusy)return;if(!reasons().length){status.textContent='请选择至少一个举报理由。';return;}forumModalBusy=true;submit.disabled=true;
        try{await forumIdentity();const client=await ensureForumClient();const {error}=await client.rpc('forum_report_comment',{p_comment:comment.id,p_reasons:reasons(),p_details:details.value.trim()});if(error)throw error;
            const hidden=forumHiddenIds();hidden.add(String(comment.id));localStorage.setItem('forumHiddenComments',JSON.stringify([...hidden]));forumModalBusy=false;closeForumModal();await loadForumComments();
            forumEl('forum-comments-status').textContent='已提交举报，并对你隐藏这条留言及回复。';
        }catch(error){status.textContent=forumError(error);}finally{forumModalBusy=false;submit.disabled=false;}
    };showForumModal('举报留言',form);
}
async function openForumDeveloper() {
    const client=await ensureForumClient(), session=await client.auth.getSession();
    const check=await client.rpc('is_forum_admin'); forumAdmin=check.data===true && !!session.data?.session;
    if(forumAdmin){navigateTo('forum-developer-page',true);loadForumReports();return;}
    const form=forumNode('form'),email=forumFormField(form,'开发者邮箱','input',254);email.type='email';email.value='1244704197@qq.com';
    const status=forumNode('p','forum-form-status');form.append(status);const submit=forumFormActions(form,'发送登录邮件');
    form.onsubmit=async e=>{e.preventDefault();if(submit.disabled)return;submit.disabled=true;
        try{const {error}=await client.auth.signInWithOtp({email:email.value.trim(),options:{shouldCreateUser:false,emailRedirectTo:location.origin+location.pathname}});if(error)throw error;status.textContent='登录邮件已发送。点击邮件中的链接后，再进入开发者模式。';}
        catch(error){status.textContent='验证邮件发送失败，请确认该邮箱已在 Supabase 创建账号，然后稍后重试。';console.warn(error);}finally{submit.disabled=false;}
    };showForumModal('开发者身份验证',form);
}
async function loadForumReports() {
    const sequence=++forumReportSequence,status=forumEl('forum-admin-status');status.textContent='正在加载举报…';
    try{const client=await ensureForumClient();const check=await client.rpc('is_forum_admin');if(check.error)throw check.error;if(check.data!==true)throw {code:'42501'};
        const {data,error}=await client.from('forum_reports').select('*').eq('status','pending').order('created_at',{ascending:false}).limit(100);if(error)throw error;if(sequence!==forumReportSequence)return;
        const fragment=document.createDocumentFragment();for(const report of data||[]){const card=forumNode('article','forum-report');
            card.append(forumNode('strong','',report.nickname),forumNode('p','',report.body),forumNode('p','forum-form-status',`${report.reasons.join('、')} · ${report.details || '无补充说明'}`),forumNode('time','',new Date(report.created_at).toLocaleString('zh-CN')));
            const actions=forumNode('div','forum-modal-actions'),del=forumNode('button','btn','删除留言及回复'),dismiss=forumNode('button','btn','保留留言');
            del.onclick=()=>confirmForumDelete({id:report.comment_id},loadForumReports);
            dismiss.onclick=async()=>{dismiss.disabled=true;const result=await client.rpc('forum_resolve_report',{p_report:report.id});if(result.error){status.textContent=forumError(result.error);dismiss.disabled=false;}else loadForumReports();};actions.append(dismiss,del);card.append(actions);fragment.append(card);}
        forumEl('forum-reports').replaceChildren(fragment);status.textContent=data?.length?'':'暂无待审核举报。';
    }catch(error){if(sequence===forumReportSequence)status.textContent=forumError(error);}
}
async function exitForumDeveloper(){const client=await ensureForumClient();await client.auth.signOut();forumUser=null;forumAdmin=false;navigateTo('settings-page',true);}
document.addEventListener('click',e=>{if(!e.target.closest('.forum-comment-actions,.forum-topic-actions'))document.querySelectorAll('.forum-comment-menu').forEach(n=>n.hidden=true);});
document.addEventListener('keydown',e=>{
    const modal=forumEl('forum-modal');if(!modal || modal.hidden)return;
    if(e.key==='Escape'){e.preventDefault();closeForumModal();}
    if(e.key==='Tab'){const items=[...modal.querySelectorAll('button,input,textarea')].filter(n=>!n.hidden&&!n.disabled),first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
});
forumEl('forum-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeForumModal();});
function resizeForumComposer() {
    const input = forumEl('forum-comment-body');
    const maximum = Math.max(43,Math.min(240, (window.visualViewport?.height || window.innerHeight) * .35));
    input.style.height = '43px';
    input.style.height = `${Math.min(maximum, Math.max(43, input.scrollHeight + 2))}px`;
    input.style.overflowY = 'auto';
}
forumEl('forum-comment-body').addEventListener('input', resizeForumComposer);
let forumViewportFrame=0;
function scheduleForumComposerViewport(){
    if(forumViewportFrame)return;
    forumViewportFrame=requestAnimationFrame(()=>{forumViewportFrame=0;updateForumComposerViewport();});
}
function updateForumComposerViewport(){
    const viewport=window.visualViewport,form=forumEl('forum-comment-form');
    const mobile=window.innerWidth<=700,active=forumEl('forum-topic-page').classList.contains('active');
    // Layout-resizing Android keyboards need no extra lift; on iOS/overlay
    // keyboards the visual viewport reveals the actual unobscured bottom.
    const offset=mobile&&active&&viewport&&Math.abs(viewport.scale-1)<.05?Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop):0;
    form.style.setProperty('--forum-keyboard-offset',Math.round(offset)+'px');
    resizeForumComposer();
}
window.addEventListener('resize',scheduleForumComposerViewport);
window.visualViewport?.addEventListener('resize',scheduleForumComposerViewport);
window.visualViewport?.addEventListener('scroll',scheduleForumComposerViewport);
forumEl('forum-comment-body').addEventListener('focus',scheduleForumComposerViewport);
forumEl('forum-comment-body').addEventListener('blur',scheduleForumComposerViewport);
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => {
    forumEl('forum-topic-page').style.setProperty('--forum-composer-space', `${forumEl('forum-comment-form').offsetHeight + 40}px`);
}).observe(forumEl('forum-comment-form'));

function forumDisplayName(){
    return typeof accountProfile!=='undefined' && accountProfile ? accountProfile.nickname : localStorage.getItem('forumGuestName') || '';
}
function forumCanSpeak(){return !!forumUser && !!forumDisplayName();}
function confirmForumGuest(after){
    const form=forumNode('form');form.append(forumNode('p','','确认是否以游客身份登录？游客可参与论坛，不能参加月赛。'));
    const status=forumNode('p','forum-form-status');form.append(status);const submit=forumFormActions(form,'确定');
    form.onsubmit=async e=>{e.preventDefault();if(forumModalBusy)return;forumModalBusy=true;submit.disabled=true;status.textContent='登录中...';
        try{const client=await accountClient(),session=await client.auth.getSession();
            if(session.data.session && !session.data.session.user.is_anonymous){await refreshAccount();}
            else {const result=session.data.session?{data:{user:session.data.session.user}}:await client.auth.signInAnonymously();if(result.error)throw result.error;forumUser=result.data.user;
                const name=localStorage.getItem('forumGuestName') || `用户${crypto.randomUUID().replace(/-/g,'').slice(0,5)}`;localStorage.setItem('forumGuestName',name);uiSettings.username=name;saveTimerData();}
            forumModalBusy=false;closeForumModal();await after();
        }catch(error){status.textContent=forumError(error);}finally{forumModalBusy=false;submit.disabled=false;}
    };showForumModal('游客登录',form);
}
forumEl('forum-comment-body').addEventListener('focus',()=>{
    if(!forumCanSpeak()){forumEl('forum-comment-body').blur();openMonthlyAccountModal(()=>forumEl('forum-comment-body').focus(),true);}
});
