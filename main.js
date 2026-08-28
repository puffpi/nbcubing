let allCubersData = [];
let historyStack = [];
let pkHistoryList = [];
let searchHistoryList = [];
let inlinePkState = 0;
let inlinePkPlayerA = null;
let pendingPkPlayerB = null;
let isDataReady = false;

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
    navigateTo('home-page');
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
    document.querySelectorAll('.page-container').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    if (isForward || !isForward) window.scrollTo(0, 0);

    if (isDataReady) {
        if (pageId === 'ranking-page') updateRanking();
        if (pageId === 'records-page') generateRecords();
    }
}

function goBack() {
    if (historyStack.length > 0) {
        const prevState = historyStack.pop();
        document.querySelectorAll('.page-container').forEach(page => page.classList.remove('active'));
        document.getElementById(prevState.id).classList.add('active');
        setTimeout(() => window.scrollTo(0, prevState.scrollY), 10);
    } else {
        navigateTo('home-page');
    }
}

function getPkButtonHtml(wcaId, formattedName) {
    const safeName = formattedName.replace(/'/g, "\\'");
    if (inlinePkState === 0) {
        return `<button class="action-btn btn btn-outline" style="padding: 4px 10px; font-size: 12px; white-space: nowrap;" onclick="startInlinePK('${wcaId}', '${safeName}')">我要 PK</button>`;
    } else {
        if (inlinePkPlayerA.id === wcaId) {
            return `<button class="action-btn btn btn-outline" style="padding: 4px 10px; font-size: 12px; white-space: nowrap; border-color: #e63946; color: #e63946;" onclick="cancelInlinePK()">取消 PK</button>`;
        } else {
            return `<button class="action-btn btn" style="padding: 4px 10px; font-size: 12px; white-space: nowrap; background-color: #e63946;" onclick="selectOpponent('${wcaId}', '${safeName}')">选择该对手</button>`;
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

                if (valA < valB) { scoreA++; classA = 'pk-cell-win'; }
                else if (valB < valA) { scoreB++; classB = 'pk-cell-win'; }
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
        wcaLinkContainer.innerHTML = `<a href="https://www.worldcubeassociation.org/persons/${cuber.person.wca_id}" target="_blank" class="btn btn-outline" style="padding: 6px 16px; font-size: 13px; border-radius: 20px; display: inline-flex; align-items: center; gap: 6px;">🔗 访问 WCA 官方主页</a>`;
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
                        <td><span style="background:#eef2ff; color:#4361ee; padding:4px 8px; border-radius:4px; font-size:12px; white-space:nowrap; display:inline-block;">单次</span></td>
                        <td class="highlight-score">${singleTime}</td>
                        <td>${formatRank(single.country_rank, 'NR')}</td>
                        <td>${formatRank(single.continent_rank, crPrefix)}</td>
                        <td>${formatRank(single.world_rank, 'WR')}</td>
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
                        <td><span style="background:#eef2ff; color:#4361ee; padding:4px 8px; border-radius:4px; font-size:12px; white-space:nowrap; display:inline-block;">平均</span></td>
                        <td class="highlight-score">${avgTime}</td>
                        <td>${formatRank(average.country_rank, 'NR')}</td>
                        <td>${formatRank(average.continent_rank, crPrefix)}</td>
                        <td>${formatRank(average.world_rank, 'WR')}</td>
                    `;
                    tbody.appendChild(trAvg);
                    isFirstRow = false;
                }
            }
        }
    });
    navigateTo('person-page', true);
}

async function showPerson(wcaId) {
    if (inlinePkState !== 0) return;
    let cuber = allCubersData.find(c => c && c.person && c.person.wca_id === wcaId);
    if (!cuber) {
        try {
            document.getElementById('global-loading').style.display = 'flex';
            let res = await fetch(`https://www.worldcubeassociation.org/api/v0/persons/${wcaId}`);
            if (res.ok) cuber = await res.json();
        } catch(e) {}
        document.getElementById('global-loading').style.display = 'none';
    }
    if (cuber) {
        addSearchHistory(cuber);
        renderPersonPage(cuber);
    }
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
    const currentType = document.getElementById('type-select').value;
    const currentGender = document.getElementById('gender-select').value;
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    let validResults = [];
    allCubersData.forEach(cuber => {
        if (!cuber || !cuber.personal_records || !cuber.person) return;
        if (currentGender !== 'all' && cuber.person.gender !== currentGender) return;

        const records = cuber.personal_records;
        if (records[currentEvent] && records[currentEvent][currentType]) {
            validResults.push({
                name: cuber.person.name, wcaId: cuber.person.wca_id, iso2: cuber.person.country_iso2,
                bestRaw: records[currentEvent][currentType].best, nr: records[currentEvent][currentType].country_rank,
                cr: records[currentEvent][currentType].continent_rank, wr: records[currentEvent][currentType].world_rank
            });
        }
    });

    if (validResults.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">暂无符合条件的成绩数据</td></tr>'; return;
    }

    validResults.sort((a, b) => a.bestRaw - b.bestRaw);
    validResults.forEach((result, index) => {
        let displayTime = formatWcaResult(result.bestRaw, currentEvent, currentType);
        let rankDisplay = index + 1;
        if(rankDisplay === 1) rankDisplay = '🥇 1';
        if(rankDisplay === 2) rankDisplay = '🥈 2';
        if(rankDisplay === 3) rankDisplay = '🥉 3';

        let crPrefix = getContinentRankPrefix(result.iso2);
        const formattedName = formatName(result.name);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${rankDisplay}</td>
            <td class="clickable-name" onclick="showPerson('${result.wcaId}')">${formattedName}</td>
            <td class="highlight-score">${displayTime}</td>
            <td>${formatRank(result.nr, 'NR')}</td>
            <td>${formatRank(result.cr, crPrefix)}</td>
            <td>${formatRank(result.wr, 'WR')}</td>
            <td style="width: 80px;">${getPkButtonHtml(result.wcaId, formattedName)}</td>
        `;
        tbody.appendChild(tr);
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
                            cr: records[ev.id][type.id].continent_rank, wr: records[ev.id][type.id].world_rank
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
                    <td><span style="background:#eef2ff; color:#4361ee; padding:4px 8px; border-radius:4px; font-size:12px; white-space:nowrap; display:inline-block;">${type.label}</span></td>
                    <td class="clickable-name record-holder" onclick="showPerson('${bestRecord.wcaId}')">${formattedName}</td>
                    <td class="highlight-score">${displayTime}</td>
                    <td>${formatRank(bestRecord.nr, 'NR')}</td>
                    <td>${formatRank(bestRecord.cr, crPrefix)}</td>
                    <td>${formatRank(bestRecord.wr, 'WR')}</td>
                    <td style="width: 80px;">${getPkButtonHtml(bestRecord.wcaId, formattedName)}</td>
                `;
                tbody.appendChild(tr);
            }
        });
    });

    const nameSun = formatName('孙凯霖（Kailin Sun）');
    const trSorSingle = document.createElement('tr');
    trSorSingle.innerHTML = `
        <td style="color:var(--text-main);">全项目综合排名</td>
        <td><span style="background:#eef2ff; color:#4361ee; padding:4px 8px; border-radius:4px; font-size:12px; white-space:nowrap; display:inline-block;">单次</span></td>
        <td class="clickable-name record-holder" onclick="showPerson('2018SUNK01')">${nameSun}</td>
        <td class="highlight-score">5278</td>
        <td>${formatRank(67, 'NR')}</td>
        <td>${formatRank(267, 'AsR')}</td>
        <td>${formatRank(1531, 'WR')}</td>
        <td style="width: 80px;">${getPkButtonHtml('2018SUNK01', nameSun)}</td>
    `;
    tbody.appendChild(trSorSingle);

    const nameGuo = formatName('郭畅（Chang Guo）');
    const trSorAvg = document.createElement('tr');
    trSorAvg.innerHTML = `
        <td></td>
        <td><span style="background:#eef2ff; color:#4361ee; padding:4px 8px; border-radius:4px; font-size:12px; white-space:nowrap; display:inline-block;">平均</span></td>
        <td class="clickable-name record-holder" onclick="showPerson('2024GUOC01')">${nameGuo}</td>
        <td class="highlight-score">5266</td>
        <td>${formatRank(68, 'NR')}</td>
        <td>${formatRank(295, 'AsR')}</td>
        <td>${formatRank(1524, 'WR')}</td>
        <td style="width: 80px;">${getPkButtonHtml('2024GUOC01', nameGuo)}</td>
    `;
    tbody.appendChild(trSorAvg);
}

// ============================================
// 初始化逻辑：读取 JSON、隐藏加载动画并刷新当前页面
// ============================================
async function initData() {
    const loader = document.getElementById('global-loading');
    
    try {
        const res = await fetch('wca_data.json?t=' + new Date().getTime());
        if (!res.ok) throw new Error("File not found");
        
        allCubersData = await res.json();
        isDataReady = true;

        // 【关键修复】成功拿到数据后，立刻隐藏全屏加载动画
        if (loader) {
            loader.style.display = 'none';
        }

        // 检查当前用户正停留在哪个页面，主动触发渲染
        const activePage = document.querySelector('.page-container.active');
        if (activePage) {
            if (activePage.id === 'ranking-page') updateRanking();
            if (activePage.id === 'records-page') generateRecords();
        }
        
    } catch (err) {
        console.error("数据加载失败", err);
        if (loader) {
            loader.innerHTML = "数据加载失败，请刷新网页重试";
        }
    }
}
