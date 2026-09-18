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
let hasHomeAnimated = false; // 记录首页是否已经完成过初始入场旋转

// ================= 新增：Supabase 数据库配置 =================
const SUPABASE_URL = 'https://aizchgrmejdqwpvpxxui.supabase.co'; // 这是你截图里的 URL
const SUPABASE_KEY = 'sb_publishable_VnqJY_Yz9PyqFhKxBPsasA_cgBb9JfU'; // 记得替换这串文字
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ================= 新增：界面设置全局变量 =================
let uiSettings = {
    homeLayout: 'simple', // 默认简约版
    font: 'default',
    fontSize: 100,
    scrambleSize: 100,
    chalTimerSize: 100,    // <--- 新增：对战计时器大小
    chalScrambleSize: 100, // <--- 新增：对战打乱公式大小
    promptAction: true,
    colorSingle: '#f59e0b',
    colorAvg: '#f59e0b',
    username: '', // 新增用户名储存
    wcaId: '' // 新增 WCA ID 储存

};

const fontOptions = [
    { id: 'default', name: '默认等宽', family: "'SFMono-Regular', Consolas, monospace" },
    { id: 'arial', name: 'Arial (无衬线)', family: "Arial, Helvetica, sans-serif" },
    { id: 'impact', name: 'Impact (厚重)', family: "Impact, sans-serif" },
    { id: 'georgia', name: 'Georgia (衬线)', family: "Georgia, serif" },
    { id: 'comic', name: 'Comic Sans (活泼)', family: "'Comic Sans MS', 'Chalkboard SE', cursive" }
];

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

function setupAutocomplete(inputId, dropdownId, onSelectCallback) {
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

                // 核心修复：如果传了回调函数（比如直达主页的指令），就立刻执行
                if (onSelectCallback) {
                    onSelectCallback(r.wca_id);
                }
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
    setupAutocomplete('search-input', 'autocomplete-search', (wcaId) => {
        showPerson(wcaId);
    });

    const audio = document.getElementById('cs-bgm');
    if(audio) audio.volume = 0.6;

    const nameInput = document.getElementById('monthly-input-name');
    if (nameInput) {
        nameInput.addEventListener('focus', function() {
            if (this.dataset.error === 'true') {
                this.value = '';
                this.style.color = '';
                this.dataset.error = 'false';
            }
        });
    }

    // ================= 全局导航栏下拉菜单逻辑 =================
    // 统一关闭所有全局导航下拉窗；不使用 hide-dropdown 等“伪隐藏”状态。
    window.closeNavDropdowns = function() {
        document.querySelectorAll('.nav-menu-item.has-dropdown').forEach(item => {
            item.classList.remove('dropdown-open');
        });
    };

    const dropdownItems = document.querySelectorAll('.nav-menu-item.has-dropdown');

    dropdownItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // 下拉项目由它自己的点击处理；这里不重复切换父菜单。
            if (e.target.closest('.dropdown-content a')) return;

            e.stopPropagation();
            const shouldOpen = !this.classList.contains('dropdown-open');
            window.closeNavDropdowns();
            if (shouldOpen) this.classList.add('dropdown-open');
        });
    });

    document.querySelectorAll('.dropdown-content a').forEach(link => {
        link.addEventListener('click', function(e) {
            // 先彻底清理状态，再让 HTML 上的 onclick 执行跳转/打开页面。
            window.closeNavDropdowns();
            e.stopPropagation();
        });
    });

    // 点击菜单外部的任意位置关闭下拉窗。
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.nav-menu-item.has-dropdown')) {
            window.closeNavDropdowns();
        }
    });

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

// 统跳主页的路由函数
function goHome() {
    let is3D = uiSettings.homeLayout === '3d';
    navigateTo(is3D ? 'home-page-3d' : 'home-page'); // 商务版其实就是复用原本的 dom 结构，直接跳转 home-page
}

function goBack() {

    // 强制关闭完赛撒花弹窗
    const finishModal = document.getElementById('monthly-finish-modal');
    if (finishModal && finishModal.style.display !== 'none') {
        closeMonthlyFinishAlert();
    }

    // --- 核心拦截：巅峰月赛退出判定 ---
    const activePage = document.querySelector('.page-container.active');
    if (activePage && activePage.id === 'monthly-timer-page') {
        if (!monthlyHasFinished) {
            document.getElementById('monthly-exit-modal').style.display = 'flex';
            return; // 拦截住返回指令
        }
    }

    if (inlinePkState !== 0) {
        inlinePkState = 0; inlinePkPlayerA = null; pendingPkPlayerB = null;
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
        goHome();
    }
}

