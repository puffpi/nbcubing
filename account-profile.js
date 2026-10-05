/* Independent account dashboard: shares data helpers, never renders the public person page. */
const accountAthletes=new Map();
let accountDashboardSequence=0,accountDashboardId='',accountDashboardPlayer=null,accountDashboardHistory=null,accountDashboardEvent='333',accountDashboardType='average';
let accountProgressChart=null,publicProfileView=false,lastPublicProfile=null;
const adNode=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
function adButton(text,action,cls=''){const b=adNode('button',cls,text);b.type='button';b.onclick=action;return b;}
function adRoot(){const id=publicProfileView?'public-profile-dashboard':'account-dashboard';let root=document.getElementById(id);if(!root){root=adNode('div','account-dashboard');root.id=id;document.getElementById(publicProfileView?'person-page':'account-page').append(root);}return root;}
async function loadAccountDashboard(force=false){
 const wasPublic=publicProfileView;if(wasPublic)lastPublicProfile={player:accountDashboardPlayer,event:accountDashboardEvent,type:accountDashboardType};publicProfileView=false;if(wasPublic)document.getElementById('public-profile-dashboard')?.replaceChildren();
 const root=adRoot(),id=accountProfile?.wca_id || '';
 if(id===accountDashboardId&&!force&&!wasPublic){document.getElementById('account-page').classList.remove('account-resolving');return;}
 accountDashboardId=id;const sequence=++accountDashboardSequence;if(accountProgressChart){accountProgressChart.destroy();accountProgressChart=null;}root.replaceChildren();
 document.getElementById('account-page').classList.remove('account-has-athlete');
 document.getElementById('account-page').classList.toggle('account-resolving',/^\d{4}[A-Z]{4}\d{2}$/.test(id));
 if(!/^\d{4}[A-Z]{4}\d{2}$/.test(id))return;
 root.append(adNode('p','ad-loading','正在读取你的选手档案…'));
 const current=()=>sequence===accountDashboardSequence&&accountProfile?.wca_id===id;
 try{
  let player=accountAthletes.get(id)||(typeof allCubersData!=='undefined'?allCubersData.find(p=>p.person?.wca_id===id):null);
  if(!player){try{const cached=JSON.parse(localStorage.getItem('accountAthlete:'+id)||'null');if(cached&&Date.now()-cached.at<86400000&&cached.player?.person?.wca_id===id)player=cached.player;}catch{}}
  if(!player){const response=await fetch(`https://www.worldcubeassociation.org/api/v0/persons/${encodeURIComponent(id)}`,{signal:AbortSignal.timeout(20000)});
   if(response.status===404){if(current())document.getElementById('account-page').classList.remove('account-resolving');if(current())root.replaceChildren(adNode('p','ad-loading','这个账号符合 WCA ID 格式，但尚未查到选手档案。'));return;}
   if(!response.ok)throw new Error('档案连接失败');player=await response.json();if(!player.person?.wca_id)throw new Error('档案格式异常');accountAthletes.set(id,player);try{localStorage.setItem('accountAthlete:'+id,JSON.stringify({at:Date.now(),player}));}catch{}
  }
  if(!current())return;
  document.getElementById('account-page').classList.remove('account-resolving');accountDashboardPlayer=player;accountDashboardHistory=allHistoryData[id]||remotePersonHistory.get(id)||null;
  document.getElementById('account-page').classList.add('account-has-athlete');renderAccountDashboard();
  try{
   let loaded=accountDashboardHistory;
   if(!loaded){const historyPromise=rosterIds.includes(id)?ensureHistoryData().then(()=>allHistoryData[id]||null):fetchRemotePersonHistory(id);const results=await Promise.allSettled([historyPromise,ensureChineseCompetitions()]);if(results[0].status==='rejected')throw results[0].reason;loaded=results[0].value;remotePersonHistory.set(id,loaded);}
   if(current()){accountDashboardHistory=loaded || {};renderAccountDashboard();}
  }catch(error){if(current()){const notice=root.querySelector('.ad-history-status');if(notice){notice.replaceChildren(adNode('span','','历史成绩暂时未能加载。'),adButton('重新加载',()=>loadAccountDashboard(true),'ad-link'));}}}
 }catch(error){if(current()){root.replaceChildren(adNode('p','ad-loading','选手档案暂时无法连接，请稍后重试。'),adButton('重试',()=>loadAccountDashboard(true),'btn btn-outline'));accountDashboardId='';}}
}
function adIcon(event){return adNode('span',`cubing-icon event-${event}`);}
function renderAccountDashboard(){
 const root=adRoot(),p=accountDashboardPlayer,records=p.personal_records||{},history=accountDashboardHistory;
 const events=eventDict.filter(e=>records[e.id]);
 if(accountProgressChart){accountProgressChart.destroy();accountProgressChart=null;}root.replaceChildren();
 root.dataset.layout=typeof uiSettings!=='undefined'?(uiSettings.personLayout||'dense'):'card';
 const hero=adNode('section','ad-hero');
 const identity=adNode('div','ad-identity');identity.append(adNode('h1','',formatName(p.person.name)),adNode('p','ad-id',p.person.wca_id));
 const historyRounds=Object.values(history||{}).flat(),dates=historyRounds.map(r=>String(r.date)).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
 if(dates.length&&dates.length===historyRounds.length){const date=d=>d.split('-').map(Number).join('.'),career=adNode('p','ad-career');career.append(adNode('span','ad-career-label','参赛经历：'),adNode('time','',date(dates[0])),adNode('span','ad-career-separator',' ~ '),adNode('time','',date(dates.at(-1))));identity.append(career);}
 const links=adNode('div','ad-links');for(const [name,url] of [['WCA',`https://www.worldcubeassociation.org/persons/${p.person.wca_id}`],['粗饼',`https://cubing.com/results/person/${p.person.wca_id}`]]){const a=adNode('a','ad-link',`↗ ${name}`);a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}identity.append(links);
 if(!publicProfileView&&typeof forumAdmin!=='undefined'&&forumAdmin&&accountProfile?.wca_id==='2024GUOC01')identity.append(adNode('p','ad-welcome','欢迎开发者登录'));
 const identityLine=adNode('div','ad-identity-line');identityLine.append(identity.querySelector('.ad-id'));const welcome=identity.querySelector('.ad-welcome');if(welcome)identityLine.append(welcome);identity.insertBefore(identityLine,identity.querySelector('.ad-career')||identity.querySelector('.ad-links'));
 const summary=adNode('div','ad-summary');for(const [value,label] of [[getCountryName(p.person.country_iso2),'地区'],[p.person.gender==='m'?'男':p.person.gender==='f'?'女':'其他','性别'],[p.competition_count??p.competition_ids?.length??0,'参赛次数'],[events.length,'参赛项目']]){const stat=adNode('div','ad-stat');stat.append(adNode('strong','',String(value)),adNode('span','',label));summary.append(stat);}hero.append(identity,summary);
 const actions=adNode('div','ad-account-actions');actions.append(adButton('返回首页',()=>goHome()));if(!publicProfileView)actions.append(adButton('退出登录',()=>accountSignOut()));hero.append(actions);
 if(root.dataset.layout==='dense'){const toolbar=adNode('div','ad-hero-toolbar');toolbar.append(links,actions);hero.append(toolbar);}
 root.append(hero);
 const section=adNode('section','ad-section');section.append(adNode('div','ad-section-heading','个人最佳 · PERSONAL BEST'));
 const grid=adNode('div','ad-record-grid');
 for(const ev of events){const card=adNode('article','ad-record');const heading=adNode('h3','');heading.append(adIcon(ev.id),adNode('span','',ev.name));card.append(heading);
  for(const type of ['single','average']){const r=records[ev.id][type];if(!r)continue;
   const row=adNode('div','ad-record-result');row.append(adNode('span','ad-type',type==='single'?'单次':'平均'),adNode('strong','ad-score',formatWcaResult(r.best,ev.id,type)));
   const ranks=adNode('div','ad-ranks');for(const [label,value] of [['NR',r.country_rank],[getContinentRankPrefix(p.person.country_iso2),r.continent_rank],['WR',r.world_rank]]){const rank=adNode('span','');rank.append(adNode('small','',label),adNode('b',Number(value)>0&&Number(value)<=100?'ad-top100':'',value?String(value):'—'));ranks.append(rank);}row.append(ranks);card.append(row);
   const match=history?.[ev.id]?.find(round=>Number(round[type])===Number(r.best)&&r.best>0);const name=r.comp_name||match?.comp;const date=r.comp_date||match?.date;
   card.append(adNode('p','ad-result-source',name?`${getChineseCompetitionName(name)} · ${date||'日期暂无'}`:'比赛与日期待历史数据补全'));
  }grid.append(card);
 }section.append(grid);root.append(section);
 if(root.dataset.layout==='classic')renderAccountClassic(section,records,history,p);
 if(root.dataset.layout==='dense')renderAccountDense(section,records,history,p);
 renderAccountHealth(root,records);
 renderAccountLegacyHistory(root,history);
}

