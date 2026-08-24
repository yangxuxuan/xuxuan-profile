// 存储：数据加载、Token、草稿。

const DATA_URL = 'data.json';
const TOKEN_KEY = 'xuxuan_token';
const DRAFT_KEY = 'xuxuan_draft';

async function loadData() {
  try {
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

function getDraft() {
  try {
    const v = localStorage.getItem(DRAFT_KEY);
    return v ? JSON.parse(v) : null;
  } catch (e) { return null; }
}
function setDraft(d) { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); }
function clearDraft() { localStorage.removeItem(DRAFT_KEY); }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DATA_URL: DATA_URL,
    TOKEN_KEY: TOKEN_KEY,
    DRAFT_KEY: DRAFT_KEY,
    loadData: loadData,
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    getDraft: getDraft,
    setDraft: setDraft,
    clearDraft: clearDraft
  };
}