function showPage(pageId) {
    const page = document.getElementById(pageId);
    document.querySelectorAll('.page-container').forEach(p => {
        p.classList.remove('active');
    });
    void page.offsetWidth;
    page.classList.add('active');
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

// 确保简约版首页的 PK 按钮也能正常唤醒新页面
function openPkPage() {
    openSearchPage();
}

// 全新合并版的历史渲染引擎
function renderCombinedHistory() {
    const container = document.getElementById('combined-history-container');
    const list = document.getElementById('combined-history-list');

    // 如果两条历史记录都为空，则隐藏容器
    if (searchHistoryList.length === 0 && pkHistoryList.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    list.innerHTML = '';

    // 1. 优先渲染单人查询历史
    searchHistoryList.forEach(cuber => {
        let btn = document.createElement('button');
        btn.className = 'history-tag';
        btn.innerHTML = `👤 ${formatName(cuber.person.name)}`;
        btn.onclick = () => { renderPersonPage(cuber); };
        list.appendChild(btn);
    });

    // 2. 紧接着渲染双人 PK 历史
    pkHistoryList.forEach(entry => {
        let btn = document.createElement('button');
        btn.className = 'history-tag';
        btn.innerHTML = `⚔️ ${formatName(entry.a.person.name)} <span class="history-vs">VS</span> ${formatName(entry.b.person.name)}`;
        btn.onclick = () => {
            navigateTo('pk-result-page', true);
            renderPK(entry.a, entry.b);
        };
        list.appendChild(btn);
    });
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

// 统跳合并后的页面
function openSearchPage() {
    document.getElementById('search-input').value = '';
    document.getElementById('pk-input-a').value = '';
    document.getElementById('pk-input-b').value = '';
    renderCombinedHistory();
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
    // 专属姓名处理工具：智能过滤，去繁就简
    function getPkDisplayName(rawName) {
        const match = rawName.match(/^(.*?)\s*[（\(](.*?)[）\)]$/);
        if (match) {
            return match[2]; // 如果有括号，只返回括号里的母语名（中文）
        }
        return rawName; // 如果没括号（如纯外国选手），保留原名
    }

    // 1. 渲染上方卡片
    let nameAHtml = `
        <div class="pk-player-card" onclick="showPerson('${pA.person.wca_id}')">
            <div class="pk-score-name" style="line-height: 1.4; font-size: 18px;">${getPkDisplayName(pA.person.name)}</div>
            <div class="pk-score-id">${pA.person.wca_id}</div>
            <div class="pk-score-value" id="pk-board-score-a">0</div>
        </div>
    `;
    let nameBHtml = `
        <div class="pk-player-card" onclick="showPerson('${pB.person.wca_id}')">
            <div class="pk-score-name" style="line-height: 1.4; font-size: 18px;">${getPkDisplayName(pB.person.name)}</div>
            <div class="pk-score-id">${pB.person.wca_id}</div>
            <div class="pk-score-value" id="pk-board-score-b">0</div>
        </div>
    `;

    const boardA = document.querySelector('#pk-result-card .pk-score-item:first-child');
    const boardB = document.querySelector('#pk-result-card .pk-score-item:last-child');
    boardA.innerHTML = nameAHtml;
    boardB.innerHTML = nameBHtml;

    // 2. 渲染下方表格头部（姓名另起一行写 WCA ID）
    document.getElementById('pk-table-name-a').innerHTML = `${getPkDisplayName(pA.person.name)}<br><span style="font-size:12px; font-weight:normal; color:var(--text-muted); margin-top:4px; display:inline-block;">${pA.person.wca_id}</span>`;
    document.getElementById('pk-table-name-b').innerHTML = `${getPkDisplayName(pB.person.name)}<br><span style="font-size:12px; font-weight:normal; color:var(--text-muted); margin-top:4px; display:inline-block;">${pB.person.wca_id}</span>`;

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

                // 3. 生成表格行数据
                let tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="${classA}" style="font-size: 16px; font-weight: 600;">${timeA}</td>
                    <td>
                        <div style="font-weight:bold; color:var(--text-main); font-size:1.05em; display:flex; justify-content:center; align-items:center; gap:5px;">
                            <span class="cubing-icon event-${ev.id}" style="color:var(--text-main); font-size:16px; margin-top:-2px;"></span>
                            <span>${ev.name}</span>
                        </div>
                        <div style="font-size:0.85em; color:var(--text-muted); margin-top:2px;">${type.label}</div>
                    </td>
                    <td class="${classB}" style="font-size: 16px; font-weight: 600;">${timeB}</td>
                `;
                tbody.appendChild(tr);
            }
        });
    });

    // 4. 结算计分板总分
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
            <a href="https://cubing.com/results/person/${cuber.person.wca_id}" target="_blank" class="btn btn-outline btn-cubing" style="padding: 6px 14px; font-size: 13px; border-radius: 20px; display: inline-flex; align-items: center; gap: 6px; border-color: #f59e0b; color: #f59e0b; margin-left: 8px;">📊 粗饼主页</a>
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

// =========================================
// 宁波纪录核心逻辑 (当前汇总 + 历史更迭史)
// =========================================

// 初始化顶部项目图标
// 初始化顶部项目图标
function initRecordsTabs() {
    const container = document.getElementById('records-event-tabs');
    if (!container) return;
    container.innerHTML = '';

    // 核心修改：剔除了 mbf (旧版多盲)
    const excludedEvents = ['magic', 'mmagic', '333ft', 'mbf'];

    eventDict.forEach(ev => {
        if (!excludedEvents.includes(ev.id)) {
            let tab = document.createElement('div');
            tab.className = `records-event-tab disabled`;
            tab.dataset.ev = ev.id;
            tab.innerHTML = `<span class="cubing-icon event-${ev.id}" style="font-size: 24px;"></span>`;
            tab.onclick = () => {
                if (recordsMode === 'current') return;
                recordsHistoryEvent = ev.id;
                updateRecordsTabsUI();
                generateRecords();
            };
            container.appendChild(tab);
        }
    });
    updateRecordsTabsUI();
}

// 更新图标界面的高亮与置灰状态
function updateRecordsTabsUI() {
    const tabs = document.querySelectorAll('.records-event-tab');
    tabs.forEach(tab => {
        if (recordsMode === 'current') {
            tab.classList.add('disabled');
            tab.classList.remove('active');
        } else {
            tab.classList.remove('disabled');
            if (tab.dataset.ev === recordsHistoryEvent) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        }
    });
}

// 控制主开关 (当前/历史) 与横向推拉动画
function setRecordMode(mode) {
    if (recordsMode === mode) return; // 防止重复点击重复刷新
    recordsMode = mode;
    document.getElementById('btn-record-mode-current').classList.toggle('active', mode === 'current');
    document.getElementById('btn-record-mode-history').classList.toggle('active', mode === 'history');

    const typeCtrl = document.getElementById('records-history-type-ctrl');
    const tableEl = document.getElementById('records-table');

    if (mode === 'history') {
        recordsHistoryEvent = '333'; // 强制跳回三阶
        typeCtrl.classList.remove('hidden');
        tableEl.classList.add('table-historical');
    } else {
        typeCtrl.classList.add('hidden');
        tableEl.classList.remove('table-historical');
    }

    document.querySelectorAll('.record-rank-col').forEach(th => {
        th.style.display = (mode === 'current') ? 'table-cell' : 'none';
    });

    updateRecordsTabsUI();
    generateRecords();
}

// 控制副开关 (单次/平均)
function setRecordHistoryType(type) {
    if (recordsHistoryType === type) return;
    recordsHistoryType = type;
    document.getElementById('btn-record-type-single').classList.toggle('active', type === 'single');
    document.getElementById('btn-record-type-average').classList.toggle('active', type === 'average');
    generateRecords();
}

// 入口分发函数 (核心修复：移除累赘延迟，1:1 完美复刻排行榜的极速动画)
function generateRecords() {
    if (!isDataReady) return;
    const tbody = document.getElementById('records-tbody');

    // 强制重置上一轮动画
    tbody.classList.remove('ranking-transition-in', 'ranking-transition-out');
    void tbody.offsetWidth;

    // 开始旧内容淡出
    tbody.classList.add('ranking-transition-out');

    // 瞬间清空数据并注入新内容
    tbody.innerHTML = '';

    if (recordsMode === 'current') {
        generateCurrentRecords(tbody);
    } else {
        generateHistoricalRecords(tbody);
    }

    // 新内容淡入
    requestAnimationFrame(() => {
        tbody.classList.remove('ranking-transition-out');
        tbody.classList.add('ranking-transition-in');

        // 保持和 updateRanking 完全一致的收尾逻辑
        setTimeout(() => {
            tbody.classList.remove('ranking-transition-in');
        }, 400);
    });
}

// 渲染传统页面 (谁持有了当前最佳)
function generateCurrentRecords(tbody) {
    const types = [{id: 'single', label: '单次'}, {id: 'average', label: '平均'}];
    const excludedEvents = ['magic', 'mmagic', '333ft', 'mbf'];

    // 1. 遍历生成 WCA 官方正常项目
    eventDict.forEach(ev => {
        if (excludedEvents.includes(ev.id)) return;

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

    // 2. 👇 核心追加：全项目综合排名专属彩蛋 (补充了比赛名称与时间，去除了“全项”二字) 👇
    const customTrSingle = document.createElement('tr');
    customTrSingle.innerHTML = `
        <td>
            <div style="display:flex; justify-content:center; align-items:center; gap:5px;">
                <span>全项目综合排名</span>
            </div>
        </td>
        <td><span class="type-badge">单次</span></td>
        <td class="clickable-name-cell">
            <span class="clickable-name" style="cursor:default;">孙凯霖（Kailin Sun）</span>
        </td>
        <td class="highlight-score">5278</td>
        <td><span class="rank-top100">NR 67</span></td>
        <td>AsR 267</td>
        <td>WR 1531</td>
        <td>
            <div style="font-size: 13px; font-weight: bold; color: var(--text-main); white-space: nowrap;">Vietnam Championship 2023</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px; white-space: nowrap;">2023-07-16</div>
        </td>
    `;
    tbody.appendChild(customTrSingle);

    const customTrAvg = document.createElement('tr');
    customTrAvg.innerHTML = `
        <td></td>
        <td><span class="type-badge">平均</span></td>
        <td class="clickable-name-cell">
            <span class="clickable-name" style="cursor:default;">郭畅（Chang Guo）</span>
        </td>
        <td class="highlight-score">5266</td>
        <td><span class="rank-top100">NR 68</span></td>
        <td>AsR 295</td>
        <td>WR 1524</td>
        <td>
            <div style="font-size: 13px; font-weight: bold; color: var(--text-main); white-space: nowrap;">Hefei August Open 2026</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px; white-space: nowrap;">2026-08-15</div>
        </td>
    `;
    tbody.appendChild(customTrAvg);
}

// 渲染时间轴破纪录历史
function generateHistoricalRecords(tbody) {
    let allAttempts = [];
    const evId = recordsHistoryEvent;
    const type = recordsHistoryType;

    for (let wcaId in allHistoryData) {
        let userHistory = allHistoryData[wcaId][evId];
        if (!userHistory) continue;

        let cuber = allCubersData.find(c => c && c.person && c.person.wca_id === wcaId);
        if (!cuber) continue;

        let name = cuber.person.name;
        let iso2 = cuber.person.country_iso2;

        userHistory.forEach(attempt => {
            let score = attempt[type];
            if (score && score > 0) {
                allAttempts.push({
                    wcaId: wcaId, name: name, iso2: iso2, score: score,
                    date: attempt.date, comp: attempt.comp
                });
            }
        });
    }

    allAttempts.sort((a, b) => {
        let dA = new Date(a.date).getTime();
        let dB = new Date(b.date).getTime();
        if (dA !== dB) return dA - dB;
        return a.score - b.score;
    });

    let progression = [];
    let currentBest = Infinity;

    allAttempts.forEach(attempt => {
        if (attempt.score < currentBest) {
            currentBest = attempt.score;
            progression.push(attempt);
        }
    });

    if (progression.length === 0) {
        // 核心修复：空数据时动态使用 colspan="5"，彻底解决列名缩成一团的 Bug
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 50px 0; color: var(--text-muted); font-size: 15px;">该项目暂无历史纪录数据</td></tr>';
        return;
    }

    // 已经倒序排列：最新的纪录在顶部，越古老的在底部
    progression.reverse();

    let evObj = eventDict.find(e => e.id === evId);
    let evName = evObj ? evObj.name : evId;
    let typeLabel = type === 'single' ? '单次' : '平均';

    progression.forEach((record, index) => {
        let displayTime = formatWcaResult(record.score, evId, type);
        let formattedName = formatName(record.name);

        let isCurrentRecord = index === 0;

        const tr = document.createElement('tr');
        if (isCurrentRecord) {
            tr.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';
        }

        tr.style.setProperty('--row-delay', `${Math.min(index * 0.02, 0.2)}s`);

        let displayEventName = (index === 0) ? `<div style="display:flex; justify-content:center; align-items:center; gap:5px;"><span class="cubing-icon event-${evId}" style="color:var(--text-main); font-size:16px; margin-top:-2px;"></span><span>${evName}</span></div>` : '';

        tr.innerHTML = `
            <td>${displayEventName}</td>
            <td><span class="type-badge">${typeLabel}</span></td>
            <td class="clickable-name-cell">
                <span class="clickable-name" onclick="showPerson('${record.wcaId}')">${formattedName}</span>
            </td>
            <td class="highlight-score" style="${isCurrentRecord ? 'color: #10b981;' : ''}">${displayTime}</td>
            <td>
                <div style="font-size: 13px; font-weight: bold; color: var(--text-main); white-space: nowrap;">${record.comp}</div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px; white-space: nowrap;">${record.date}</div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 👇 新增：历史纪录专属全局控制变量 👇
let recordsMode = 'current'; // 当前模式
let recordsHistoryType = 'single'; // 单次/平均
let recordsHistoryEvent = '333'; // 默认三阶

async function initData() {
    // 核心修复：必须在决定路由前，优先读取本地排版设置
    loadTimerData();

    const loader = document.getElementById('global-loading');
    try {
        const [resWca, resHist] = await Promise.all([
            fetch('wca_data.json?t=' + new Date().getTime()),
            fetch('history_data.json?t=' + new Date().getTime())
        ]);
        allCubersData = await resWca.json();
        allHistoryData = await resHist.json();
        isDataReady = true;
        if (loader) loader.style.display = 'none';

        // 👇 核心新增：初始化纪录页面的项目图标 👇
        initRecordsTabs();

        const activePage = document.querySelector('.page-container.active');
        if (!activePage) {
            // 核心修改：仅在首次打开网页时进入主页，并触发一次动画
            let is3D = uiSettings.homeLayout === '3d';
            navigateTo(is3D ? 'home-page-3d' : 'home-page');
            if (is3D) {
                setTimeout(() => triggerCubeSpin('right', true), 50);
            }
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
// NB Timer 核心逻辑 (完整重构引擎：支持惩罚、Mo/Ao及动态修改)
// =========================================
let timerState = 'IDLE';
let timerHoldTimeout = null;
let solveStartTime = 0;
let requestAnimFrameId = null;

let timerHistoryData = {};
let currentTimerEvent = '333';
let currentSessionBestMs = Infinity;

let stat1 = { type: 'ao', count: 5 };
let stat2 = { type: 'ao', count: 12 };
let currentSessionBestStat1Ms = Infinity;
let currentSessionBestStat2Ms = Infinity;

let editScoreIndex = -1;
let currentEditPenalty = '';

function getNowFormatted() {
    const d = new Date();
    const pad = n => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function toggleTimerMoreMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('timer-more-dropdown');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

document.addEventListener('click', (e) => {
    const menu = document.getElementById('timer-more-dropdown');
    if (menu && menu.style.display === 'block' && !e.target.closest('.sidebar-header-row')) {
        menu.style.display = 'none';
    }
});

// 清空成绩
function openTimerClearModal() {
    document.getElementById('timer-more-dropdown').style.display = 'none';
    document.getElementById('timer-clear-modal').style.display = 'flex';
}
function closeTimerClearModal() {
    document.getElementById('timer-clear-modal').style.display = 'none';
}
function confirmTimerClear() {
    timerHistoryData[currentTimerEvent] = [];
    recalculateSessionStats();
    saveTimerData();
    closeTimerClearModal();
}

// ================= 导入导出引擎 =================
function openTimerExportModal() {
    document.getElementById('timer-more-dropdown').style.display = 'none';
    const records = timerHistoryData[currentTimerEvent] || [];
    if (records.length === 0) return alert('当前项目没有任何成绩可导出！');
    document.getElementById('timer-export-modal').style.display = 'flex';
}
function closeTimerExportModal() { document.getElementById('timer-export-modal').style.display = 'none'; }

function confirmTimerExport() {
    const dataStr = JSON.stringify(timerHistoryData[currentTimerEvent]);
    navigator.clipboard.writeText(dataStr).then(() => {
        const btn = document.querySelector('#timer-export-modal .edit-btn-confirm');
        btn.innerText = '复制成功';
        setTimeout(() => {
            btn.innerText = '确定导出';
            closeTimerExportModal();
        }, 1200);
    });
}

function openTimerImportModal() {
    document.getElementById('timer-more-dropdown').style.display = 'none';
    document.getElementById('timer-import-textarea').value = '';
    document.getElementById('timer-import-modal').style.display = 'flex';
}
function closeTimerImportModal() { document.getElementById('timer-import-modal').style.display = 'none'; }

function confirmTimerImport() {
    const str = document.getElementById('timer-import-textarea').value.trim();
    if (!str) return alert('输入内容不能为空！');
    try {
        const parsed = JSON.parse(str);
        if (!Array.isArray(parsed)) throw new Error('格式不合法');

        // 追加合并成绩，并剔除无效数据
        const currentData = timerHistoryData[currentTimerEvent] || [];
        const validParsed = parsed.filter(r => r.hasOwnProperty('rawMs') && typeof r.rawMs === 'number');
        timerHistoryData[currentTimerEvent] = [...currentData, ...validParsed];

        recalculateSessionStats();
        saveTimerData();
        closeTimerImportModal();
        alert('成绩导入成功！');
    } catch (e) {
        alert('解析失败，请检查粘贴的数据格式是否正确！');
    }
}

// ================= 智能成绩分布引擎 (带动态区间防溢出) =================
function openTimerDistModal() {
    document.getElementById('timer-more-dropdown').style.display = 'none';

    const records = timerHistoryData[currentTimerEvent] || [];
    // 过滤掉 DNF 和无效数据
    const validMs = records.map(r => {
        if (r.penalty === 'DNF') return Infinity;
        return r.penalty === '+2' ? r.rawMs + 2000 : r.rawMs;
    }).filter(ms => ms !== Infinity && !isNaN(ms) && ms > 0);

    const container = document.getElementById('timer-dist-chart');
    if (validMs.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">暂无有效成绩数据</div>';
        document.getElementById('timer-dist-modal').style.display = 'flex';
        return;
    }

    const maxMs = Math.max(...validMs);
    const minMs = Math.min(...validMs);
    const range = maxMs - minMs;

    // 👇 核心修复：动态计算合理的步长，强制保证区间数量最多在 12~14 个左右 👇
    const niceSteps = [100, 200, 500, 1000, 2000, 5000, 10000, 15000, 20000, 30000, 60000];
    let stepMs = 60000; // 默认最大跨度
    for (let step of niceSteps) {
        if (range / step <= 12) { // 找到第一个能让分段数控制在12段以内的完美步长
            stepMs = step;
            break;
        }
    }
    // 如果所有的成绩都一模一样（range === 0），给一个默认兜底区间
    if (range === 0) stepMs = 500;

    // 强制锁定最快和最慢所在的绝对区间
    let startBin = Math.floor(minMs / stepMs) * stepMs;
    let endBin = Math.floor(maxMs / stepMs) * stepMs;

    let bins = {};
    let maxCount = 0;

    // 强制补齐从最快到最慢中间的所有区间，维持连续性
    for (let b = startBin; b <= endBin; b += stepMs) {
        bins[b] = 0;
    }

    validMs.forEach(ms => {
        let binStart = Math.floor(ms / stepMs) * stepMs;
        if (bins[binStart] !== undefined) {
            bins[binStart]++;
            if (bins[binStart] > maxCount) maxCount = bins[binStart];
        }
    });

    const sortedBinKeys = Object.keys(bins).map(Number).sort((a, b) => a - b);
    container.innerHTML = '';

    // 👇 刻度字符智能格式化：自动隐藏多余小数点，超长则按分:秒格式化 👇
    const getTickStr = (val) => {
        if (val >= 60000) {
            let m = Math.floor(val / 60000);
            let s = (val % 60000) / 1000;
            let sStr = s % 1 === 0 ? s.toString().padStart(2, '0') : s.toFixed(1).padStart(4, '0');
            return `${m}:${sStr}`;
        }
        let sec = val / 1000;
        return sec % 1 === 0 ? sec.toString() : sec.toFixed(1);
    };

    sortedBinKeys.forEach((start, index) => {
        let count = bins[start];
        let end = start + stepMs;
        let percentage = maxCount === 0 ? 0 : (count / maxCount) * 100;

        let startStr = getTickStr(start);
        let endStr = getTickStr(end);

        let endLabelHtml = '';
        // 只有最后一个柱子，才在底部画一个封底的下刻度
        if (index === sortedBinKeys.length - 1) {
            endLabelHtml = `<div class="dist-y-tick-bottom">${endStr}</div>`;
        }

        container.innerHTML += `
            <div class="dist-row">
                <div class="dist-y-tick-top">${startStr}</div>
                ${endLabelHtml}
                <div class="dist-bar-track">
                    <div class="dist-bar-fill" style="width: 0%; ${count === 0 ? 'background: transparent;' : ''}" data-width="${percentage}%">
                        ${count > 0 ? `<span class="dist-bar-label">${count}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    document.getElementById('timer-dist-modal').style.display = 'flex';

    // 触发横向生长动画
    setTimeout(() => {
        container.querySelectorAll('.dist-bar-fill').forEach(bar => {
            bar.style.width = bar.getAttribute('data-width');
        });
    }, 50);
}

function closeTimerDistModal() {
    document.getElementById('timer-dist-modal').style.display = 'none';
}


// ================= 折线图走势引擎 =================
let timerTrendChartInstance = null;

function openTimerTrendModal() {
    document.getElementById('timer-more-dropdown').style.display = 'none';
    const records = timerHistoryData[currentTimerEvent] || [];
    const ctx = document.getElementById('timer-trend-canvas').getContext('2d');

    if (records.length === 0) {
        alert('暂无成绩数据可生成图表');
        return;
    }

    // 数据反转，从老到新
    const chronoRecords = [...records].reverse();

    const labels = chronoRecords.map((_, i) => `#${i + 1}`);
    const singleData = chronoRecords.map(r => r.effectiveMs !== Infinity ? Number((r.effectiveMs / 1000).toFixed(2)) : null);
    const stat1Data = chronoRecords.map(r => r.stat1Ms !== Infinity ? Number((r.stat1Ms / 1000).toFixed(2)) : null);
    const stat2Data = chronoRecords.map(r => r.stat2Ms !== Infinity ? Number((r.stat2Ms / 1000).toFixed(2)) : null);

    if (timerTrendChartInstance) {
        timerTrendChartInstance.destroy();
    }

    timerTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '单次',
                    data: singleData,
                    borderColor: '#f59e0b', // 琥珀橙
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    pointRadius: 2,
                    spanGaps: true // 跨越 DNF
                },
                {
                    label: `${stat1.type}${stat1.count}`,
                    data: stat1Data,
                    borderColor: '#3b82f6', // 经典蓝
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0, // 隐藏端点使曲线更干净
                    spanGaps: true
                },
                {
                    label: `${stat2.type}${stat2.count}`,
                    data: stat2Data,
                    borderColor: '#10b981', // 翡翠绿
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0,
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { font: { size: 13, family: 'sans-serif' } } },
                tooltip: { backgroundColor: 'rgba(51, 65, 85, 0.95)' }
            },
            scales: {
                y: { title: { display: true, text: '时间 (秒)', font: { size: 12 } } },
                x: { ticks: { autoSkip: true, maxTicksLimit: 10 } }
            }
        }
    });

    document.getElementById('timer-trend-modal').style.display = 'flex';
}
function closeTimerTrendModal() {
    document.getElementById('timer-trend-modal').style.display = 'none';
}

function switchSidebarTab(tab) {
    document.querySelectorAll('.sidebar-view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.desktop-sidebar-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`sidebar-view-${tab}`).classList.add('active');
    document.getElementById(`btn-sidebar-${tab}`).classList.add('active');
}

function setStatType(statNum, type) {
    if (statNum === 1) stat1.type = type;
    if (statNum === 2) stat2.type = type;
    document.getElementById(`btn-stat${statNum}-ao`).classList.remove('active');
    document.getElementById(`btn-stat${statNum}-mo`).classList.remove('active');
    document.getElementById(`btn-stat${statNum}-${type}`).classList.add('active');
    recalculateSessionStats();
    saveTimerData(); // 核心新增
}

function setStatCount(statNum, count) {
    let val = parseInt(count);
    if (isNaN(val) || val < 1) val = 1;
    if (statNum === 1) stat1.count = val;
    if (statNum === 2) stat2.count = val;
    recalculateSessionStats();
    saveTimerData(); // 核心新增
}

function calculateStat(slice, type, count) {
    if (slice.length < count) return { str: '-', ms: Infinity };
    let vals = slice.map(r => r.effectiveMs);

    if (type === 'mo') {
        if (vals.includes(Infinity)) return { str: 'DNF', ms: Infinity };
        let sum = vals.reduce((a,b) => a+b, 0);
        let avgMs = Math.floor(sum / count);
        return { str: formatTimerOutput(avgMs), ms: avgMs };
    } else {
        if (count < 3) {
            if (vals.includes(Infinity)) return { str: 'DNF', ms: Infinity };
            let sum = vals.reduce((a,b) => a+b, 0);
            let avgMs = Math.floor(sum / count);
            return { str: formatTimerOutput(avgMs), ms: avgMs };
        }
        vals.sort((a, b) => a - b);
        let sum = 0;
        let hasDNF = false;
        for (let i = 1; i < count - 1; i++) {
            if (vals[i] === Infinity) hasDNF = true;
            sum += vals[i];
        }
        if (hasDNF) return { str: 'DNF', ms: Infinity };
        let avgMs = Math.floor(sum / (count - 2));
        return { str: formatTimerOutput(avgMs), ms: avgMs };
    }
}

function recalculateSessionStats() {
    const sessionArr = timerHistoryData[currentTimerEvent] || [];
    currentSessionBestMs = Infinity;
    currentSessionBestStat1Ms = Infinity;
    currentSessionBestStat2Ms = Infinity;

    for (let i = 0; i < sessionArr.length; i++) {
        let r = sessionArr[i];
        if (r.penalty === '+2') {
            r.effectiveMs = r.rawMs + 2000;
            r.displayTime = formatTimerOutput(r.effectiveMs) + '+';
        } else if (r.penalty === 'DNF') {
            r.effectiveMs = Infinity;
            r.displayTime = 'DNF';
        } else {
            r.effectiveMs = r.rawMs;
            r.displayTime = formatTimerOutput(r.effectiveMs);
        }
    }

    for (let i = sessionArr.length - 1; i >= 0; i--) {
        sessionArr[i].isPb = false;
        if (sessionArr[i].effectiveMs !== Infinity && sessionArr[i].effectiveMs < currentSessionBestMs) {
            currentSessionBestMs = sessionArr[i].effectiveMs;
            sessionArr[i].isPb = true;
        }

        let slice1 = sessionArr.slice(i, i + stat1.count);
        let s1 = calculateStat(slice1, stat1.type, stat1.count);
        sessionArr[i].stat1Str = s1.str;
        sessionArr[i].stat1Ms = s1.ms;
        sessionArr[i].isStat1Pb = false;
        if (s1.ms !== Infinity && s1.ms <= currentSessionBestStat1Ms) {
            currentSessionBestStat1Ms = s1.ms;
            sessionArr[i].isStat1Pb = true;
        }

        let slice2 = sessionArr.slice(i, i + stat2.count);
        let s2 = calculateStat(slice2, stat2.type, stat2.count);
        sessionArr[i].stat2Str = s2.str;
        sessionArr[i].stat2Ms = s2.ms;
        sessionArr[i].isStat2Pb = false;
        if (s2.ms !== Infinity && s2.ms <= currentSessionBestStat2Ms) {
            currentSessionBestStat2Ms = s2.ms;
            sessionArr[i].isStat2Pb = true;
        }
    }

    document.getElementById('header-stat1').innerText = `${stat1.type}${stat1.count}`;
    document.getElementById('header-stat2').innerText = `${stat2.type}${stat2.count}`;
    renderTimerHistory();
}

// ================= 新增：完赛结算专属全局变量 =================
let pendingSolveMs = 0;
let pendingSolvePenalty = '';

function stopTimer() {
    timerState = 'IDLE';
    cancelAnimationFrame(requestAnimFrameId);

    let elapsed = Math.floor(performance.now() - solveStartTime);
    let finalTimeStr = formatTimerOutput(elapsed);
    document.getElementById('timer-display').innerText = finalTimeStr;

    // 核心拦截：如果开启了每次提示，则拦截保存动作，弹出卡片
    if (uiSettings.promptAction) {
        pendingSolveMs = elapsed;
        setPostPenalty('', false); // 默认无惩罚，且不更新界面避免闪烁
        document.getElementById('post-solve-time').innerText = finalTimeStr;
        document.getElementById('post-solve-modal').style.display = 'flex';
    } else {
        // 如果没开启，维持以前的无缝丝滑记录方式
        timerHistoryData[currentTimerEvent].unshift({
            rawMs: elapsed,
            penalty: "",
            timestamp: getNowFormatted(),
            scramble: document.getElementById('scramble-text').innerText
        });
        recalculateSessionStats();
        saveTimerData();
        generateScramble();
    }
}

// 专属卡片惩罚切换
function setPostPenalty(pen, updateDisplay = true) {
    pendingSolvePenalty = pen;
    ['none', 'plus2', 'dnf'].forEach(id => document.getElementById(`post-pen-${id}`).classList.remove('active'));
    if (pen === '') document.getElementById('post-pen-none').classList.add('active');
    else if (pen === '+2') document.getElementById('post-pen-plus2').classList.add('active');
    else if (pen === 'DNF') document.getElementById('post-pen-dnf').classList.add('active');

    if (updateDisplay) {
        let simDisp = "";
        if (pen === '+2') simDisp = formatTimerOutput(pendingSolveMs + 2000) + '+';
        else if (pen === 'DNF') simDisp = 'DNF';
        else simDisp = formatTimerOutput(pendingSolveMs);
        document.getElementById('post-solve-time').innerText = simDisp;
    }
}

// 核心黑科技：瞬间倒推时光，恢复之前计时的无缝连接
function resumePostSolve() {
    document.getElementById('post-solve-modal').style.display = 'none';

    // 巧妙利用时间差：当前时间减去刚才积攒的毫秒数，算出虚拟的“起步时间”
    solveStartTime = performance.now() - pendingSolveMs;
    timerState = 'RUNNING';

    const display = document.getElementById('timer-display');
    display.classList.remove('waiting', 'ready');

    function update() {
        if (timerState !== 'RUNNING') return;
        let elapsed = Math.floor(performance.now() - solveStartTime);
        display.innerText = formatTimerOutput(elapsed);
        requestAnimFrameId = requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// 丢弃成绩 (点击取消)：直接重置并给新打乱
function cancelPostSolve() {
    document.getElementById('post-solve-modal').style.display = 'none';
    document.getElementById('timer-display').innerText = '0.00';
    generateScramble();
}

// 确认记录 (点击确认或点击外部空白)：真正写入数据库
function confirmPostSolve() {
    const modal = document.getElementById('post-solve-modal');
    if (modal.style.display === 'none') return; // 防连击保护
    modal.style.display = 'none';

    timerHistoryData[currentTimerEvent].unshift({
        rawMs: pendingSolveMs,
        penalty: pendingSolvePenalty,
        timestamp: getNowFormatted(),
        scramble: document.getElementById('scramble-text').innerText
    });

    recalculateSessionStats();
    saveTimerData();
    generateScramble();
}

function renderTimerHistory() {
    const list = document.getElementById('timer-history-list');
    list.innerHTML = '';
    const records = timerHistoryData[currentTimerEvent] || [];

    records.forEach((r, index) => {
        const div = document.createElement('div');
        div.className = 'timer-history-item';
        let displayCount = records.length - index;

        let stat1Name = stat1.type + stat1.count;
        let stat2Name = stat2.type + stat2.count;

        let stat1Click = r.stat1Str !== '-' ? `onclick="openAvgPopup(${index}, ${stat1.count}, '${stat1Name}', '${r.stat1Str}')"` : '';
        let stat2Click = r.stat2Str !== '-' ? `onclick="openAvgPopup(${index}, ${stat2.count}, '${stat2Name}', '${r.stat2Str}')"` : '';

        let stat1Class = r.stat1Str !== '-' ? 'clickable-time' : '';
        let stat2Class = r.stat2Str !== '-' ? 'clickable-time' : '';

        // 核心修复：应用 timer-pb-single 和 timer-pb-avg 以完美响应你的颜色设置
        div.innerHTML = `
            <span class="col-id">${displayCount}</span>
            <span class="col-time clickable-time ${r.isPb ? 'timer-pb-single' : ''}" onclick="openEditPopup(${index})">${r.displayTime}</span>
            <span class="col-stat ${stat1Class} ${r.isStat1Pb ? 'timer-pb-avg' : ''}" ${stat1Click}>${r.stat1Str}</span>
            <span class="col-stat ${stat2Class} ${r.isStat2Pb ? 'timer-pb-avg' : ''}" ${stat2Click}>${r.stat2Str}</span>
        `;
        list.appendChild(div);
    });

    if (records.length > 0) {
        // 👇 核心新增：实时计算有效成绩次数并更新显示 👇
        let validCount = records.filter(r => r.penalty !== 'DNF').length;
        let countEl = document.getElementById('timer-stat-count');
        if (countEl) countEl.innerText = `${validCount}/${records.length}`;

        document.getElementById('timer-stat-best').innerText = `best: ` + (currentSessionBestMs !== Infinity ? formatTimerOutput(currentSessionBestMs) : 'DNF');
        document.getElementById('timer-stat-stat1').innerText = `${stat1.type}${stat1.count}: ` + (currentSessionBestStat1Ms !== Infinity ? formatTimerOutput(currentSessionBestStat1Ms) : '-');
        document.getElementById('timer-stat-stat2').innerText = `${stat2.type}${stat2.count}: ` + (currentSessionBestStat2Ms !== Infinity ? formatTimerOutput(currentSessionBestStat2Ms) : '-');
    } else {
        let countEl = document.getElementById('timer-stat-count');
        if (countEl) countEl.innerText = `0/0`;

        document.getElementById('timer-stat-best').innerText = `best: -`;
        document.getElementById('timer-stat-stat1').innerText = `${stat1.type}${stat1.count}: -`;
        document.getElementById('timer-stat-stat2').innerText = `${stat2.type}${stat2.count}: -`;
    }
}

// ================= 编辑成绩弹窗交互逻辑 =================
function openEditPopup(index) {
    editScoreIndex = index;
    const records = timerHistoryData[currentTimerEvent];
    const r = records[index];
    currentEditPenalty = r.penalty;

    document.getElementById('edit-index').innerText = `#${records.length - index}`;
    document.getElementById('edit-time').innerText = r.displayTime;
    document.getElementById('edit-timestamp').innerText = r.timestamp;
    document.getElementById('edit-scramble').innerText = r.scramble;

    // 核心新增：渲染卡片内部的打乱图并应用缩放补偿
    const editDisplayEl = document.getElementById('edit-scramble-display');
    if (editDisplayEl) {
        let cleanScramble = r.scramble.replace(/<br>/g, ' ');
        editDisplayEl.setAttribute('puzzle', getCubingJsPuzzle(currentTimerEvent));
        editDisplayEl.setAttribute('alg', cleanScramble);

        editDisplayEl.style.transition = "transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)";
        editDisplayEl.style.transform = `scale(${getScrambleZoom(currentTimerEvent)})`;

        // 瞬间跳转到打乱最终态
        setTimeout(() => {
            editDisplayEl.timestamp = "end";
        }, 10);
    }

    setEditPenalty(currentEditPenalty, false);
    document.getElementById('edit-score-popup').style.display = 'flex';
}

// ================= 平均成绩点击弹窗逻辑 =================
let currentAvgData = null; // 缓存当前打开的平均成绩数据

// 参数: index(最新单次在数组中的索引), count(如5/12), typeLabel(如"ao5"), avgValue(成绩文本)
function openAvgPopup(index, count, typeLabel, avgValue) {
    const records = timerHistoryData[currentTimerEvent];
    if (index + count > records.length) return; // 容错拦截

    // 截取该组平均包含的所有单次成绩 (按最新到最旧的顺序)
    const solves = records.slice(index, index + count);

    // 计算历史真实序号
    const total = records.length;
    const endNum = total - index;
    const startNum = total - (index + count - 1);
    const rangeStr = `#${startNum} ~ ${endNum}`;

    let isAo = typeLabel.toLowerCase().startsWith('ao');

    let bestRaw = Infinity;
    let worstRaw = -1;

    let mappedSolves = solves.map(r => {
        let actualMs = r.penalty === '+2' ? r.rawMs + 2000 : r.rawMs;
        let isDNF = r.penalty === 'DNF';
        let sortMs = isDNF ? Infinity : actualMs;

        let baseStr = formatTimerOutput(actualMs);
        if (r.penalty === '+2') baseStr += '+';

        // 核心修改：DNF 强制拼接入原成绩
        let dispStr = isDNF ? `DNF(${formatTimerOutput(r.rawMs)})` : baseStr;

        if (sortMs < bestRaw) bestRaw = sortMs;
        if (sortMs > worstRaw) worstRaw = sortMs;

        return {
            ...r,
            sortMs: sortMs,
            baseDisp: dispStr
        };
    });

    // 倒序：按时间正向顺序 (老 -> 新) 排列，完美符合 WCA 读谱习惯
    let chronologicalSolves = [...mappedSolves].reverse();

    let bestMarked = false;
    let worstMarked = false;

    // 提取带括号的成绩列表字符串
    let timeListStrs = chronologicalSolves.map(s => {
        let finalStr = s.baseDisp;
        if (isAo) {
            // 给最快和最慢成绩加括号，即使它是带成绩的 DNF
            if (s.sortMs === bestRaw && !bestMarked) {
                finalStr = `(${finalStr})`;
                bestMarked = true;
            } else if (s.sortMs === worstRaw && !worstMarked) {
                finalStr = `(${finalStr})`;
                worstMarked = true;
            }
        }
        s.finalDisp = finalStr; // 保存最终呈现文本到原对象
        return finalStr;
    });

    // 核心计算：中位数 (Median)
    let allSortMs = mappedSolves.map(s => s.sortMs).sort((a,b) => a - b);
    let medianMs;
    let mid = Math.floor(allSortMs.length / 2);
    if (allSortMs.length % 2 === 0) {
        let m1 = allSortMs[mid - 1];
        let m2 = allSortMs[mid];
        if (m1 === Infinity || m2 === Infinity) medianMs = Infinity;
        else medianMs = Math.floor((m1 + m2) / 2);
    } else {
        medianMs = allSortMs[mid];
    }
    let medianStr = medianMs === Infinity ? "DNF" : formatTimerOutput(medianMs);

    let bestStr = bestRaw === Infinity ? "DNF" : formatTimerOutput(bestRaw);
    let worstSolveObj = mappedSolves.find(s => s.sortMs === worstRaw);
    let worstStr = worstSolveObj ? worstSolveObj.baseDisp : "DNF";

    // 格式化“五次去尾平均”之类的前缀翻译词
    let cnCountMap = { 3: '三', 5: '五', 12: '十二', 50: '五十', 100: '一百' };
    let cnCount = cnCountMap[count] || count.toString();
    let avgTypeDesc = isAo ? `${cnCount}次去尾平均` : `${cnCount}次算术平均`;
    let copyTitle = `${rangeStr}  ${avgTypeDesc} ${typeLabel} = ${avgValue}`;

    currentAvgData = {
        range: rangeStr,
        title: `${typeLabel} = ${avgValue}`,
        copyTitle: copyTitle,
        timestamp: solves[0].timestamp, // 取最后一次复原的时间
        best: bestStr,
        worst: worstStr,
        median: medianStr,
        timeListStr: timeListStrs.join(', '),
        chronologicalSolves: chronologicalSolves,
        startNum: startNum
    };

    // 渲染文字
    document.getElementById('avg-index-range').innerText = currentAvgData.range;
    document.getElementById('avg-main-value').innerText = currentAvgData.title;
    document.getElementById('avg-timestamp').innerText = currentAvgData.timestamp;
    document.getElementById('avg-best-single').innerText = `最快单次：${currentAvgData.best}`;
    document.getElementById('avg-worst-single').innerText = `最慢单次：${currentAvgData.worst}`;
    document.getElementById('avg-median-single').innerText = `中位数：${currentAvgData.median}`;
    document.getElementById('avg-time-list').innerText = `成绩列表：${currentAvgData.timeListStr}`;

    // 显示摘要弹窗
    document.getElementById('avg-score-popup').style.display = 'flex';
}

function closeAvgPopup() {
    document.getElementById('avg-score-popup').style.display = 'none';
}

function copyAvgInfo() {
    if (!currentAvgData) return;
    const text = `该统计信息由NB Timer自动生成于${currentAvgData.timestamp}\n${currentAvgData.copyTitle}\n最快单次：${currentAvgData.best}\n最慢单次：${currentAvgData.worst}\n中位数：${currentAvgData.median}\n成绩列表：${currentAvgData.timeListStr}`;
    if (navigator.clipboard) navigator.clipboard.writeText(text);

    // 获取到“复制”按钮并修改文字交互反馈
    const btn = document.querySelectorAll('#avg-score-popup .edit-btn-cancel')[1];
    if (btn) {
        const oldText = btn.innerText;
        btn.innerText = '已复制';
        setTimeout(() => btn.innerText = oldText, 1500);
    }
}

// 展开详细列表
function openAvgDetails() {
    closeAvgPopup();
    const listContainer = document.getElementById('avg-details-list');
    listContainer.innerHTML = "";

    currentAvgData.chronologicalSolves.forEach((s, i) => {
        // 使用正向推进的历史编号
        const num = currentAvgData.startNum + i;

        const item = document.createElement('div');
        item.className = 'avg-detail-item';
        item.innerHTML = `
            <div class="avg-detail-row1">
                <span class="avg-detail-time">#${num} &nbsp; ${s.finalDisp}</span>
                <span class="avg-detail-date">${s.timestamp}</span>
            </div>
            <div class="avg-detail-scramble">${s.scramble}</div>
        `;
        listContainer.appendChild(item);
    });

    document.getElementById('avg-details-popup').style.display = 'flex';
}

function closeAvgDetails() {
    document.getElementById('avg-details-popup').style.display = 'none';
}

function closeEditPopup() {
    document.getElementById('edit-score-popup').style.display = 'none';
}

function setEditPenalty(pen, updateDisplay = true) {
    currentEditPenalty = pen;
    ['none', 'plus2', 'dnf'].forEach(id => document.getElementById(`edit-pen-${id}`).classList.remove('active'));

    if (pen === '') document.getElementById('edit-pen-none').classList.add('active');
    else if (pen === '+2') document.getElementById('edit-pen-plus2').classList.add('active');
    else if (pen === 'DNF') document.getElementById('edit-pen-dnf').classList.add('active');

    if (updateDisplay) {
        const r = timerHistoryData[currentTimerEvent][editScoreIndex];
        let simDisp = "";
        if (pen === '+2') simDisp = formatTimerOutput(r.rawMs + 2000) + '+';
        else if (pen === 'DNF') simDisp = 'DNF';
        else simDisp = formatTimerOutput(r.rawMs);
        document.getElementById('edit-time').innerText = simDisp;
    }
}

function confirmEditScore() {
    timerHistoryData[currentTimerEvent][editScoreIndex].penalty = currentEditPenalty;
    closeEditPopup();
    recalculateSessionStats();
    saveTimerData(); // 核心新增：改判后存档
}

function deleteEditScore() {
    timerHistoryData[currentTimerEvent].splice(editScoreIndex, 1);
    closeEditPopup();
    recalculateSessionStats();
    saveTimerData(); // 核心新增：删除后存档
}

function copyEditScramble() {
    const text = document.getElementById('edit-scramble').innerText;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('.edit-btn-copy');
        const oldText = btn.innerText;
        btn.innerText = '✔️ 已复制';
        setTimeout(() => btn.innerText = oldText, 1500);
    });
}

// 移动端切换 (新增设置选项卡与子视图双重丝滑联动)
function switchTimerTab(tabName) {
    // 核心新增：只要不是空闲状态（正在长按或计时中），一律禁止切换栏目
    if (timerState !== 'IDLE') return;

    if (window.innerWidth > 768) return;

    // 移除所有大 Tab 和底部按钮的激活状态
    document.getElementById('timer-tab-main').classList.remove('active-tab');
    document.getElementById('timer-tab-list').classList.remove('active-tab');
    document.getElementById('btn-tab-main').classList.remove('active');
    document.getElementById('btn-tab-list').classList.remove('active');
    document.getElementById('btn-tab-settings').classList.remove('active');

    // 智能调度：如果是成绩或设置，强制召唤 timer-tab-list 并切换其内部动画视图
    if (tabName === 'main') {
        document.getElementById('timer-tab-main').classList.add('active-tab');
        document.getElementById('btn-tab-main').classList.add('active');
    } else if (tabName === 'list') {
        document.getElementById('timer-tab-list').classList.add('active-tab');
        document.getElementById('btn-tab-list').classList.add('active');
        switchSidebarTab('history'); // 强制左侧栏切换到列表视图
    } else if (tabName === 'settings') {
        document.getElementById('timer-tab-list').classList.add('active-tab');
        document.getElementById('btn-tab-settings').classList.add('active');
        switchSidebarTab('settings'); // 强制左侧栏切换到设置视图
    }
}

// ================= 计时器项目选择悬浮窗逻辑 =================
let timerTempEvent = '333';

function initTimer() {
    loadTimerData();

    try {
        let evObj = eventDict.find(e => e.id === currentTimerEvent);
        if (evObj) {
            document.getElementById('timer-event-icon').className = `cubing-icon event-${currentTimerEvent}`;
            document.getElementById('timer-event-name').innerText = evObj.name;
            document.getElementById('timer-event-title').innerText = "WCA - " + evObj.name;
        }
    } catch (e) {}

    if (!timerHistoryData[currentTimerEvent]) {
        timerHistoryData[currentTimerEvent] = [];
    }

    try { recalculateSessionStats(); } catch(e) {}
    try { generateScramble(); } catch(e) {}
    switchTimerTab('main');
}

function openTimerEventPopup() {
    document.getElementById('timer-more-dropdown').style.display = 'none';
    timerTempEvent = currentTimerEvent;
    renderTimerEventGrid();

    const popup = document.getElementById('timer-event-popup');
    popup.classList.remove('popup-fade-out');
    popup.style.display = 'flex';
}

function renderTimerEventGrid() {
    const grid = document.getElementById('timer-event-grid');
    grid.innerHTML = '';
    const excludedEvents = ['magic', 'mmagic', '333ft', 'mbf', '333mbf', '333fm'];

    eventDict.forEach(ev => {
        if (!excludedEvents.includes(ev.id)) {
            let isActive = timerTempEvent === ev.id ? 'active' : '';
            let btn = document.createElement('div');
            btn.className = `chal-event-item ${isActive}`;
            btn.innerHTML = `<span class="cubing-icon event-${ev.id}" style="font-size: 24px; display:block; margin-bottom:5px;"></span><span style="font-size:12px; font-weight:600;">${ev.name}</span>`;

            btn.onclick = () => {
                timerTempEvent = ev.id;
                renderTimerEventGrid(); // 仅刷新高亮，不触发真实打乱
            };
            grid.appendChild(btn);
        }
    });
}

function confirmTimerEvent() {
    if (timerTempEvent !== currentTimerEvent) {
        currentTimerEvent = timerTempEvent;

        let evObj = eventDict.find(e => e.id === currentTimerEvent);
        let evName = evObj ? evObj.name : '未知';

        // 更新左侧选择器与右侧大标题
        document.getElementById('timer-event-icon').className = `cubing-icon event-${currentTimerEvent}`;
        document.getElementById('timer-event-name').innerText = evName;
        document.getElementById('timer-event-title').innerText = "WCA - " + evName;

        if (!timerHistoryData[currentTimerEvent]) {
            timerHistoryData[currentTimerEvent] = [];
        }

        recalculateSessionStats();
        generateScramble();
    }
    closeTimerEventPopup();
}

function closeTimerEventPopup(e) {
    if (e && e.target.id !== 'timer-event-popup') return;
    const popup = document.getElementById('timer-event-popup');
    if (popup.style.display === 'none') return;

    popup.classList.add('popup-fade-out');
    setTimeout(() => {
        popup.style.display = 'none';
        popup.classList.remove('popup-fade-out');
    }, 200);
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

// 提取通用的打乱引擎 (严格匹配 WCA TNoodle 规则)
function getScrambleByEvent(ev) {
    let scramble = "";

    if (ev === '222') {
        scramble = getRandomMoves(["R", "U", "F"], 11);
    } else if (['333', '333oh', '333fm', '333ft'].includes(ev)) {
        scramble = getRandomMoves(["R", "L", "U", "D", "F", "B"], 20);
    } else if (['333bf', '333mbf'].includes(ev)) {
        // 三盲/多盲：20步 + 0-2次随机握持方向宽层转动 (Rw, Uw, Fw)
        let ori = getRandomMoves(["Rw", "Uw", "Fw"], Math.floor(Math.random() * 3));
        scramble = getRandomMoves(["R", "L", "U", "D", "F", "B"], 20) + (ori ? " " + ori : "");
    } else if (ev === '444') {
        scramble = getRandomMoves(["R", "L", "U", "D", "F", "B", "Rw", "Uw", "Fw"], 40); // 官方四阶标准为40步
    } else if (ev === '444bf') {
        // 四盲：40步 + 0-2次整体转动 (x, y, z)
        let ori = getRandomMoves(["x", "y", "z"], Math.floor(Math.random() * 3));
        scramble = getRandomMoves(["R", "L", "U", "D", "F", "B", "Rw", "Uw", "Fw"], 40) + (ori ? " " + ori : "");
    } else if (ev === '555') {
        scramble = getRandomMoves(["R", "L", "U", "D", "F", "B", "Rw", "Lw", "Uw", "Dw", "Fw", "Bw"], 60);
    } else if (ev === '555bf') {
        // 五盲：60步 + 0-2次三层转动 (3Rw, 3Uw, 3Fw 改变中心朝向)
        let ori = getRandomMoves(["3Rw", "3Uw", "3Fw"], Math.floor(Math.random() * 3));
        scramble = getRandomMoves(["R", "L", "U", "D", "F", "B", "Rw", "Lw", "Uw", "Dw", "Fw", "Bw"], 60) + (ori ? " " + ori : "");
    } else if (['666', '777'].includes(ev)) {
        let moves67 = ["R", "L", "U", "D", "F", "B", "Rw", "Lw", "Uw", "Dw", "Fw", "Bw", "3Rw", "3Lw", "3Uw", "3Dw", "3Fw", "3Bw"];
        scramble = getRandomMoves(moves67, ev === '666' ? 80 : 100);
    } else if (ev === 'pyram') {
        // 金字塔：修饰符限制为 [无, ']，彻底消灭 "2"
        scramble = getRandomMoves(["U", "L", "R", "B"], 11, ["", "'"]);
        let tips = ["u", "l", "r", "b"];
        tips.forEach(t => { if(Math.random() > 0.5) scramble += " " + t + (Math.random() > 0.5 ? "'" : ""); });
    } else if (ev === 'skewb') {
        // 斜转：修饰符限制为 [无, ']，彻底消灭 "2"
        scramble = getRandomMoves(["R", "L", "U", "B"], 11, ["", "'"]);
    } else if (ev === 'minx') {
        let res = [];
        for (let i=0; i<7; i++) {
            for (let j=0; j<10; j++) res.push((j%2===0 ? "R" : "D") + (Math.random() > 0.5 ? "++" : "--"));
            res.push("U" + (Math.random() > 0.5 ? "'" : "") + "<br>");
        }
        scramble = res.join(" ");
    } else if (ev === 'sq1') {
        let res = [];
        // 3代表90度，选取3的倍数即可保证不破坏方形
        let safeMoves = [-3, 0, 3, 6];

        for(let i = 0; i < 12; i++) {
            let top, bot;
            do {
                if (i < 5) {
                    // 前 5 个括号限制在安全度数内，保持形状
                    top = safeMoves[Math.floor(Math.random() * safeMoves.length)];
                    bot = safeMoves[Math.floor(Math.random() * safeMoves.length)];
                } else {
                    // 5 个括号之后，恢复完全随机，开始破坏形状
                    top = Math.floor(Math.random() * 12) - 5;
                    bot = Math.floor(Math.random() * 12) - 5;
                }
            } while (top === 0 && bot === 0); // 顺便加个拦截，防止出现 (0,0) 的无效打乱

            res.push(`(${top},${bot})`);
        }
        scramble = res.join(" / ");
    } else if (ev === 'clock') {
        // 核心修复魔表：严格区分正负数语法，完美适配官方解析器
        let clockMoves1 = ["UR", "DR", "DL", "UL", "U", "R", "D", "L", "ALL"];
        let clockMoves2 = ["U", "R", "D", "L", "ALL"];
        let res = [];

        const getClockVal = () => {
            let v = Math.floor(Math.random() * 12) - 5; // 生成 -5 到 +6
            if (v < 0) return Math.abs(v) + "-";
            return v + "+";
        };

        clockMoves1.forEach(p => res.push(p + getClockVal()));
        res.push("y2");
        clockMoves2.forEach(p => res.push(p + getClockVal()));

        // 已经移除了根据 WCA 早期规则在末尾随机按立柱的代码，完美适配新规

        scramble = res.join(" ");
    }
    return scramble;
}

// 升级版：智能同轴抵消防御引擎 (严格匹配 WCA 难度标准)
function getRandomMoves(moves, length, mods = ["", "'", "2"]) {
    if (length === 0) return "";
    let scramble = [];
    let lastFace = "";
    let secondLastFace = "";

    // 核心规则：定义平行对立面
    const opposites = { 'R': 'L', 'L': 'R', 'U': 'D', 'D': 'U', 'F': 'B', 'B': 'F' };

    for (let i = 0; i < length; i++) {
        let m, newFace;
        let isValid = false;

        do {
            m = moves[Math.floor(Math.random() * moves.length)];

            // 提取核心转动面 (智能剥离高阶数字和 w 修饰符，例如 '3Rw' -> 'R', 'Fw' -> 'F')
            let match = m.match(/[RLUDFB]/);
            newFace = match ? match[0] : m;

            // 拦截规则 1：不能和上一步转动同一个基础面 (例如防止 R 和 Rw 连在一起)
            if (newFace === lastFace) {
                isValid = false;
            }
            // 拦截规则 2：杜绝同轴抵消夹心饼干 (例如严禁 F B F，或 R L Rw)
            else if (newFace === secondLastFace && opposites[newFace] === lastFace) {
                isValid = false;
            }
            else {
                isValid = true;
            }
        } while (!isValid);

        // 更新历史记录状态
        secondLastFace = lastFace;
        lastFace = newFace;

        scramble.push(m + mods[Math.floor(Math.random() * mods.length)]);
    }
    return scramble.join(" ");
}

// =========================================
// 官方打乱图组件事件映射与动态缩放补偿字典
// =========================================
function getCubingJsPuzzle(eventId) {
    const map = {
        '222': '2x2x2', '333': '3x3x3', '333oh': '3x3x3', '333bf': '3x3x3', '333fm': '3x3x3', '333mbf': '3x3x3', '333ft': '3x3x3',
        '444': '4x4x4', '444bf': '4x4x4',
        '555': '5x5x5', '555bf': '5x5x5',
        '666': '6x6x6', '777': '7x7x7',
        'pyram': 'pyraminx', 'minx': 'megaminx', 'skewb': 'skewb', 'sq1': 'square1', 'clock': 'clock'
    };
    return map[eventId] || '3x3x3';
}

// 核心新增：专门对抗官方组件“高阶缩水”的放大补偿系数
function getScrambleZoom(eventId) {
    const zoomMap = {
        '222': 0.9,
        '333': 1.0, '333oh': 1.0, '333bf': 1.0, '333fm': 1.0, '333mbf': 1.0, '333ft': 1.0,
        '444': 1.20, '444bf': 1.20, // 四阶放大
        '555': 1.20, '555bf': 1.20, // 五阶放大
        '666': 1.20,                // 六阶放大
        '777': 1.20,                // 七阶放大
        'minx': 1.05,               // 五魔方形状特殊，稍微放大
        'pyram': 1.0,
        'sq1': 1.0,
        'skewb': 1.15,
        'clock': 1.0
    };
    return zoomMap[eventId] || 1.0;
}

function generateScramble() {
    const scramble = getScrambleByEvent(currentTimerEvent);
    document.getElementById('scramble-text').innerHTML = scramble;

    // 同步更新右下角打乱图
    const displayEl = document.getElementById('timer-scramble-display');
    if (displayEl) {
        // 去除换行符，保证组件能正确识别
        let cleanScramble = scramble.replace(/<br>/g, ' ');

        displayEl.setAttribute('puzzle', getCubingJsPuzzle(currentTimerEvent));
        displayEl.setAttribute('alg', cleanScramble);

        // 核心修复：根据当前项目，动态注入缩放比例，并附带 0.3 秒丝滑过渡动画
        displayEl.style.transition = "transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)";
        displayEl.style.transform = `scale(${getScrambleZoom(currentTimerEvent)})`;

        // 强制组件瞬间跳转到打乱后的最终状态
        setTimeout(() => {
            displayEl.timestamp = "end";
        }, 10);
    }
}

// ================= 空格键与右键监听控制 =================
document.addEventListener('keydown', (e) => {
    const activePage = document.querySelector('.page-container.active');
    if (!activePage || activePage.id !== 'timer-page') return;

    // 👇 核心升级：如果确认卡片在屏幕上，敲击【任意键】直接记录成绩并关闭卡片！
    const postModal = document.getElementById('post-solve-modal');
    if (postModal && postModal.style.display === 'flex') {
        e.preventDefault();
        confirmPostSolve(); // 直接调用确定保存成绩
        return;
    }

    if (timerState === 'IDLE') {
        if (e.code === 'ArrowRight') {
            e.preventDefault();
            generateScramble();
            return;
        }
        if (e.code === 'ArrowDown') {
            e.preventDefault();
            openNbManualInput();
            return;
        }
        if (e.code === 'ArrowLeft') {
            e.preventDefault();
            openNbDeleteLast();
            return;
        }
        if (e.code === 'ArrowUp') {
            e.preventDefault();
            openNbEditLast();
            return;
        }
        if (e.code === 'Space') {
            e.preventDefault();
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
        e.preventDefault();
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

// =======================================================
// 手机端：限定区域内的滑动切打乱/弹出卡片与长按屏幕计时逻辑 (NB Timer)
// =======================================================
let touchStartX = 0;
let touchStartY = 0;
let nbSwipeAction = null;

document.addEventListener('touchstart', (e) => {
    const activePage = document.querySelector('.page-container.active');
    if (!activePage || activePage.id !== 'timer-page') return;

    // 👇 绝对防御：如果确认卡片在屏幕上，强行没收所有触摸指令！
    const postModal = document.getElementById('post-solve-modal');
    if (postModal && postModal.style.display === 'flex') return;

    const isTimerArea = e.target.closest('#timer-tab-main');
    if (!isTimerArea) return;

    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
    nbSwipeAction = null;

    if (timerState === 'RUNNING') {
        if(e.cancelable) e.preventDefault();
        stopTimer();
        return;
    }

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
    const isTimerArea = e.target.closest('#timer-tab-main');

    if (isTimerArea && (timerState === 'WAITING' || timerState === 'READY')) {
        let currentX = e.changedTouches[0].screenX;
        let currentY = e.changedTouches[0].screenY;

        // 扩充四个方向的判定
        if (currentX - touchStartX > 50) {
            nbSwipeAction = 'right';
        } else if (currentX - touchStartX < -50) {
            nbSwipeAction = 'left';
        } else if (currentY - touchStartY > 50) {
            nbSwipeAction = 'down';
        } else if (currentY - touchStartY < -50) {
            nbSwipeAction = 'up';
        }

        // 判定发生滑动，立即中断长按状态并恢复原色
        if (nbSwipeAction) {
            clearTimeout(timerHoldTimeout);
            timerState = 'IDLE';
            document.getElementById('timer-display').classList.remove('waiting', 'ready');
        }

        if(e.cancelable) e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchend', (e) => {
    const activePage = document.querySelector('.page-container.active');
    if (!activePage || activePage.id !== 'timer-page') return;
    const isTimerArea = e.target.closest('#timer-tab-main');

    if (!isTimerArea) {
        if (timerState === 'WAITING' || timerState === 'READY') {
            clearTimeout(timerHoldTimeout);
            timerState = 'IDLE';
            document.getElementById('timer-display').classList.remove('waiting', 'ready');
        }
        return;
    }

    if (nbSwipeAction === 'right') {
        generateScramble();
        return;
    } else if (nbSwipeAction === 'down') {
        openNbManualInput();
        return;
    } else if (nbSwipeAction === 'left') {
        openNbDeleteLast();
        return;
    } else if (nbSwipeAction === 'up') {
        openNbEditLast();
        return;
    }

    const display = document.getElementById('timer-display');
    if (timerState === 'WAITING') {
        clearTimeout(timerHoldTimeout);
        timerState = 'IDLE';
        display.classList.remove('waiting');
    } else if (timerState === 'READY') {
        if(e.cancelable) e.preventDefault();
        startTimer();
    }
}, { passive: false });


// =======================================================
// 手机端专属：巅峰月赛滑动防误触与卡片触发
// =======================================================
let monthlyTouchStartX = 0;
let monthlyTouchStartY = 0;
let monthlySwipeAction = null;

document.addEventListener('touchstart', (e) => {
    const activePage = document.querySelector('.page-container.active');
    if (!activePage || activePage.id !== 'monthly-timer-page') return;
    const penaltyModal = document.getElementById('monthly-penalty-modal');
    if (penaltyModal && penaltyModal.style.display === 'flex') return;
    const isTimerArea = e.target.closest('#monthly-timer-main-area');
    if (!isTimerArea || monthlyHasFinished) return;

    monthlyTouchStartX = e.changedTouches[0].screenX;
    monthlyTouchStartY = e.changedTouches[0].screenY;
    monthlySwipeAction = null;

    if (monthlyTimerState === 'RUNNING') {
        if (e.cancelable) e.preventDefault();
        stopMonthlyTimer();
        return;
    }

    if (monthlyTimerState === 'IDLE') {
        monthlyTimerState = 'WAITING';
        const display = document.getElementById('monthly-timer-display');
        display.classList.add('waiting');
        monthlyHoldTimeout = setTimeout(() => {
            if (monthlyTimerState === 'WAITING') {
                monthlyTimerState = 'READY';
                display.classList.remove('waiting');
                display.classList.add('ready');
            }
        }, 350);
    }
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    const activePage = document.querySelector('.page-container.active');
    if (!activePage || activePage.id !== 'monthly-timer-page') return;
    const isTimerArea = e.target.closest('#monthly-timer-main-area');

    if (isTimerArea && (monthlyTimerState === 'WAITING' || monthlyTimerState === 'READY')) {
        let currentY = e.changedTouches[0].screenY;
        if (currentY - monthlyTouchStartY > 50) {
            monthlySwipeAction = 'down';
            clearTimeout(monthlyHoldTimeout);
            monthlyTimerState = 'IDLE';
            document.getElementById('monthly-timer-display').classList.remove('waiting', 'ready');
        }
        if (e.cancelable) e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchend', (e) => {
    const activePage = document.querySelector('.page-container.active');
    if (!activePage || activePage.id !== 'monthly-timer-page') return;
    const penaltyModal = document.getElementById('monthly-penalty-modal');
    if (penaltyModal && penaltyModal.style.display === 'flex') return;
    const isTimerArea = e.target.closest('#monthly-timer-main-area');

    if (!isTimerArea) {
        if (monthlyTimerState === 'WAITING' || monthlyTimerState === 'READY') {
            clearTimeout(monthlyHoldTimeout);
            monthlyTimerState = 'IDLE';
            document.getElementById('monthly-timer-display').classList.remove('waiting', 'ready');
        }
        return;
    }

    if (monthlyHasFinished) return;

    if (monthlySwipeAction === 'down') {
        openMonthlyManualInput();
        return;
    }

    const display = document.getElementById('monthly-timer-display');
    if (monthlyTimerState === 'WAITING') {
        clearTimeout(monthlyHoldTimeout);
        monthlyTimerState = 'IDLE';
        display.classList.remove('waiting');
    } else if (monthlyTimerState === 'READY') {
        if (e.cancelable) e.preventDefault();
        startMonthlyTimer();
    }
}, { passive: false });

// =========================================
// NB Challenge 核心逻辑引擎 (含独立赛点/胜利特写系统)
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
let chalCurrentEvent = '333';
let chalHasInit = false;

// 游戏规则参数 (独立赛点与胜利标记)
let chalWinScore = 11;
let chalHasWinner = false;
let matchPointShownTop = false;
let matchPointShownBottom = false;
let chalAlertTimer = null;

function initChallenge() {
    if (!chalHasInit) {
        updateChallengeScores();
        generateChallengeScramble();
        chalHasInit = true;
    }
}

function exitChallenge() {
    if (chalState === 'RUNNING') return;
    goBack();
}

function generateChallengeScramble() {
    let scramble = getScrambleByEvent(chalCurrentEvent);
    document.getElementById('challenge-scramble-top').innerHTML = scramble;
    document.getElementById('challenge-scramble-bottom').innerHTML = scramble;
}

function updateChallengeScores() {
    document.getElementById('challenge-score-top').innerText = chalScoreTop;
    document.getElementById('challenge-score-bottom').innerText = chalScoreBottom;
}

// ============== 更多下拉菜单逻辑 ==============
function toggleChalMore(e) {
    e.stopPropagation();
    const menu = document.getElementById('chal-more-dropdown');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

// 拦截全局点击，点击空白处自动收起各种菜单
document.addEventListener('click', (e) => {
    // 拦截普通 Timer 的更多菜单
    const timerMenu = document.getElementById('timer-more-dropdown');
    if (timerMenu && timerMenu.style.display === 'block' && !e.target.closest('.btn-more') && !e.target.closest('#timer-more-dropdown')) {
        timerMenu.style.display = 'none';
    }
    // 拦截 Challenge 的更多菜单：只要点击的不是“更多”按钮本身，也不是菜单内部，就立刻关闭
    const chalMenu = document.getElementById('chal-more-dropdown');
    if (chalMenu && chalMenu.style.display === 'block' && !e.target.closest('.chal-more-btn') && !e.target.closest('#chal-more-dropdown')) {
        chalMenu.style.display = 'none';
    }
});

// ============== 弹窗设置面板 ==============
function openChalSettingsModal(type) {
    document.getElementById('chal-more-dropdown').style.display = 'none';
    const titleEl = document.getElementById('chal-settings-title');
    const bodyEl = document.getElementById('chal-settings-body');
    const confirmBtn = document.getElementById('chal-settings-confirm');

    if (type === 'clear') {
        titleEl.innerText = '清空比分';
        bodyEl.innerHTML = '<p style="margin: 10px 0; color: var(--text-main); font-size: 15px; text-align: center;">是否确认清空当前比分？</p>';
        confirmBtn.onclick = () => {
            chalScoreTop = 0; chalScoreBottom = 0;
            // 核心修复：清空比分时重置所有状态
            chalHasWinner = false;
            matchPointShownTop = false;
            matchPointShownBottom = false;
            updateChallengeScores();
            closeChalSettings();
        };
    } else if (type === 'winScore') {
        titleEl.innerText = '设置胜利得分';
        bodyEl.innerHTML = `
            <div class="ios-setting-group" style="text-align: center;">
                <input type="number" id="chal-input-winscore" class="ios-input" value="${chalWinScore}" style="width: 120px; font-size: 24px; padding: 12px;">
            </div>`;
        confirmBtn.onclick = () => {
            let val = parseInt(document.getElementById('chal-input-winscore').value);
            if (!isNaN(val) && val > 0) chalWinScore = val;
            checkChalWinCondition();
            closeChalSettings();
        };
    } else if (type === 'adjust') {
        titleEl.innerText = '手动调整比分';
        bodyEl.innerHTML = `
            <div style="display: flex; justify-content: space-around; align-items: center; margin-top: 10px;">
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <label style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">上屏玩家</label>
                    <input type="number" id="chal-input-top" class="ios-input" value="${chalScoreTop}" style="width: 80px; font-size: 22px;">
                </div>
                <div style="font-size: 20px; font-weight: bold; color: var(--border-color);">:</div>
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <label style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">下屏玩家</label>
                    <input type="number" id="chal-input-bot" class="ios-input" value="${chalScoreBottom}" style="width: 80px; font-size: 22px;">
                </div>
            </div>`;
        confirmBtn.onclick = () => {
            let t = parseInt(document.getElementById('chal-input-top').value);
            let b = parseInt(document.getElementById('chal-input-bot').value);
            if (!isNaN(t) && t >= 0) chalScoreTop = t;
            if (!isNaN(b) && b >= 0) chalScoreBottom = b;
            updateChallengeScores();
            checkChalWinCondition();
            closeChalSettings();
        };
    }
    // 👇 从这里开始追加全新的字体调节模块 👇
    else if (type === 'font') {
        titleEl.innerText = '调整字体大小';
        let curScramble = uiSettings.chalScrambleSize || 100;
        let curTimer = uiSettings.chalTimerSize || 100;

        // 界面结构：复用了主界面的同款 UI 风格
        bodyEl.innerHTML = `
            <div style="margin-top: 10px;">
                <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px; text-align: left; font-weight: 600;">打乱公式</div>
                <div class="ui-slider-wrapper" style="width: 100%; margin-bottom: 20px;">
                    <span id="chal-scramble-size-val" style="width: 45px; text-align: left; font-family: monospace; font-size: 14px; color: var(--text-main);">${curScramble}%</span>
                    <input type="range" id="chal-scramble-size-slider" min="50" max="200" value="${curScramble}" oninput="document.getElementById('chal-scramble-size-val').innerText = this.value + '%'" style="flex: 1; accent-color: var(--primary-color); cursor: pointer;">
                </div>
                
                <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px; text-align: left; font-weight: 600;">计时器</div>
                <div class="ui-slider-wrapper" style="width: 100%;">
                    <span id="chal-timer-size-val" style="width: 45px; text-align: left; font-family: monospace; font-size: 14px; color: var(--text-main);">${curTimer}%</span>
                    <input type="range" id="chal-timer-size-slider" min="50" max="200" value="${curTimer}" oninput="document.getElementById('chal-timer-size-val').innerText = this.value + '%'" style="flex: 1; accent-color: var(--primary-color); cursor: pointer;">
                </div>
            </div>
        `;

        // 逻辑：点击确定后保存到全局设置，触发重新渲染，并存入本地数据库
        confirmBtn.onclick = () => {
            uiSettings.chalScrambleSize = parseInt(document.getElementById('chal-scramble-size-slider').value);
            uiSettings.chalTimerSize = parseInt(document.getElementById('chal-timer-size-slider').value);
            applyUiSettings();
            saveTimerData();
            closeChalSettings();
        };
    }
    document.getElementById('chal-settings-modal').style.display = 'flex';
}

function closeChalSettings() {
    document.getElementById('chal-settings-modal').style.display = 'none';
}

// ============== 赛点与胜利判定特效 (独立逻辑引擎) ==============
function checkChalWinCondition() {
    // 逻辑一：如果因为调比分退出了胜利线，恢复游戏状态
    if (chalScoreTop < chalWinScore && chalScoreBottom < chalWinScore) {
        chalHasWinner = false;
    }

    // 逻辑二：一旦有人获胜过，不再弹任何提示（哪怕另一方追上来）
    if (chalHasWinner) return;

    // 逻辑三：判定是否有人获胜
    if (chalScoreTop >= chalWinScore || chalScoreBottom >= chalWinScore) {
        chalHasWinner = true;
        let winner = chalScoreTop >= chalWinScore ? "上屏玩家" : "下屏玩家";
        showChalAlert('🎉', '比赛结束', `${winner} 获胜！`);
        return;
    }

    // 逻辑四：只要无人获胜，谁到了赛点（且没弹过），就弹一次赛点
    if (chalScoreTop === chalWinScore - 1 && !matchPointShownTop) {
        matchPointShownTop = true;
        showChalAlert('✨', '赛 点', `上屏玩家距离胜利仅差一分`);
    } else if (chalScoreTop < chalWinScore - 1) {
        matchPointShownTop = false; // 分数掉下去后解冻，允许下次再触发
    }

    if (chalScoreBottom === chalWinScore - 1 && !matchPointShownBottom) {
        matchPointShownBottom = true;
        showChalAlert('✨', '赛 点', `下屏玩家距离胜利仅差一分`);
    } else if (chalScoreBottom < chalWinScore - 1) {
        matchPointShownBottom = false;
    }
}

function showChalAlert(icon, title, desc) {
    document.getElementById('chal-alert-icon').innerText = icon;
    document.getElementById('chal-alert-title').innerText = title;
    document.getElementById('chal-alert-desc').innerText = desc;
    const modal = document.getElementById('chal-alert-modal');

    // 移除可能残留的消失动画，确保卡片能正常弹出
    modal.classList.remove('popup-fade-out');
    modal.style.display = 'flex';

    clearTimeout(chalAlertTimer);
    chalAlertTimer = setTimeout(() => {
        closeChalAlert();
    }, 3000);
}

function closeChalAlert() {
    const modal = document.getElementById('chal-alert-modal');
    if (modal.style.display === 'none') return;

    // 增加消失动画类名，延迟 200 毫秒后再真正隐藏元素
    modal.classList.add('popup-fade-out');
    clearTimeout(chalAlertTimer);

    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('popup-fade-out');
    }, 200);
}

// ============== 项目选择悬浮窗逻辑 ==============
let chalTempEvent = '333'; // 新增：用于暂存点击选中、但还未确定的项目

function openChalEventPopup() {
    document.getElementById('chal-more-dropdown').style.display = 'none';
    chalTempEvent = chalCurrentEvent; // 每次打开时，将暂存值同步为当前真实项目
    renderChalEventGrid();

    const popup = document.getElementById('chal-event-popup');
    popup.classList.remove('popup-fade-out');
    popup.style.display = 'flex';
}

// 抽离出的独立渲染函数，只管渲染高亮，不碰真实的打乱和计分板
function renderChalEventGrid() {
    const grid = document.getElementById('chal-event-grid');
    grid.innerHTML = '';
    const excludedEvents = ['magic', 'mmagic', '333ft', 'mbf', '333mbf', '333fm'];

    eventDict.forEach(ev => {
        if (!excludedEvents.includes(ev.id)) {
            let isActive = chalTempEvent === ev.id ? 'active' : '';
            let btn = document.createElement('div');
            btn.className = `chal-event-item ${isActive}`;
            btn.innerHTML = `<span class="cubing-icon event-${ev.id}" style="font-size: 24px; display:block; margin-bottom:5px;"></span><span style="font-size:12px; font-weight:600;">${ev.name}</span>`;

            // 点击时只更新暂存变量，并刷新界面的高亮效果，坚决不触发真正的数据变更
            btn.onclick = () => {
                chalTempEvent = ev.id;
                renderChalEventGrid();
            };
            grid.appendChild(btn);
        }
    });
}

// 点击“确定”按钮时执行的终极确认函数
function confirmChalEvent() {
    // 只有当用户确实换了新项目时，才触发清零和打乱
    if (chalTempEvent !== chalCurrentEvent) {
        if (chalScoreTop > 0 || chalScoreBottom > 0) {
            chalScoreTop = 0;
            chalScoreBottom = 0;
            chalHasWinner = false;
            matchPointShownTop = false;
            matchPointShownBottom = false;
            updateChallengeScores();
        }

        chalCurrentEvent = chalTempEvent;

        // 从字典中取出全名
        let evObj = eventDict.find(e => e.id === chalCurrentEvent);
        let evName = evObj ? evObj.name : '未知';

        document.getElementById('chal-event-icon').className = `cubing-icon event-${chalCurrentEvent}`;
        document.getElementById('chal-event-name').innerText = evName;
        generateChallengeScramble();
    }

    // 执行完毕后关闭弹窗
    closeChalEventPopup();
}

function closeChalEventPopup(e) {
    if (e && e.target.id !== 'chal-event-popup') return;
    const popup = document.getElementById('chal-event-popup');
    if (popup.style.display === 'none') return;

    popup.classList.add('popup-fade-out');
    setTimeout(() => {
        popup.style.display = 'none';
        popup.classList.remove('popup-fade-out');
    }, 200);
}

// ============== 计时核心逻辑 ==============
function handleChalPress(player) {
    // 核心新增：如果“更多”菜单在开着，强制拦截触摸/点击，必须关了才能按计时器
    const chalMore = document.getElementById('chal-more-dropdown');
    if (chalMore && chalMore.style.display === 'block') return;

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

    if (player === 'top') {
        chalTopPressed = true;
        const topEl = document.getElementById('challenge-timer-top');
        topEl.classList.add('waiting');
        topEl.classList.remove('ready');
    }
    if (player === 'bottom') {
        chalBottomPressed = true;
        const botEl = document.getElementById('challenge-timer-bottom');
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
        generateChallengeScramble();
        checkChalWinCondition();
    }
}

/* ================= 触屏与鼠标事件绑定 ================= */
const isChalActive = () => document.querySelector('.page-container.active')?.id === 'challenge-page';

document.addEventListener('touchstart', (e) => {
    if (!isChalActive()) return;
    if (e.target.closest('.global-nav-header')) return; // <--- 新增这行，放行顶部导航栏！
    if (e.target.closest('#chal-event-popup') || e.target.closest('#chal-settings-modal') || e.target.closest('#chal-alert-modal') || e.target.closest('.challenge-divider')) return;
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
    if (!isChalActive()) return;
    if (e.target.closest('.global-nav-header')) return; // <--- 新增这行，放行顶部导航栏！
    if (e.target.closest('#chal-event-popup') || e.target.closest('#chal-settings-modal') || e.target.closest('#chal-alert-modal') || e.target.closest('.challenge-divider')) return;

    if (e.target.closest('#challenge-top-area')) handleChalPress('top');
    if (e.target.closest('#challenge-bottom-area')) handleChalPress('bottom');
});

document.addEventListener('mouseup', (e) => {
    if (!isChalActive()) return;
    if (e.target.closest('#challenge-top-area')) handleChalRelease('top');
    if (e.target.closest('#challenge-bottom-area')) handleChalRelease('bottom');
});

/* ================= 键盘事件绑定 ================= */
const topKeys = ['w', 'a', 's', 'd'];
const bottomKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

document.addEventListener('keydown', (e) => {
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

// ================= 本地数据持久化引擎 =================
function loadTimerData() {
    try {
        const saved = localStorage.getItem('nbTimerConfig');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.history) timerHistoryData = parsed.history;
            if (parsed.stat1) stat1 = parsed.stat1;
            if (parsed.stat2) stat2 = parsed.stat2;
            if (parsed.uiSettings) uiSettings = { ...uiSettings, ...parsed.uiSettings };

            document.getElementById('input-stat1-count').value = stat1.count;
            document.getElementById('input-stat2-count').value = stat2.count;

            ['ao', 'mo'].forEach(type => {
                document.getElementById(`btn-stat1-${type}`).classList.remove('active');
                document.getElementById(`btn-stat2-${type}`).classList.remove('active');
            });
            document.getElementById(`btn-stat1-${stat1.type}`).classList.add('active');
            document.getElementById(`btn-stat2-${stat2.type}`).classList.add('active');
        }
    } catch (e) { console.warn("读取本地历史数据失败", e); }

    // 👇 绝对强制令：无论本地存了什么，所有人都必须用商务版！
    uiSettings.homeLayout = 'business';

    // 核心防御：包裹 UI 设置，就算报错也绝不中断网页启动
    try { applyUiSettings(); } catch(e) { console.warn("UI配置应用失败", e); }
}

function saveTimerData() {
    try {
        for (let ev in timerHistoryData) {
            if (timerHistoryData[ev].length > 10000) {
                timerHistoryData[ev] = timerHistoryData[ev].slice(0, 10000);
            }
        }
        const dataToSave = {
            history: timerHistoryData,
            stat1: stat1,
            stat2: stat2,
            uiSettings: uiSettings
        };
        localStorage.setItem('nbTimerConfig', JSON.stringify(dataToSave));
    } catch (e) { console.warn("本地存储已满", e); }
}

// ================= 新增：界面设置交互引擎 =================
function applyUiSettings() {

    // 👇 新增：每次应用 UI 设置时，同步更新 Challenge 的缩放参数 👇
    let scScale = (uiSettings.chalScrambleSize || 100) / 100;
    let tmScale = (uiSettings.chalTimerSize || 100) / 100;
    document.documentElement.style.setProperty('--chal-scramble-scale', scScale);
    document.documentElement.style.setProperty('--chal-timer-scale', tmScale);
    // 👆 新增结束 👆

    let fontObj = fontOptions.find(f => f.id === uiSettings.font) || fontOptions[0];
    document.documentElement.style.setProperty('--timer-font', fontObj.family);

    let fontNameEl = document.getElementById('current-font-name');
    if (fontNameEl) fontNameEl.innerText = fontObj.name.split(' ')[0];

    document.documentElement.style.setProperty('--timer-font-scale', uiSettings.fontSize / 100);

    let sliderEl = document.getElementById('font-size-slider');
    if (sliderEl) sliderEl.value = uiSettings.fontSize;

    let sliderValEl = document.getElementById('font-size-val');
    if (sliderValEl) sliderValEl.innerText = uiSettings.fontSize + '%';

    // 👇 核心新增：渲染并应用打乱公式的大小 👇
    document.documentElement.style.setProperty('--scramble-font-scale', uiSettings.scrambleSize / 100);
    let scrambleSliderEl = document.getElementById('scramble-size-slider');
    if (scrambleSliderEl) scrambleSliderEl.value = uiSettings.scrambleSize;
    let scrambleValEl = document.getElementById('scramble-size-val');
    if (scrambleValEl) scrambleValEl.innerText = uiSettings.scrambleSize + '%';
    // 👆 新增结束 👆

    document.documentElement.style.setProperty('--pb-single-color', uiSettings.colorSingle);
    document.documentElement.style.setProperty('--pb-avg-color', uiSettings.colorAvg);

    let singleDisp = document.getElementById('color-single-display');
    if (singleDisp) singleDisp.style.background = uiSettings.colorSingle;

    let singleHex = document.getElementById('color-single-hex');
    if (singleHex) singleHex.value = uiSettings.colorSingle.toUpperCase();

    let avgDisp = document.getElementById('color-avg-display');
    if (avgDisp) avgDisp.style.background = uiSettings.colorAvg;

    let avgHex = document.getElementById('color-avg-hex');
    if (avgHex) avgHex.value = uiSettings.colorAvg.toUpperCase();

    // 控制全局设置页面的排版滑动开关状态
    let btnSimpleGlobal = document.getElementById('btn-layout-simple-global');
    let btn3dGlobal = document.getElementById('btn-layout-3d-global');

    if (btnSimpleGlobal && btn3dGlobal) {
        btnSimpleGlobal.classList.toggle('active', uiSettings.homeLayout === 'business');
        btn3dGlobal.classList.toggle('active', uiSettings.homeLayout === '3d');
    }

    // --- 👇直接在这里追加：读取并显示用户名和 WCA ID ---
    let userEl = document.getElementById('setting-username');
    if (userEl) userEl.value = uiSettings.username || '';

    let wcaEl = document.getElementById('setting-wcaid');
    if (wcaEl) wcaEl.value = uiSettings.wcaId || '';

    // 👇 核心新增：渲染每次成绩确认开关 👇
    let btnPromptNo = document.getElementById('btn-prompt-no');
    let btnPromptYes = document.getElementById('btn-prompt-yes');
    if (btnPromptNo && btnPromptYes) {
        btnPromptNo.classList.toggle('active', !uiSettings.promptAction);
        btnPromptYes.classList.toggle('active', !!uiSettings.promptAction);
    }
}

function openFontModal() {
    const list = document.getElementById('font-options-list');
    list.innerHTML = '';
    fontOptions.forEach(f => {
        let btn = document.createElement('div');
        btn.className = `chal-event-item ${uiSettings.font === f.id ? 'active' : ''}`;
        btn.style.flexDirection = 'row';
        btn.style.padding = '14px 15px';
        btn.innerHTML = `<span style="font-family: ${f.family}; font-size: 16px;">${f.name}</span>`;
        btn.onclick = () => {
            uiSettings.font = f.id;
            saveTimerData();
            applyUiSettings();
            closeFontModal();
        };
        list.appendChild(btn);
    });
    document.getElementById('font-select-modal').style.display = 'flex';
}

function closeFontModal(e) {
    if (e && e.target.id !== 'font-select-modal') return;
    document.getElementById('font-select-modal').style.display = 'none';
}

function updateFontSize(val) {
    uiSettings.fontSize = parseInt(val);
    applyUiSettings();
    saveTimerData();
}

// 👇 核心新增：控制打乱字体的函数 👇
function updateScrambleSize(val) {
    uiSettings.scrambleSize = parseInt(val);
    applyUiSettings();
    saveTimerData(); // 自动保存到本地，下次打开仍然生效
}

// 👇 核心新增：控制提示选项的函数 👇
function setPromptAction(val) {
    uiSettings.promptAction = val;
    applyUiSettings();
    saveTimerData();
}

function updateColor(type, val) {
    let hex = val.startsWith('#') ? val : '#' + val;
    if (!/^#[0-9A-Fa-f]{6}$/i.test(hex)) {
        if (hex.length === 7) return;
    } else {
        if (type === 'single') uiSettings.colorSingle = hex;
        else uiSettings.colorAvg = hex;
        applyUiSettings();
        saveTimerData();
    }
}

// ---- 专属颜色卡片逻辑 ----
let currentColorTarget = 'single';

function openColorModal(type) {
    currentColorTarget = type;
    document.getElementById('color-modal-title').innerText = type === 'single' ? '选择颜色：最快单次' : '选择颜色：最快平均';

    // 初始化同步显示当前的十六进制文本与原生调色盘底色
    let currentColor = type === 'single' ? uiSettings.colorSingle : uiSettings.colorAvg;
    document.getElementById('custom-color-btn-text').innerText = currentColor.toUpperCase();
    document.getElementById('native-color-picker').value = currentColor;

    const popup = document.getElementById('color-picker-modal');
    popup.classList.remove('popup-fade-out');
    popup.style.display = 'flex';
}

function closeColorModal(e) {
    if (e && e.target.id !== 'color-picker-modal') return;
    const popup = document.getElementById('color-picker-modal');
    if (popup.style.display === 'none') return;
    popup.classList.add('popup-fade-out');
    setTimeout(() => { popup.style.display = 'none'; popup.classList.remove('popup-fade-out'); }, 200);
}

// 修复：剥离了导致报错的不存在的 input 元素
function applyQuickColor(hex) {
    document.getElementById('custom-color-btn-text').innerText = hex.toUpperCase();
    if (currentColorTarget === 'single') uiSettings.colorSingle = hex;
    else uiSettings.colorAvg = hex;
    applyUiSettings();
    saveTimerData();
    closeColorModal();
}

function applyNativeColor(hex) {
    document.getElementById('custom-color-btn-text').innerText = hex.toUpperCase();
    if (currentColorTarget === 'single') uiSettings.colorSingle = hex;
    else uiSettings.colorAvg = hex;
    applyUiSettings();
    saveTimerData();
}

// ================= 新增：3D 首页排版与交互逻辑 =================
function setHomeLayout(layout) {
    uiSettings.homeLayout = layout;
    applyUiSettings();
    saveTimerData();
    // 如果当前正在主页，则瞬间切换排版
    const activePage = document.querySelector('.page-container.active');
    if (activePage && (activePage.id === 'home-page' || activePage.id === 'home-page-3d')) {
        goHome();
    }
}

// 升级为 3 状态机 (0: 基础模块, 1: 计时与挑战, 2: 全局设置)
let cubeState = 0;
let isCubeAnimating = false;

function handleCubeClick(face) {
    if (isCubeAnimating) return;

    if (cubeState === 0) {
        if (face === 'top') { navigateTo('ranking-page'); }
        if (face === 'front') { navigateTo('records-page'); generateRecords(); }
        if (face === 'right') { openSearchPage(); }
    } else if (cubeState === 1) {
        if (face === 'top') { initMonthly(); }
        if (face === 'front') { navigateTo('timer-page'); initTimer(); }
        if (face === 'right') { initChallenge(); navigateTo('challenge-page'); }
    } else if (cubeState === 2) {
        navigateTo('settings-page'); // 3个面统一进入设置
    }
}

// 支持左划/右划判断，并兼容入场动画调用
function triggerCubeSpin(direction = 'right', isEntryAnim = false) {
    // 兼容之前只传了一个 boolean 值的入场动画代码
    if (typeof direction === 'boolean') {
        isEntryAnim = direction;
        direction = 'right';
    }

    if (isCubeAnimating) return;
    isCubeAnimating = true;
    const cube = document.getElementById('home-cube');
    const scene = document.getElementById('scene-container');

    cube.classList.remove('spinning-right', 'spinning-left', 'spinning');
    if (scene) scene.classList.remove('spinning-blur');
    void cube.offsetWidth;

    // 根据滑动方向赋予不同的动画类名
    if (direction === 'left') {
        cube.classList.add('spinning-left');
    } else {
        cube.classList.add('spinning-right');
    }

    if (scene) scene.classList.add('spinning-blur');

    if (!isEntryAnim) {
        setTimeout(() => {
            // 核心修复：顺应标准的轮播交互直觉
            // 向左滑 (看下一页) -> 状态 +1
            // 向右滑 (看上一页) -> 状态 +2 (等同于-1)
            if (direction === 'left') {
                cubeState = (cubeState + 1) % 3;
            } else {
                cubeState = (cubeState + 2) % 3;
            }

            const elTop = document.getElementById('cube-face-top');
            const elFront = document.getElementById('cube-face-front');
            const elRight = document.getElementById('cube-face-right');

            if (cubeState === 0) {
                elTop.innerText = '成绩排行榜';
                elFront.innerText = '宁波纪录';
                elRight.innerText = '成绩查询 · PK';
            } else if (cubeState === 1) {
                elTop.innerText = '巅峰月赛';
                elFront.innerText = 'NB Timer';
                elRight.innerText = 'NB Challenge';
            } else if (cubeState === 2) {
                elTop.innerText = '设置';
                elFront.innerText = '设置';
                elRight.innerText = '设置';
            }
        }, 350);
    }

    // 核心修复：在 700ms 动画播放完毕后，彻底剥离动画类名
    setTimeout(() => {
        isCubeAnimating = false;

        // 扒掉类名，让魔方瞬间切回静止的 -45 度（与旋转终点视觉完美重合），杜绝 display 切换时的二次重播
        if (cube) cube.classList.remove('spinning-right', 'spinning-left', 'spinning');
        if (scene) scene.classList.remove('spinning-blur');
    }, 700);
}

// 全局滑动侦测升级 (加入正负方向判断)
let cubeStartX = 0;
document.addEventListener('touchstart', (e) => {
    const activePage = document.querySelector('.page-container.active');
    if (activePage && activePage.id === 'home-page-3d') { cubeStartX = e.changedTouches[0].screenX; }
}, {passive: false});

document.addEventListener('touchend', (e) => {
    const activePage = document.querySelector('.page-container.active');
    if (activePage && activePage.id === 'home-page-3d') {
        let delta = e.changedTouches[0].screenX - cubeStartX;
        if (delta > 50) triggerCubeSpin('right');
        else if (delta < -50) triggerCubeSpin('left');
    }
});

document.addEventListener('mousedown', (e) => {
    const activePage = document.querySelector('.page-container.active');
    if (activePage && activePage.id === 'home-page-3d') { cubeStartX = e.clientX; }
});

document.addEventListener('mouseup', (e) => {
    const activePage = document.querySelector('.page-container.active');
    if (activePage && activePage.id === 'home-page-3d') {
        let delta = e.clientX - cubeStartX;
        if (delta > 80) triggerCubeSpin('right');
        else if (delta < -80) triggerCubeSpin('left');
    }
});

// ================= 用户名与 WCA ID 保存引擎 =================
function saveUsername(val) {
    uiSettings.username = val.trim();
    saveTimerData();
}

function saveWcaId(val) {
    uiSettings.wcaId = val.trim().toUpperCase();
    saveTimerData();
    // 失去焦点时自动变成大写并刷新显示
    let wcaEl = document.getElementById('setting-wcaid');
    if (wcaEl) wcaEl.value = uiSettings.wcaId;
}

// ================= 巅峰月赛渲染引擎 =================

// =========================================
// 巅峰月赛底层数据引擎与计时逻辑
// =========================================
let currentMonthlyEventTarget = '';
let currentMonthlyEventName = '';
let monthlyTimerState = 'IDLE';
let monthlyHoldTimeout = null;
let monthlyStartTime = 0;
let monthlyAnimFrame = null;
let monthlyAttempts = [];
let monthlyHasFinished = false;
let currentMonthlyRawMs = 0;
let currentMonthlyPen = '';
let monthlyFinishTimer = null;

function getCurrentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}_${now.getMonth() + 1}`;
}

// 👇 核心新增：标准的 ISO 国际周数计算引擎 👇
function getCurrentWeekKey() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}_W${weekNo}`;
}

function getEventFormat(evId) {
    if (['666', '777', '333bf', '444bf', '555bf', '333fm'].includes(evId)) return { count: 3 };
    return { count: 5 };
}

// 👇 将以下三个函数的密钥从 MonthKey 改为 WeekKey，释放每周刷榜限制 👇
function getMonthlyAttempts(eventId) {
    let data = JSON.parse(localStorage.getItem('monthlyParticipation') || '{}');
    let key = getCurrentWeekKey(); // 替换为 WeekKey
    return data[key] ? data[key][eventId] : null;
}

function markMonthlyParticipated(eventId, attemptsArr) {
    let data = JSON.parse(localStorage.getItem('monthlyParticipation') || '{}');
    let key = getCurrentWeekKey(); // 替换为 WeekKey
    if (!data[key]) data[key] = {};
    data[key][eventId] = attemptsArr || 'DNF';
    localStorage.setItem('monthlyParticipation', JSON.stringify(data));
}

function ensureMonthlyScrambles() {
    const key = 'monthlyScrambles_' + getCurrentWeekKey();
    let cached = localStorage.getItem(key);
    if (cached) return JSON.parse(cached);

    let generated = {};
    const excludedEvents = ['magic', 'mmagic', '333ft', 'mbf', '333mbf', '333fm'];
    eventDict.forEach(ev => {
        if (!excludedEvents.includes(ev.id)) {
            let format = getEventFormat(ev.id);
            let scrs = [];
            for (let i = 0; i < format.count; i++) scrs.push(getScrambleByEvent(ev.id));
            generated[ev.id] = scrs;
        }
    });
    localStorage.setItem(key, JSON.stringify(generated));
    return generated;
}

// ---------------- 成绩解析与智能格式化引擎 ----------------
function processMonthlyResults(attemptsData, evId) {
    let format = getEventFormat(evId);
    let isBlind = ['333bf', '444bf', '555bf'].includes(evId);

    if (!Array.isArray(attemptsData)) {
        return { avgDisp: 'DNF (未完赛)', detailsStr: 'DNS', sortAvgMs: Infinity, sortSingleMs: Infinity };
    }

    let formattedList = attemptsData.map(a => {
        if (a.penalty === 'DNS') return { disp: 'DNS', ms: Infinity };
        if (a.penalty === 'DNF') return { disp: 'DNF', ms: Infinity };
        let ms = a.penalty === '+2' ? a.rawMs + 2000 : a.rawMs;
        return { disp: formatTimerOutput(ms) + (a.penalty === '+2' ? '+' : ''), ms };
    });

    let dnfOrDnsCount = attemptsData.filter(a => a.penalty === 'DNF' || a.penalty === 'DNS').length;
    let isUnfinished = attemptsData.some(a => a.penalty === 'DNS');

    let avgDisp = 'DNF';
    let sortAvgMs = Infinity;
    let sortSingleMs = Math.min(...formattedList.map(a => a.ms));

    if (isBlind) {
        if (sortSingleMs === Infinity) {
            avgDisp = isUnfinished ? 'DNF (未完赛)' : 'DNF';
        } else {
            avgDisp = formatTimerOutput(sortSingleMs);
        }
        sortAvgMs = sortSingleMs;
    } else if (format.count === 3) {
        if (dnfOrDnsCount > 0) {
            avgDisp = isUnfinished ? 'DNF (未完赛)' : 'DNF';
        } else {
            let sum = formattedList.reduce((acc, a) => acc + a.ms, 0);
            sortAvgMs = Math.floor(sum / 3);
            avgDisp = formatTimerOutput(sortAvgMs);
        }
    } else if (format.count === 5) {
        if (dnfOrDnsCount > 1) {
            avgDisp = isUnfinished ? 'DNF (未完赛)' : 'DNF';
        } else {
            let validMs = formattedList.map(a => a.ms).sort((a,b) => a-b);
            let sum = 0;
            for (let i = 1; i < 4; i++) sum += validMs[i];
            sortAvgMs = Math.floor(sum / 3);
            avgDisp = formatTimerOutput(sortAvgMs);
        }
    }

    let bestMs = sortSingleMs;
    let worstMs = Math.max(...formattedList.map(a => a.ms));
    let bestMarked = false; let worstMarked = false;

    let detailsStr = formattedList.map(a => {
        let s = a.disp;
        // 核心修改：只有在计算得出有效平均成绩的前提下，才给最好最慢加上括号
        if (format.count === 5 && sortAvgMs !== Infinity) {
            if (a.ms === worstMs && !worstMarked) { s = `(${s})`; worstMarked = true; }
            else if (a.ms === bestMs && !bestMarked) { s = `(${s})`; bestMarked = true; }
        }
        return s;
    }).join(' ');

    return { avgDisp, detailsStr, sortAvgMs, sortSingleMs };
}

// ---------------- 身份验证与路由分发 ----------------
function initMonthly() {
    if (!uiSettings.username) {
        document.getElementById('monthly-input-name').value = '';
        document.getElementById('monthly-input-wcaid').value = '';
        document.getElementById('monthly-name-modal').style.display = 'flex';
    } else {
        renderMonthlyList();
        // 如果是从 3D 首页进来的，此处不加 true，确保不污染返回栈
        navigateTo('monthly-page');
    }
}

function cancelMonthlyName() {
    document.getElementById('monthly-name-modal').style.display = 'none';
    goBack();
}

function confirmMonthlyName() {
    const nameEl = document.getElementById('monthly-input-name');
    const wcaEl = document.getElementById('monthly-input-wcaid');
    const nameVal = nameEl.value.trim();

    if (nameEl.dataset.error === 'true' || !nameVal) {
        nameEl.dataset.error = 'true';
        nameEl.value = '不可输入空白用户名';
        nameEl.style.color = '#e63946';
        return;
    }

    uiSettings.username = nameVal;
    uiSettings.wcaId = wcaEl.value.trim().toUpperCase();
    saveTimerData();
    applyUiSettings();

    document.getElementById('monthly-name-modal').style.display = 'none';
    renderMonthlyList();
    navigateTo('monthly-page');
}

// ---------------- 巅峰月赛 列表主页渲染引擎 (异步秒开版) ----------------
async function renderMonthlyList() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    document.getElementById('monthly-date-range').innerText = `${month}.01 - ${month}.${lastDay}`;

    const list = document.getElementById('monthly-event-list');
    list.innerHTML = ''; // 取消转圈动画，瞬间清空

    ensureMonthlyScrambles();
    const excludedEvents = ['magic', 'mmagic', '333ft', 'mbf', '333mbf', '333fm'];
    const validEvents = eventDict.filter(ev => !excludedEvents.includes(ev.id));

    // 第一步：瞬间把 UI 画出来，人数暂留占位符 [...]
    validEvents.forEach(ev => {
        let cnName = ev.name.split('（')[0].split('(')[0].trim();
        let attemptsData = getMonthlyAttempts(ev.id);

        // 预留排名的 span，给它一个专属 ID 方便等下填入数据
        let rankHtml = `<span id="monthly-rank-${ev.id}" style="font-size: 13.5px; color: var(--text-muted); font-weight: normal; margin-left: 10px; font-family: 'SFMono-Regular', Consolas, monospace;">[...]</span>`;

        let btnAction = `event.stopPropagation(); openMonthlyEntry('${ev.id}', '${cnName}')`;
        let resultHtml = `<button class="btn btn-outline monthly-btn" onclick="${btnAction}">参加</button>`;

        if (attemptsData) {
            let res = processMonthlyResults(attemptsData, ev.id);
            btnAction = `event.stopPropagation(); alert('您已完成或中途退出了本周该项目的比赛，无法再次进入！')`;

            resultHtml = `
                <div style="display: flex; flex-direction: column; align-items: flex-end; line-height: 1.3;">
                    <div style="font-size: 16px; font-weight: bold; color: var(--primary-color);">${res.avgDisp}</div>
                    <div style="font-size: 13px; color: var(--text-muted); font-family: 'SFMono-Regular', Consolas, monospace; margin-top: 2px;">${res.detailsStr}</div>
                </div>
            `;
        }

        let row = document.createElement('div');
        row.className = 'monthly-event-row';
        row.style.cursor = 'pointer';
        row.onclick = () => { openMonthlyRanking(ev.id, cnName); };

        row.innerHTML = `
            <div style="display: flex; align-items: center; font-size: 16px; font-weight: bold; color: var(--text-main);">
                <span class="cubing-icon event-${ev.id}" style="font-size: 24px; color: var(--primary-color); margin-right: 12px;"></span>
                <span>${cnName}</span>
                ${rankHtml}
            </div>
            ${resultHtml}
        `;
        list.appendChild(row);
    });

    // 第二步：后台静默拉取云端数据，不阻塞页面交互
    try {
        const { data, error } = await supabaseClient.from('WeeklyRecord').select('event_id, wca_id, username, raw_ms');
        if (!error && data) {
            let eventLeaderboards = {};
            data.forEach(row => {
                if (!eventLeaderboards[row.event_id]) eventLeaderboards[row.event_id] = [];
                eventLeaderboards[row.event_id].push(row);
            });

            // 数据回来后，悄悄把每个项目的人数填进去
            validEvents.forEach(ev => {
                let cloudData = eventLeaderboards[ev.id] || [];
                let attemptsData = getMonthlyAttempts(ev.id);

                if (attemptsData) {
                    let res = processMonthlyResults(attemptsData, ev.id);
                    cloudData.push({
                        username: uiSettings.username,
                        wca_id: uiSettings.wcaId || '',
                        raw_ms: res.sortAvgMs === Infinity ? 99999999 : res.sortAvgMs
                    });
                }

                let userMap = {};
                cloudData.forEach(entry => {
                    let key = entry.wca_id ? entry.wca_id.toUpperCase() : entry.username;
                    if (!userMap[key] || entry.raw_ms < userMap[key].raw_ms) userMap[key] = entry;
                });

                let finalEntries = Object.values(userMap);
                finalEntries.sort((a, b) => a.raw_ms - b.raw_ms);

                let totalParticipants = finalEntries.length;
                let myRank = -1;

                if (uiSettings.username) {
                    let myKey1 = uiSettings.wcaId ? uiSettings.wcaId.toUpperCase() : null;
                    let myKey2 = uiSettings.username;
                    for (let i = 0; i < finalEntries.length; i++) {
                        let entry = finalEntries[i];
                        let entryKey = entry.wca_id ? entry.wca_id.toUpperCase() : entry.username;
                        if ((myKey1 && entryKey === myKey1) || (!myKey1 && entryKey === myKey2)) {
                            myRank = i + 1; break;
                        }
                    }
                }

                let rankEl = document.getElementById(`monthly-rank-${ev.id}`);
                if (rankEl) {
                    if (totalParticipants > 0) {
                        rankEl.innerText = myRank !== -1 ? `[${myRank}/${totalParticipants}]` : `[${totalParticipants}]`;
                    } else {
                        rankEl.innerText = '';
                    }
                }
            });
        }
    } catch (e) {
        console.warn("后台拉取云端统计数据失败", e);
    }
}

// ---------------- 巅峰月赛 排行榜渲染引擎 (核心升级：直连全网云端) ----------------
async function openMonthlyRanking(evId, cnName) {
    document.getElementById('monthly-ranking-title').innerText = `月赛排行榜 - ${cnName}`;
    const list = document.getElementById('monthly-ranking-list');

    list.innerHTML = '<div style="padding: 40px 20px; text-align: center; color: var(--text-muted); font-size: 14px;"><div class="spinner" style="margin: 0 auto 15px auto; width: 30px; height: 30px; border-width: 3px;"></div>数据同步中...</div>';
    navigateTo('monthly-ranking-page', true);

    let cloudData = await fetchWeeklyLeaderboard(evId);
    let allEntries = [];

    // 把本地的最新的这一组成绩也临时加进来一起比对
    let attemptsData = getMonthlyAttempts(evId);
    if (attemptsData) {
        let res = processMonthlyResults(attemptsData, evId);
        allEntries.push({
            username: uiSettings.username,
            wca_id: uiSettings.wcaId || '',
            details: res.detailsStr,
            raw_ms: res.sortAvgMs === Infinity ? 99999999 : res.sortAvgMs,
            sortSingleMs: res.sortSingleMs
        });
    }

    if (cloudData && cloudData.length > 0) {
        allEntries = allEntries.concat(cloudData);
    }

    // 核心新增：基于 WCA ID 或 用户名 进行智能去重，同一个选手只取他最好的一次成绩
    let userMap = {};
    allEntries.forEach(entry => {
        let key = entry.wca_id ? entry.wca_id.toUpperCase() : entry.username;
        if (!userMap[key] || entry.raw_ms < userMap[key].raw_ms) {
            userMap[key] = entry;
        }
    });

    let finalEntries = Object.values(userMap);

    if (finalEntries.length === 0) {
        list.innerHTML = '<div style="padding: 40px 20px; text-align: center; color: var(--text-muted); font-size: 15px;">本月全网暂无成绩</div>';
        return;
    }

    // 重新排序
    finalEntries.sort((a, b) => {
        if (a.raw_ms !== b.raw_ms) return a.raw_ms - b.raw_ms;
        return (a.sortSingleMs || Infinity) - (b.sortSingleMs || Infinity);
    });

    list.innerHTML = '';

    finalEntries.forEach((entry, index) => {
        let row = document.createElement('div');
        row.className = 'monthly-event-row';
        row.style.cursor = 'default';

        let finalTimeDisp = entry.raw_ms >= 99999999 ? 'DNF' : formatTimerOutput(entry.raw_ms);

        // 核心新增：无痕点击跳转交互判定
        let clickStyle = entry.wca_id ? 'cursor: pointer;' : '';
        let clickAction = entry.wca_id ? `onclick="handleMonthlyRankingClick('${entry.wca_id}')"` : '';

        let userDisplay = entry.wca_id
            ? `${entry.username}<br><span style="font-size:12px; color:var(--text-muted); font-weight:normal;">${entry.wca_id}</span>`
            : `${entry.username}`;

        row.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <span style="font-size: 18px; font-weight: bold; color: var(--text-muted); width: 24px; text-align: center;">${index + 1}</span>
                <div style="font-size: 15px; font-weight: bold; color: var(--text-main); line-height: 1.3; ${clickStyle}" ${clickAction}>
                    ${userDisplay}
                </div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; line-height: 1.3;">
                <div style="font-size: 16px; font-weight: bold; color: var(--primary-color);">${finalTimeDisp}</div>
                <div style="font-size: 13px; color: var(--text-muted); font-family: 'SFMono-Regular', Consolas, monospace; margin-top: 2px;">${entry.details}</div>
            </div>
        `;
        list.appendChild(row);
    });
}

// ---------------- 巅峰月赛 个人主页跳转与校验引擎 ----------------
let wcaidCheckTimer = null;

async function handleMonthlyRankingClick(wcaId) {
    if (!wcaId) return;

    // 1. 弹出专属卡片，展示“载入中”状态
    const modal = document.getElementById('wcaid-check-modal');
    const spinner = document.getElementById('wcaid-check-spinner');
    const textEl = document.getElementById('wcaid-check-text');

    clearTimeout(wcaidCheckTimer);
    modal.classList.remove('popup-fade-out');
    modal.style.display = 'flex';

    // 初始化卡片为加载状态
    spinner.style.display = 'block';
    textEl.innerText = '载入中...';
    textEl.style.color = 'var(--text-main)';

    let player = null;
    // 2. 本地全量库内秒查
    let exact = allCubersData.find(c => c && c.person && c.person.wca_id.toUpperCase() === wcaId.toUpperCase());

    if (exact) {
        player = exact;
    } else {
        // 3. 本地查无此人，静默去 WCA 官方库捞数据
        try {
            let res = await fetch(`https://www.worldcubeassociation.org/api/v0/persons/${wcaId.toUpperCase()}`);
            if (res.ok) player = await res.json();
        } catch(e) {}
    }

    if (player) {
        // 4. 找到数据，直接隐藏卡片并跳转
        modal.style.display = 'none';
        addSearchHistory(player);
        renderPersonPage(player);
    } else {
        // 5. 查无此人，卡片就地无缝变身错误提示
        spinner.style.display = 'none'; // 隐藏转圈动画
        textEl.innerText = 'WCA ID 不存在';
        textEl.style.color = 'var(--text-main)'; // 保持和“载入中”同款的高级灰黑底色

        // 3秒后自动解封关闭
        wcaidCheckTimer = setTimeout(() => {
            closeWcaidCheckModal();
        }, 3000);
    }
}

function closeWcaidCheckModal(e) {
    if (e) {
        // 绝对防御：强行吃掉所有的点击穿透事件，确保不会误点到下面的其他选手
        e.stopPropagation();
        e.preventDefault();
    }
    const modal = document.getElementById('wcaid-check-modal');
    if (modal.style.display === 'none') return;

    modal.classList.add('popup-fade-out');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('popup-fade-out');
    }, 200);
}

// ---------------- 弹窗与进出控制 ----------------
function openMonthlyEntry(evId, cnName) {
    currentMonthlyEventTarget = evId;
    currentMonthlyEventName = cnName;
    document.getElementById('monthly-entry-modal').style.display = 'flex';
}
function closeMonthlyEntry() { document.getElementById('monthly-entry-modal').style.display = 'none'; }
function closeMonthlyExit() { document.getElementById('monthly-exit-modal').style.display = 'none'; }

function confirmMonthlyExit() {
    document.getElementById('monthly-exit-modal').style.display = 'none';

    // 核心修复：自动给未完成的次数强行塞入 DNS 并立即封存本地成绩
    let format = getEventFormat(currentMonthlyEventTarget);
    let finalAttempts = [...monthlyAttempts];
    while (finalAttempts.length < format.count) {
        finalAttempts.push({ rawMs: Infinity, penalty: 'DNS' });
    }

    markMonthlyParticipated(currentMonthlyEventTarget, finalAttempts);
    monthlyTimerState = 'IDLE';
    monthlyHasFinished = true;

    // 强制后台刷新外部列表状态，保障返回后一眼看到 DNF 且无法重进
    renderMonthlyList();
    goBack();
}

function confirmMonthlyEntry() {
    // 无论渲染组件出现任何报错，都绝不能阻断页面跳转
    try {
        document.getElementById('monthly-entry-modal').style.display = 'none';
        monthlyAttempts = [];
        monthlyHasFinished = false;
        monthlyTimerState = 'IDLE';

        let displayEl = document.getElementById('monthly-timer-display');
        if(displayEl) {
            displayEl.innerText = '0.00';
            displayEl.className = 'timer-display';
        }

        let titleEl = document.getElementById('monthly-timer-title');
        if(titleEl) {
            titleEl.innerText = `巅峰月赛 - ${currentMonthlyEventName}`;
        }

        renderMonthlyAttemptsList();
        renderMonthlyScramble(0);
    } catch (err) {
        console.warn("UI 渲染出现波动，已被系统拦截", err);
    } finally {
        // 核心修复：放在 finally 中，确保 100% 会执行跳转指令
        navigateTo('monthly-timer-page', true);
    }
}

function renderMonthlyAttemptsList() {
    const panel = document.getElementById('monthly-stats-panel');
    if (!panel) return;

    panel.innerHTML = '';

    const format = getEventFormat(currentMonthlyEventTarget);

    for (let i = 0; i < format.count; i++) {
        let valStr = '-';

        if (i < monthlyAttempts.length) {
            const att = monthlyAttempts[i];

            if (att.penalty === '+2') {
                valStr = formatTimerOutput(att.rawMs + 2000) + '+';
            } else if (att.penalty === 'DNF') {
                valStr = 'DNF';
            } else if (att.penalty === 'DNS') {
                valStr = 'DNS';
            } else {
                valStr = formatTimerOutput(att.rawMs);
            }
        }

        const row = document.createElement('div');

        row.style.marginBottom = '6px';
        row.style.fontFamily = "'SFMono-Regular', Consolas, monospace";

        row.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <span style="
                    font-size: 18px;
                    font-weight: bold;
                    color: var(--text-muted);
                    width: 24px;
                    text-align: center;
                ">
                    ${i + 1}
                </span>

                <span style="
                    font-size: 15px;
                    font-weight: bold;
                    color: var(--text-main);
                ">
                    ${valStr}
                </span>
            </div>
        `;

        panel.appendChild(row);
    }
}

function renderMonthlyScramble(attemptIndex) {
    try {
        let allScrambles = ensureMonthlyScrambles();
        let scrambles = allScrambles[currentMonthlyEventTarget];

        if (!scrambles) {
            localStorage.removeItem('monthlyScrambles_' + getCurrentMonthKey());
            allScrambles = ensureMonthlyScrambles();
            scrambles = allScrambles[currentMonthlyEventTarget];
        }

        if (!scrambles || attemptIndex >= scrambles.length) return;

        const scramble = scrambles[attemptIndex];
        let textEl = document.getElementById('monthly-scramble-text');
        if(textEl) textEl.innerHTML = scramble;

        const displayEl = document.getElementById('monthly-scramble-display');
        if (displayEl) {
            let cleanScramble = scramble.replace(/<br>/g, ' ');

            // 给官方组件的操作套上异常捕获罩，即使报错也只在后台静默处理
            try {
                displayEl.setAttribute('puzzle', getCubingJsPuzzle(currentMonthlyEventTarget));
                displayEl.setAttribute('alg', cleanScramble);
                displayEl.style.transition = "transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)";
                displayEl.style.transform = `scale(${getScrambleZoom(currentMonthlyEventTarget)})`;

                setTimeout(() => {
                    try { displayEl.timestamp = "end"; } catch(e){}
                }, 10);
            } catch(renderErr) {
                console.warn(`[${currentMonthlyEventTarget}] 项目的打乱图渲染失败，已降级为仅文本显示`, renderErr);
            }
        }
    } catch (err) {
        console.warn("打乱引擎波动，已被系统拦截", err);
    }
}

// ---------------- 计时与判定逻辑 ----------------
function startMonthlyTimer() {
    monthlyTimerState = 'RUNNING';
    const display = document.getElementById('monthly-timer-display');
    display.classList.remove('ready');
    monthlyStartTime = performance.now();

    function update() {
        if (monthlyTimerState !== 'RUNNING') return;
        let elapsed = Math.floor(performance.now() - monthlyStartTime);
        display.innerText = formatTimerOutput(elapsed);
        monthlyAnimFrame = requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

function stopMonthlyTimer() {
    monthlyTimerState = 'IDLE';
    cancelAnimationFrame(monthlyAnimFrame);
    currentMonthlyRawMs = Math.floor(performance.now() - monthlyStartTime);
    document.getElementById('monthly-timer-display').innerText = formatTimerOutput(currentMonthlyRawMs);

    document.getElementById('monthly-penalty-index').innerText = `#${monthlyAttempts.length + 1}`;
    setMonthlyPenalty('');
    document.getElementById('monthly-penalty-modal').style.display = 'flex';
}

function setMonthlyPenalty(pen) {
    currentMonthlyPen = pen;
    ['none', 'plus2', 'dnf'].forEach(id => document.getElementById(`monthly-pen-${id}`).classList.remove('active'));
    if (pen === '') document.getElementById('monthly-pen-none').classList.add('active');
    else if (pen === '+2') document.getElementById('monthly-pen-plus2').classList.add('active');
    else if (pen === 'DNF') document.getElementById('monthly-pen-dnf').classList.add('active');

    let simDisp = "";
    if (pen === '+2') simDisp = formatTimerOutput(currentMonthlyRawMs + 2000) + '+';
    else if (pen === 'DNF') simDisp = 'DNF';
    else simDisp = formatTimerOutput(currentMonthlyRawMs);
    document.getElementById('monthly-penalty-time').innerText = simDisp;
}

function showMonthlyFinishAlert() {
    const modal = document.getElementById('monthly-finish-modal');
    modal.classList.remove('popup-fade-out');
    modal.style.display = 'flex';
    clearTimeout(monthlyFinishTimer);
    monthlyFinishTimer = setTimeout(() => {
        closeMonthlyFinishAlert();
    }, 3000);
}

function closeMonthlyFinishAlert() {
    const modal = document.getElementById('monthly-finish-modal');
    if (modal.style.display === 'none') return;
    modal.classList.add('popup-fade-out');
    setTimeout(() => { modal.style.display = 'none'; modal.classList.remove('popup-fade-out'); }, 200);
}

function confirmMonthlyPenalty() {
    document.getElementById('monthly-penalty-modal').style.display = 'none';

    monthlyAttempts.push({
        rawMs: currentMonthlyRawMs,
        penalty: currentMonthlyPen
    });

    renderMonthlyAttemptsList();

    if (monthlyAttempts.length < getEventFormat(currentMonthlyEventTarget).count) {
        renderMonthlyScramble(monthlyAttempts.length);
    } else {
        monthlyHasFinished = true;
        markMonthlyParticipated(currentMonthlyEventTarget, monthlyAttempts);
        renderMonthlyList(); // 后台预渲染，为返回上一页做准备
        showMonthlyFinishAlert();

        // 核心新增：项目完赛，立刻同步到云端
        syncMonthlyResultToCloud();
    }
}

// ---------------- 手动成绩输入与解析引擎 ----------------
let currentManualPenalty = '';
let invalidToastTimer = null;

function openMonthlyManualInput() {
    document.getElementById('monthly-manual-input').value = '';
    setManualPenalty('');
    document.getElementById('monthly-manual-modal').style.display = 'flex';
}

function closeMonthlyManualInput() {
    document.getElementById('monthly-manual-modal').style.display = 'none';
}

function setManualPenalty(pen) {
    currentManualPenalty = pen;
    ['none', 'plus2', 'dnf'].forEach(id => document.getElementById(`manual-pen-${id}`).classList.remove('active'));
    if (pen === '') document.getElementById('manual-pen-none').classList.add('active');
    else if (pen === '+2') document.getElementById('manual-pen-plus2').classList.add('active');
    else if (pen === 'DNF') document.getElementById('manual-pen-dnf').classList.add('active');
}

function manualInput(val) {
    const inputEl = document.getElementById('monthly-manual-input');
    if (val === 'CLEAR') {
        inputEl.value = '';
    } else if (val === 'BACK') {
        inputEl.value = inputEl.value.slice(0, -1);
    } else {
        if (inputEl.value.length < 12) inputEl.value += val;
    }
}

function showInvalidInputToast() {
    const toast = document.getElementById('invalid-input-toast');
    toast.style.display = 'block';
    clearTimeout(invalidToastTimer);
    invalidToastTimer = setTimeout(() => { toast.style.display = 'none'; }, 2000);
}

// 智能转换输入 (例如 0009.2300 -> 9230ms, 1:9.2 -> 69200ms)
function parseManualTime(str) {
    str = str.trim();
    if (!str) return null;
    if (!/^[0-9:\.]+$/.test(str)) return null;

    const parts = str.split(':');
    if (parts.length > 2) return null;

    let min = 0;
    let secStr = str;

    if (parts.length === 2) {
        if (!parts[0] || !parts[1]) return null;
        min = parseInt(parts[0]);
        secStr = parts[1];
    }

    let secParts = secStr.split('.');
    if (secParts.length > 2) return null;

    let sec = parseInt(secParts[0] || '0');
    let msStr = secParts[1] || '0';

    if (isNaN(min) || isNaN(sec)) return null;
    if (parts.length === 2 && sec >= 60) return null;

    msStr = (msStr + '000').substring(0, 3);
    let ms = parseInt(msStr);
    if (isNaN(ms)) return null;

    return min * 60000 + sec * 1000 + ms;
}

function confirmMonthlyManual() {
    const str = document.getElementById('monthly-manual-input').value;
    let rawMs = 0;

    if (str) {
        let parsed = parseManualTime(str); // 复用已有的智能时间解析函数
        if (parsed === null) {
            showInvalidInputToast();
            return;
        }
        rawMs = parsed;
    } else {
        if (currentManualPenalty !== 'DNF') return;
        rawMs = Infinity; // 输入为空但点击了 DNF 允许放行
    }

    monthlyAttempts.push({
        rawMs: rawMs,
        penalty: currentManualPenalty
    });

    renderMonthlyAttemptsList();

    if (monthlyAttempts.length < getEventFormat(currentMonthlyEventTarget).count) {
        renderMonthlyScramble(monthlyAttempts.length);
    } else {
        monthlyHasFinished = true;
        markMonthlyParticipated(currentMonthlyEventTarget, monthlyAttempts);
        renderMonthlyList();
        showMonthlyFinishAlert();

        // 核心新增：手动输入完赛，立刻同步到云端
        syncMonthlyResultToCloud();
    }

    closeMonthlyManualInput();
}

// ---------------- 专属按键与触屏控制 ----------------
document.addEventListener('keydown', (e) => {
    const activePage = document.querySelector('.page-container.active');
    if (!activePage || activePage.id !== 'monthly-timer-page') return;
    if (monthlyHasFinished) return;

    const penaltyModal = document.getElementById('monthly-penalty-modal');
    if (penaltyModal && penaltyModal.style.display === 'flex') return;

    if (monthlyTimerState === 'IDLE') {
        if (e.code === 'Space') {
            e.preventDefault();
            if (document.activeElement) document.activeElement.blur();
            if (e.repeat) return;
            monthlyTimerState = 'WAITING';
            const display = document.getElementById('monthly-timer-display');
            display.classList.add('waiting');
            monthlyHoldTimeout = setTimeout(() => {
                if (monthlyTimerState === 'WAITING') {
                    monthlyTimerState = 'READY';
                    display.classList.remove('waiting');
                    display.classList.add('ready');
                }
            }, 350);
        }
    } else if (monthlyTimerState === 'RUNNING') {
        e.preventDefault();
        stopMonthlyTimer();
    }
});

document.addEventListener('keyup', (e) => {
    const activePage = document.querySelector('.page-container.active');
    if (!activePage || activePage.id !== 'monthly-timer-page') return;
    if (monthlyHasFinished) return;

    if (e.code === 'Space') {
        const display = document.getElementById('monthly-timer-display');
        if (monthlyTimerState === 'WAITING') {
            clearTimeout(monthlyHoldTimeout);
            monthlyTimerState = 'IDLE';
            display.classList.remove('waiting');
        } else if (monthlyTimerState === 'READY') {
            startMonthlyTimer();
        }
    }
});

// ================= NB Timer 手动成绩输入引擎 =================
let currentNbManualPenalty = '';

function openNbManualInput() {
    document.getElementById('nb-manual-input').value = '';
    setNbManualPenalty('');
    document.getElementById('nb-manual-modal').style.display = 'flex';
}

function closeNbManualInput() {
    document.getElementById('nb-manual-modal').style.display = 'none';
}

function setNbManualPenalty(pen) {
    currentNbManualPenalty = pen;
    ['none', 'plus2', 'dnf'].forEach(id => document.getElementById(`nb-manual-pen-${id}`).classList.remove('active'));
    if (pen === '') document.getElementById('nb-manual-pen-none').classList.add('active');
    else if (pen === '+2') document.getElementById('nb-manual-pen-plus2').classList.add('active');
    else if (pen === 'DNF') document.getElementById('nb-manual-pen-dnf').classList.add('active');
}

function nbManualInput(val) {
    const inputEl = document.getElementById('nb-manual-input');
    if (val === 'CLEAR') {
        inputEl.value = '';
    } else if (val === 'BACK') {
        inputEl.value = inputEl.value.slice(0, -1);
    } else {
        if (inputEl.value.length < 12) inputEl.value += val;
    }
}

function confirmNbManual() {
    const str = document.getElementById('nb-manual-input').value;
    let rawMs = 0;

    if (str) {
        let parsed = parseManualTime(str); // 复用已有的智能时间解析函数
        if (parsed === null) {
            showInvalidInputToast();
            return;
        }
        rawMs = parsed;
    } else {
        if (currentNbManualPenalty !== 'DNF') return;
        rawMs = Infinity;
    }

    timerHistoryData[currentTimerEvent].unshift({
        rawMs: rawMs,
        penalty: currentNbManualPenalty,
        timestamp: getNowFormatted(),
        scramble: document.getElementById('scramble-text').innerText
    });

    closeNbManualInput();
    recalculateSessionStats();
    saveTimerData();
    generateScramble();
}

// ================= NB Timer 快捷弹窗功能 (删除与编辑最新成绩) =================
let currentNbEditLastPenalty = '';

function openNbDeleteLast() {
    const records = timerHistoryData[currentTimerEvent];
    if (!records || records.length === 0) return; // 如果没有成绩，不响应

    // 渲染序号与成绩
    document.getElementById('delete-last-index').innerText = `#${records.length}`;
    document.getElementById('delete-last-time').innerText = records[0].displayTime;

    document.getElementById('nb-delete-last-modal').style.display = 'flex';
}

function closeNbDeleteLast() {
    document.getElementById('nb-delete-last-modal').style.display = 'none';
}

function confirmNbDeleteLast() {
    const records = timerHistoryData[currentTimerEvent];
    if (records && records.length > 0) {
        records.shift(); // 移除最新的一次成绩
        recalculateSessionStats();
        saveTimerData();
    }
    closeNbDeleteLast();
}

function openNbEditLast() {
    const records = timerHistoryData[currentTimerEvent];
    if (!records || records.length === 0) return;

    const r = records[0];
    document.getElementById('edit-last-index').innerText = `#${records.length}`;
    setNbEditLastPenalty(r.penalty); // 自动匹配并展示当前状态

    document.getElementById('nb-edit-last-modal').style.display = 'flex';
}

function closeNbEditLast() {
    document.getElementById('nb-edit-last-modal').style.display = 'none';
}

function setNbEditLastPenalty(pen) {
    currentNbEditLastPenalty = pen;
    ['none', 'plus2', 'dnf'].forEach(id => document.getElementById(`edit-last-pen-${id}`).classList.remove('active'));

    if (pen === '') document.getElementById('edit-last-pen-none').classList.add('active');
    else if (pen === '+2') document.getElementById('edit-last-pen-plus2').classList.add('active');
    else if (pen === 'DNF') document.getElementById('edit-last-pen-dnf').classList.add('active');

    const records = timerHistoryData[currentTimerEvent];
    if (!records || records.length === 0) return;

    let simDisp = "";
    if (pen === '+2') simDisp = formatTimerOutput(records[0].rawMs + 2000) + '+';
    else if (pen === 'DNF') simDisp = 'DNF';
    else simDisp = formatTimerOutput(records[0].rawMs);

    document.getElementById('edit-last-time').innerText = simDisp;
}

function confirmNbEditLast() {
    const records = timerHistoryData[currentTimerEvent];
    if (records && records.length > 0) {
        records[0].penalty = currentNbEditLastPenalty;
        recalculateSessionStats();
        saveTimerData();
    }
    closeNbEditLast();
}

// ================= 云端数据库接口：周赛/月赛系统 =================

// ================= 云端同步辅助函数 =================
function syncMonthlyResultToCloud() {
    // 利用现成的成绩解析引擎，直接算出最终成绩和带括号的明细文本
    let res = processMonthlyResults(monthlyAttempts, currentMonthlyEventTarget);

    // 数据库的 int8 无法存储 JS 的 Infinity（DNF代表值）
    // 将其转化为 99999999，确保在云端升序排列时 DNF 自动垫底
    let uploadMs = res.sortAvgMs;
    if (uploadMs === Infinity) {
        uploadMs = 99999999;
    }

    // 触发 Supabase 上传接口
    uploadWeeklyResult(
        uiSettings.wcaId || '',
        uiSettings.username || '匿名魔友',
        currentMonthlyEventTarget,
        uploadMs,
        res.detailsStr
    );
}

// 1. 上传成绩到全网
async function uploadWeeklyResult(wcaId, username, eventId, rawMs, details) {
    const { data, error } = await supabaseClient
        .from('WeeklyRecord')
        .insert([
            {
                wca_id: wcaId,
                username: username,
                event_id: eventId,
                raw_ms: rawMs,
                details: details
            }
        ]);

    if (error) {
        console.error('成绩上传失败：', error);
    } else {
        console.log('成绩已同步至排行榜！');
    }
}

// 2. 从全网拉取排行榜
async function fetchWeeklyLeaderboard(eventId) {
    const { data, error } = await supabaseClient
        .from('WeeklyRecord')
        .select('*')
        .eq('event_id', eventId)
        .order('raw_ms', { ascending: true }) // 毫秒数越小（越快）排得越靠前
        .limit(50); // 最多拉取前 50 名的数据

    if (error) {
        console.error('拉取排行榜失败：', error);
        return [];
    }
    return data;
}

// =========================================
// 全新简约版首页及衍生页面核心数据引擎
// =========================================

if (typeof window.hasHomeEngineInit === 'undefined') {
    window.hasHomeEngineInit = true;

    window.allCompsData = [];
    window.currentCompsPage = 1;
    window.COMPS_PER_PAGE = 10;

    window.allNewsData = [];
    window.currentNewsPage = 1;
    window.NEWS_PER_PAGE = 10;

    window.originalInitData = initData;
    initData = async function() {
        await window.originalInitData();
        if (isDataReady) {
            initHomeData();
        }
    };
}

// ================= 新增：全局搜索跳转直连引擎 =================
window.executeHomeSearch = function() {
    const input = document.getElementById('home-search-input');
    const val = input.value.trim();
    if (!val) return;

    openSearchPage();
    document.getElementById('search-input').value = val;
    input.value = '';
    performSearch();
};

async function initHomeData() {
    setupAutocomplete('home-search-input', 'autocomplete-home', (wcaId) => {
        document.getElementById('home-search-input').value = '';
        showPerson(wcaId);
    });

    document.getElementById('home-search-input').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            executeHomeSearch();
        }
    });

    renderHomeRecords();
    buildNewsTimeline();
    await fetchCompetitions();
}

// ---------------- 1. 赛事引擎 ----------------
async function fetchCompetitions() {
    const grid = document.getElementById('recent-comps-grid');
    try {
        const d = new Date();
        const todayStr = d.toISOString().split('T')[0];

        const resUp = await fetch(`https://www.worldcubeassociation.org/api/v0/competitions?country_iso2=CN&start=${todayStr}&sort=start_date`);
        let upcomingComps = resUp.ok ? await resUp.json() : [];

        const [resPast1, resPast2] = await Promise.all([
            fetch(`https://www.worldcubeassociation.org/api/v0/competitions?country_iso2=CN&sort=-start_date&per_page=100&page=1`),
            fetch(`https://www.worldcubeassociation.org/api/v0/competitions?country_iso2=CN&sort=-start_date&per_page=100&page=2`)
        ]);

        let pastCompsAll = [];
        if (resPast1.ok) pastCompsAll.push(...await resPast1.json());
        if (resPast2.ok) pastCompsAll.push(...await resPast2.json());

        let pastComps = pastCompsAll.filter(c => c.end_date < todayStr);

        window.allCompsData = [];
        upcomingComps.forEach(c => window.allCompsData.push(c));
        pastComps.forEach(c => window.allCompsData.push(c));

        let displayComps = [];
        let homeUpcoming = upcomingComps.slice(0, 8);
        displayComps.push(...homeUpcoming);

        if (displayComps.length < 8) {
            let needed = 8 - displayComps.length;
            displayComps.push(...pastComps.slice(0, needed));
        }

        if (displayComps.length === 0) {
            grid.innerHTML = '<div style="color: var(--text-muted); font-size: 14px;">近期暂无赛事</div>';
            return;
        }

        grid.innerHTML = '';
        displayComps.forEach(comp => grid.appendChild(createCompCard(comp, false)));

    } catch (e) {
        grid.innerHTML = '<div style="color: #e63946; font-size: 14px;">赛事数据拉取失败，请检查网络连接</div>';
    }
}

function createCompCard(comp, isListPage = false) {
    const compName = comp.name;
    const city = comp.city || '中国';
    const formatId = comp.id.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/([A-Za-z])(\d{4})$/, '$1-$2');
    const cubingUrl = `https://cubing.com/competition/${formatId}`;

    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${day}`;

    let statusText = '';
    let statusClass = '';

    if (comp.end_date < todayStr) {
        statusText = '已结束';
        statusClass = 'status-ended';
        if (isListPage) statusText = '';
    } else if (comp.start_date > todayStr) {
        statusText = '未开始';
        statusClass = 'status-upcoming';
    } else {
        statusText = '进行中';
        statusClass = 'status-active';
    }

    const card = document.createElement('div');
    card.className = 'comp-card';
    card.onclick = () => window.open(cubingUrl, '_blank');

    let tagHtml = statusText ? `<div class="comp-status-tag ${statusClass}">${statusText}</div>` : '';

    card.innerHTML = `
        <div class="comp-title">${compName}</div>
        <div class="comp-meta-col">
            <span>📍 ${city}</span>
            <span>📅 ${comp.start_date}</span>
        </div>
        ${tagHtml}
    `;
    return card;
}

// ---------------- 翻页组件与跳转引擎 ----------------
function renderPaginationHTML(currentPage, totalItems, itemsPerPage, clickHandlerName) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return '';

    let html = `<button class="page-btn" onclick="${clickHandlerName}(1)" ${currentPage === 1 ? 'disabled' : ''}>首页</button>`;
    html += `<button class="page-btn" onclick="${clickHandlerName}(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>上一页</button>`;

    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, currentPage + 2);

    if (start > 1) {
        html += `<button class="page-btn page-num-btn" onclick="${clickHandlerName}(1)">1</button>`;
        if (start > 2) html += `<span class="page-dots">...</span>`;
    }

    for (let i = start; i <= end; i++) {
        if (i === currentPage) {
            html += `<button class="page-btn page-num-btn active">${i}</button>`;
        } else {
            html += `<button class="page-btn page-num-btn" onclick="${clickHandlerName}(${i})">${i}</button>`;
        }
    }

    if (end < totalPages) {
        if (end < totalPages - 1) html += `<span class="page-dots">...</span>`;
        html += `<button class="page-btn page-num-btn" onclick="${clickHandlerName}(${totalPages})">${totalPages}</button>`;
    }

    html += `<button class="page-btn" onclick="${clickHandlerName}(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>下一页</button>`;
    html += `<button class="page-btn" onclick="${clickHandlerName}(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>末页</button>`;

    return html;
}

function openCompsPage() {
    navigateTo('comps-page', true);
    window.currentCompsPage = 1;
    renderCompsPage();
}

function goToCompsPage(page) {
    const totalPages = Math.ceil(window.allCompsData.length / window.COMPS_PER_PAGE);
    if (page < 1 || page > totalPages) return;
    window.currentCompsPage = page;
    renderCompsPage();
}

function renderCompsPage() {
    const grid = document.getElementById('all-comps-grid');
    grid.innerHTML = '';
    const start = (window.currentCompsPage - 1) * window.COMPS_PER_PAGE;
    const end = start + window.COMPS_PER_PAGE;
    const pageData = window.allCompsData.slice(start, end);

    pageData.forEach(comp => grid.appendChild(createCompCard(comp, true)));

    const controlsWrap = document.querySelector('#comps-page .pagination-controls');
    controlsWrap.innerHTML = renderPaginationHTML(window.currentCompsPage, window.allCompsData.length, window.COMPS_PER_PAGE, 'goToCompsPage');
}

function openNewsPage() {
    navigateTo('news-page', true);
    window.currentNewsPage = 1;
    renderNewsPage();
}

function goToNewsPage(page) {
    const totalPages = Math.ceil(window.allNewsData.length / window.NEWS_PER_PAGE);
    if (page < 1 || page > totalPages) return;
    window.currentNewsPage = page;
    renderNewsPage();
}

function renderNewsPage() {
    const list = document.getElementById('all-news-list');
    list.innerHTML = '';
    const start = (window.currentNewsPage - 1) * window.NEWS_PER_PAGE;
    const end = start + window.NEWS_PER_PAGE;
    const pageData = window.allNewsData.slice(start, end);
    pageData.forEach(news => list.appendChild(createNewsCard(news, true)));

    const controlsWrap = document.querySelector('#news-page .pagination-controls');
    controlsWrap.innerHTML = renderPaginationHTML(window.currentNewsPage, window.allNewsData.length, window.NEWS_PER_PAGE, 'goToNewsPage');
}

// ---------------- 2. 资讯引擎 ----------------
function buildNewsTimeline() {
    let globalAttempts = [];

    for (let wcaId in allHistoryData) {
        let userEvents = allHistoryData[wcaId];
        let cuber = allCubersData.find(c => c && c.person && c.person.wca_id === wcaId);
        if (!cuber) continue;
        let name = formatName(cuber.person.name);

        for (let evId in userEvents) {
            userEvents[evId].forEach(attempt => {
                globalAttempts.push({ wcaId, name, evId, attempt, dateStr: attempt.date });
            });
        }
    }

    globalAttempts.sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr));

    let rollingNR = {};
    let personalBest = {};
    window.allNewsData = [];

    globalAttempts.forEach(item => {
        let attempt = item.attempt;
        let evObj = eventDict.find(e => e.id === item.evId);
        let evName = evObj ? evObj.name.split('（')[0] : item.evId;

        ['single', 'average'].forEach(type => {
            let score = attempt[type];
            if (score && score > 0) {
                let pbKey = `${item.wcaId}_${item.evId}_${type}`;
                let nrKey = `${item.evId}_${type}`;
                let isPB = false;
                let isNR = false;

                if (!personalBest[pbKey] || score < personalBest[pbKey]) {
                    personalBest[pbKey] = score;
                    isPB = true;
                }
                if (!rollingNR[nrKey] || score < rollingNR[nrKey]) {
                    rollingNR[nrKey] = score;
                    isNR = true;
                }

                if (isPB) {
                    window.allNewsData.push({
                        wcaId: item.wcaId, name: item.name, evId: item.evId, evName: evName,
                        type: type === 'single' ? '单次' : '平均',
                        score, isNR, date: attempt.date, comp: attempt.comp
                    });
                }
            }
        });
    });

    window.allNewsData.reverse();

    const list = document.getElementById('news-list');
    list.innerHTML = '';
    const topNews = window.allNewsData.slice(0, 15);
    topNews.forEach(news => list.appendChild(createNewsCard(news, false)));
}

function createNewsCard(news, isFullPage) {
    let timeDisp = formatWcaResult(news.score, news.evId, news.type === '单次' ? 'single' : 'average');
    let nrBadge = news.isNR ? `<span class="badge-nr-break">宁波纪录</span>` : '';
    let levelText = news.isNR ? "宁波" : "个人";

    let titleHtml = `
        <div class="news-title">
            <span class="news-name-link" onclick="showPerson('${news.wcaId}')">${news.name}</span> 
            以 <span class="highlight">${timeDisp}</span> 的成绩刷新了 ${news.evName} ${news.type} ${levelText} 纪录！${nrBadge}
        </div>
    `;

    let descHtml = `在 <strong>${news.comp}</strong> 赛场上，他凭借优异的发挥突破了极限。`;

    let item = document.createElement('div');
    item.className = isFullPage ? 'news-card-item' : 'news-item';
    item.innerHTML = `
        ${titleHtml}
        <div class="news-desc">${descHtml}</div>
        <div class="news-footer">️发布时间: ${news.date} &nbsp;·&nbsp; WCA ID: ${news.wcaId}</div>
    `;
    return item;
}

// ---------------- 3. 全景简约纪录引擎 ----------------
function renderHomeRecords() {
    const list = document.getElementById('mini-records-list');
    list.innerHTML = '';

    const excludedEvents = ['magic', 'mmagic', '333ft', 'mbf', '333mbf', '333fm'];
    const targetEvents = eventDict.filter(ev => !excludedEvents.includes(ev.id));

    targetEvents.forEach(evObj => {
        let evId = evObj.id;
        let bestSingle = { score: Infinity, name: '' };
        let bestAverage = { score: Infinity, name: '' };

        allCubersData.forEach(cuber => {
            if (!cuber || !cuber.personal_records || !cuber.personal_records[evId]) return;
            const rec = cuber.personal_records[evId];

            if (rec.single && rec.single.best < bestSingle.score) {
                bestSingle.score = rec.single.best;
                bestSingle.name = formatName(cuber.person.name);
            }
            if (rec.average && rec.average.best < bestAverage.score) {
                bestAverage.score = rec.average.best;
                bestAverage.name = formatName(cuber.person.name);
            }
        });

        let hasSingle = bestSingle.score !== Infinity;
        let hasAvg = bestAverage.score !== Infinity;

        if (hasSingle) {
            let item = document.createElement('div');
            item.className = 'mini-record-row';
            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; font-size: 14px; font-weight: 600; color: var(--text-main);">
                    <span class="cubing-icon event-${evId}" style="font-size: 18px; color: var(--primary-color); width: 18px; text-align: center;"></span>
                    <span style="color: var(--text-muted); font-size: 12px; width: 26px;">单次</span>
                    <span>${bestSingle.name}</span>
                </div>
                <div style="font-family: 'SFMono-Regular', Consolas, monospace; font-size: 15px; font-weight: bold; color: var(--primary-color);">
                    ${formatWcaResult(bestSingle.score, evId, 'single')}
                </div>
            `;
            list.appendChild(item);
        }

        if (hasAvg) {
            let item = document.createElement('div');
            item.className = 'mini-record-row';
            let iconHtml = hasSingle
                ? `<span style="width: 18px; display: inline-block;"></span>`
                : `<span class="cubing-icon event-${evId}" style="font-size: 18px; color: var(--primary-color); width: 18px; text-align: center;"></span>`;

            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; font-size: 14px; font-weight: 600; color: var(--text-main);">
                    ${iconHtml}
                    <span style="color: var(--text-muted); font-size: 12px; width: 26px;">平均</span>
                    <span>${bestAverage.name}</span>
                </div>
                <div style="font-family: 'SFMono-Regular', Consolas, monospace; font-size: 15px; font-weight: bold; color: var(--primary-color);">
                    ${formatWcaResult(bestAverage.score, evId, 'average')}
                </div>
            `;
            list.appendChild(item);
        }
    });

    // 👇 核心新增：在最底部追加“全项目综合排名”专属彩蛋 👇
    const customHtml = `
        <div class="mini-record-row">
            <div style="display: flex; align-items: center; gap: 12px; font-size: 14px; font-weight: 600; color: var(--text-main);">
                <div style="font-size: 12px; font-weight: 900; color: var(--primary-color); width: 18px; display: flex; justify-content: center; white-space: nowrap;">全项</div>
                <span style="color: var(--text-muted); font-size: 12px; width: 26px;">单次</span>
                <span>孙凯霖（Kailin Sun）</span>
            </div>
            <div style="font-family: 'SFMono-Regular', Consolas, monospace; font-size: 15px; font-weight: bold; color: var(--primary-color);">
                NR67
            </div>
        </div>
        <div class="mini-record-row">
            <div style="display: flex; align-items: center; gap: 12px; font-size: 14px; font-weight: 600; color: var(--text-main);">
                <span style="width: 18px; display: inline-block;"></span>
                <span style="color: var(--text-muted); font-size: 12px; width: 26px;">平均</span>
                <span>郭畅（Chang Guo）</span>
            </div>
            <div style="font-family: 'SFMono-Regular', Consolas, monospace; font-size: 15px; font-weight: bold; color: var(--primary-color);">
                NR68
            </div>
        </div>
    `;
    list.insertAdjacentHTML('beforeend', customHtml);
}

// =========================================================================
// 🚀 魔方空间 (Cube Space) 3D 物理沙盒引擎核心逻辑 (含持久化存档)
// =========================================================================

let csScene, csCamera, csRenderer, csOrbitCtrl, csTransformCtrl;
let csObjects = [];
let csFloor;
let csHemiLight, csDirLight;
let csCurrentMode = 'observe';
let csCurrentCategory = 'cube';
let isCsExpanded = false;
let isCsInitialized = false;
let csSelectedObject = null;
let csPendingAction = null;

let csTimeState = 1;
let csCurrentFloorType = 'floor_brick';

// ==================== 持久化存档引擎 ====================
function saveCsConfig() {
    const config = {
        timeState: csTimeState,
        floorType: csCurrentFloorType,
        objects: csObjects.map(obj => ({
            id: obj.userData.id,
            type: obj.userData.type,
            pos: obj.position.toArray(),
            rot: obj.rotation.toArray(),
            scale: obj.scale.toArray(),
            lampInt: obj.userData.isLamp ? obj.userData.lightObj.intensity : 1
        }))
    };
    localStorage.setItem('nbCubeSpaceConfig', JSON.stringify(config));
}

function loadCsConfig() {
    try {
        const saved = localStorage.getItem('nbCubeSpaceConfig');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.floorType) changeFloorTexture(parsed.floorType);
            if (parsed.timeState !== undefined) {
                csTimeState = (parsed.timeState + 3) % 4;
                cycleCsTime();
            }
            if (parsed.objects && parsed.objects.length > 0) {
                parsed.objects.forEach(o => addObjToSpace(o.id, o.type, o));
            } else {
                generateDefaultScene();
            }
        } else {
            generateDefaultScene();
        }
    } catch (e) {
        generateDefaultScene();
    }
}

