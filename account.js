/* Shared Supabase identity for forum and monthly competition. */
let accountProfile = null, accountMonthly = new Map(), accountActiveEntry = null;
let accountAuthClient = null, accountRefreshSequence = 0, accountRecoveryAllowed = false, accountSaveBusy = false;
let accountNicknameTimer = null;
const accountEl = id => document.getElementById(id);
async function accountClient() {
    const client = await ensureForumClient();
    if (accountAuthClient !== client) {
        accountAuthClient = client;
        client.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') accountRecoveryAllowed = true;
            setTimeout(async () => {
                try { await refreshAccount(); if (event === 'PASSWORD_RECOVERY') navigateTo('account-password-page',true); } catch { /* explicit actions show errors */ }
            },0);
        });
    }
    return client;
}
function accountWelcome(){return accountProfile?.wca_id==='2024GUOC01' && forumAdmin ? '欢迎开发者2024GUOC01登录' : `欢迎用户${accountProfile?.nickname || ''}登录`;}
function accountError(error) {
    if (/Failed to fetch|NetworkError|Load failed/i.test(error?.message || '')) return `无法连接账号服务。请检查 account 函数是否已部署、JWT 验证是否关闭，以及 SITE_ORIGINS 是否包含当前网站地址 ${location.origin}。`;
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return '连接账号服务超时，请检查网络后重试。';
    if (/PGRST|42P01|42703/.test(error?.code || '')) return '账号功能尚未配置，请先执行 account_supabase.sql 并部署 account 函数。';
    return error?.message || '暂时无法连接账号服务，请稍后重试。';
}
async function refreshAccount() {
    const sequence=++accountRefreshSequence,client=await accountClient();
    const session=await client.auth.getSession();if(session.error)throw session.error;
    const user=session.data.session?.user;
    let profile=null,records=[];
    if(user && !user.is_anonymous) {
        const result=await client.from('account_profiles').select('user_id,wca_id,nickname,email').eq('user_id',user.id).maybeSingle();if(result.error)throw result.error;
        profile=result.data;
        if(profile){const result=await client.from('account_monthly_entries').select('*').eq('month_key',getCurrentMonthKey());if(result.error)throw result.error;records=result.data || [];}
    }
    if(sequence!==accountRefreshSequence)return accountProfile;
    accountProfile=profile;accountMonthly=new Map(records.map(r=>[r.event_id,r]));
    if(profile) {
        uiSettings.username=profile.nickname;uiSettings.wcaId=profile.wca_id;saveTimerData();
        const name=accountEl('setting-username'),wca=accountEl('setting-wcaid');if(name)name.value=profile.nickname;if(wca)wca.textContent=profile.wca_id;
        localStorage.removeItem('forumGuestName');
    }
    accountEl('account-nav-entry').textContent=profile?'我的账号':'登录';
    accountEl('account-signed-in').hidden=!profile;accountEl('account-login-form').hidden=!!profile;
    
    forumUser=user || null;
    const admin=await client.rpc('is_forum_admin');forumAdmin=admin.data===true;
    if(profile)accountEl('account-profile-title').textContent=accountWelcome();
    const wca=accountEl('setting-wcaid');if(wca)wca.textContent=profile?.wca_id || '未登录';
    const email=accountEl('setting-email');if(email)email.textContent=profile ? (profile.email || '未填写') : '未登录';
    if(typeof loadAccountDashboard==='function' && accountEl('account-page').classList.contains('active')) loadAccountDashboard();
    return profile;
}
async function accountRequest(action,fields) {
    const client=await accountClient(),session=await client.auth.getSession();
    // Supabase display-name edits do not change the deployed function's slug.
    const response=await fetch(`${SUPABASE_URL}/functions/v1/swift-processor`,{
        method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY,...(session.data.session ? {Authorization:`Bearer ${session.data.session.access_token}`} : {})},
        body:JSON.stringify({action,...fields,...(action==='recover'?{redirectTo:`${location.origin}${location.pathname}?account=recovery`}:{})}),signal:AbortSignal.timeout(20000)
    });
    let result;try{result=await response.json();}catch{throw new Error('账号服务尚未部署或暂不可用。');}
    if(!response.ok)throw new Error(result.error || '账号操作失败。');
    if(result.session){const signed=await client.auth.setSession({access_token:result.session.access_token,refresh_token:result.session.refresh_token});if(signed.error)throw signed.error;await refreshAccount();}
    return result;
}
async function openAccountPage() {
    accountEl('account-page').classList.add('account-resolving');navigateTo('account-page',true);accountEl('account-status').textContent='正在检查登录状态…';
    try{await refreshAccount();accountEl('account-status').textContent='';}catch(error){accountEl('account-page').classList.remove('account-resolving');accountEl('account-status').textContent=accountError(error);}
}
async function submitAccountForm(event) {
    event.preventDefault();const form=event.currentTarget,action=event.submitter?.value || 'login',status=accountEl('account-status');
    const fields=Object.fromEntries(new FormData(form));fields.wcaId=fields.wcaId.trim().toUpperCase();
    if(action==='register' && !fields.email.trim()){status.textContent='注册时需要填写找回密码的邮箱。';return;}
    if(action==='register' && fields.password.length<8){status.textContent='密码至少 8 位。';return;}
    const buttons=[...form.querySelectorAll('button[type=submit]')];if(buttons.some(b=>b.disabled))return;buttons.forEach(b=>b.disabled=true);status.textContent=action==='register'?'注册中...':'登录中...';
    try{await accountRequest(action,fields);form.elements.password.value='';status.textContent=accountWelcome();}
    catch(error){status.textContent=accountError(error);}finally{buttons.forEach(b=>b.disabled=false);}
}
function openAccountRecovery(){navigateTo('account-recovery-page',true);accountEl('account-recovery-status').textContent='验证邮件中的链接后，即可设置新密码。';}
async function submitAccountRecovery(event){
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type=submit]');if(button.disabled)return;button.disabled=true;
    try{const result=await accountRequest('recover',Object.fromEntries(new FormData(form)));accountEl('account-recovery-status').textContent=result.message;}
    catch(error){accountEl('account-recovery-status').textContent=accountError(error);}finally{button.disabled=false;}
}
async function submitAccountPassword(event){
    event.preventDefault();const form=event.currentTarget,fields=Object.fromEntries(new FormData(form)),status=accountEl('account-password-status');
    if(!accountRecoveryAllowed){status.textContent='请先打开邮箱中的有效重置链接。';return;}
    if(fields.password!==fields.repeat){status.textContent='两次密码不一致，请重新输入。';return;}
    const button=form.querySelector('button');if(button.disabled)return;button.disabled=true;
    try{const client=await accountClient();const result=await client.auth.updateUser({password:fields.password});if(result.error)throw result.error;accountRecoveryAllowed=false;form.reset();await refreshAccount();navigateTo('account-page',true);if(accountProfile&&typeof loadAccountDashboard==='function')loadAccountDashboard();accountEl('account-status').textContent='新密码已保存，当前账号已登录。';}
    catch(error){status.textContent=accountError(error);}finally{button.disabled=false;}
}
async function accountSignOut(){
    if(accountSaveBusy || monthlyTimerState==='RUNNING'){alert('请先完成当前计时及成绩保存。');return;}
    const client=await accountClient();const result=await client.auth.signOut();if(result.error){accountEl('account-status').textContent=accountError(result.error);return;}
    accountProfile=null;accountMonthly.clear();accountActiveEntry=null;forumUser=null;forumAdmin=false;
    uiSettings.username='';uiSettings.wcaId='';saveTimerData();await refreshAccount();accountEl('account-status').textContent='已退出登录。';
}
async function updateAccountNickname(value){
    if(!accountProfile)return;clearTimeout(accountNicknameTimer);
    const owner=accountProfile.user_id,nickname=value.trim() || `用户${accountProfile.user_id.replace(/-/g,'').slice(0,6)}`;
    accountNicknameTimer=setTimeout(async()=>{try{if(accountProfile?.user_id!==owner)return;const client=await accountClient();const {error}=await client.from('account_profiles').update({nickname}).eq('user_id',owner);if(error)throw error;accountProfile.nickname=nickname;}catch(error){console.warn('昵称同步失败',error);}},600);
}

