const HISTORY_KEY = 'cv_translator_history';
const MAX_HISTORY = 20;

let currentHistory = loadHistory();

function loadHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
        return [];
    }
}

function saveHistory() {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(currentHistory.slice(0, MAX_HISTORY)));
    } catch {}
}

function addHistory(type, input) {
    const entry = { type, input, time: Date.now() };
    currentHistory = [entry, ...currentHistory.filter(h => h.input !== input || h.type !== type)].slice(0, MAX_HISTORY);
    saveHistory();
    renderHistory();
}

function removeHistory(input, type) {
    currentHistory = currentHistory.filter(h => !(h.input === input && h.type === type));
    saveHistory();
    renderHistory();
}

function renderHistory() {
    const el = document.getElementById('historyList');
    if (!currentHistory.length) {
        el.innerHTML = '<span class="history-empty">暂无查询记录</span>';
        return;
    }
    el.innerHTML = currentHistory.map(h => {
        const icon = h.type === 'translate' ? '→' : '←';
        return `<span class="history-item" data-type="${h.type}" data-input="${h.input}">${icon} ${escapeHtml(h.input)}</span>`;
    }).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function translateApi(concept, context) {
    const resp = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept, context }),
    });
    return resp.json();
}

async function explainApi(name) {
    const resp = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
    return resp.json();
}

function renderTranslateResult(data) {
    const el = document.getElementById('translateResult');
    if (data.error) {
        el.innerHTML = `<div class="error">${escapeHtml(data.error)}</div>`;
        return;
    }
    const fields = [
        { label: 'camelCase', key: 'camelCase' },
        { label: 'snake_case', key: 'snake_case' },
        { label: 'PascalCase', key: 'PascalCase' },
        { label: 'SCREAMING_CASE', key: 'SCREAMING_CASE' },
        { label: 'abbreviation', key: 'abbreviation' },
    ];
    el.innerHTML = fields.map(f => {
        const val = data[f.key];
        if (!val) return '';
        return `<div class="item">
            <span class="label">${f.label}</span>
            <code class="value">${escapeHtml(val)}</code>
            <button class="copy-btn" data-copy="${escapeHtml(val)}">复制</button>
        </div>`;
    }).filter(Boolean).join('');
}

function renderExplainResult(data) {
    const el = document.getElementById('explainResult');
    if (data.error) {
        el.innerHTML = `<div class="error">${escapeHtml(data.error)}</div>`;
        return;
    }
    const blocks = [];
    if (data.original) blocks.push({ label: '原变量名', value: data.original });
    if (data.full_name) blocks.push({ label: '完整拼写', value: data.full_name });
    if (data.abbreviation_expansion) blocks.push({ label: '缩写展开', value: data.abbreviation_expansion });
    if (data.meaning_cn) blocks.push({ label: '中文含义', value: data.meaning_cn });
    if (data.possible_context) blocks.push({ label: '可能场景', value: data.possible_context });

    el.innerHTML = blocks.map(b => {
        const isCode = b.label === '原变量名' || b.label === '完整拼写' || b.label === '缩写展开';
        return `<div class="meaning-block">
            <div class="meaning-label">${b.label}</div>
            <div class="meaning-value">${isCode ? `<code>${escapeHtml(b.value)}</code>` : escapeHtml(b.value)}</div>
        </div>`;
    }).join('');
}

function setLoading(elId, loading) {
    const el = document.getElementById(elId);
    if (loading) {
        el.innerHTML = '<div class="loading"><span class="spinner"></span> 思考中...</div>';
    }
}

function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2000);
}

document.addEventListener('DOMContentLoaded', () => {
    renderHistory();

    const translateInput = document.getElementById('translateInput');
    const translateBtn = document.getElementById('translateBtn');
    const contextSelect = document.getElementById('contextSelect');
    const translateResult = document.getElementById('translateResult');

    const explainInput = document.getElementById('explainInput');
    const explainBtn = document.getElementById('explainBtn');
    const explainResult = document.getElementById('explainResult');

    async function doTranslate() {
        const concept = translateInput.value.trim();
        if (!concept) { showToast('请输入中文概念'); return; }
        const context = contextSelect.value;
        translateBtn.disabled = true;
        setLoading('translateResult', true);

        const data = await translateApi(concept, context);
        renderTranslateResult(data);
        if (!data.error) addHistory('translate', concept);
        translateBtn.disabled = false;
    }

    async function doExplain() {
        const name = explainInput.value.trim();
        if (!name) { showToast('请输入变量名'); return; }
        explainBtn.disabled = true;
        setLoading('explainResult', true);

        const data = await explainApi(name);
        renderExplainResult(data);
        if (!data.error) addHistory('explain', name);
        explainBtn.disabled = false;
    }

    translateBtn.addEventListener('click', doTranslate);
    explainBtn.addEventListener('click', doExplain);

    translateInput.addEventListener('keydown', e => { if (e.key === 'Enter') doTranslate(); });
    explainInput.addEventListener('keydown', e => { if (e.key === 'Enter') doExplain(); });

    translateResult.addEventListener('click', e => {
        const btn = e.target.closest('.copy-btn');
        if (!btn) return;
        const text = btn.dataset.copy;
        navigator.clipboard.writeText(text).then(() => showToast('已复制: ' + text)).catch(() => showToast('复制失败'));
    });

    document.getElementById('historyList').addEventListener('click', e => {
        const item = e.target.closest('.history-item');
        if (!item) return;
        const type = item.dataset.type;
        const input = item.dataset.input;
        if (type === 'translate') {
            translateInput.value = input;
            doTranslate();
        } else {
            explainInput.value = input;
            doExplain();
        }
    });
});