function generateDefaultScene() {
    changeFloorTexture('floor_brick');
    csTimeState = 1;
    cycleCsTime();

    addObjToSpace('smart_tv', 'smart', {pos: [0, 0, -2], rot: [0, 0, 0], scale: [1, 1, 1]});
    addObjToSpace('smart_speaker', 'smart', {pos: [-4.5, 0, -1.5], rot: [0, 0.4, 0], scale: [1, 1, 1]});
    addObjToSpace('smart_msg', 'smart', {pos: [4.5, 0, -1.5], rot: [0, -0.4, 0], scale: [1, 1, 1]});
    addObjToSpace('mc_grass', 'mc', {pos: [-3.5, 0, 3], rot: [0, 0.2, 0], scale: [1, 1, 1]});
    addObjToSpace('mc_crack', 'mc', {pos: [0, 0, 2.5], rot: [0, -0.1, 0], scale: [1, 1, 1]});
    addObjToSpace('mc_brick', 'mc', {pos: [3.5, 0, 3], rot: [0, -0.3, 0], scale: [1, 1, 1]});
    addObjToSpace('777', 'cube', {pos: [-3.5, 2, 3], rot: [0, 0.5, 0], scale: [0.85, 0.85, 0.85]});
    addObjToSpace('smart_lamp', 'smart', {pos: [7, 0, 1], rot: [0, 0, 0], scale: [1, 1, 1], lampInt: 1.5});

    saveCsConfig();
}

