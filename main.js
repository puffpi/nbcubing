let allCubersData = [];
let historyStack = [];
let pkHistoryList = [];
let searchHistoryList = [];
let inlinePkState = 0;
let inlinePkPlayerA = null;
let pendingPkPlayerB = null;
let isDataReady = false;
let allHistoryData = {};
let currentPersonHistory = null;
let progressChartInstance = null;
let currentChartEventId = '333'; // 默认优先三阶
let currentChartType = 'average'; // 记录当前选中的是平均还是单次
let currentRankingType = 'single';
let currentRankingGender = 'all';

const countryDict = {
    'CN': '中国', 'HK': '中国香港', 'MO': '中国澳门', 'TW': '中国台湾',
    'AU': '澳大利亚', 'US': '美国', 'CA': '加拿大', 'JP': '日本', 'KR': '韩国',
    'GB': '英国', 'DE': '德国', 'FR': '法国', 'IT': '意大利', 'ES': '西班牙',
    'PL': '波兰', 'NL': '荷兰', 'SE': '瑞典', 'NO': '挪威', 'FI': '芬兰',
    'DK': '丹麦', 'RU': '俄罗斯', 'UA': '乌克兰', 'CH': '瑞士', 'IN': '印度',
    'ID': '印度尼西亚', 'PH': '菲律宾', 'MY': '马来西亚', 'SG': '新加坡',
    'VN': '越南', 'TH': '泰国', 'KZ': '哈萨克斯坦', 'UZ': '乌兹别克斯坦',
    'BR': '巴西', 'AR': '阿根廷', 'CL': '智利', 'CO': '哥伦比亚', 'PE': '秘鲁',
    'NZ': '新西兰', 'ZA': '南非', 'EG': '埃及', 'MA': '摩洛哥', 'NG': '尼日利亚',
    'MX': '墨西哥', 'IE': '爱尔兰', 'AT': '奥地利', 'BE': '比利时', 'CZ': '捷克',
    'HU': '匈牙利', 'PT': '葡萄牙', 'GR': '希腊', 'TR': '土耳其', 'IL': '以色列',
    'MN': '蒙古'
};

function getCountryName(iso2) {
    if (!iso2) return '未知地区';
    return countryDict[iso2.toUpperCase()] || iso2;
}

function debounce(func, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    }
}

async function fetchAutocomplete(query) {
    let results = [];
    allCubersData.forEach(c => {
        if (c && c.person) {
            if (c.person.name.toLowerCase().includes(query.toLowerCase()) ||
                c.person.wca_id.toUpperCase().includes(query.toUpperCase())) {
                results.push({ name: c.person.name, wca_id: c.person.wca_id });
            }
        }
    });

    if (query.length >= 2 || /[\u4e00-\u9fa5]/.test(query)) {
        try {
            let res = await fetch(`https://www.worldcubeassociation.org/api/v0/persons?q=${encodeURIComponent(query)}`);
            if (res.ok) {
                let data = await res.json();
                let items = Array.isArray(data) ? data : (data.persons || data.items || data.results || []);
                items.forEach(item => {
                    let p = item.person ? item.person : item;
                    if (p && p.wca_id && !results.find(r => r.wca_id === p.wca_id)) {
                        results.push({ name: p.name, wca_id: p.wca_id });
                    }
                });
            }
        } catch(e) {}
    }
    return results;
}

function setupAutocomplete(inputId, dropdownId) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);

    const handleInput = debounce(async (e) => {
        const val = e.target.value.trim();
        if (!val) {
            dropdown.style.display = 'none';
            return;
        }
        dropdown.innerHTML = '<div class="autocomplete-item" style="justify-content:center; color:var(--text-muted);">正在全球搜索...</div>';
        dropdown.style.display = 'block';

        const results = await fetchAutocomplete(val);
        if (results.length === 0) {
            dropdown.innerHTML = '<div class="autocomplete-item" style="justify-content:center; color:var(--text-muted);">未找到匹配的选手</div>';
            return;
        }

        dropdown.innerHTML = '';
        results.forEach(r => {
            let div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.innerHTML = `<span style="font-weight: 600;">${formatName(r.name)}</span> <span style="color:var(--text-muted); font-size:14px; font-weight:500;">${r.wca_id}</span>`;
            div.onclick = () => {
                input.value = `${formatName(r.name)}（${r.wca_id}）`;
                dropdown.style.display = 'none';
            };
            dropdown.appendChild(div);
        });
    }, 400);

    input.addEventListener('input', handleInput);
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.style.display = 'none';
    });
    input.addEventListener('focus', () => {
        if (dropdown.innerHTML && input.value.trim() && !input.value.includes('（')) dropdown.style.display = 'block';
    });
}

document.addEventListener("DOMContentLoaded", () => {
    setupAutocomplete('pk-input-a', 'autocomplete-a');
    setupAutocomplete('pk-input-b', 'autocomplete-b');
    setupAutocomplete('search-input', 'autocomplete-search');

    // 初始状态下不让首页直接乱显现，先在后台拉取数据
    initData();
});

function formatName(rawName) {
    if (!rawName) return '';
    const match = rawName.match(/^(.*?)\s*[（\(](.*?)[）\)]$/);
    if (match) return `${match[2]}（${match[1]}）`;
    return rawName;
}

function navigateTo(pageId, isForward = false) {
    const currentPage = document.querySelector('.page-container.active');
    if (isForward && currentPage) {
        historyStack.push({ id: currentPage.id, scrollY: window.scrollY });
    } else if (!isForward) {
        historyStack = [];
    }

    showPage(pageId);

    if (isForward || !isForward) window.scrollTo(0, 0);

    if (isDataReady) {
        if (pageId === 'ranking-page') updateRanking();
        if (pageId === 'records-page') generateRecords();
    }
}

function goBack() {
    // 返回上一页时，如果正处于“选择 PK 对手”状态，先彻底清除 PK 状态
    if (inlinePkState !== 0) {
        inlinePkState = 0;
        inlinePkPlayerA = null;
        pendingPkPlayerB = null;

        document.body.classList.remove('pk-mode');

        const floatingBar = document.getElementById('pk-floating-bar');
        if (floatingBar) floatingBar.style.display = 'none';

        const confirmModal = document.getElementById('pk-confirm-modal');
        if (confirmModal) confirmModal.style.display = 'none';
    }

    if (historyStack.length > 0) {
        const prevState = historyStack.pop();
        showPage(prevState.id);
        setTimeout(() => window.scrollTo(0, prevState.scrollY), 10);
    } else {
        navigateTo('home-page');
    }
}

function showPage(pageId) {
    const page = document.getElementById(pageId);
    document.querySelectorAll('.page-container').forEach(p => {
        p.classList.remove('active');
    });
    void page.offsetWidth;
    page.classList.add('active');

    const floatingNav = document.getElementById('floating-nav');
    if (floatingNav) {
        // 在主页和挑战页面均隐藏悬浮导航
        floatingNav.style.display = (pageId === 'home-page' || pageId === 'challenge-page') ? 'none' : 'block';
    }
}