const adHealthTemplate="<div class=\"card\" id=\"account-big-cube-index-card\" style=\"display: none; margin-top: 20px;\">\n            <div style=\"text-align: center; margin-bottom: 15px;\">\n                <h3 style=\"margin: 0 0 5px 0; font-size: 16px; color: var(--primary-color);\">高阶健康指数</h3>\n                <div style=\"font-size: 12px; color: var(--text-muted);\">\n                    评估四阶到七阶魔方的复原时间健康度<br>\n                    指数偏高代表比较的两方中低阶偏快或高阶偏慢，指数偏低则相反<br>\n                    参考区间：五阶/四阶 ∈ (1.7, 2.0)，六阶/五阶 ∈ (1.7, 2.0)，七阶≤六阶+五阶 即 七阶/六阶 ≈ 1.5\n                </div>\n            </div>\n            <div class=\"table-responsive\">\n                <table>\n                    <thead>\n                        <tr>\n                            <th style=\"width: 25%\">类型</th>\n                            <th style=\"width: 25%\">五阶 / 四阶</th>\n                            <th style=\"width: 25%\">六阶 / 五阶</th>\n                            <th style=\"width: 25%\">七阶 / 六阶</th>\n                        </tr>\n                    </thead>\n                    <tbody id=\"account-big-cube-tbody\"></tbody>\n                </table>\n            </div>\n        </div>";
const adHistoryTemplate="<div class=\"card\" id=\"account-history-chart-card\" style=\"display: none; margin-top: 20px;\">\n            <div id=\"account-history-event-tabs\" style=\"display: flex; gap: 15px; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; overflow-x: auto;\"></div>\n            <div style=\"display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;\">\n                <h3 style=\"margin: 0; font-size: 16px; color: var(--text-main);\">成绩变化曲线</h3>\n                <div class=\"ios-segment-control\">\n                    <div id=\"account-btn-type-single\" class=\"ios-segment-btn\" >单次</div>\n                    <div id=\"account-btn-type-average\" class=\"ios-segment-btn active\" >平均</div>\n                </div>\n            </div>\n            <div style=\"height: 250px; width: 100%; margin-bottom: 30px;\">\n                <canvas id=\"account-progressChart\"></canvas>\n            </div>\n            <h3 style=\"margin: 0 0 15px 0; font-size: 16px; color: var(--text-main);\">历史成绩详情</h3>\n            <div class=\"table-responsive\">\n                <table style=\"font-size: 13px;\">\n                    <thead>\n                        <tr>\n                            <th style=\"width: 25%;\">比赛</th>\n                            <th style=\"width: 10%;\">轮次</th>\n                            <th style=\"width: 8%;\">排名</th>\n                            <th style=\"width: 12%;\">单次</th>\n                            <th style=\"width: 12%;\">平均</th>\n                            <th style=\"width: 35%;\">详情</th>\n                        </tr>\n                    </thead>\n                    <tbody id=\"account-history-detail-tbody\"></tbody>\n                </table>\n            </div>\n        </div>";
function adTemplate(html,cls){const t=document.createElement('template');t.innerHTML=html;const card=t.content.firstElementChild;card.classList.add(cls);card.style.display='block';return card;}
function renderAccountHealth(root,records){
 const section=adTemplate(adHealthTemplate,'ad-legacy-health');root.append(section);
    const bigCubeCard = section;
    const bigCubeTbody = section.querySelector('#account-big-cube-tbody');
    bigCubeTbody.innerHTML = '';

    const r4 = records['444'];
    const r5 = records['555'];
    const r6 = records['666'];
    const r7 = records['777'];

    // 只有当选手至少有一项相邻高阶的成绩时，才展示面板
    if ((r4 && r5) || (r5 && r6) || (r6 && r7)) {
        bigCubeCard.style.display = 'block';

        // 颜色判断逻辑
        const getHealthColor = (ratio, type) => {
            const val = parseFloat(ratio);
            if (type === '54' || type === '65') {
                if (val >= 2.10 || val < 1.60) return 'color: #e63946;'; // 红灯
                if (val >= 2.00 || val < 1.70) return 'color: #f59e0b;'; // 黄灯
                return 'color: #10b981;'; // 绿灯健康
            } else if (type === '76') {
                if (val >= 1.65 || val < 1.40) return 'color: #e63946;'; // 红灯
                if (val >= 1.60 || val < 1.45) return 'color: #f59e0b;'; // 黄灯
                return 'color: #10b981;'; // 绿灯健康
            }
            return '';
        };

        // 核心计算逻辑：带有阈值颜色渲染
        const calcRatio = (high, low, type) => {
            if (high && low) {
                const ratio = (high.best / low.best).toFixed(2);
                return `<span style="${getHealthColor(ratio, type)}">${ratio}</span>`;
            }
            return '-';
        };

        const trSingle = document.createElement('tr');
        trSingle.innerHTML = `
            <td><span class="type-badge">单次</span></td>
            <td style="font-weight: 600;">${calcRatio(r5?.single, r4?.single, '54')}</td>
            <td style="font-weight: 600;">${calcRatio(r6?.single, r5?.single, '65')}</td>
            <td style="font-weight: 600;">${calcRatio(r7?.single, r6?.single, '76')}</td>
        `;

        const trAvg = document.createElement('tr');
        trAvg.innerHTML = `
            <td><span class="type-badge">平均</span></td>
            <td style="font-weight: 600;">${calcRatio(r5?.average, r4?.average, '54')}</td>
            <td style="font-weight: 600;">${calcRatio(r6?.average, r5?.average, '65')}</td>
            <td style="font-weight: 600;">${calcRatio(r7?.average, r6?.average, '76')}</td>
        `;

        bigCubeTbody.appendChild(trSingle);
        bigCubeTbody.appendChild(trAvg);
    } else {
        bigCubeCard.style.display = 'none';
    }

}
function renderAccountLegacyHistory(root,history){
 if(!history || !Object.keys(history).length)return;
 const card=adTemplate(adHistoryTemplate,'ad-legacy-history');root.append(card);
 const tabs=card.querySelector('#account-history-event-tabs');
 const available=eventDict.filter(ev=>history[ev.id]?.length);
 if(!history[accountDashboardEvent])accountDashboardEvent=available[0]?.id;
 for(const ev of available){const tab=adButton('',()=>{accountDashboardEvent=ev.id;tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===tab));updateAccountLegacyHistory(card);},'history-event-tab'+(ev.id===accountDashboardEvent?' active':''));tab.setAttribute('aria-label',ev.name);tab.style.border='0';tab.style.padding='0';const icon=adIcon(ev.id);icon.style.fontSize='26px';tab.append(icon);tabs.append(tab);}
 for(const type of ['single','average']){const button=card.querySelector('#account-btn-type-'+type);button.setAttribute('role','button');button.onclick=()=>{accountDashboardType=type;card.querySelectorAll('.ios-segment-btn').forEach(b=>b.classList.toggle('active',b===button));updateAccountLegacyHistory(card);};button.classList.toggle('active',type===accountDashboardType);}
 updateAccountLegacyHistory(card);
}
async function updateAccountLegacyHistory(container) {
    if (!accountDashboardHistory) return;
    const type = accountDashboardType;
    const eventId = accountDashboardEvent;
    let results = accountDashboardHistory[eventId];
    if (!results) return;

    // 记录当前的滚动条位置，防止表格刷新时页面上下跳动
    const currentScrollY = window.scrollY;

    let rollingPrSingle = Infinity;
    let rollingPrAverage = Infinity;

    results.forEach(r => {
        r.isPrSingle = false;
        r.isPrAverage = false;
        // 这里的 r.single > 0 和 r.average > 0 严格保障了 DNF/DNS 绝不可能被标为 PR
        if (r.single && r.single > 0 && r.single < rollingPrSingle) {
            rollingPrSingle = r.single;
            r.isPrSingle = true;
        }
        if (r.average && r.average > 0 && r.average < rollingPrAverage) {
            rollingPrAverage = r.average;
            r.isPrAverage = true;
        }
    });

    let plotData = [];
    results.forEach((r) => {
        let val = r[type];
        if (val && val > 0) {
            let isPr = (type === 'average') ? r.isPrAverage : r.isPrSingle;
            plotData.push({ x: r.date, compName: getChineseCompetitionName(r.comp), y: val, displayTime: formatWcaResult(val, eventId, type), isPr: isPr });
        }
    });

    if (plotData.length > 0 && !window.Chart) {
        try { await ensureChartJs(); }
        catch (error) { console.warn('图表组件加载失败', error); }
    }
    if(!container.isConnected)return;
    if (plotData.length > 0 && window.Chart) {
        let chartValues = plotData.map(p => eventId === '333fm' && type === 'single' ? p.y : p.y / 100);
        let labels = plotData.map(p => p.x);

        let pointColors = plotData.map(p => p.isPr ? '#f59e0b' : '#9ca3af');
        let pointBorderColors = plotData.map(p => p.isPr ? '#ffffff' : '#ffffff');
        let pointRadii = plotData.map(p => p.isPr ? 5 : 3);
        let pointBorderWidths = plotData.map(p => p.isPr ? 2 : 1);

        const ctx = container.querySelector('#account-progressChart').getContext('2d');

        if (accountProgressChart) {
            accountProgressChart.data.labels = labels;
            accountProgressChart.data.datasets[0].data = chartValues;
            accountProgressChart.data.datasets[0].pointBackgroundColor = pointColors;
            accountProgressChart.data.datasets[0].pointBorderColor = pointBorderColors;
            accountProgressChart.data.datasets[0].pointRadius = pointRadii;
            accountProgressChart.data.datasets[0].pointBorderWidth = pointBorderWidths;

            if (accountProgressChart.options.animations && accountProgressChart.options.animations.y) {
                delete accountProgressChart.options.animations.y;
            }

            accountProgressChart._plotData = plotData;
            accountProgressChart.update();
        } else {
            accountProgressChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '成绩',
                        data: chartValues,
                        borderColor: '#d1d5db',
                        backgroundColor: 'rgba(209, 213, 219, 0.2)',
                        borderWidth: 2,
                        pointBackgroundColor: pointColors,
                        pointBorderColor: pointBorderColors,
                        pointBorderWidth: pointBorderWidths,
                        pointRadius: pointRadii,
                        pointHoverRadius: 7,
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    animations: {
                        y: { duration: 1000, easing: 'easeOutQuart', from: (ctx) => ctx.chart.scales.y ? ctx.chart.scales.y.bottom : 300 }
                    },
                    interaction: { mode: 'index', intersect: false, axis: 'x' },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            displayColors: false,
                            backgroundColor: 'rgba(51, 65, 85, 0.95)',
                            padding: 12,
                            titleFont: { size: 0 },
                            bodyFont: { size: 14, lineHeight: 1.5 },
                            callbacks: {
                                title: () => null,
                                label: function(tooltipItem) {
                                    let currentPlotData = tooltipItem.chart._plotData;
                                    let dataIndex = tooltipItem.dataIndex;
                                    if (!currentPlotData || !currentPlotData[dataIndex]) return '';

                                    let compName = currentPlotData[dataIndex].compName;
                                    let prefix = currentPlotData[dataIndex].isPr ? 'PR: ' : '成绩: ';
                                    let scoreStr = prefix + currentPlotData[dataIndex].displayTime;
                                    return [compName, scoreStr];
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            title: { display: true, text: '成绩', font: { size: 13 } },
                            afterFit: function(scaleInstance) { scaleInstance.width = 65; },
                            ticks: {
                                callback: function(value) {
                                    if (eventId === '333fm' || eventId === '333mbf') return value;
                                    let cleanVal = Number(value.toFixed(2));
                                    if (cleanVal >= 60) {
                                        let m = Math.floor(cleanVal / 60);
                                        let s = Math.floor(cleanVal % 60).toString().padStart(2, '0');
                                        return `${m}:${s}`;
                                    }
                                    return cleanVal.toString();
                                }
                            }
                        },
                        x: { ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 }, autoSkip: true, maxTicksLimit: 12 } }
                    }
                }
            });
            accountProgressChart._plotData = plotData;
        }
    } else {
        if (accountProgressChart) { accountProgressChart.destroy(); accountProgressChart = null; }
    }

    const tbody = container.querySelector('#account-history-detail-tbody');
    tbody.innerHTML = '';
    const reversedResults = [...results].reverse();

    const prStyle = 'color: #f59e0b; font-weight: bold;';
    const roundMap = { '1': '初赛', '2': '复赛', '3': '半决赛', 'f': '决赛', 'c': '联合初/复赛', 'd': '第一轮', 'e': '第二轮', 'b': 'B组决赛', 'h': '资格赛' };

    let lastComp = '';
    reversedResults.forEach(r => {
        let displayComp = '';
        if (r.comp !== lastComp) {
            displayComp = `<div style="font-size: 14px; font-weight: bold; color: var(--text-main); line-height: 1.4;">${getChineseCompetitionName(r.comp)}</div>
                           <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">${r.date}</div>`;
            lastComp = r.comp;
        }

        let displayRound = roundMap[r.round] || r.round;
        let displayPos = r.pos ? r.pos : '-';

        // 将没有成绩的记录直接替换为 DNF (或 DNS)
        let singleHtml = 'DNF';
        if (r.single && r.single > 0) singleHtml = formatWcaResult(r.single, eventId, 'single');
        else if (r.single === -2) singleHtml = 'DNS';

        if (r.isPrSingle) singleHtml = `<span style="${prStyle}">${singleHtml}</span>`;

        let avgHtml = 'DNF';
        if (r.average && r.average > 0) avgHtml = formatWcaResult(r.average, eventId, 'average');
        else if (r.average === -2) avgHtml = 'DNS';

        if (r.isPrAverage) avgHtml = `<span style="${prStyle}">${avgHtml}</span>`;

        let rawVals = [r.v1 || 0, r.v2 || 0, r.v3 || 0, r.v4 || 0, r.v5 || 0];
        let validVals = [];
        let dnfCount = 0;
        rawVals.forEach(v => {
            if (v === -1 || v === -2) dnfCount++;
            else if (v > 0) validVals.push(v);
        });

        let best = validVals.length > 0 ? Math.min(...validVals) : -1;
        let worst = validVals.length > 0 ? Math.max(...validVals) : -1;

        let bestWrapped = false;
        let worstWrapped = false;
        let isAo5 = (rawVals.filter(v => v !== 0 && v !== null).length === 5);

        let detailsHtmlArr = rawVals.map(v => {
            if (v === 0 || v === null || isNaN(v)) return '';
            let str = (v === -1) ? 'DNF' : (v === -2) ? 'DNS' : formatWcaResult(v, eventId, 'single');

            // 纯粹地添加括号，不再注入控制灰色的 HTML 标签
            if (isAo5) {
                if ((v === -1 || v === -2) && !worstWrapped) {
                    str = `(${str})`; worstWrapped = true;
                } else if (v === worst && !worstWrapped && dnfCount === 0) {
                    str = `(${str})`; worstWrapped = true;
                } else if (v === best && !bestWrapped) {
                    str = `(${str})`; bestWrapped = true;
                }
            }
            return str;
        });

        let finalDetails = detailsHtmlArr.filter(s => s !== '').join(' &nbsp; ');
        if (!finalDetails) finalDetails = '-';

        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${displayComp}</td>
            <td style="font-size: 14px; color: var(--text-main);">${displayRound}</td>
            <td style="font-size: 14px; color: var(--text-main);">${displayPos}</td>
            <td style="font-size: 15px; color: var(--text-main);">${singleHtml}</td>
            <td style="font-size: 15px; color: var(--text-main);">${avgHtml}</td>
            <td style="font-family: SFMono-Regular, Consolas, monospace; font-size: 15px; color: var(--text-main);">${finalDetails}</td>
        `;
        tbody.appendChild(tr);
    });

    window.scrollTo(0, currentScrollY);
}


function setPersonLayout(value){uiSettings.personLayout=value;saveTimerData();if(accountDashboardPlayer)renderAccountDashboard();}
function renderAccountClassic(section,records,history,cuber){
 const root=adRoot(),oldHero=root.querySelector('.ad-hero');
 const header=adNode('div','page-header ad-classic-header'),back=adButton('返回首页',()=>goHome()),identity=adNode('div');
 identity.append(adNode('h2','',formatName(cuber.person.name)),adNode('div','ad-classic-id',`（${cuber.person.wca_id}）`));
 const meta=adNode('div','ad-classic-meta');for(const text of [cuber.person.gender==='m'?'👦 男':cuber.person.gender==='f'?'👧 女':'🧑 其他',`🌍 ${getCountryName(cuber.person.country_iso2)}`,`🏅 参赛 ${cuber.competition_count||cuber.competition_ids?.length||0} 次`])meta.append(adNode('span','meta-tag',text));identity.append(meta);
 const links=adNode('div','ad-classic-links');for(const [name,url,cls] of [['WCA 主页',`https://www.worldcubeassociation.org/persons/${cuber.person.wca_id}`,''],['粗饼主页',`https://cubing.com/results/person/${cuber.person.wca_id}`,'btn-cubing']]){const link=adNode('a','btn btn-outline '+cls,'🔗 '+name);link.href=url;link.target='_blank';link.rel='noopener noreferrer';links.append(link);}identity.append(links);const actions=adNode('div','ad-classic-actions');actions.append(adButton('返回首页',()=>goHome()));if(!publicProfileView)actions.append(adButton('退出登录',()=>accountSignOut()));header.append(identity,actions);oldHero.replaceWith(header);
 section.className='card ad-classic-records';section.replaceChildren();
 const scroll=adNode('div','table-responsive'),table=adNode('table'),head=adNode('thead'),tr=adNode('tr');for(const [label,width] of [['项目','12%'],['类型','10%'],['成绩','16%'],['地区排名（NR）','12%'],['洲际排名（CR）','12%'],['世界排名（WR）','12%'],['比赛与日期','26%']]){const th=adNode('th','',label);th.style.width=width;tr.append(th);}head.append(tr);table.append(head);const tbody=adNode('tbody');table.append(tbody);scroll.append(table);section.append(scroll);
 const personHistory=history,iso2=cuber.person.country_iso2,crPrefix=getContinentRankPrefix(iso2);
 const bestCompetition=(eventId,type,record)=>{const match=personHistory?.[eventId]?.find(r=>Number(r[type])===Number(record?.best)&&record.best>0),name=record?.comp_name||match?.comp;return name?{name,date:record?.comp_date||match?.date||''}:null;};
    eventDict.forEach(ev => {
        if (records[ev.id]) {
            const single = records[ev.id].single;
            const average = records[ev.id].average;
            if (single || average) {
                let isFirstRow = true;
                if (single) {
                    let singleTime = formatWcaResult(single.best, ev.id, 'single');
                    const singleCompetition = bestCompetition(ev.id, 'single', single);
                    let eventHtml = isFirstRow ? `<div style="display:flex; justify-content:center; align-items:center; gap:5px;"><span class="cubing-icon event-${ev.id}" style="color:var(--text-main); font-size:16px; margin-top:-2px;"></span><span>${ev.name}</span></div>` : '';
                    let trSingle = document.createElement('tr');
                    trSingle.innerHTML = `
                        <td>${eventHtml}</td>
                        <td><span class="type-badge">单次</span></td>
                        <td class="highlight-score">${singleTime}</td>
                        <td>${formatRank(single.country_rank, 'NR')}</td>
                        <td>${formatRank(single.continent_rank, crPrefix)}</td>
                        <td>${formatRank(single.world_rank, 'WR')}</td>
                        <td>
                            <div style="font-size: 13px; font-weight: bold; color: var(--text-main); white-space: nowrap;">${singleCompetition ? getChineseCompetitionName(singleCompetition.name) : '-'}</div>
                            <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px; white-space: nowrap;">${singleCompetition?.date || '-'}</div>
                        </td>
                    `;
                    tbody.appendChild(trSingle);
                    isFirstRow = false;
                }
                if (average) {
                    let avgTime = formatWcaResult(average.best, ev.id, 'average');
                    const averageCompetition = bestCompetition(ev.id, 'average', average);
                    let eventHtml = isFirstRow ? `<div style="display:flex; justify-content:center; align-items:center; gap:5px;"><span class="cubing-icon event-${ev.id}" style="color:var(--text-main); font-size:16px; margin-top:-2px;"></span><span>${ev.name}</span></div>` : '';
                    let trAvg = document.createElement('tr');
                    trAvg.innerHTML = `
                        <td>${eventHtml}</td>
                        <td><span class="type-badge">平均</span></td>
                        <td class="highlight-score">${avgTime}</td>
                        <td>${formatRank(average.country_rank, 'NR')}</td>
                        <td>${formatRank(average.continent_rank, crPrefix)}</td>
                        <td>${formatRank(average.world_rank, 'WR')}</td>
                        <td>
                            <div style="font-size: 13px; font-weight: bold; color: var(--text-main); white-space: nowrap;">${averageCompetition ? getChineseCompetitionName(averageCompetition.name) : '-'}</div>
                            <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px; white-space: nowrap;">${averageCompetition?.date || '-'}</div>
                        </td>
                    `;
                    tbody.appendChild(trAvg);
                    isFirstRow = false;
                }
            }
        }
    });

}
function renderAccountDense(section,records,history,player){
 section.className='card ad-dense-records';section.replaceChildren();
 const scroll=adNode('div','table-responsive'),table=adNode('table','ad-dense-table'),head=adNode('thead'),tr=adNode('tr');
 for(const label of ['项目','单次','NR',getContinentRankPrefix(player.person.country_iso2),'WR','比赛与日期','平均','NR',getContinentRankPrefix(player.person.country_iso2),'WR','比赛与日期'])tr.append(adNode('th','',label));head.append(tr);table.append(head);
 const body=adNode('tbody');for(const ev of eventDict){if(!records[ev.id])continue;const row=adNode('tr'),label=adNode('td');const event=adNode('div','ad-classic-event');event.append(adIcon(ev.id),adNode('span','',ev.name));label.append(event);row.append(label);
 for(const type of ['single','average']){const r=records[ev.id][type];row.append(adNode('td','ad-dense-score',r?formatWcaResult(r.best,ev.id,type):'—'));for(const v of [r?.country_rank,r?.continent_rank,r?.world_rank])row.append(adNode('td','ad-dense-rank '+(v>0&&v<=100?'ad-top100':''),String(v||'—')));const match=history?.[ev.id]?.find(h=>h[type]===r?.best),source=adNode('td','ad-dense-source');source.append(adNode('div','',getChineseCompetitionName(r?.comp_name||match?.comp||'—')),adNode('small','',r?.comp_date||match?.date||'—'));row.append(source);}body.append(row);}table.append(body);scroll.append(table);section.append(scroll);
}

function openPersonLayoutModal(){
 const modal=document.getElementById('cube-appearance-modal');modal.classList.remove('timer-settings-context');
 document.getElementById('cube-appearance-title').textContent='个人主页排版';const list=document.getElementById('cube-appearance-options');list.replaceChildren();
 for(const [value,name] of [['classic','经典'],['card','卡片'],['dense','密集']]){const option=adButton(name,()=>{setPersonLayout(value);applyUiSettings();closeCubeAppearanceModal();},'cube-appearance-option'+((uiSettings.personLayout||'dense')===value?' active':''));list.append(option);}modal.hidden=false;
}

async function renderUnifiedPersonPage(player,preserveScroll=false,navigate=true){
 const previousScroll=window.scrollY,sequence=++accountDashboardSequence;
 publicProfileView=true;accountDashboardId='';document.getElementById('account-dashboard')?.replaceChildren();
 const page=document.getElementById('person-page');page.classList.add('unified-person-page');
 accountDashboardPlayer=player;const id=player.person.wca_id;
 accountDashboardHistory=allHistoryData[id]||remotePersonHistory.get(id)||null;
 accountDashboardEvent=navigate?'333':lastPublicProfile?.event||'333';if(!navigate)accountDashboardType=lastPublicProfile?.type||'average';lastPublicProfile={player,event:accountDashboardEvent,type:accountDashboardType};renderAccountDashboard();
 if(navigate)navigateTo('person-page',true);if(preserveScroll)requestAnimationFrame(()=>window.scrollTo(0,previousScroll));
 if(accountDashboardHistory)return;
 try{const historyPromise=rosterIds.includes(id)?ensureHistoryData().then(()=>allHistoryData[id]||{}):fetchRemotePersonHistory(id);const result=await Promise.allSettled([historyPromise,ensureChineseCompetitions()]);if(result[0].status==='rejected')throw result[0].reason;
 remotePersonHistory.set(id,result[0].value);if(sequence===accountDashboardSequence&&publicProfileView){accountDashboardHistory=result[0].value;renderAccountDashboard();}
 }catch(error){if(sequence===accountDashboardSequence&&publicProfileView)adRoot().append(adNode('p','ad-history-status','历史成绩暂时无法读取，请稍后重试。'));}
}

function restorePublicProfile(){
 if(lastPublicProfile&&(!publicProfileView||!document.getElementById('public-profile-dashboard')?.childElementCount))renderUnifiedPersonPage(lastPublicProfile.player,true,false);
}