function updateCsLighting() {
    if (!csDirLight) return;
    const hasLamp = csObjects.some(o => o.userData && o.userData.isLamp);

    if (csTimeState === 3) {
        if (hasLamp) {
            csDirLight.castShadow = false;
            csDirLight.intensity = 0;
        } else {
            csDirLight.castShadow = true;
            csDirLight.intensity = 0.05;
        }
    } else {
        csDirLight.castShadow = true;
        if (csTimeState === 0) csDirLight.intensity = 0.5;
        else if (csTimeState === 1) csDirLight.intensity = 0.65;
        else if (csTimeState === 2) csDirLight.intensity = 0.4;
    }
}

function cycleCsTime() {
    csTimeState = (csTimeState + 1) % 4;
    const iconEl = document.getElementById('cs-time-icon');
    let bgColor, fogColor, hemiSky, hemiGround, hemiInt;

    if (csTimeState === 0) {
        iconEl.innerText = '🌅'; bgColor = 0xfff0e6; fogColor = 0xfff0e6;
        hemiSky = 0xffe4e1; hemiGround = 0x87ceeb; hemiInt = 0.5;
    } else if (csTimeState === 1) {
        iconEl.innerText = '☀️'; bgColor = 0xf8fafc; fogColor = 0xf8fafc;
        hemiSky = 0xffffff; hemiGround = 0xe2e8f0; hemiInt = 0.7;
    } else if (csTimeState === 2) {
        iconEl.innerText = '🌇'; bgColor = 0xfed7aa; fogColor = 0xfed7aa;
        hemiSky = 0xfdba74; hemiGround = 0x94a3b8; hemiInt = 0.4;
    } else if (csTimeState === 3) {
        iconEl.innerText = '🌙'; bgColor = 0x0f172a; fogColor = 0x0f172a;
        hemiSky = 0x1e293b; hemiGround = 0x020617; hemiInt = 0.1;
    }

    csScene.background.setHex(bgColor); csScene.fog.color.setHex(fogColor);
    csHemiLight.color.setHex(hemiSky); csHemiLight.groundColor.setHex(hemiGround);
    csHemiLight.intensity = hemiInt;

    updateCsLighting();
    saveCsConfig();
}