function getPkButtonHtml(wcaId, formattedName) {
    const safeName = formattedName.replace(/'/g, "\\'");

    if (inlinePkState === 0) {
        return `<button class="action-btn btn btn-outline pk-action-btn pk-start-btn"
            onclick="startInlinePK('${wcaId}', '${safeName}')">我要 PK</button>`;
    } else {
        if (inlinePkPlayerA.id === wcaId) {
            return `<button class="action-btn btn btn-outline pk-action-btn pk-cancel-btn"
                onclick="cancelInlinePK()">取消 PK</button>`;
        } else {
            return `<button class="action-btn btn pk-action-btn pk-opponent-btn"
                onclick="selectOpponent('${wcaId}', '${safeName}')">选择该对手</button>`;
        }
    }
}

function startInlinePK(wcaId, name) {
    inlinePkState = 1;
    inlinePkPlayerA = { id: wcaId, name: name };
    document.body.classList.add('pk-mode');
    document.getElementById('pk-float-name').innerText = name;
    document.getElementById('pk-floating-bar').style.display = 'flex';
    if (document.getElementById('ranking-page').classList.contains('active')) updateRanking();
    if (document.getElementById('records-page').classList.contains('active')) generateRecords();
}

function cancelInlinePK() {
    inlinePkState = 0;
    inlinePkPlayerA = null;
    document.body.classList.remove('pk-mode');
    document.getElementById('pk-floating-bar').style.display = 'none';
    if (document.getElementById('ranking-page').classList.contains('active')) updateRanking();
    if (document.getElementById('records-page').classList.contains('active')) generateRecords();
}

function selectOpponent(wcaId, name) {
    pendingPkPlayerB = { id: wcaId, name: name };
    document.getElementById('pk-confirm-a').innerText = inlinePkPlayerA.name;
    document.getElementById('pk-confirm-b').innerText = name;
    document.getElementById('pk-confirm-modal').style.display = 'flex';
}

function abortInlinePK() {
    pendingPkPlayerB = null;
    document.getElementById('pk-confirm-modal').style.display = 'none';
}

async function executeInlinePK() {
    document.getElementById('pk-confirm-modal').style.display = 'none';
    let pA_id = inlinePkPlayerA.id;
    let pB_id = pendingPkPlayerB.id;
    cancelInlinePK();

    document.getElementById('global-loading').style.display = 'flex';
    const players = await Promise.all([resolvePlayerAsync(pA_id, '选手A'), resolvePlayerAsync(pB_id, '选手B')]);
    document.getElementById('global-loading').style.display = 'none';

    if(players[0] && players[1]) {
        addPkHistory(players[0], players[1]);
        navigateTo('pk-result-page', true);
        renderPK(players[0], players[1]);
    }
}

function addPkHistory(pA, pB) {
    const existsIndex = pkHistoryList.findIndex(e =>
        (e.a.person.wca_id === pA.person.wca_id && e.b.person.wca_id === pB.person.wca_id) ||
        (e.a.person.wca_id === pB.person.wca_id && e.b.person.wca_id === pA.person.wca_id)
    );
    if (existsIndex > -1) pkHistoryList.splice(existsIndex, 1);
    pkHistoryList.unshift({a: pA, b: pB});
}

function renderPkHistory() {
    const container = document.getElementById('pk-history-container');
    const list = document.getElementById('pk-history-list');
    if (pkHistoryList.length === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';
    list.innerHTML = '';
    pkHistoryList.forEach(entry => {
        let btn = document.createElement('button');
        btn.className = 'history-tag';
        btn.innerHTML = `${formatName(entry.a.person.name)} <span class="history-vs">VS</span> ${formatName(entry.b.person.name)}`;
        btn.onclick = () => {
            navigateTo('pk-result-page', true);
            renderPK(entry.a, entry.b);
        };
        list.appendChild(btn);
    });
}

function openPkPage() {
    document.getElementById('pk-input-a').value = '';
    document.getElementById('pk-input-b').value = '';
    renderPkHistory();
    navigateTo('pk-page');
}

async function handlePkClick() {
    const valA = document.getElementById('pk-input-a').value.trim();
    const valB = document.getElementById('pk-input-b').value.trim();
    if (!valA || !valB) return alert('请在两边都输入想要对战的选手姓名或 WCA ID！');

    document.getElementById('global-loading').style.display = 'flex';
    const playerA = await resolvePlayerAsync(valA, '左边选手A');
    if (!playerA) { document.getElementById('global-loading').style.display = 'none'; return; }

    const playerB = await resolvePlayerAsync(valB, '右边选手B');
    document.getElementById('global-loading').style.display = 'none';
    if (!playerB) return;

    addPkHistory(playerA, playerB);
    navigateTo('pk-result-page', true);
    renderPK(playerA, playerB);
}

function addSearchHistory(cuber) {
    const existsIndex = searchHistoryList.findIndex(c => c.person.wca_id === cuber.person.wca_id);
    if (existsIndex > -1) searchHistoryList.splice(existsIndex, 1);
    searchHistoryList.unshift(cuber);
    if (searchHistoryList.length > 10) searchHistoryList.pop();
}

function renderSearchHistory() {
    const container = document.getElementById('search-history-container');
    const list = document.getElementById('search-history-list');
    if (searchHistoryList.length === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';
    list.innerHTML = '';
    searchHistoryList.forEach(cuber => {
        let btn = document.createElement('button');
        btn.className = 'history-tag';
        btn.innerHTML = `👤 ${formatName(cuber.person.name)}`;
        btn.onclick = () => {
            renderPersonPage(cuber);
        };
        list.appendChild(btn);
    });
}

function openSearchPage() {
    document.getElementById('search-input').value = '';
    renderSearchHistory();
    navigateTo('search-page');
}

async function performSearch() {
    const val = document.getElementById('search-input').value.trim();
    if (!val) return alert('请输入想要查询的选手姓名或 WCA ID！');

    document.getElementById('global-loading').style.display = 'flex';
    const player = await resolvePlayerAsync(val, '成绩查询');
    document.getElementById('global-loading').style.display = 'none';

    if (player) {
        addSearchHistory(player);
        renderPersonPage(player);
    }
}

// 修复：点击名字跳转个人主页的函数
async function showPerson(wcaId) {
    document.getElementById('global-loading').style.display = 'flex';
    // 利用已有的 resolvePlayerAsync 函数获取数据
    const player = await resolvePlayerAsync(wcaId, '个人主页');
    document.getElementById('global-loading').style.display = 'none';

    if (player) {
        // 可选：将点击查看的选手也加入搜索历史记录
        addSearchHistory(player);
        renderPersonPage(player);
    }
}

async function resolvePlayerAsync(input, sideLabel) {
    const idMatch = input.match(/[（\(]([A-Z0-9]+)[）\)]$/i);
    if (idMatch) {
        input = idMatch[1];
    }

    let exact = allCubersData.find(c => c && c.person && c.person.wca_id.toUpperCase() === input.toUpperCase());
    if (exact) return exact;

    let matches = allCubersData.filter(c => c && c.person &&
        (c.person.name.toLowerCase().includes(input.toLowerCase()) ||
         c.person.wca_id.toUpperCase().includes(input.toUpperCase()))
    );

    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
        document.getElementById('global-loading').style.display = 'none';
        return await showSelectionModal(matches, sideLabel);
    }

    if (/^\d{4}[A-Z]{4}\d{2}$/i.test(input)) {
        try {
            let res = await fetch(`https://www.worldcubeassociation.org/api/v0/persons/${input.toUpperCase()}`);
            if (!res.ok) throw new Error();
            return await res.json();
        } catch(err) {
            alert(`在 WCA 官方数据库中未找到 ID 为 [${input}] 的选手！`);
            return null;
        }
    }

    try {
        let res = await fetch(`https://www.worldcubeassociation.org/api/v0/persons?q=${encodeURIComponent(input)}`);
        if (res.ok) {
            let data = await res.json();
            let items = Array.isArray(data) ? data : (data.persons || data.items || data.results || []);
            if (items && items.length > 0) {
                if (items.length === 1) {
                    let wcaId = items[0].person ? items[0].person.wca_id : items[0].wca_id;
                    let fullRes = await fetch(`https://www.worldcubeassociation.org/api/v0/persons/${wcaId}`);
                    if (fullRes.ok) return await fullRes.json();
                } else {
                    let combinedMatches = [];
                    items.forEach(item => {
                        let p = item.person ? item.person : item;
                        if (p && p.wca_id) combinedMatches.push({ person: p });
                    });
                    if (combinedMatches.length > 0) return await showSelectionModal(combinedMatches, sideLabel);
                }
            }
        }
    } catch(e) {}

    alert(`在库中未找到符合 [${input}] 的选手！\n请检查姓名拼写，或直接输入完整的 WCA ID。`);
    return null;
}

function showSelectionModal(matches, sideLabel) {
    return new Promise((resolve) => {
        document.getElementById('pk-modal-side').innerText = sideLabel;
        const list = document.getElementById('pk-modal-list');
        list.innerHTML = '';
        matches.forEach(m => {
            let btn = document.createElement('button');
            btn.className = 'btn btn-outline';
            btn.style.textAlign = 'left';
            btn.innerText = `${formatName(m.person.name)}（${m.person.wca_id}）`;
            btn.onclick = async () => {
                document.getElementById('pk-modal').style.display = 'none';
                if (!m.personal_records) {
                    document.getElementById('global-loading').style.display = 'flex';
                    let res = await fetch(`https://www.worldcubeassociation.org/api/v0/persons/${m.person.wca_id}`);
                    document.getElementById('global-loading').style.display = 'none';
                    resolve(await res.json());
                } else {
                    resolve(m);
                }
            };
            list.appendChild(btn);
        });
        document.getElementById('pk-modal-cancel').onclick = () => {
            document.getElementById('pk-modal').style.display = 'none'; resolve(null);
        };
        document.getElementById('pk-modal').style.display = 'flex';
    });
}

function renderPK(pA, pB) {
    let nameAHtml = `
        <div class="pk-player-card" onclick="showPerson('${pA.person.wca_id}')">
            <div class="pk-score-name">${formatName(pA.person.name)}</div>
            <div class="pk-score-id">${pA.person.wca_id}</div>
            <div class="pk-score-value" id="pk-board-score-a">0</div>
        </div>
    `;
    let nameBHtml = `
        <div class="pk-player-card" onclick="showPerson('${pB.person.wca_id}')">
            <div class="pk-score-name">${formatName(pB.person.name)}</div>
            <div class="pk-score-id">${pB.person.wca_id}</div>
            <div class="pk-score-value" id="pk-board-score-b">0</div>
        </div>
    `;

    const boardA = document.querySelector('#pk-result-card .pk-score-item:first-child');
    const boardB = document.querySelector('#pk-result-card .pk-score-item:last-child');
    boardA.innerHTML = nameAHtml;
    boardB.innerHTML = nameBHtml;

    document.getElementById('pk-table-name-a').innerHTML = `${formatName(pA.person.name)}<br><span style="font-size:13px; font-weight:normal; color:var(--text-muted);">${pA.person.wca_id}</span>`;
    document.getElementById('pk-table-name-b').innerHTML = `${formatName(pB.person.name)}<br><span style="font-size:13px; font-weight:normal; color:var(--text-muted);">${pB.person.wca_id}</span>`;

    let scoreA = 0; let scoreB = 0;
    const tbody = document.getElementById('pk-tbody');
    tbody.innerHTML = '';
    const types = [{id: 'single', label: '单次'}, {id: 'average', label: '平均'}];

    eventDict.forEach(ev => {
        types.forEach(type => {
            let recA = pA.personal_records[ev.id] ? pA.personal_records[ev.id][type.id] : null;
            let recB = pB.personal_records[ev.id] ? pB.personal_records[ev.id][type.id] : null;
            if (recA || recB) {
                let valA = recA ? recA.best : Infinity;
                let valB = recB ? recB.best : Infinity;
                let timeA = valA !== Infinity ? formatWcaResult(valA, ev.id, type.id) : '-';
                let timeB = valB !== Infinity ? formatWcaResult(valB, ev.id, type.id) : '-';
                let classA = ''; let classB = '';

                if (valA < valB) { scoreA++; classA = 'pk-cell-win'; classB = 'pk-cell-lose'; }
                else if (valB < valA) { scoreB++; classB = 'pk-cell-win'; classA = 'pk-cell-lose'; }
                else if (valA === valB && valA !== Infinity) { classA = 'pk-cell-tie'; classB = 'pk-cell-tie'; }

                let tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="${classA}">${timeA}</td>
                    <td>
                        <div style="font-weight:bold; color:var(--text-main); font-size:1.05em; display:flex; justify-content:center; align-items:center; gap:5px;">
                            <span class="cubing-icon event-${ev.id}" style="color:var(--text-main); font-size:16px; margin-top:-2px;"></span>
                            <span>${ev.name}</span>
                        </div>
                        <div style="font-size:0.85em; color:var(--text-muted); margin-top:2px;">${type.label}</div>
                    </td>
                    <td class="${classB}">${timeB}</td>
                `;
                tbody.appendChild(tr);
            }
        });
    });

    const scoreElA = document.getElementById('pk-board-score-a');
    const scoreElB = document.getElementById('pk-board-score-b');
    scoreElA.innerText = scoreA; scoreElB.innerText = scoreB;
    scoreElA.className = 'pk-score-value'; scoreElB.className = 'pk-score-value';

    if (scoreA > scoreB) { scoreElA.classList.add('win'); scoreElB.classList.add('lose'); }
    else if (scoreB > scoreA) { scoreElA.classList.add('lose'); scoreElB.classList.add('win'); }
    else { scoreElA.classList.add('tie'); scoreElB.classList.add('tie'); }
}

function renderPersonPage(cuber) {
    document.getElementById('person-title-name').innerText = formatName(cuber.person.name);
    document.getElementById('person-title-wcaid').innerText = `（${cuber.person.wca_id}）`;

    const wcaLinkContainer = document.getElementById('person-wca-link');
    if (wcaLinkContainer) {
        wcaLinkContainer.innerHTML = `
            <a href="https://www.worldcubeassociation.org/persons/${cuber.person.wca_id}" target="_blank" class="btn btn-outline" style="padding: 6px 14px; font-size: 13px; border-radius: 20px; display: inline-flex; align-items: center; gap: 6px;">🔗 WCA 官方</a>
            <a href="https://cubing.com/results/person/${cuber.person.wca_id}" target="_blank" class="btn btn-outline" style="padding: 6px 14px; font-size: 13px; border-radius: 20px; display: inline-flex; align-items: center; gap: 6px; border-color: #f59e0b; color: #f59e0b; margin-left: 8px;">📊 粗饼主页</a>
        `;
    }

    const metaContainer = document.getElementById('person-title-meta');
    metaContainer.innerHTML = '';

    let genderStr = cuber.person.gender === 'm' ? '👦 男' : (cuber.person.gender === 'f' ? '👧 女' : '🧑 其他');
    let countryChinese = getCountryName(cuber.person.country_iso2);
    let countryStr = `🌍 ${countryChinese}`;
    let compCount = cuber.competition_count || (cuber.competition_ids ? cuber.competition_ids.length : 0);
    let compStr = `🏅 参赛 ${compCount} 次`;

    metaContainer.innerHTML = `
        <span class="meta-tag">${genderStr}</span>
        <span class="meta-tag">${countryStr}</span>
        <span class="meta-tag">${compStr}</span>
    `;

    const tbody = document.getElementById('person-tbody');
    tbody.innerHTML = '';
    const records = cuber.personal_records || {};
    const iso2 = cuber.person.country_iso2;
    const crPrefix = getContinentRankPrefix(iso2);

    eventDict.forEach(ev => {
        if (records[ev.id]) {
            const single = records[ev.id].single;
            const average = records[ev.id].average;
            if (single || average) {
                let isFirstRow = true;
                if (single) {
                    let singleTime = formatWcaResult(single.best, ev.id, 'single');
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
                            <div style="font-size: 13px; font-weight: bold; color: var(--text-main); white-space: nowrap;">${single.comp_name || '-'}</div>
                            <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px; white-space: nowrap;">${single.comp_date || '-'}</div>
                        </td>
                    `;
                    tbody.appendChild(trSingle);
                    isFirstRow = false;
                }
                if (average) {
                    let avgTime = formatWcaResult(average.best, ev.id, 'average');
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
                            <div style="font-size: 13px; font-weight: bold; color: var(--text-main); white-space: nowrap;">${average.comp_name || '-'}</div>
                            <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px; white-space: nowrap;">${average.comp_date || '-'}</div>
                        </td>
                    `;
                    tbody.appendChild(trAvg);
                    isFirstRow = false;
                }
            }
        }
    });

    // ============================================
    // 计算并渲染高阶健康指数
    // ============================================
    const bigCubeCard = document.getElementById('big-cube-index-card');
    const bigCubeTbody = document.getElementById('big-cube-tbody');
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

    // 注入并渲染历史曲线图与表格
    currentPersonHistory = allHistoryData[cuber.person.wca_id] || null;
    const chartCard = document.getElementById('history-chart-card');
    const eventTabs = document.getElementById('history-event-tabs');

    if (currentPersonHistory && Object.keys(currentPersonHistory).length > 0) {
        chartCard.style.display = 'block';
        eventTabs.innerHTML = '';

        // 每次进入个人主页时，强制将项目重置为三阶 (333)
        currentChartEventId = '333';

        let isFirst = true;
        eventTabs.innerHTML = '';

        // 按照 eventDict 中的官方顺序对选手参加过的项目进行排序（被取消的项目会自动排在最后）
        let availableEvents = Object.keys(currentPersonHistory);
        availableEvents.sort((a, b) => {
            let idxA = eventDict.findIndex(e => e.id === a);
            let idxB = eventDict.findIndex(e => e.id === b);
            return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999);
        });

        // let isFirst = true;
        availableEvents.forEach(evId => {
            let isSelected = (currentChartEventId === evId) || (isFirst && !currentPersonHistory[currentChartEventId]);
            if (isSelected) {
                currentChartEventId = evId;
                isFirst = false;
            }

            let tab = document.createElement('div');
            tab.className = `history-event-tab ${isSelected ? 'active' : ''}`;
            tab.innerHTML = `<span class="cubing-icon event-${evId}" style="font-size: 26px;"></span>`;

            tab.onclick = () => {
                currentChartEventId = evId;
                document.querySelectorAll('.history-event-tab').forEach(el => el.classList.remove('active'));
                tab.classList.add('active');
                updateChartAndTable();
            };
            eventTabs.appendChild(tab);
        });
        updateChartAndTable();
    } else {
        chartCard.style.display = 'none';
    }

    navigateTo('person-page', true);
}

function updateChartAndTable() {
    if (!currentPersonHistory) return;
    const type = currentChartType;
    const eventId = currentChartEventId;
    let results = currentPersonHistory[eventId];
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
            plotData.push({ x: r.date, compName: r.comp, y: val, displayTime: formatWcaResult(val, eventId, type), isPr: isPr });
        }
    });

    if (plotData.length > 0) {
        let chartValues = plotData.map(p => eventId === '333fm' && type === 'single' ? p.y : p.y / 100);
        let labels = plotData.map(p => p.x);

        let pointColors = plotData.map(p => p.isPr ? '#f59e0b' : '#9ca3af');
        let pointBorderColors = plotData.map(p => p.isPr ? '#ffffff' : '#ffffff');
        let pointRadii = plotData.map(p => p.isPr ? 5 : 3);
        let pointBorderWidths = plotData.map(p => p.isPr ? 2 : 1);

        const ctx = document.getElementById('progressChart').getContext('2d');

        if (progressChartInstance) {
            progressChartInstance.data.labels = labels;
            progressChartInstance.data.datasets[0].data = chartValues;
            progressChartInstance.data.datasets[0].pointBackgroundColor = pointColors;
            progressChartInstance.data.datasets[0].pointBorderColor = pointBorderColors;
            progressChartInstance.data.datasets[0].pointRadius = pointRadii;
            progressChartInstance.data.datasets[0].pointBorderWidth = pointBorderWidths;

            if (progressChartInstance.options.animations && progressChartInstance.options.animations.y) {
                delete progressChartInstance.options.animations.y;
            }

            progressChartInstance._plotData = plotData;
            progressChartInstance.update();
        } else {
            progressChartInstance = new Chart(ctx, {
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
            progressChartInstance._plotData = plotData;
        }
    } else {
        if (progressChartInstance) { progressChartInstance.destroy(); progressChartInstance = null; }
    }

    const tbody = document.getElementById('history-detail-tbody');
    tbody.innerHTML = '';
    const reversedResults = [...results].reverse();

    const prStyle = 'color: #f59e0b; font-weight: bold;';
    const roundMap = { '1': '初赛', '2': '复赛', '3': '半决赛', 'f': '决赛', 'c': '联合初/复赛', 'd': '第一轮', 'e': '第二轮', 'b': 'B组决赛', 'h': '资格赛' };

    let lastComp = '';
    reversedResults.forEach(r => {
        let displayComp = '';
        if (r.comp !== lastComp) {
            displayComp = `<div style="font-size: 14px; font-weight: bold; color: var(--text-main); line-height: 1.4;">${r.comp}</div>
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

function getContinentRankPrefix(iso2) {
    if (!iso2) return 'CR';
    const asianCountries = ['CN', 'JP', 'KR', 'TW', 'HK', 'MO', 'IN', 'ID', 'PH', 'MY', 'SG', 'VN', 'TH', 'KZ', 'UZ'];
    const europeanCountries = ['GB', 'FR', 'DE', 'IT', 'ES', 'PL', 'NL', 'SE', 'NO', 'FI', 'DK', 'RU', 'UA', 'CH'];
    const northAmericanCountries = ['US', 'CA', 'MX'];
    const southAmericanCountries = ['BR', 'AR', 'CL', 'CO', 'PE'];
    const oceaniaCountries = ['AU', 'NZ'];
    const africanCountries = ['ZA', 'EG', 'MA', 'NG'];
    if (asianCountries.includes(iso2)) return 'AsR';
    if (europeanCountries.includes(iso2)) return 'ER';
    if (northAmericanCountries.includes(iso2)) return 'NAR';
    if (southAmericanCountries.includes(iso2)) return 'SAR';
    if (oceaniaCountries.includes(iso2)) return 'OcR';
    if (africanCountries.includes(iso2)) return 'AfR';
    return 'CR';
}

function formatRank(rankValue, prefix) {
    if (!rankValue) return '-';
    if (rankValue == 1 || rankValue === '1') {
        if (prefix === 'NR') return `<span class="badge-nr">NR</span>`;
        if (prefix === 'WR') return `<span class="badge-wr">WR</span>`;
        return `<span class="badge-cr">${prefix}</span>`;
    }
    const displayStr = `${prefix} ${rankValue}`;
    if (rankValue <= 100) return `<span class="rank-top100">${displayStr}</span>`;
    return displayStr;
}

function formatWcaResult(rawScore, eventId, type) {
    if (eventId === '333fm') {
        if (type === 'single') return rawScore + ' 步';
        if (type === 'average') return (rawScore / 100).toFixed(2) + ' 步';
    }
    if (eventId === '333mbf') {
        const missed = rawScore % 100;
        const timeSeconds = Math.floor((rawScore % 10000000) / 100);
        const difference = 99 - Math.floor(rawScore / 10000000);
        const solved = difference + missed;
        const attempted = solved + missed;
        const hours = Math.floor(timeSeconds / 3600);
        const mins = Math.floor((timeSeconds % 3600) / 60);
        const secs = timeSeconds % 60;
        const padMins = mins.toString().padStart(2, '0');
        const padSecs = secs.toString().padStart(2, '0');
        let timeStr = hours > 0 ? `${hours}:${padMins}:${padSecs}` : `${mins}:${padSecs}`;
        return `${solved}/${attempted} &nbsp;&nbsp;（${timeStr}）`;
    }
    const totalSeconds = Math.floor(rawScore / 100);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const cents = rawScore % 100;
    const padSecs = secs.toString().padStart(2, '0');
    const padCents = cents.toString().padStart(2, '0');

    if (mins > 0) return `${mins}:${padSecs}.${padCents}`;
    return `${totalSeconds}.${padCents}`;
}

function updateRanking() {
    if (!isDataReady) return;

    const currentEvent = document.getElementById('event-select').value;
    const currentType = currentRankingType;
    const currentGender = currentRankingGender;
    const tbody = document.getElementById('table-body');

    // 强制重置上一轮动画
    tbody.classList.remove('ranking-transition-in', 'ranking-transition-out');
    void tbody.offsetWidth;

    // 开始旧内容淡出
    tbody.classList.add('ranking-transition-out');

    tbody.innerHTML = '';

    let validResults = [];

    allCubersData.forEach(cuber => {
        if (!cuber || !cuber.personal_records || !cuber.person) return;
        if (currentGender !== 'all' && cuber.person.gender !== currentGender) return;

        const records = cuber.personal_records;

        if (records[currentEvent] && records[currentEvent][currentType]) {
            validResults.push({
                name: cuber.person.name,
                wcaId: cuber.person.wca_id,
                iso2: cuber.person.country_iso2,
                bestRaw: records[currentEvent][currentType].best,
                nr: records[currentEvent][currentType].country_rank,
                cr: records[currentEvent][currentType].continent_rank,
                wr: records[currentEvent][currentType].world_rank,
                compName: records[currentEvent][currentType].comp_name || '-',
                compDate: records[currentEvent][currentType].comp_date || '-'
            });
        }
    });

    if (validResults.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">暂无符合条件的成绩数据</td></tr>';

        // 新内容淡入
        requestAnimationFrame(() => {
            tbody.classList.remove('ranking-transition-out');
            tbody.classList.add('ranking-transition-in');

            setTimeout(() => {
                tbody.classList.remove('ranking-transition-in');
            }, 400);
        });

        return;
    }

    validResults.sort((a, b) => a.bestRaw - b.bestRaw);

    validResults.forEach((result, index) => {
        let displayTime = formatWcaResult(
            result.bestRaw,
            currentEvent,
            currentType
        );

        let rankDisplay = index + 1;

        if (rankDisplay === 1) rankDisplay = '🥇 1';
        if (rankDisplay === 2) rankDisplay = '🥈 2';
        if (rankDisplay === 3) rankDisplay = '🥉 3';

        let crPrefix = getContinentRankPrefix(result.iso2);
        const formattedName = formatName(result.name);

        const tr = document.createElement('tr');

        // 给每一行设置一个非常小的错峰延迟
        tr.style.setProperty(
            '--row-delay',
            `${Math.min(index * 0.012, 0.15)}s`
        );

        tr.innerHTML = `
            <td>${rankDisplay}</td>

            <td class="clickable-name-cell">
                <span class="clickable-name"
                      onclick="showPerson('${result.wcaId}')">
                    ${formattedName}
                </span>
            </td>

            <td class="highlight-score">${displayTime}</td>

            <td>${formatRank(result.nr, 'NR')}</td>

            <td>${formatRank(result.cr, crPrefix)}</td>

            <td>${formatRank(result.wr, 'WR')}</td>

            <td>
                <div style="font-size: 13px; font-weight: bold; color: var(--text-main); white-space: nowrap;">
                    ${result.compName}
                </div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px; white-space: nowrap;">
                    ${result.compDate}
                </div>
            </td>

            <td style="width: 80px;">
                ${getPkButtonHtml(result.wcaId, formattedName)}
            </td>
        `;

        tbody.appendChild(tr);
    });

    // 下一帧开始显示新表格
    requestAnimationFrame(() => {
        tbody.classList.remove('ranking-transition-out');
        tbody.classList.add('ranking-transition-in');

        // 强制重新计算，让新内容的动画每次都从头开始
        void tbody.offsetWidth;

        tbody.classList.remove('ranking-transition-out');
        tbody.classList.add('ranking-transition-in');
    });
}

function generateRecords() {
    if (!isDataReady) return;
    const tbody = document.getElementById('records-tbody');
    tbody.innerHTML = '';
    const types = [{id: 'single', label: '单次'}, {id: 'average', label: '平均'}];

    eventDict.forEach(ev => {
        types.forEach(type => {
            let bestRecord = null;
            allCubersData.forEach(cuber => {
                if (!cuber || !cuber.personal_records) return;
                const records = cuber.personal_records;
                if (records[ev.id] && records[ev.id][type.id]) {
                    const score = records[ev.id][type.id].best;
                    if (!bestRecord || score < bestRecord.rawScore) {
                        bestRecord = {
                            name: cuber.person.name, wcaId: cuber.person.wca_id, iso2: cuber.person.country_iso2,
                            rawScore: score, nr: records[ev.id][type.id].country_rank,
                            cr: records[ev.id][type.id].continent_rank, wr: records[ev.id][type.id].world_rank,
                            compName: records[ev.id][type.id].comp_name || '-',
                            compDate: records[ev.id][type.id].comp_date || '-'
                        };
                    }
                }
            });

            if (bestRecord) {
                let displayTime = formatWcaResult(bestRecord.rawScore, ev.id, type.id);
                let crPrefix = getContinentRankPrefix(bestRecord.iso2);
                let displayEventName = (type.id === 'single') ? `<div style="display:flex; justify-content:center; align-items:center; gap:5px;"><span class="cubing-icon event-${ev.id}" style="color:var(--text-main); font-size:16px; margin-top:-2px;"></span><span>${ev.name}</span></div>` : '';
                const formattedName = formatName(bestRecord.name);

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${displayEventName}</td>
                    <td><span class="type-badge">${type.label}</span></td>
                    <td class="clickable-name-cell">
                        <span class="clickable-name" onclick="showPerson('${bestRecord.wcaId}')">${formattedName}</span>
                    </td>
                    <td class="highlight-score">${displayTime}</td>
                    <td>${formatRank(bestRecord.nr, 'NR')}</td>
                    <td>${formatRank(bestRecord.cr, crPrefix)}</td>
                    <td>${formatRank(bestRecord.wr, 'WR')}</td>
                    <td>
                        <div style="font-size: 13px; font-weight: bold; color: var(--text-main); white-space: nowrap;">${bestRecord.compName}</div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px; white-space: nowrap;">${bestRecord.compDate}</div>
                    </td>
                `;
                tbody.appendChild(tr);
            }
        });
    });

    const nameSun = formatName('孙凯霖（Kailin Sun）');
    const trSorSingle = document.createElement('tr');
    trSorSingle.innerHTML = `
        <td style="color:var(--text-main);">全项目综合排名</td>
        <td><span class="type-badge">单次</span></td>
        <td class="clickable-name-cell">
            <span class="clickable-name" onclick="showPerson('2018SUNK01')">${nameSun}</span>
        </td>
        <td class="highlight-score">5278</td>
        <td>${formatRank(67, 'NR')}</td>
        <td>${formatRank(267, 'AsR')}</td>
        <td>${formatRank(1531, 'WR')}</td>
        <td>
            <div style="font-size: 13px; font-weight: bold; color: var(--text-main); white-space: nowrap;">Vietnam Championship 2023</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px; white-space: nowrap;">2023-07-16</div>
        </td>
    `;
    tbody.appendChild(trSorSingle);

    const nameGuo = formatName('郭畅（Chang Guo）');
    const trSorAvg = document.createElement('tr');
    trSorAvg.innerHTML = `
        <td></td>
        <td><span class="type-badge">平均</span></td>
        <td class="clickable-name-cell">
            <span class="clickable-name" onclick="showPerson('2024GUOC01')">${nameGuo}</span>
        </td>
        <td class="highlight-score">5266</td>
        <td>${formatRank(68, 'NR')}</td>
        <td>${formatRank(295, 'AsR')}</td>
        <td>${formatRank(1524, 'WR')}</td>
        <td>
            <div style="font-size: 13px; font-weight: bold; color: var(--text-main); white-space: nowrap;">Hefei August Open 2026</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px; white-space: nowrap;">2026-08-15</div>
        </td>
    `;
    tbody.appendChild(trSorAvg);
}

async function initData() {
    const loader = document.getElementById('global-loading');
    const homePage = document.getElementById('home-page');

    try {
        const [resWca, resHist] = await Promise.all([
            fetch('wca_data.json?t=' + new Date().getTime()),
            fetch('history_data.json?t=' + new Date().getTime())
        ]);
        allCubersData = await resWca.json();
        allHistoryData = await resHist.json();
        isDataReady = true;

        if (loader) loader.style.display = 'none';

        // 核心修复：仅在没有任何页面处于激活状态时，才显示首页，避免错乱
        const activePage = document.querySelector('.page-container.active');
        if (!activePage) {
            if (homePage) homePage.classList.add('active');
        } else {
            if (activePage.id === 'ranking-page') updateRanking();
            if (activePage.id === 'records-page') generateRecords();
        }
    } catch (err) {
        if (loader) loader.innerHTML = "数据加载失败，请刷新网页重试";
    }
}

function setChartType(type) {
    currentChartType = type;

    document.querySelectorAll('#btn-type-average, #btn-type-single')
        .forEach(btn => btn.classList.remove('active'));

    document.getElementById(`btn-type-${type}`).classList.add('active');

    updateChartAndTable();
}

function setRankingType(type) {
    currentRankingType = type;

    document.querySelectorAll('[id^="ranking-type-"]')
        .forEach(btn => btn.classList.remove('active'));

    document.getElementById(`ranking-type-${type}`).classList.add('active');

    updateRanking();
}

function setRankingGender(gender) {
    currentRankingGender = gender;

    document.querySelectorAll('[id^="ranking-gender-"]')
        .forEach(btn => btn.classList.remove('active'));

    document.getElementById(`ranking-gender-${gender}`).classList.add('active');

    updateRanking();
}

function getRankingColumnPositions() {
    const table = document.getElementById('ranking-table');
    if (!table) return null;

    const tableLeft = table.getBoundingClientRect().left;
    return Array.from(table.querySelectorAll('thead th')).map(th => {
        return th.getBoundingClientRect().left - tableLeft;
    });
}

function animateRankingColumns(oldPositions) {
    const table = document.getElementById('ranking-table');
    if (!table || !oldPositions) return;

    requestAnimationFrame(() => {
        const tableLeft = table.getBoundingClientRect().left;
        const newHeaders = Array.from(table.querySelectorAll('thead th'));

        const newPositions = newHeaders.map(th => {
            return th.getBoundingClientRect().left - tableLeft;
        });

        const shifts = newPositions.map((newX, index) => {
            if (oldPositions[index] === undefined) return 0;
            return oldPositions[index] - newX;
        });

        const cells = table.querySelectorAll('th, td');

        cells.forEach(cell => {
            const index = Array.from(cell.parentElement.children).indexOf(cell);
            const shift = shifts[index] || 0;

            cell.style.transition = 'none';
            cell.style.setProperty('--column-shift-x', `${shift}px`);
        });

        // 强制浏览器应用初始位置
        void table.offsetWidth;

        requestAnimationFrame(() => {
            cells.forEach(cell => {
                cell.style.transition =
                    'transform 0.32s cubic-bezier(0.25, 0.8, 0.25, 1)';
                cell.style.setProperty('--column-shift-x', '0px');
            });
        });

        setTimeout(() => {
            cells.forEach(cell => {
                cell.style.transition = '';
                cell.style.removeProperty('--column-shift-x');
            });
        }, 360);
    });
}

// =========================================
// 全局智能悬浮导航拖拽逻辑
// =========================================
// =========================================
// 全局智能悬浮导航拖拽逻辑 (仅左右半圆版)
// =========================================
function setupDraggableNav() {
    const nav = document.getElementById('floating-nav');
    if (!nav) return;

    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    const onDragStart = (e) => {
        if (e.target.closest('.nav-item')) return;
        isDragging = true;
        nav.style.transition = 'none';

        // 核心修复：拖拽时全局强制禁止选中文字
        document.body.style.userSelect = 'none';

        const rect = nav.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        nav.style.bottom = 'auto';
        nav.style.right = 'auto';
        nav.style.left = initialLeft + 'px';
        nav.style.top = initialTop + 'px';

        if (e.type === 'touchstart') {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        } else {
            startX = e.clientX;
            startY = e.clientY;
        }
    };

    const onDragMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();

        let clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        let clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

        let newLeft = initialLeft + (clientX - startX);
        let newTop = initialTop + (clientY - startY);

        const maxX = window.innerWidth - nav.offsetWidth;
        const maxY = window.innerHeight - nav.offsetHeight;
        newLeft = Math.max(0, Math.min(newLeft, maxX));
        newTop = Math.max(0, Math.min(newTop, maxY));

        nav.style.left = newLeft + 'px';
        nav.style.top = newTop + 'px';
    };

    const onDragEnd = () => {
        if (isDragging) {
            isDragging = false;
            nav.style.transition = 'all 0.3s ease';

            // 核心修复：拖拽结束后恢复网页文字正常选中状态
            document.body.style.userSelect = '';

            const rect = nav.getBoundingClientRect();
            const centerX = window.innerWidth / 2;

            nav.classList.remove('expand-left', 'expand-right');

            // 极简判断：只区分左右半圆展开
            if (rect.left < centerX) {
                nav.classList.add('expand-right'); // 处在左半屏 -> 向右边展开半圆
            } else {
                nav.classList.add('expand-left');  // 处在右半屏 -> 向左边展开半圆
            }
        }
    };

    nav.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove, { passive: false });
    document.addEventListener('mouseup', onDragEnd);

    nav.addEventListener('touchstart', onDragStart, { passive: false });
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);
}

// 确保 DOM 加载后初始化拖拽功能
document.addEventListener("DOMContentLoaded", () => {
    // 之前已有的其他逻辑...
    setupDraggableNav();
});

// =========================================
// NB Timer 核心逻辑 (多项目支持 + Ao5 + 滚动 PB)
// =========================================
let timerState = 'IDLE';
let timerHoldTimeout = null;
let solveStartTime = 0;
let requestAnimFrameId = null;

// { '333': [ { ms: 1230, time: '12.30', ao5: '13.00', isPb: true } ], ... }
let timerHistoryData = {};
let currentTimerEvent = '333';
let currentSessionBestMs = Infinity;
let currentSessionBestAo5Ms = Infinity; // 新增：记录当前项目的 Ao5 PB

// 新增：移动端计时器底部 Tab 切换逻辑
function switchTimerTab(tabName) {
    if (window.innerWidth > 768) return; // 桌面端不触发 Tab 切换

    // 移除所有激活状态
    document.getElementById('timer-tab-main').classList.remove('active-tab');
    document.getElementById('timer-tab-list').classList.remove('active-tab');
    document.getElementById('btn-tab-main').classList.remove('active');
    document.getElementById('btn-tab-list').classList.remove('active');

    // 激活对应的 Tab 和图标
    document.getElementById(`timer-tab-${tabName}`).classList.add('active-tab');
    document.getElementById(`btn-tab-${tabName}`).classList.add('active');
}

// 替换原有 initTimer：记录项目状态，强制进入计时视图
function initTimer() {
    const select = document.getElementById('timer-event-select');
    if (select.children.length === 0) {
        const excludedEvents = ['magic', 'mmagic', '333ft', 'mbf', '333mbf', '333fm'];
        eventDict.forEach(ev => {
            if (!excludedEvents.includes(ev.id)) {
                let option = document.createElement('option');
                option.value = ev.id;
                option.text = ev.name;
                select.appendChild(option);
            }
        });
        select.value = '333';
        switchTimerEvent();
    } else {
        // 项目已经存在，说明是二次进入。保留原有的 select 选项，只需刷新打乱公式即可
        generateScramble();
    }

    // 每次从主页点进来，不论上次停在哪，都强制切回第一个计时 Tab
    switchTimerTab('main');
}

function switchTimerEvent() {
    const select = document.getElementById('timer-event-select');
    currentTimerEvent = select.value;

    // 核心修复：强制下拉框失去焦点，防止后续按方向键时意外拨动菜单
    select.blur();

    // 更新标题并拼接 "WCA - " 前缀
    const evName = select.options[select.selectedIndex].text;
    document.getElementById('timer-event-title').innerText = "WCA - " + formatName(evName);

    if (!timerHistoryData[currentTimerEvent]) {
        timerHistoryData[currentTimerEvent] = [];
    }

    currentSessionBestMs = Infinity;
    currentSessionBestAo5Ms = Infinity;
    timerHistoryData[currentTimerEvent].forEach(record => {
        if (record.ms < currentSessionBestMs) currentSessionBestMs = record.ms;
        if (record.ao5Ms && record.ao5Ms < currentSessionBestAo5Ms) currentSessionBestAo5Ms = record.ao5Ms;
    });

    renderTimerHistory();
    generateScramble();
}

function formatTimerOutput(ms) {
    let totalSec = Math.floor(ms / 10);
    let sec = Math.floor(totalSec / 100);
    let centi = (totalSec % 100).toString().padStart(2, '0');
    if (sec >= 60) {
        let min = Math.floor(sec / 60);
        let remSec = (sec % 60).toString().padStart(2, '0');
        return `${min}:${remSec}.${centi}`;
    }
    return `${sec}.${centi}`;
}

// 自动计算最近 5 次的 Ao5 (去头去尾取平均)
function calculateAo5(historyList) {
    if (historyList.length < 5) return { str: '-', ms: Infinity };
    let last5 = historyList.slice(0, 5).map(r => r.ms);
    last5.sort((a, b) => a - b);
    let sum = last5[1] + last5[2] + last5[3];
    let avgMs = Math.floor(sum / 3);
    return { str: formatTimerOutput(avgMs), ms: avgMs };
}

function renderTimerHistory() {
    const list = document.getElementById('timer-history-list');
    list.innerHTML = '';

    const records = timerHistoryData[currentTimerEvent];

    records.forEach((r, index) => {
        const div = document.createElement('div');
        div.className = 'timer-history-item';

        let timeClass = r.isPb ? 'timer-pb' : '';
        let ao5Class = r.isAo5Pb ? 'timer-pb' : ''; // 新增：判定 Ao5 是否该高亮
        let displayCount = records.length - index;

        div.innerHTML = `
            <span>${displayCount}</span>
            <span class="${timeClass}">${r.time}</span>
            <span class="${ao5Class}">${r.ao5}</span>
        `;
        list.appendChild(div);
    });

    // 更新左下角数据榜
    if (records.length > 0) {
        document.getElementById('timer-stat-best').innerText = `best: ${formatTimerOutput(currentSessionBestMs)}`;
        document.getElementById('timer-stat-ao5').innerText = `ao5: ${records[0].ao5}`;
    } else {
        document.getElementById('timer-stat-best').innerText = `best: -`;
        document.getElementById('timer-stat-ao5').innerText = `ao5: -`;
    }
}

// ================= 空格键与右键监听控制 =================
document.addEventListener('keydown', (e) => {
    const activePage = document.querySelector('.page-container.active');
    if (!activePage || activePage.id !== 'timer-page') return;

    if (timerState === 'IDLE') {
        // 严格限定：只有向右方向键才能切换打乱，并拦截页面的默认横向滚动
        if (e.code === 'ArrowRight') {
            e.preventDefault();
            generateScramble();
            return;
        }

        // 启动计时的逻辑
        if (e.code === 'Space') {
            e.preventDefault(); // 拦截空格键导致的页面下滚

            // 再次做全局安全排查：如果焦点残留在了任何按钮或输入框上，强制剥离
            if (document.activeElement) document.activeElement.blur();

            if (e.repeat) return;
            timerState = 'WAITING';
            const display = document.getElementById('timer-display');
            display.classList.add('waiting');
            timerHoldTimeout = setTimeout(() => {
                if (timerState === 'WAITING') {
                    timerState = 'READY';
                    display.classList.remove('waiting');
                    display.classList.add('ready');
                }
            }, 350);
        }
    } else if (timerState === 'RUNNING') {
        e.preventDefault(); // 运行状态下拦截任何按键的默认网页行为
        stopTimer();
    }
});

document.addEventListener('keyup', (e) => {
    const activePage = document.querySelector('.page-container.active');
    if (!activePage || activePage.id !== 'timer-page') return;
    if (e.code === 'Space') {
        const display = document.getElementById('timer-display');
        if (timerState === 'WAITING') {
            clearTimeout(timerHoldTimeout);
            timerState = 'IDLE';
            display.classList.remove('waiting');
        } else if (timerState === 'READY') {
            startTimer();
        }
    }
});

function startTimer() {
    timerState = 'RUNNING';
    const display = document.getElementById('timer-display');
    display.classList.remove('ready');
    solveStartTime = performance.now();

    function update() {
        if (timerState !== 'RUNNING') return;
        let elapsed = Math.floor(performance.now() - solveStartTime);
        display.innerText = formatTimerOutput(elapsed);
        requestAnimFrameId = requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

function stopTimer() {
    timerState = 'IDLE';
    cancelAnimationFrame(requestAnimFrameId);

    let elapsed = Math.floor(performance.now() - solveStartTime);
    let finalTimeStr = formatTimerOutput(elapsed);
    document.getElementById('timer-display').innerText = finalTimeStr;

    // 判定单次 PB
    let isPb = false;
    if (elapsed < currentSessionBestMs) {
        isPb = true;
        currentSessionBestMs = elapsed;
    }

    const sessionArr = timerHistoryData[currentTimerEvent];
    let newRecord = { ms: elapsed, time: finalTimeStr, isPb: isPb, ao5: '-', ao5Ms: Infinity, isAo5Pb: false };
    sessionArr.unshift(newRecord);

    // 算出 Ao5 后回填，并同步判定 Ao5 PB
    let ao5Result = calculateAo5(sessionArr);
    newRecord.ao5 = ao5Result.str;
    newRecord.ao5Ms = ao5Result.ms;

    if (newRecord.ao5Ms !== Infinity && newRecord.ao5Ms < currentSessionBestAo5Ms) {
        newRecord.isAo5Pb = true;
        currentSessionBestAo5Ms = newRecord.ao5Ms;
    }

    renderTimerHistory();
    generateScramble();
}

// ================= 全项目随机打乱引擎 =================
function generateScramble() {
    const ev = currentTimerEvent;
    let scramble = "";

    if (ev === '222') {
        scramble = getRandomMoves(["R", "U", "F"], 11);
    } else if (['333', '333oh', '333bf', '333fm', '333mbf', '333ft'].includes(ev)) {
        scramble = getRandomMoves(["R", "L", "U", "D", "F", "B"], 20);
    } else if (['444', '444bf'].includes(ev)) {
        scramble = getRandomMoves(["R", "L", "U", "D", "F", "B", "Rw", "Uw", "Fw"], 45);
    } else if (['555', '555bf', '666', '777'].includes(ev)) {
        scramble = getRandomMoves(["R", "L", "U", "D", "F", "B", "Rw", "Lw", "Uw", "Dw", "Fw", "Bw"], ev === '555' ? 60 : 80);
    } else if (ev === 'pyram') {
        scramble = getRandomMoves(["U", "L", "R", "B"], 11);
        let tips = ["u", "l", "r", "b"];
        tips.forEach(t => { if(Math.random() > 0.5) scramble += " " + t + (Math.random() > 0.5 ? "'" : ""); });
    } else if (ev === 'minx') {
        let res = [];
        for (let i=0; i<7; i++) {
            for (let j=0; j<10; j++) res.push((j%2===0 ? "R" : "D") + (Math.random() > 0.5 ? "++" : "--"));
            res.push("U" + (Math.random() > 0.5 ? "'" : "") + "<br>");
        }
        scramble = res.join(" ");
    } else if (ev === 'skewb') {
        scramble = getRandomMoves(["R", "L", "U", "B"], 11);
    } else if (ev === 'sq1') {
        let res = [];
        for(let i=0; i<12; i++) {
            let top = Math.floor(Math.random()*12)-5;
            let bot = Math.floor(Math.random()*12)-5;
            res.push(`(${top},${bot})`);
        }
        scramble = res.join(" / ");
    } else if (ev === 'clock') {
        let pins = ["UR","DR","DL","UL","U","R","D","L","ALL"];
        let res = [];
        pins.forEach(p => res.push(`${p}${Math.floor(Math.random()*12)-5}+`));
        res.push("y2");
        ["U","R","D","L","ALL"].forEach(p => res.push(`${p}${Math.floor(Math.random()*12)-5}+`));
        scramble = res.join(" ");
    } else {
        scramble = "无打乱规则";
    }

    document.getElementById('scramble-text').innerHTML = scramble;
}

function getRandomMoves(moves, length) {
    const mods = ["", "'", "2"];
    let scramble = [];
    let lastMove = "";
    for(let i = 0; i < length; i++) {
        let m;
        do { m = moves[Math.floor(Math.random() * moves.length)]; } while (m[0] === lastMove[0]);
        lastMove = m;
        scramble.push(m + mods[Math.floor(Math.random() * mods.length)]);
    }
    return scramble.join(" ");
}

// =======================================================
// 手机端：限定区域内的滑动切打乱与长按屏幕计时逻辑
// =======================================================
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', (e) => {
    const activePage = document.querySelector('.page-container.active');
    if (!activePage || activePage.id !== 'timer-page') return;

    // 核心边界限制：仅当手指落在计时器主区域（#timer-main-area）时，才触发计时或滑动
    const isTimerArea = e.target.closest('#timer-tab-main');
    if (!isTimerArea) return;

    touchStartX = e.changedTouches[0].screenX;

    // 运行中触摸屏幕直接停止
    if (timerState === 'RUNNING') {
        if(e.cancelable) e.preventDefault();
        stopTimer();
        return;
    }

    // 空闲时触摸屏幕，进入 0.35 秒长按变色判定
    if (timerState === 'IDLE') {
        timerState = 'WAITING';
        const display = document.getElementById('timer-display');
        display.classList.add('waiting');
        timerHoldTimeout = setTimeout(() => {
            if (timerState === 'WAITING') {
                timerState = 'READY';
                display.classList.remove('waiting');
                display.classList.add('ready');
            }
        }, 350);
    }
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    const activePage = document.querySelector('.page-container.active');
    if (!activePage || activePage.id !== 'timer-page') return;

    // 核心体验保护：长按准备期间（红字/绿字阶段），拦截屏幕滚动，防止画面随手指乱跑
    const isTimerArea = e.target.closest('#timer-tab-main');
    if (isTimerArea && (timerState === 'WAITING' || timerState === 'READY')) {
        if(e.cancelable) e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchend', (e) => {
    const activePage = document.querySelector('.page-container.active');
    if (!activePage || activePage.id !== 'timer-page') return;

    const isTimerArea = e.target.closest('#timer-tab-main');
    if (!isTimerArea) {
        // 如果手指不小心滑动到了下方成绩列表区域再松开，立刻安全重置状态
        if (timerState === 'WAITING' || timerState === 'READY') {
            clearTimeout(timerHoldTimeout);
            timerState = 'IDLE';
            document.getElementById('timer-display').classList.remove('waiting', 'ready');
        }
        return;
    }

    touchEndX = e.changedTouches[0].screenX;

    // 判定滑动切打乱：处于空闲或刚按下一会，且在计时区域内右滑距离大于 50px，执行刷新
    if (timerState === 'WAITING' || timerState === 'IDLE') {
        if (touchEndX - touchStartX > 50) {
            clearTimeout(timerHoldTimeout);
            timerState = 'IDLE';
            document.getElementById('timer-display').classList.remove('waiting', 'ready');
            generateScramble();
            return;
        }
    }

    // 正常长按松开判定
    const display = document.getElementById('timer-display');
    if (timerState === 'WAITING') {
        // 未超过 0.35 秒松开（红字状态），取消启动，恢复灰色
        clearTimeout(timerHoldTimeout);
        timerState = 'IDLE';
        display.classList.remove('waiting');
    } else if (timerState === 'READY') {
        // 绿字状态松手，正式启动高精度计时
        if(e.cancelable) e.preventDefault();
        startTimer();
    }
}, { passive: false });

// =========================================
// 手机端悬浮导航：点击展开与点空白处收回逻辑
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    const nav = document.getElementById('floating-nav');
    const mainBtn = document.getElementById('nav-main-btn');

    if(nav && mainBtn) {
        // 1. 点击主按钮触发展开/收起
        mainBtn.addEventListener('click', (e) => {
            if (window.innerWidth <= 650 || ('ontouchstart' in window)) {
                nav.classList.toggle('touch-expanded');
                e.stopPropagation(); // 阻止事件冒泡，防止立刻触发下方的 document 点击关闭
            }
        });

        // 2. 点击页面其他任意位置，缩回菜单
        document.addEventListener('click', (e) => {
            if (!nav.contains(e.target)) {
                nav.classList.remove('touch-expanded');
            }
        });

        // 3. 点击三个小选项执行功能后，也自动缩回
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                nav.classList.remove('touch-expanded');
            });
        });
    }
});

// =========================================
// NB Challenge 核心逻辑引擎 (完整键鼠+触屏适配版)
// =========================================
let chalScoreTop = 0;
let chalScoreBottom = 0;
let chalState = 'IDLE';
let chalTopPressed = false;
let chalBottomPressed = false;
let chalTopState = 'IDLE';
let chalBottomState = 'IDLE';
let chalHoldTimeout = null;
let chalStartTime = 0;
let chalAnimFrame = null;
let chalTopTime = 0;
let chalBottomTime = 0;

function initChallenge() {
    // 移除了 chalScoreTop = 0 和 chalScoreBottom = 0，从而保留历史比分
    updateChallengeScores();
    resetChallengeTimer();
    generateChallengeScramble();

    const nav = document.getElementById('floating-nav');
    if (nav) nav.style.display = 'none';
}

function exitChallenge() {
    // 如果正在计时中，拦截点击，不允许返回上一页
    if (chalState === 'RUNNING') return;

    goBack();
    // 核心修复：删除了 nav.style.display = 'block';
    // 页面切换后的悬浮窗显隐已经由 showPage() 统一智能接管，不再强制显示
}

function generateChallengeScramble() {
    let scramble = getRandomMoves(["R", "L", "U", "D", "F", "B"], 20);
    document.getElementById('challenge-scramble-top').innerHTML = scramble;
    document.getElementById('challenge-scramble-bottom').innerHTML = scramble;
}

function updateChallengeScores() {
    document.getElementById('challenge-score-top').innerText = chalScoreTop;
    document.getElementById('challenge-score-bottom').innerText = chalScoreBottom;
}

function resetChallengeTimer() {
    chalState = 'IDLE';
    chalTopState = 'IDLE';
    chalBottomState = 'IDLE';
    chalTopPressed = false;
    chalBottomPressed = false;

    const tTop = document.getElementById('challenge-timer-top');
    const tBot = document.getElementById('challenge-timer-bottom');
    tTop.innerText = '0.00';
    tBot.innerText = '0.00';
    tTop.className = 'challenge-timer';
    tBot.className = 'challenge-timer';

    cancelAnimationFrame(chalAnimFrame);
}

function handleChalPress(player) {
    if (chalState === 'DONE') {
        chalState = 'IDLE';
        chalTopState = 'IDLE';
        chalBottomState = 'IDLE';
    }

    if (chalState === 'RUNNING') {
        if (player === 'top' && chalTopState === 'RUNNING') {
            chalTopState = 'STOPPED';
            chalTopTime = performance.now() - chalStartTime;
            document.getElementById('challenge-timer-top').innerText = formatTimerOutput(chalTopTime);
            checkChallengeFinish();
        }
        if (player === 'bottom' && chalBottomState === 'RUNNING') {
            chalBottomState = 'STOPPED';
            chalBottomTime = performance.now() - chalStartTime;
            document.getElementById('challenge-timer-bottom').innerText = formatTimerOutput(chalBottomTime);
            checkChallengeFinish();
        }
        return;
    }

    // 只要有手放上去，立即清零并变红
    if (player === 'top') {
        chalTopPressed = true;
        const topEl = document.getElementById('challenge-timer-top');
        topEl.innerText = '0.00';
        topEl.classList.add('waiting');
        topEl.classList.remove('ready');
    }
    if (player === 'bottom') {
        chalBottomPressed = true;
        const botEl = document.getElementById('challenge-timer-bottom');
        botEl.innerText = '0.00';
        botEl.classList.add('waiting');
        botEl.classList.remove('ready');
    }

    if (chalState === 'IDLE' && chalTopPressed && chalBottomPressed) {
        chalState = 'WAITING';
        chalHoldTimeout = setTimeout(() => {
            if (chalState === 'WAITING' && chalTopPressed && chalBottomPressed) {
                chalState = 'READY';
                document.getElementById('challenge-timer-top').classList.replace('waiting', 'ready');
                document.getElementById('challenge-timer-bottom').classList.replace('waiting', 'ready');
            }
        }, 400);
    }
}

function handleChalRelease(player) {
    if (player === 'top') {
        chalTopPressed = false;
        if (chalState !== 'RUNNING' && chalState !== 'DONE') {
            document.getElementById('challenge-timer-top').classList.remove('waiting', 'ready');
        }
    }
    if (player === 'bottom') {
        chalBottomPressed = false;
        if (chalState !== 'RUNNING' && chalState !== 'DONE') {
            document.getElementById('challenge-timer-bottom').classList.remove('waiting', 'ready');
        }
    }

    if (chalState === 'WAITING') {
        clearTimeout(chalHoldTimeout);
        chalState = 'IDLE';
    } else if (chalState === 'READY') {
        startChallenge();
    }
}

function startChallenge() {
    chalState = 'RUNNING';
    chalTopState = 'RUNNING';
    chalBottomState = 'RUNNING';
    chalStartTime = performance.now();

    document.getElementById('challenge-timer-top').className = 'challenge-timer';
    document.getElementById('challenge-timer-bottom').className = 'challenge-timer';

    function update() {
        if (chalState !== 'RUNNING') return;
        let elapsed = Math.floor(performance.now() - chalStartTime);
        let timeStr = formatTimerOutput(elapsed);

        if (chalTopState === 'RUNNING') document.getElementById('challenge-timer-top').innerText = timeStr;
        if (chalBottomState === 'RUNNING') document.getElementById('challenge-timer-bottom').innerText = timeStr;

        chalAnimFrame = requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

function checkChallengeFinish() {
    if (chalTopState === 'STOPPED' && chalBottomState === 'STOPPED') {
        chalState = 'DONE';
        cancelAnimationFrame(chalAnimFrame);

        if (chalTopTime < chalBottomTime) {
            chalScoreTop++;
        } else if (chalBottomTime < chalTopTime) {
            chalScoreBottom++;
        }
        updateChallengeScores();

        // 双方完成直接刷新打乱，保留成绩不重置
        generateChallengeScramble();
    }
}

/* ================= 触屏与鼠标事件绑定 ================= */
const isChalActive = () => document.querySelector('.page-container.active')?.id === 'challenge-page';

document.addEventListener('touchstart', (e) => {
    // 核心修复：移除了 || chalState === 'DONE'，允许结算后再次触发按下事件
    if (!isChalActive()) return;
    if (e.target.closest('.challenge-divider')) return;
    if (e.cancelable) e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i];
        if (t.target.closest('#challenge-top-area')) handleChalPress('top');
        if (t.target.closest('#challenge-bottom-area')) handleChalPress('bottom');
    }
}, { passive: false });

document.addEventListener('touchend', (e) => {
    if (!isChalActive()) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i];
        if (t.target.closest('#challenge-top-area')) handleChalRelease('top');
        if (t.target.closest('#challenge-bottom-area')) handleChalRelease('bottom');
    }
});

document.addEventListener('mousedown', (e) => {
    // 核心修复：移除了 || chalState === 'DONE'
    if (!isChalActive()) return;
    if (e.target.closest('.challenge-divider')) return;

    if (e.target.closest('#challenge-top-area')) handleChalPress('top');
    if (e.target.closest('#challenge-bottom-area')) handleChalPress('bottom');
});

document.addEventListener('mouseup', (e) => {
    if (!isChalActive()) return;
    if (e.target.closest('#challenge-top-area')) handleChalRelease('top');
    if (e.target.closest('#challenge-bottom-area')) handleChalRelease('bottom');
});

/* ================= 键盘事件绑定 (WASD & 方向键) ================= */
const topKeys = ['w', 'a', 's', 'd'];
const bottomKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

document.addEventListener('keydown', (e) => {
    // 核心修复：移除了 || chalState === 'DONE'
    if (!isChalActive() || e.repeat) return;
    const key = e.key.toLowerCase();

    if (topKeys.includes(key)) { e.preventDefault(); handleChalPress('top'); }
    if (bottomKeys.includes(key)) { e.preventDefault(); handleChalPress('bottom'); }
});

document.addEventListener('keyup', (e) => {
    if (!isChalActive()) return;
    const key = e.key.toLowerCase();

    if (topKeys.includes(key)) { e.preventDefault(); handleChalRelease('top'); }
    if (bottomKeys.includes(key)) { e.preventDefault(); handleChalRelease('bottom'); }
});