// Local settings are a view of authenticated records, not a source of eligibility.
getMonthlyAttempts=function(eventId){const row=accountMonthly.get(eventId);return row?.month_key===getCurrentMonthKey() && row.status==='completed'?row.attempts:null;};
getMonthlyBestAttempts=function(eventId){return getMonthlyAttempts(eventId);};
markMonthlyParticipated=function(){/* Completion is committed by the database RPC. */};
syncMonthlyResultToCloud=function(){/* RPC commits the leaderboard with the last attempt. */};
uploadWeeklyResult=async function(){throw new Error('月赛成绩只能通过已登录账号逐次提交。');};
const accountOriginalMonthlyList=renderMonthlyList;
renderMonthlyList=async function(){
    await accountOriginalMonthlyList();
    for(const [event,row] of accountMonthly)if(row.status==='started' && row.month_key===getCurrentMonthKey()){
        const button=document.querySelector(`#monthly-event-list .event-${event}`)?.closest('.monthly-event-row')?.querySelector('button');if(button)button.textContent='继续';
    }
};

initMonthly=async function(){
    try{await refreshAccount();if(!accountProfile){openMonthlyAccountModal();return;}await renderMonthlyList();navigateTo('monthly-page');ensureTwistyPlayer().catch(console.warn);}
    catch(error){alert(accountError(error));}
};
function openMonthlyAccountModal(after=initMonthly,allowGuest=false){
    const form=forumNode('form');form.append(forumNode('p','','登录只需账号和密码，用户名和注册邮箱会自动同步。注册时可填写用户名，留空则自动生成并保存。'));
    const nickname=forumFormField(form,'用户名（仅注册时选填）','input',24,false);nickname.placeholder='留空则自动生成并保存';
    const wca=forumFormField(form,'账号（8–32 位字母、数字、下划线或短横线）','input',32);wca.value=uiSettings.wcaId || '';wca.autocomplete='username';
    const password=forumFormField(form,'密码','input',128);password.type='password';password.autocomplete='current-password';password.placeholder='注册密码至少 8 位';
    const email=forumFormField(form,'邮箱（仅注册时必填，用于找回密码）','input',254,false);email.type='email';email.placeholder='登录时无需填写';
    const status=forumNode('p','forum-form-status');form.append(status);
    const actions=forumNode('div','forum-modal-actions'),register=forumNode('button','btn','注册'),login=forumNode('button','btn btn-primary','登录');register.type=login.type='submit';register.value='register';login.value='login';actions.append(register,login);form.append(actions);
    const forgot=forumNode('button','account-text-link','忘记密码？');forgot.type='button';forgot.onclick=()=>{closeForumModal();openAccountRecovery();};form.append(forgot);
    form.onsubmit=async event=>{event.preventDefault();const action=event.submitter.value;if(forumModalBusy)return;
        if(action==='register' && (!email.value.trim() || password.value.length<8)){status.textContent='注册需要邮箱，密码至少 8 位。';return;}
        forumModalBusy=true;register.disabled=login.disabled=true;status.textContent=action==='register'?'注册中...':'登录中...';
        try{await accountRequest(action,{nickname:nickname.value,wcaId:wca.value,password:password.value,email:email.value});password.value='';forumModalBusy=false;closeForumModal();await after();}
        catch(error){status.textContent=accountError(error);}finally{forumModalBusy=false;register.disabled=login.disabled=false;}
    };
    if(allowGuest){const guest=forumNode('button','btn btn-outline','游客登录');guest.type='button';guest.onclick=()=>confirmForumGuest(after);form.append(guest);}
    showForumModal(allowGuest?'登录后参与交流':'用户 · 注册或登录',form);
}
openMonthlyEntry=async function(evId,cnName){
    if(monthlyEntryChecking)return;monthlyEntryChecking=true;
    try{await refreshAccount();if(!accountProfile){openMonthlyAccountModal();return;}if(getMonthlyAttempts(evId)){alert('本月该项目已参加，不能再次参加。');return;}
        currentMonthlyEventTarget=evId;currentMonthlyEventName=cnName;accountEl('monthly-entry-modal').style.display='flex';
    }catch(error){alert(accountError(error));}finally{monthlyEntryChecking=false;}
};
confirmMonthlyEntry=async function(){
    if(accountSaveBusy)return;accountSaveBusy=true;
    try{
        const client=await accountClient(),scrambles=ensureMonthlyScrambles(currentMonthlyEventTarget)[currentMonthlyEventTarget];
        const {data,error}=await monthlyCloudRequest(client.rpc('account_monthly_start',{p_event:currentMonthlyEventTarget,p_scrambles:scrambles}));if(error)throw error;
        accountMonthly.set(data.event_id,data);closeMonthlyEntry();
        if(data.status==='completed'){alert('本月该项目已完成，不能再次参加。');renderMonthlyList();return;}
        accountActiveEntry=data;monthlyAttempts=[...data.attempts];monthlyHasFinished=false;monthlyTimerState='IDLE';
        accountEl('monthly-timer-display').textContent='0.00';accountEl('monthly-timer-display').className='timer-display';
        accountEl('monthly-timer-title').textContent=`巅峰月赛 - ${currentMonthlyEventName}`;accountEl('monthly-event-watermark').className=`cubing-icon event-${currentMonthlyEventTarget}`;
        renderMonthlyAttemptsList();renderMonthlyScramble(monthlyAttempts.length);navigateTo('monthly-timer-page',true);
    }catch(error){alert(accountError(error));}finally{accountSaveBusy=false;}
};
const accountOriginalRenderScramble=renderMonthlyScramble;
renderMonthlyScramble=function(index){
    if(accountActiveEntry?.event_id===currentMonthlyEventTarget){
        const key='monthlyScrambles_v2_'+getCurrentMonthKey()+'_'+getCurrentWeekKey();let cached={};try{cached=JSON.parse(localStorage.getItem(key)||'{}');}catch{}
        cached[currentMonthlyEventTarget]=accountActiveEntry.scrambles;localStorage.setItem(key,JSON.stringify(cached));
    }accountOriginalRenderScramble(index);
};
async function accountAppendAttempt(rawMs,penalty,modalId){
    if(accountSaveBusy || !accountActiveEntry)return;accountSaveBusy=true;
    try{
        const client=await accountClient(),result=await monthlyCloudRequest(client.rpc('account_monthly_append',{p_entry:accountActiveEntry.id,p_index:monthlyAttempts.length,p_attempt:{rawMs:Number.isFinite(rawMs)?rawMs:0,penalty}}));if(result.error)throw result.error;
        accountActiveEntry=result.data;accountMonthly.set(result.data.event_id,result.data);monthlyAttempts=[...result.data.attempts];accountEl(modalId).style.display='none';renderMonthlyAttemptsList();
        if(result.data.status==='completed'){monthlyHasFinished=true;renderMonthlyList();showMonthlyFinishAlert();}else renderMonthlyScramble(monthlyAttempts.length);
    }catch(error){alert(`${accountError(error)}\n本次成绩尚未确认，请保留此页面重试。`);}finally{accountSaveBusy=false;}
}
confirmMonthlyPenalty=function(){return accountAppendAttempt(currentMonthlyRawMs,currentMonthlyPen,'monthly-penalty-modal');};
confirmMonthlyManual=function(){
    const value=accountEl('monthly-manual-input').value;let ms=value?parseManualTime(value):0;
    if(ms===null){showInvalidInputToast();return;}if(!value && currentManualPenalty!=='DNF')return;
    return accountAppendAttempt(ms,currentManualPenalty,'monthly-manual-modal');
};
confirmMonthlyExit=async function(){
    if(accountSaveBusy || !accountActiveEntry)return;accountSaveBusy=true;
    try{const client=await accountClient(),result=await monthlyCloudRequest(client.rpc('account_monthly_abort',{p_entry:accountActiveEntry.id}));if(result.error)throw result.error;
        accountMonthly.set(result.data.event_id,result.data);monthlyAttempts=result.data.attempts;monthlyTimerState='IDLE';monthlyHasFinished=true;closeMonthlyExit();renderMonthlyList();goBack();
    }catch(error){alert(accountError(error));}finally{accountSaveBusy=false;}
};
// No requests for logged-out homepage visitors; restore only saved sessions/recovery links.
if(localStorage.getItem('nbcubing-forum-auth') || location.hash.includes('access_token=') || new URLSearchParams(location.search).get('account')==='recovery') {
    const recoveryHint=location.hash.includes('type=recovery');
    accountClient().then(async client=>{
        const session=await client.auth.getSession();
        // Supabase verifies the recovery token before establishing this session.
        if(recoveryHint && session.data.session){accountRecoveryAllowed=true;navigateTo('account-password-page',true);}
        await refreshAccount();
    }).catch(error=>console.warn('账号自动恢复暂不可用',error));
}