let csHistory = [];
let csTransformStartParams = null;

function pushCsHistory(action) {
    csHistory.push(action);
    if(csHistory.length > 30) csHistory.shift();
    document.getElementById('cs-action-undo').classList.remove('disabled');
}

function undoCsAction() {
    if(csHistory.length === 0) return;
    const action = csHistory.pop();

    if(action.type === 'add') {
        csScene.remove(action.obj);
        csObjects = csObjects.filter(o => o !== action.obj);
        if(csSelectedObject === action.obj) { csTransformCtrl.detach(); csSelectedObject=null; hideInfoCard(); }
    } else if (action.type === 'delete') {
        csScene.add(action.obj);
        csObjects.push(action.obj);
    } else if (action.type === 'transform') {
        action.obj.position.copy(action.oldPos);
        action.obj.rotation.copy(action.oldRot);
        action.obj.scale.copy(action.oldScale);
        if(csSelectedObject === action.obj) updateInfoCardValues();
    }

    if(csHistory.length === 0) document.getElementById('cs-action-undo').classList.add('disabled');

    updateCsLighting();
    saveCsConfig();
}

function csShowAlert(msg) {
    document.getElementById('cs-alert-text').innerText = msg;
    document.getElementById('cs-alert-modal').style.display = 'flex';
}

function openCubeSpace() {
    window.closeNavDropdowns();
    document.querySelectorAll('.page-container').forEach(p => p.classList.remove('active'));
    document.getElementById('cube-space-page').classList.add('active');

    if (!isCsInitialized) {
        initCubeSpace3D();
        loadCsConfig();
        isCsInitialized = true;
    }
    setCubeSpaceMode('observe');
    isCsExpanded = false;
    updateCsPanelState();
}

function exitCubeSpace() { goBack(); }

function toggleCubeSpacePanel() {
    if (!isCsExpanded) {
        setCubeSpaceMode('edit');
        isCsExpanded = true;
    } else {
        setCubeSpaceMode('observe');
        isCsExpanded = false;
    }
    updateCsPanelState();
}

// ==================== 音量调节 ====================
function updateCsSpeakerVol(val) {
    const audio = document.getElementById('cs-bgm');
    if(audio) audio.volume = val / 100;
}

// ==================== UI 交互控制 ====================
function switchCsCategory(cat) {
    if (csCurrentMode !== 'edit') {
        setCubeSpaceMode('edit');
    }
    csCurrentCategory = cat;
    ['cube', 'mc', 'smart', 'scene'].forEach(c => {
        document.getElementById(`cs-cat-${c}`).classList.toggle('active', cat === c);
    });
    populateCsPanel();
    if (!isCsExpanded) {
        isCsExpanded = true;
        updateCsPanelState();
    }
}

function updateCsPanelState() {
    const panel = document.getElementById('cs-dock-panel');
    const arrow = document.getElementById('cs-toggle-arrow');
    if (isCsExpanded) {
        panel.style.height = '115px'; panel.style.opacity = '1'; panel.style.pointerEvents = 'auto';
        arrow.style.transform = 'rotate(0deg)';
        populateCsPanel();
    } else {
        panel.style.height = '0'; panel.style.opacity = '0'; panel.style.pointerEvents = 'none';
        arrow.style.transform = 'rotate(180deg)';
    }
}

function setCubeSpaceMode(mode) {
    csCurrentMode = mode;
    document.getElementById('cs-mode-observe').classList.toggle('active', mode === 'observe');
    document.getElementById('cs-mode-edit').classList.toggle('active', mode === 'edit');

    ['mc', 'smart', 'scene'].forEach(c => {
        document.getElementById(`cs-cat-${c}`).classList.toggle('disabled', mode === 'observe');
    });
    const hint = document.getElementById('cube-space-hint');

    hideInteractCards();

    if (mode === 'observe') {
        hint.innerText = "观察者模式：左键旋转 / 右键平移 / 滚轮缩放";
        if (csTransformCtrl) csTransformCtrl.detach();
        hideInfoCard();

        if (isCsExpanded) {
            isCsExpanded = false;
            updateCsPanelState();
        }
    } else {
        hint.innerText = "编辑模式：可添加、移动、旋转、缩放场景物件";
    }
}

function clearCubeSpace() {
    csPendingAction = 'clear_all';
    document.getElementById('cs-delete-title').innerText = "确定要清空空间里的所有物件吗？";
    document.getElementById('cs-delete-modal').style.display = 'flex';
}

function populateCsPanel() {
    const content = document.getElementById('cs-panel-content');
    content.innerHTML = '';

    if (csCurrentCategory === 'cube') {
        const items = ['222', '333', '444', '555', '666', '777', 'clock'];
        items.forEach(evId => {
            let evObj = eventDict.find(e => e.id === evId);
            let name = evObj ? evObj.name.split('（')[0] : evId;
            let btn = document.createElement('div');
            btn.className = 'cs-item-btn';
            btn.innerHTML = `<span class="cubing-icon event-${evId}" style="font-size: 32px;"></span><span style="font-size: 14px; font-weight:bold;">${name}</span>`;
            btn.onclick = () => { addObjToSpace(evId, 'cube'); };
            content.appendChild(btn);
        });
    } else if (csCurrentCategory === 'mc') {
        const mcs = [
            { id: 'mc_grass', icon: '🟩', name: '草方块' },
            { id: 'mc_stone', icon: '🪨', name: '原石' },
            { id: 'mc_crack', icon: '🌑', name: '裂纹原石' },
            { id: 'mc_brick', icon: '🧱', name: '红砖块' }
        ];
        mcs.forEach(item => {
            let btn = document.createElement('div');
            btn.className = 'cs-item-btn';
            btn.innerHTML = `<span style="font-size: 32px;">${item.icon}</span><span style="font-size: 14px; font-weight:bold;">${item.name}</span>`;
            btn.onclick = () => { addObjToSpace(item.id, 'mc'); };
            content.appendChild(btn);
        });
    } else if (csCurrentCategory === 'smart') {
        const smarts = [
            { id: 'smart_speaker', icon: '🔈', name: '音响' },
            { id: 'smart_tv', icon: '🖥️', name: '现代电视' },
            { id: 'smart_lamp', icon: '💡', name: '发光路灯' },
            { id: 'smart_msg', icon: '📦', name: '命令方块' }
        ];
        smarts.forEach(item => {
            let btn = document.createElement('div');
            btn.className = 'cs-item-btn';
            btn.innerHTML = `<span style="font-size: 32px;">${item.icon}</span><span style="font-size: 14px; font-weight:bold;">${item.name}</span>`;
            btn.onclick = () => { addObjToSpace(item.id, 'smart'); };
            content.appendChild(btn);
        });
    } else if (csCurrentCategory === 'scene') {
        const scenes = [
            { id: 'floor_brick', icon: '<div style="width:24px;height:24px;background:#64748b;border-radius:4px;border:2px solid #475569;margin:auto;"></div>', name: '青石砖块' },
            { id: 'floor_grass', icon: '🟩', name: '自然草地' },
            { id: 'floor_grid', icon: '⬜', name: '空白网格' }
        ];
        scenes.forEach(item => {
            let btn = document.createElement('div');
            btn.className = 'cs-item-btn';
            btn.innerHTML = `<span style="font-size: 32px; display:flex; align-items:center; justify-content:center; height:32px; width:32px;">${item.icon}</span><span style="font-size: 14px; font-weight:bold;">${item.name}</span>`;
            btn.onclick = () => { changeFloorTexture(item.id); };
            content.appendChild(btn);
        });
    }
}

function createMCTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const addNoise = (color1, color2, prob) => {
        for(let i=0; i<64; i+=4) {
            for(let j=0; j<64; j+=4) {
                ctx.fillStyle = Math.random()>prob ? color1 : color2;
                ctx.fillRect(i, j, 4, 4);
            }
        }
    };

    if (type === 'grass_top') { addNoise('#5B8C51', '#4A7A40', 0.5); }
    else if (type === 'grass_side') {
        addNoise('#784A32', '#5A3520', 0.5);
        ctx.fillStyle = '#5B8C51'; ctx.fillRect(0,0,64,16);
        ctx.fillStyle = '#4A7A40'; for(let i=0;i<64;i+=8) ctx.fillRect(i, 16, 4, Math.random()*8);
    }
    else if (type === 'dirt') { addNoise('#784A32', '#5A3520', 0.5); }
    else if (type === 'stone') { addNoise('#94a3b8', '#64748b', 0.5); }
    else if (type === 'red_brick') {
        ctx.fillStyle = '#fca5a5'; ctx.fillRect(0,0,64,64);
        ctx.fillStyle = '#ef4444';
        for(let y=0; y<64; y+=16) {
            let offset = (y/16)%2===0 ? 0 : -16;
            for(let x=offset; x<64; x+=32) ctx.fillRect(x+2, y+2, 28, 12);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        for(let i=0;i<50;i++) ctx.fillRect(Math.random()*64, Math.random()*64, 4, 4);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
}

function changeFloorTexture(type) {
    csCurrentFloorType = type;
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');

    if (type === 'floor_grid') {
        csFloor.material.map = null;
        csFloor.material.color.setHex(0xf8fafc);
        csFloor.material.needsUpdate = true;
        saveCsConfig();
        return;
    }

    if (type === 'floor_brick') {
        ctx.fillStyle = '#64748b'; ctx.fillRect(0,0,512,512);
        ctx.fillStyle = '#475569';
        for(let i=0; i<8; i++) {
            ctx.fillRect(0, i*64, 512, 6);
            for(let j=0; j<8; j++) { ctx.fillRect(j*64 + (i%2===0?0:32), i*64, 6, 64); }
        }
    } else if (type === 'floor_grass') {
        ctx.fillStyle = '#5B8C51'; ctx.fillRect(0,0,512,512);
        for(let i=0; i<2000; i++) { ctx.fillStyle=Math.random()>0.5?'#4A7A40':'#669E5A'; ctx.fillRect(Math.random()*512, Math.random()*512, 6, 6); }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(15, 15);
    csFloor.material.color.setHex(0xffffff);
    csFloor.material.map = tex;
    csFloor.material.needsUpdate = true;
    saveCsConfig();
}

// ==================== 互动配件全息引擎 ====================
let csInteractObject = null;
let isCsMsgActive = false;
let csMsgSourceObj = null;
let csMsgInterval = null;
let csNewsIndex = 0;

function toggleCsSpeaker(isPlaying) {
    const audio = document.getElementById('cs-bgm');
    if(isPlaying) {
        audio.play().catch(e => console.warn("音频播放被浏览器拦截，请先与页面交互", e));
    } else {
        audio.pause();
    }
    hideInteractCards();
}

function replayCsSpeaker() {
    const audio = document.getElementById('cs-bgm');
    audio.currentTime = 0;
    document.getElementById('cs-speaker-toggle').checked = true;
    audio.play().catch(e => console.warn("音频播放被拦截", e));
    hideInteractCards();
}

function toggleCsMsg(isBroadcasting) {
    const holo = document.getElementById('cs-msg-hologram');
    isCsMsgActive = isBroadcasting;
    csMsgSourceObj = csInteractObject;

    if (isBroadcasting) {
        holo.style.display = 'block';
        updateCsHologramText();
        csMsgInterval = setInterval(updateCsHologramText, 4000);
    } else {
        holo.style.display = 'none';
        clearInterval(csMsgInterval);
    }
    hideInteractCards();
}

function updateCsHologramText() {
    if (window.allNewsData && window.allNewsData.length > 0) {
        const news = window.allNewsData[csNewsIndex];
        let text = `📣 ${news.name} 以 ${formatWcaResult(news.score, news.evId, news.type === '单次' ? 'single' : 'average')} 刷新了 ${news.evName} ${news.type} 纪录!`;
        document.getElementById('cs-hologram-text').innerText = text;
        csNewsIndex = (csNewsIndex + 1) % window.allNewsData.length;
    } else {
        document.getElementById('cs-hologram-text').innerText = "暂无最新赛事资讯...";
    }
}

function updateInteractCardPos(type) {
    if (!csInteractObject) return;
    const pos = csInteractObject.position.clone().project(csCamera);
    const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (pos.y * -0.5 + 0.5) * window.innerHeight;

    let cardId = type === 'speaker' ? 'cs-speaker-card' : 'cs-msg-card';
    const card = document.getElementById(cardId);
    if(card) {
        card.style.left = (x + 40) + 'px';
        card.style.top = (y - 80) + 'px';
    }
}

function updateDynamicHolograms() {
    if (isCsMsgActive && csMsgSourceObj) {
        const pos = csMsgSourceObj.position.clone();
        pos.y += 2.5;
        pos.project(csCamera);
        const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (pos.y * -0.5 + 0.5) * window.innerHeight;

        const holo = document.getElementById('cs-msg-hologram');
        holo.style.left = x + 'px';
        holo.style.top = y + 'px';
        holo.style.display = pos.z > 1 ? 'none' : 'block';
    }

    if (document.getElementById('cs-speaker-card').style.display !== 'none') {
        updateInteractCardPos('speaker');
    }
    if (document.getElementById('cs-msg-card').style.display !== 'none') {
        updateInteractCardPos('msg');
    }
}

function hideInteractCards() {
    document.getElementById('cs-speaker-card').style.display = 'none';
    document.getElementById('cs-msg-card').style.display = 'none';
    csInteractObject = null;
}

const originalHideInfoCard = hideInfoCard;
hideInfoCard = function() {
    originalHideInfoCard();
    hideInteractCards();
}

// ==================== 核心 3D 渲染引擎 (终极防翻转版) ====================
function initCubeSpace3D() {
    const container = document.getElementById('cube-space-canvas');
    csScene = new THREE.Scene();
    csScene.background = new THREE.Color(0xf8fafc);
    csScene.fog = new THREE.Fog(0xf8fafc, 20, 100);

    csCamera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    csCamera.position.set(15, 12, 20);

    csRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    csRenderer.setSize(container.clientWidth, container.clientHeight);
    csRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    csRenderer.shadowMap.enabled = true;
    csRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(csRenderer.domElement);

    csHemiLight = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.7);
    csHemiLight.position.set(0, 20, 0);
    csScene.add(csHemiLight);

    csDirLight = new THREE.DirectionalLight(0xffffff, 0.65);
    csDirLight.position.set(12, 25, 15);
    csDirLight.castShadow = true;
    csDirLight.shadow.camera.top = 25;
    csDirLight.shadow.camera.bottom = -25;
    csDirLight.shadow.camera.left = -25;
    csDirLight.shadow.camera.right = 25;
    csDirLight.shadow.mapSize.width = 2048;
    csDirLight.shadow.mapSize.height = 2048;
    csDirLight.shadow.bias = -0.0005;
    csScene.add(csDirLight);

    const floorGeo = new THREE.PlaneGeometry(150, 150);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 1 });
    csFloor = new THREE.Mesh(floorGeo, floorMat);
    csFloor.rotation.x = -Math.PI / 2;
    csFloor.receiveShadow = true;
    csScene.add(csFloor);

    const gridHelper = new THREE.GridHelper(50, 50, 0x000000, 0x000000);
    gridHelper.material.opacity = 0.12;
    gridHelper.material.transparent = true;
    csScene.add(gridHelper);

    csOrbitCtrl = new THREE.OrbitControls(csCamera, csRenderer.domElement);
    csOrbitCtrl.enableDamping = false;
    csOrbitCtrl.maxPolarAngle = Math.PI / 2 - 0.02;

    csOrbitCtrl.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
    };

    csTransformCtrl = new THREE.TransformControls(csCamera, csRenderer.domElement);

    // 1. 隐藏多余的面和幽灵白线，只保留单纯的 XYZ 轴
    csTransformCtrl.traverse(function(child) {
        if (child.isMesh && ['XY', 'YZ', 'XZ', 'XYZE', 'E'].includes(child.name)) {
            child.visible = false;
        }
        if (child.isLine) {
            if (['X', 'Y', 'Z'].includes(child.name)) {
                child.material.visible = true;
            } else {
                child.material.visible = false;
            }
        }
    });

    // 2. 核心大招：拦截 TransformControls 的底层矩阵更新！
    // 强制把被系统为了“正对用户”而偷偷倒转的圆锥方向用绝对值掰回世界绝对正向！
    const originalUpdateMatrixWorld = csTransformCtrl.updateMatrixWorld;
    csTransformCtrl.updateMatrixWorld = function() {
        originalUpdateMatrixWorld.apply(this, arguments);
        this.traverse(function(child) {
            if (child.name === 'X' || child.name === 'Y' || child.name === 'Z') {
                child.scale.x = Math.abs(child.scale.x);
                child.scale.y = Math.abs(child.scale.y);
                child.scale.z = Math.abs(child.scale.z);
                child.updateMatrix();
                if (child.parent) {
                    child.matrixWorld.multiplyMatrices(child.parent.matrixWorld, child.matrix);
                }
            }
        });
    };

    csTransformCtrl.addEventListener('dragging-changed', function (event) {
        csOrbitCtrl.enabled = !event.value;
        if (event.value) {
            hideInfoCard();
            csTransformStartParams = { pos: csSelectedObject.position.clone(), rot: csSelectedObject.rotation.clone(), scale: csSelectedObject.scale.clone() };
        } else {
            updateInfoCardValues();
            if (csTransformStartParams && csSelectedObject) {
                pushCsHistory({ type: 'transform', obj: csSelectedObject, oldPos: csTransformStartParams.pos, oldRot: csTransformStartParams.rot, oldScale: csTransformStartParams.scale });
                saveCsConfig();
            }
        }
    });

    csTransformCtrl.addEventListener('change', function () {
        if (csTransformCtrl.dragging) return;
        updateInfoCardPos();
    });

    csOrbitCtrl.addEventListener('change', updateInfoCardPos);
    csScene.add(csTransformCtrl);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    csRenderer.domElement.addEventListener('pointerdown', (e) => {
        if (csTransformCtrl.dragging) return;

        if (e.pointerType === 'mouse' && e.button !== 0) return;

        const rect = csRenderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, csCamera);
        const intersects = raycaster.intersectObjects(csObjects, true);

        if (csCurrentMode === 'edit') {
            if (intersects.length > 0) {
                let obj = intersects[0].object;
                while (obj.parent && obj.parent.type === 'Group' && !csObjects.includes(obj)) {
                    obj = obj.parent;
                }
                csTransformCtrl.attach(obj);
                csSelectedObject = obj;
                updateInfoCardValues();
            } else {
                csTransformCtrl.detach();
                csSelectedObject = null;
                hideInfoCard();
            }
        }
        else if (csCurrentMode === 'observe') {
            if (intersects.length > 0) {
                let obj = intersects[0].object;
                while (obj.parent && obj.parent.type === 'Group' && !csObjects.includes(obj)) {
                    obj = obj.parent;
                }

                if (obj.userData && obj.userData.id === 'smart_speaker') {
                    csInteractObject = obj;
                    updateInteractCardPos('speaker');
                    document.getElementById('cs-speaker-card').style.display = 'flex';
                    document.getElementById('cs-msg-card').style.display = 'none';
                }
                else if (obj.userData && obj.userData.id === 'smart_msg') {
                    csInteractObject = obj;
                    updateInteractCardPos('msg');
                    document.getElementById('cs-msg-card').style.display = 'flex';
                    document.getElementById('cs-speaker-card').style.display = 'none';
                } else {
                    hideInteractCards();
                }
            } else {
                hideInteractCards();
            }
        }
    });

    window.addEventListener('resize', () => {
        if (!document.getElementById('cube-space-page').classList.contains('active')) return;
        csCamera.aspect = container.clientWidth / container.clientHeight;
        csCamera.updateProjectionMatrix();
        csRenderer.setSize(container.clientWidth, container.clientHeight);
    });

    const animate = function () {
        requestAnimationFrame(animate);
        csOrbitCtrl.update();
        updateDynamicHolograms();
        csRenderer.render(csScene, csCamera);
    };
    animate();
    initInfoCardListeners();
}

// ==================== 物件生成与精准贴地算法 ====================
function addObjToSpace(id, type, restoreData = null) {
    const group = new THREE.Group();
    let size = 2;

    group.userData = { id: id, type: type };

    if (type === 'cube') {
        let order = 3;
        if (id === '222') { order = 2; size = 1.6; }
        else if (id === '333') { order = 3; size = 2; }
        else if (id === '444') { order = 4; size = 2.4; }
        else if (id === '555') { order = 5; size = 2.8; }
        else if (id === '666') { order = 6; size = 3.2; }
        else if (id === '777') { order = 7; size = 3.6; }
        else order = 0;

        if (order > 0) {
            const pSize = size / order;
            const gapScale = 0.88;
            const mats = [
                new THREE.MeshStandardMaterial({ color: 0xf87171, roughness: 0.2 }),
                new THREE.MeshStandardMaterial({ color: 0xfb923c, roughness: 0.2 }),
                new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 }),
                new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.2 }),
                new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.2 }),
                new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.2 })
            ];
            const black = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
            const offset = (size - pSize) / 2;
            for (let x = 0; x < order; x++) {
                for (let y = 0; y < order; y++) {
                    for (let z = 0; z < order; z++) {
                        const piece = new THREE.Mesh(new THREE.BoxGeometry(pSize * gapScale, pSize * gapScale, pSize * gapScale), [
                            x === order - 1 ? mats[0] : black, x === 0 ? mats[1] : black,
                            y === order - 1 ? mats[2] : black, y === 0 ? mats[3] : black,
                            z === order - 1 ? mats[4] : black, z === 0 ? mats[5] : black
                        ]);
                        piece.position.set(x * pSize - offset, y * pSize - offset, z * pSize - offset);
                        piece.castShadow = true; piece.receiveShadow = true;
                        group.add(piece);
                    }
                }
            }
        } else if (id === 'clock') {
            size = 2.4;
            const base = new THREE.Mesh(new THREE.CylinderGeometry(size, size, 0.45, 32), new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.4 }));
            base.rotation.x = Math.PI / 2; base.castShadow = true; base.receiveShadow = true;
            group.add(base);
            const cMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.8 });
            const hMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
            const pinMat = new THREE.MeshStandardMaterial({ color: 0xfacc15 });
            for(let side=0; side<2; side++) {
                let zOffset = side === 0 ? 0.23 : -0.23;
                for(let i=0; i<9; i++) {
                    let cx = (i%3 - 1) * (size*0.55); let cy = (Math.floor(i/3) - 1) * (size*0.55);
                    let c = new THREE.Mesh(new THREE.CircleGeometry(size*0.23, 32), cMat);
                    c.position.set(cx, cy, zOffset);
                    if(side === 1) c.rotation.y = Math.PI;
                    group.add(c);
                    let hand = new THREE.Mesh(new THREE.BoxGeometry(0.06, size*0.2, 0.02), hMat);
                    hand.position.set(cx, cy, zOffset + (side===0?0.01:-0.01));
                    hand.rotation.z = Math.random() * Math.PI * 2;
                    group.add(hand);
                }
            }
            for(let i=0; i<4; i++) {
                let px = (i%2 - 0.5) * (size*0.55); let py = (Math.floor(i/2) - 0.5) * (size*0.55);
                let pin = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.7), pinMat);
                pin.rotation.x = Math.PI/2; pin.position.set(px, py, 0);
                group.add(pin);
            }
        }
    } else if (type === 'mc') {
        const geo = new THREE.BoxGeometry(2, 2, 2);
        let mats;
        if (id === 'mc_grass') mats = [createMCTexture('grass_side'), createMCTexture('grass_side'), createMCTexture('grass_top'), createMCTexture('dirt'), createMCTexture('grass_side'), createMCTexture('grass_side')];
        else if (id === 'mc_stone') mats = createMCTexture('stone');
        else if (id === 'mc_brick') mats = createMCTexture('red_brick');

        let block = new THREE.Mesh(geo, mats);
        block.castShadow = true; block.receiveShadow = true;
        group.add(block);

    } else if (type === 'smart') {
        if (id === 'smart_lamp') {
            let pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 4.5), new THREE.MeshStandardMaterial({ color: 0x334155 }));
            pole.position.y = 2.25; pole.castShadow = true; pole.receiveShadow = true;

            let bulb = new THREE.Mesh(new THREE.SphereGeometry(0.6), new THREE.MeshBasicMaterial({ color: 0xfffbeb }));
            bulb.position.y = 4.8;
            bulb.castShadow = false; // 核心光影修复：灯泡绝对不能产生阴影遮挡自身光线

            let light = new THREE.PointLight(0xfff5b6, 1.5, 25, 2);
            light.position.y = 4.8;
            light.castShadow = true;
            light.shadow.mapSize.width = 1024;
            light.shadow.mapSize.height = 1024;
            light.shadow.bias = -0.01; // 核心光影修复：增加阴影偏移，彻底消除自身黑斑

            group.add(pole, bulb, light);

            group.userData.isLamp = true;
            group.userData.lightObj = light;
            if (restoreData && restoreData.lampInt !== undefined) {
                light.intensity = restoreData.lampInt;
                light.distance = restoreData.lampInt * 16 + 5;
            }

        } else if (id === 'smart_tv') {
            let body = new THREE.Mesh(new THREE.BoxGeometry(6.3, 3.6, 0.15), new THREE.MeshStandardMaterial({ color: 0x111111 }));
            body.position.y = 2.4; body.castShadow = true; body.receiveShadow = true;
            let screen = new THREE.Mesh(new THREE.BoxGeometry(6.1, 3.4, 0.02), new THREE.MeshStandardMaterial({ color: 0xbae6fd, emissive: 0x38bdf8, emissiveIntensity: 0.3 }));
            screen.position.set(0, 2.4, 0.08);
            let neck = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.15), new THREE.MeshStandardMaterial({ color: 0x333333 }));
            neck.position.set(0, 0.4, 0); neck.castShadow = true;
            let base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 1.2), new THREE.MeshStandardMaterial({ color: 0x222222 }));
            base.position.set(0, 0.025, 0); base.castShadow = true;
            group.add(body, screen, neck, base);

        } else if (id === 'smart_speaker') {
            let box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 1.2), new THREE.MeshStandardMaterial({ color: 0x1f2937 }));
            box.position.y = 1.2; box.castShadow = true; box.receiveShadow = true;
            let woofer = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32), new THREE.MeshStandardMaterial({ color: 0x111111 }));
            woofer.rotation.x = Math.PI/2; woofer.position.set(0, 0.8, 0.61);
            let tweeter = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 32), new THREE.MeshStandardMaterial({ color: 0x334155 }));
            tweeter.rotation.x = Math.PI/2; tweeter.position.set(0, 1.8, 0.61);
            group.add(box, woofer, tweeter);

        } else if (id === 'smart_msg') {
            const canvas = document.createElement('canvas');
            canvas.width = 64; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#c87e4f'; ctx.fillRect(0,0,64,64);
            ctx.fillStyle = '#3a2618'; ctx.fillRect(0,0,64,4); ctx.fillRect(0,60,64,4); ctx.fillRect(0,0,4,64); ctx.fillRect(60,0,4,64);
            ctx.fillStyle = '#6b4a31'; ctx.fillRect(20,20,24,24);
            for(let i=0; i<30; i++) { ctx.fillStyle=Math.random()>0.5?'#e8a071':'#8c5836'; ctx.fillRect(Math.random()*60, Math.random()*60, 4, 4); }
            const tex = new THREE.CanvasTexture(canvas);
            tex.magFilter = THREE.NearestFilter;
            let block = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), new THREE.MeshStandardMaterial({ map: tex }));
            block.position.y = 0.9; block.castShadow = true; block.receiveShadow = true;
            group.add(block);
        }
    }

    // 核心物理引擎修复：无论之前状态如何，必须先算出几何体底部Y边距并重置原点，之后才能应用坐标系！
    group.updateMatrixWorld();
    let bbox = new THREE.Box3().setFromObject(group);
    let bottomY = bbox.min.y;
    let centerOffset = new THREE.Vector3();
    bbox.getCenter(centerOffset);

    // 把该 Group 内所有物体的局部坐标系原点强制拉到其底部中心
    group.children.forEach(c => {
        c.position.x -= centerOffset.x;
        c.position.z -= centerOffset.z;
        c.position.y -= bottomY;
    });

    // 原点对齐完毕后，再将其置于世界坐标中，方可完美贴地
    if (restoreData) {
        group.position.fromArray(restoreData.pos);
        group.rotation.fromArray(restoreData.rot);
        group.scale.fromArray(restoreData.scale);
    } else {
        group.position.set(0, 0, 0);
    }

    csObjects.push(group);
    csScene.add(group);

    if (!restoreData) {
        csTransformCtrl.attach(group);
        csSelectedObject = group;
        pushCsHistory({ type: 'add', obj: group });
        updateInfoCardValues();
    }

    updateCsLighting();
    saveCsConfig();
}

// ==================== 卡片参数联动 ====================
function setCsTransformMode(mode) {
    csTransformCtrl.setMode(mode);
    document.getElementById('cs-btn-translate').style.background = mode === 'translate' ? 'var(--primary-color)' : '#f1f5f9';
    document.getElementById('cs-btn-translate').style.color = mode === 'translate' ? 'white' : 'var(--text-main)';
    document.getElementById('cs-btn-rotate').style.background = mode === 'rotate' ? 'var(--primary-color)' : '#f1f5f9';
    document.getElementById('cs-btn-rotate').style.color = mode === 'rotate' ? 'white' : 'var(--text-main)';
}

function updateInfoCardValues() {
    if (!csSelectedObject) return;

    document.getElementById('cs-pos-x').value = csSelectedObject.position.x.toFixed(1);
    document.getElementById('cs-pos-y').value = csSelectedObject.position.y.toFixed(1);
    document.getElementById('cs-pos-z').value = csSelectedObject.position.z.toFixed(1);
    document.getElementById('cs-rot-x').value = THREE.MathUtils.radToDeg(csSelectedObject.rotation.x).toFixed(0);
    document.getElementById('cs-rot-y').value = THREE.MathUtils.radToDeg(csSelectedObject.rotation.y).toFixed(0);
    document.getElementById('cs-rot-z').value = THREE.MathUtils.radToDeg(csSelectedObject.rotation.z).toFixed(0);

    document.getElementById('cs-scale-val').value = csSelectedObject.scale.x.toFixed(1);

    if (csSelectedObject.userData && csSelectedObject.userData.isLamp) {
        document.getElementById('cs-lamp-label').style.display = 'block';
        document.getElementById('cs-lamp-val').style.display = 'block';
        document.getElementById('cs-lamp-val').value = csSelectedObject.userData.lightObj.intensity.toFixed(1);
    } else {
        document.getElementById('cs-lamp-label').style.display = 'none';
        document.getElementById('cs-lamp-val').style.display = 'none';
    }

    updateInfoCardPos();
    document.getElementById('cs-info-card').style.display = 'block';
}

function updateInfoCardPos() {
    if (!csSelectedObject || !document.getElementById('cs-info-card')) return;
    const pos = csSelectedObject.position.clone().project(csCamera);
    const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (pos.y * -0.5 + 0.5) * window.innerHeight;

    const card = document.getElementById('cs-info-card');
    card.style.left = (x + 100) + 'px';
    card.style.top = (y - 120) + 'px';
}

function hideInfoCard() {
    document.getElementById('cs-info-card').style.display = 'none';
}

function initInfoCardListeners() {
    const bindAttr = (id, callback) => {
        document.getElementById(id).addEventListener('change', function() {
            if (!csSelectedObject) return;
            pushCsHistory({ type: 'transform', obj: csSelectedObject, oldPos: csSelectedObject.position.clone(), oldRot: csSelectedObject.rotation.clone(), oldScale: csSelectedObject.scale.clone() });
            callback(parseFloat(this.value));
            saveCsConfig();
        });
    };

    bindAttr('cs-pos-x', val => csSelectedObject.position.x = val);
    bindAttr('cs-pos-y', val => csSelectedObject.position.y = val);
    bindAttr('cs-pos-z', val => csSelectedObject.position.z = val);
    bindAttr('cs-rot-x', val => csSelectedObject.rotation.x = THREE.MathUtils.degToRad(val));
    bindAttr('cs-rot-y', val => csSelectedObject.rotation.y = THREE.MathUtils.degToRad(val));
    bindAttr('cs-rot-z', val => csSelectedObject.rotation.z = THREE.MathUtils.degToRad(val));
    bindAttr('cs-scale-val', val => csSelectedObject.scale.set(val, val, val));

    bindAttr('cs-lamp-val', val => {
        if (csSelectedObject.userData && csSelectedObject.userData.isLamp) {
            csSelectedObject.userData.lightObj.intensity = val;
            // 完美绑定：亮度增加的同时照射距离也线性增加
            csSelectedObject.userData.lightObj.distance = val * 16 + 5;
        }
    });
}

function showDeleteCsModal() {
    csPendingAction = 'delete_single';
    document.getElementById('cs-delete-title').innerText = "确定删除该物件吗？";
    document.getElementById('cs-delete-modal').style.display = 'flex';
}
function closeDeleteCsModal() { document.getElementById('cs-delete-modal').style.display = 'none'; }
document.getElementById('cs-delete-confirm-btn').onclick = function() {
    if (csPendingAction === 'clear_all') {
        csObjects.forEach(obj => csScene.remove(obj));
        csObjects = [];
        if (csTransformCtrl) csTransformCtrl.detach();
        hideInfoCard();
        csHistory = []; document.getElementById('cs-action-undo').classList.add('disabled');
    } else if (csPendingAction === 'delete_single') {
        if (csSelectedObject) {
            pushCsHistory({ type: 'delete', obj: csSelectedObject });
            csScene.remove(csSelectedObject);
            csObjects = csObjects.filter(o => o !== csSelectedObject);
            csTransformCtrl.detach();
            csSelectedObject = null;
            hideInfoCard();
        }
    }
    updateCsLighting();
    saveCsConfig();
    closeDeleteCsModal();
};
