# Xuxuan Profile 可编辑能力 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给纯静态个人站增加「站长可编辑、访客可看」的能力：网页里增删改事件、传图、点发布即提交到 GitHub 并由 Pages 自动重发。

**Architecture:** 内容从 `index.html` 抽到 `data.json`，网站运行时 fetch 渲染（失败回退内嵌兜底数据）。新增一套纯前端编辑层：`js/*.js` 模块负责数据/图片/存储/GitHub 发布，`index.html` 负责渲染与编辑 UI。发布走 GitHub Contents API，Token 存站长浏览器 localStorage。

**Tech Stack:** 原生 HTML/CSS/JS（零依赖）；Node 内置 `node:test`（v25）做纯函数单元测试；Edge headless 做端到端验证。

**Spec:** `docs/superpowers/specs/2026-08-24-xuxuan-profile-editable-design.md`

## Global Constraints

- 零运行时依赖：不引入任何 npm 包、不引入 CDN。
- 纯函数文件用 UMD（`if (typeof module !== 'undefined') module.exports = {...}`），浏览器 `<script src>` 加载后函数进入全局作用域。
- 仓库：owner=`yangxuxuan`，repo=`xuxuan-profile`，branch=`main`。
- 图片压缩上限 1MB（GitHub Contents API 限制），最长边 1600px，JPEG quality 0.8。
- 可编辑范围仅「事件」层；板块/页面/首页文案不可编辑。
- Token 仅存 localStorage，绝不写入仓库、不打印到日志。

## File Structure

- `index.html` — 修改：删内联 `profileData`，改引 `js/fallback-data.js`；新增编辑 UI 的 DOM 与 CSS；数据加载与渲染改用 `contentData`。
- `data.json` — 新建（生成）：运行时内容数据（含事件 `id`）。
- `js/fallback-data.js` — 新建：兜底初始数据（现有 profileData 原样迁入，无 id）。
- `js/content.js` — 新建：数据纯函数（事件 id、CRUD、序列化）。
- `js/storage.js` — 新建：`loadData` / Token / 草稿 存取。
- `js/image.js` — 新建：图片尺寸计算、命名、压缩、base64。
- `js/github.js` — 新建：GitHub Contents API 客户端与发布流程。
- `js/editor.js` — 新建：编辑模式 UI 与发布触发。
- `scripts/gen-data.cjs` — 新建：从 fallback-data 生成 `data.json`。
- `test/content.test.js`、`test/image.test.js`、`test/github.test.js` — 新建：纯函数单元测试。

---

### Task 1: 数据纯函数 + 兜底数据 + 单元测试

**Files:**
- Create: `js/content.js`
- Create: `js/fallback-data.js`
- Create: `test/content.test.js`

**Interfaces:**
- Produces: `createEventId()`, `newEvent()`, `ensureEventIds(data)`, `serializeData(data)`, `addEvent(sections, sectionId, event)`, `updateEvent(sections, sectionId, eventId, patch)`, `removeEvent(sections, sectionId, eventId)`（均全局 + `module.exports`）
- Produces: `FALLBACK_DATA`（全局 + `module.exports`）

- [ ] **Step 1: 写 `js/content.js`**

```js
// 内容数据纯函数：事件 id 生成、事件增删改、序列化。

function createEventId() {
  return 'evt_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function newEvent() {
  return { id: createEventId(), title: '', desc: '', imgs: [], caption: '', cover: '', layout: '' };
}

function ensureEventIds(data) {
  const clone = JSON.parse(JSON.stringify(data));
  Object.keys(clone).forEach(function (pageKey) {
    clone[pageKey].sections.forEach(function (section) {
      section.events.forEach(function (ev) {
        if (!ev.id) ev.id = createEventId();
      });
    });
  });
  return clone;
}

function serializeData(data) {
  return JSON.stringify(data, null, 2);
}

function addEvent(sections, sectionId, event) {
  const clone = JSON.parse(JSON.stringify(sections));
  const i = clone.findIndex(function (s) { return s.id === sectionId; });
  if (i === -1) return clone;
  clone[i].events.push(event);
  return clone;
}

function updateEvent(sections, sectionId, eventId, patch) {
  const clone = JSON.parse(JSON.stringify(sections));
  const i = clone.findIndex(function (s) { return s.id === sectionId; });
  if (i === -1) return clone;
  const j = clone[i].events.findIndex(function (e) { return e.id === eventId; });
  if (j === -1) return clone;
  clone[i].events[j] = Object.assign({}, clone[i].events[j], patch, { id: eventId });
  return clone;
}

function removeEvent(sections, sectionId, eventId) {
  const clone = JSON.parse(JSON.stringify(sections));
  const i = clone.findIndex(function (s) { return s.id === sectionId; });
  if (i === -1) return clone;
  clone[i].events = clone[i].events.filter(function (e) { return e.id !== eventId; });
  return clone;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createEventId: createEventId, newEvent: newEvent, ensureEventIds: ensureEventIds, serializeData: serializeData, addEvent: addEvent, updateEvent: updateEvent, removeEvent: removeEvent };
}
```

- [ ] **Step 2: 写 `test/content.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
const c = require('../js/content.js');

const sample = {
  highschool: { name: '高中', grid: 'grid-2x2', sections: [
    { id: 'hs-study', name: '高考学习', desc: '', events: [
      { title: 'a', desc: '', imgs: [], caption: '', cover: '', layout: '' },
      { id: 'existing', title: 'b', desc: '', imgs: [], caption: '', cover: '', layout: '' },
    ] },
  ] },
  university: { name: '大学', sections: [] },
};

test('createEventId 格式 evt_ 前缀且含字母数字', () => {
  assert.match(c.createEventId(), /^evt_[a-z0-9]+$/);
});

test('createEventId 不重复', () => {
  const ids = new Set(Array.from({ length: 1000 }, () => c.createEventId()));
  assert.equal(ids.size, 1000);
});

test('ensureEventIds 给无 id 的补 id，已有 id 的不变，不改原对象', () => {
  const before = JSON.stringify(sample);
  const out = c.ensureEventIds(sample);
  assert.ok(out.highschool.sections[0].events[0].id);
  assert.equal(out.highschool.sections[0].events[1].id, 'existing');
  assert.equal(JSON.stringify(sample), before);
});

test('serializeData 输出带缩进 JSON', () => {
  assert.equal(c.serializeData({ a: 1 }), '{\n  "a": 1\n}');
});

test('addEvent 只影响目标 section', () => {
  const sections = sample.highschool.sections;
  const ev = c.newEvent();
  const out = c.addEvent(sections, 'hs-study', ev);
  assert.equal(out[0].events.length, 3);
  assert.equal(out[0].events[2].id, ev.id);
  assert.equal(sections[0].events.length, 2); // 原数组不变
});

test('updateEvent 按 id 更新且保留 id', () => {
  const out = c.updateEvent(sample.highschool.sections, 'hs-study', 'existing', { title: '改' });
  assert.equal(out[0].events[1].title, '改');
  assert.equal(out[0].events[1].id, 'existing');
});

test('removeEvent 按 id 删除', () => {
  const out = c.removeEvent(sample.highschool.sections, 'hs-study', 'existing');
  assert.equal(out[0].events.length, 1);
});
```

- [ ] **Step 3: 运行测试确认通过**

Run: `node --test test/content.test.js`
Expected: 6 tests pass。

- [ ] **Step 4: 写 `js/fallback-data.js`**（把 `index.html` 497-559 行的 `profileData = {...}` 对象原样迁入，去掉 `ev(...)` 调用、展开为字面量对象，字段顺序 `title, desc, imgs, caption, cover, layout`，不写 `id`）

```js
// 兜底初始数据：data.json 读取失败时用于渲染，也是生成首个 data.json 的来源。
// 事件 id 由 ensureEventIds 在运行时补齐。
const FALLBACK_DATA = { /* 从 index.html 现有 profileData 迁入，见 Step 4a */ };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FALLBACK_DATA: FALLBACK_DATA };
}
```

- [ ] **Step 4a: 迁入数据**：从 `index.html` 复制 `profileData` 对象体，替换 `/* ... */` 占位。所有 `ev('题', '述', [img], '备注', 'cover', 'layout')` 展开成 `{ title, desc, imgs, caption, cover, layout }`；无参则 `imgs: []`。

- [ ] **Step 5: 提交**

```bash
git add js/content.js js/fallback-data.js test/content.test.js
git commit -m "feat: 数据纯函数与兜底数据"
```

---

### Task 2: 生成初始 data.json

**Files:**
- Create: `scripts/gen-data.cjs`
- Create: `data.json`

**Interfaces:**
- Consumes: `ensureEventIds`, `serializeData` (content.js), `FALLBACK_DATA` (fallback-data.js)
- Produces: `data.json`（含事件 id）

- [ ] **Step 1: 写 `scripts/gen-data.cjs`**

```js
const fs = require('fs');
const path = require('path');
const { ensureEventIds, serializeData } = require('../js/content.js');
const { FALLBACK_DATA } = require('../js/fallback-data.js');

function countEvents(data) {
  let n = 0;
  Object.keys(data).forEach(k => data[k].sections.forEach(s => { n += s.events.length; }));
  return n;
}

const data = ensureEventIds(FALLBACK_DATA);
fs.writeFileSync(path.join(__dirname, '..', 'data.json'), serializeData(data));
console.log('data.json 已生成，事件数：' + countEvents(data));
```

- [ ] **Step 2: 运行生成**

Run: `node scripts/gen-data.cjs`
Expected: 输出事件数 15，生成 `data.json`。

- [ ] **Step 3: 校验 data.json 可解析**

Run: `node -e "const d=require('./data.json'); console.log(Object.keys(d));"`（若因 JSON 非模块报错，改用 `node -e "console.log(JSON.parse(require('fs').readFileSync('data.json','utf8')).highschool.name)"`）
Expected: 输出 `['highschool','university']` 与 `高中`。

- [ ] **Step 4: 提交**

```bash
git add scripts/gen-data.cjs data.json
git commit -m "feat: 生成初始 data.json"
```

---

### Task 3: 数据加载改造（storage.js + index.html）

**Files:**
- Create: `js/storage.js`
- Modify: `index.html`（删内联 profileData；引 fallback-data.js；contentData 化；启动加载）

**Interfaces:**
- Consumes: `ensureEventIds` (content.js)
- Produces: `loadData()` → Promise<object|null>；`getToken/setToken/clearToken`；`getDraft/setDraft/clearDraft`；全局 `contentData`（当前内容源）；全局 `FALLBACK_DATA`。

- [ ] **Step 1: 写 `js/storage.js`**

```js
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
  try { const v = localStorage.getItem(DRAFT_KEY); return v ? JSON.parse(v) : null; }
  catch (e) { return null; }
}
function setDraft(d) { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); }
function clearDraft() { localStorage.removeItem(DRAFT_KEY); }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DATA_URL: DATA_URL, TOKEN_KEY: TOKEN_KEY, DRAFT_KEY: DRAFT_KEY, loadData: loadData, getToken: getToken, setToken: setToken, clearToken: clearToken, getDraft: getDraft, setDraft: setDraft, clearDraft: clearDraft };
}
```

- [ ] **Step 2: 删 `index.html` 内联数据**：删除第 491-559 行中「`// ========== Data ==========` 注释、`ev` 函数、`const profileData = {...}`」整段（保留 `state` 等后续代码）。`ev` 函数也不再需要。

- [ ] **Step 3: 引 script 并加 contentData**：在 `index.html` 内联 `<script>` 的开头（`const state = {...}` 之前）加：

```js
let contentData = ensureEventIds(FALLBACK_DATA);
```

并在 `renderContentPage` 内把 `const data = profileData[pageKey];` 改为 `const data = contentData[pageKey];`。

- [ ] **Step 4: 引外部 js 文件**：在 `<body>` 末尾、现有内联 `<script>` 之前插入：

```html
<script src="js/fallback-data.js"></script>
<script src="js/content.js"></script>
<script src="js/storage.js"></script>
<script src="js/image.js"></script>
<script src="js/github.js"></script>
<script src="js/editor.js"></script>
```

（image.js / github.js / editor.js 后续任务创建；先全部引用可让后续只加文件不改引用。）

- [ ] **Step 5: 启动加载**：在内联 script 末尾（导航绑定之后）追加：

```js
(async function init() {
  const loaded = await loadData();
  contentData = loaded ? ensureEventIds(loaded) : ensureEventIds(FALLBACK_DATA);
  const draft = getDraft();
  if (draft) contentData = draft;
  initEditor();
  if (state.currentPage === 'highschool' || state.currentPage === 'university') {
    renderContentPage(state.currentPage);
  }
})();
```

（`initEditor` 在 Task 6 定义；当前 editor.js 可为空文件，避免报错。）

- [ ] **Step 6: 端到端验证渲染**：用 headless Edge dump-dom，确认页面加载后 `data.json` 内容被渲染（非兜底占位）：

```
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --dump-dom "file:///D:/xuxuan-profile/index.html" > /tmp/dom.html
```
检查 dom 中含 `学科竞赛` 等板块名、且 fetch 到 data.json（用临时注入 console 校验，或直接目视 dom 含真实事件名）。

- [ ] **Step 7: 提交**

```bash
git add js/storage.js index.html
git commit -m "feat: 数据加载改造，内容源切换到 contentData"
```

---

### Task 4: 图片处理模块 + 单元测试

**Files:**
- Create: `js/image.js`
- Create: `test/image.test.js`

**Interfaces:**
- Produces: `computeTargetSize(w, h, maxSide)`, `generateImageName(ext)`, `compressImage(file, maxSide, quality)` → Promise<Blob>, `blobToBase64(blob)` → Promise<string>

- [ ] **Step 1: 写 `js/image.js`**

```js
function computeTargetSize(w, h, maxSide) {
  maxSide = maxSide || 1600;
  if (Math.max(w, h) <= maxSide) return { w: w, h: h };
  const scale = maxSide / Math.max(w, h);
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

function generateImageName(ext) {
  ext = ext || 'jpg';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let hex = '';
  bytes.forEach(function (b) { hex += b.toString(16).padStart(2, '0'); });
  return hex + '.' + ext;
}

function compressImage(file, maxSide, quality) {
  maxSide = maxSide || 1600;
  quality = typeof quality === 'number' ? quality : 0.8;
  return new Promise(function (resolve, reject) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () {
      const t = computeTargetSize(img.naturalWidth, img.naturalHeight, maxSide);
      const canvas = document.createElement('canvas');
      canvas.width = t.w; canvas.height = t.h;
      canvas.getContext('2d').drawImage(img, 0, 0, t.w, t.h);
      URL.revokeObjectURL(url);
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob); else reject(new Error('compress failed'));
      }, 'image/jpeg', quality);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function blobToBase64(blob) {
  return new Promise(function (resolve, reject) {
    const fr = new FileReader();
    fr.onload = function () { resolve(fr.result.split(',')[1]); };
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeTargetSize: computeTargetSize, generateImageName: generateImageName, compressImage: compressImage, blobToBase64: blobToBase64 };
}
```

- [ ] **Step 2: 写 `test/image.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
const img = require('../js/image.js');

test('computeTargetSize 横图缩放', () => {
  assert.deepEqual(img.computeTargetSize(4000, 3000, 1600), { w: 1600, h: 1200 });
});
test('computeTargetSize 竖图缩放', () => {
  assert.deepEqual(img.computeTargetSize(3000, 4000, 1600), { w: 1200, h: 1600 });
});
test('computeTargetSize 小图不放大', () => {
  assert.deepEqual(img.computeTargetSize(800, 600, 1600), { w: 800, h: 600 });
});
test('generateImageName 32 位 hex + 扩展名', () => {
  assert.match(img.generateImageName('jpg'), /^[0-9a-f]{32}\.jpg$/);
});
```

- [ ] **Step 3: 运行测试**

Run: `node --test test/image.test.js`
Expected: 4 tests pass。

- [ ] **Step 4: 提交**

```bash
git add js/image.js test/image.test.js
git commit -m "feat: 图片压缩与命名模块"
```

---

### Task 5: GitHub 发布客户端 + 单元测试

**Files:**
- Create: `js/github.js`
- Create: `test/github.test.js`

**Interfaces:**
- Produces: `class GitHubClient`（构造 `{token, owner, repo, branch}`；方法 `getFile`, `putFile`, `deleteFile`, `publish`），`utf8ToBase64(str)`, `buildPutPayload(path, base64, sha, message, branch)`。

- [ ] **Step 1: 写 `js/github.js`**

```js
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(function (b) { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function buildPutPayload(filePath, base64, sha, message, branch) {
  const body = { message: message, content: base64, branch: branch || 'main' };
  if (sha) body.sha = sha;
  return body;
}

class GitHubClient {
  constructor(opts) {
    this.token = opts.token; this.owner = opts.owner; this.repo = opts.repo;
    this.branch = opts.branch || 'main';
  }
  _headers() {
    return {
      'Authorization': 'Bearer ' + this.token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }
  async _request(method, path, body) {
    const res = await fetch('https://api.github.com' + path, {
      method: method,
      headers: this._headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error('GitHub API ' + res.status + ': ' + text.slice(0, 200));
    }
    return res.json();
  }
  async getFile(filePath) {
    const path = '/repos/' + this.owner + '/' + this.repo + '/contents/' + filePath + '?ref=' + this.branch;
    const res = await fetch('https://api.github.com' + path, { headers: this._headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('GitHub get ' + res.status);
    const json = await res.json();
    return { sha: json.sha, content: json.content };
  }
  async putFile(filePath, base64, sha, message) {
    return this._request('PUT', '/repos/' + this.owner + '/' + this.repo + '/contents/' + filePath,
      buildPutPayload(filePath, base64, sha, message, this.branch));
  }
  async deleteFile(filePath, sha, message) {
    return this._request('DELETE', '/repos/' + this.owner + '/' + this.repo + '/contents/' + filePath,
      { message: message, branch: this.branch, sha: sha });
  }
  async publish(opts) {
    const msg = 'Update content via editor';
    const addImages = opts.addImages || [];
    const removeImages = opts.removeImages || [];
    for (const img of addImages) {
      await this.putFile(img.path, img.base64, null, msg);
    }
    for (const path of removeImages) {
      const existing = await this.getFile(path);
      if (existing) await this.deleteFile(path, existing.sha, msg);
    }
    const cur = await this.getFile('data.json');
    await this.putFile('data.json', utf8ToBase64(opts.dataJson), cur ? cur.sha : undefined, msg);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GitHubClient: GitHubClient, utf8ToBase64: utf8ToBase64, buildPutPayload: buildPutPayload };
}
```

- [ ] **Step 2: 写 `test/github.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
const g = require('../js/github.js');

test('utf8ToBase64 正确处理中文', () => {
  assert.equal(g.utf8ToBase64('高中'), Buffer.from('高中', 'utf8').toString('base64'));
});

test('buildPutPayload 无 sha 不含 sha 字段', () => {
  const p = g.buildPutPayload('images/a.jpg', 'AA==', null, 'm', 'main');
  assert.deepEqual(p, { message: 'm', content: 'AA==', branch: 'main' });
});

test('buildPutPayload 有 sha 带上 sha', () => {
  const p = g.buildPutPayload('data.json', 'AA==', 'abc', 'm', 'main');
  assert.equal(p.sha, 'abc');
});

test('GitHubClient 构造默认 branch', () => {
  const c = new g.GitHubClient({ token: 't', owner: 'o', repo: 'r' });
  assert.equal(c.branch, 'main');
});
```

- [ ] **Step 3: 运行测试**

Run: `node --test test/github.test.js`
Expected: 4 tests pass。

- [ ] **Step 4: 提交**

```bash
git add js/github.js test/github.test.js
git commit -m "feat: GitHub 发布客户端"
```

---

### Task 6: 编辑模式入口与控件（editor.js + index.html UI）

**Files:**
- Create: `js/editor.js`
- Modify: `index.html`（新增编辑按钮、提示条、Token 弹窗、事件表单弹窗的 DOM 与 CSS）

**Interfaces:**
- Consumes: `getToken/setToken/clearToken/getDraft/setDraft/clearDraft` (storage.js)；`GitHubClient` (github.js)；`compressImage/blobToBase64/generateImageName` (image.js)；全局 `state`、`contentData`、`viewState`、`renderContentPage`（index.html 内联）。
- Produces: 全局 `editor`（`{enabled, token, owner, repo, branch}`），`isEditMode()`, `initEditor()`。

- [ ] **Step 1: 写 `js/editor.js`（编辑模式状态与解锁）**

```js
const editor = { enabled: false, token: '', owner: 'yangxuxuan', repo: 'xuxuan-profile', branch: 'main' };
const editorPendingImages = []; // { name, blob } 待发布的新图

function isEditMode() { return editor.enabled; }

function initEditor() {
  const btn = document.getElementById('editBtn');
  if (!btn) return;
  btn.addEventListener('click', function () {
    if (!editor.enabled) {
      if (!getToken()) openTokenModal();
      else enterEditMode();
    } else {
      exitEditMode();
    }
  });
  const tokenSave = document.getElementById('tokenSaveBtn');
  if (tokenSave) tokenSave.addEventListener('click', saveToken);
  const exitBtn = document.getElementById('exitEditBtn');
  if (exitBtn) exitBtn.addEventListener('click', exitEditMode);
  const pubBtn = document.getElementById('publishBtn');
  if (pubBtn) pubBtn.addEventListener('click', publish);
  document.addEventListener('click', onEditActionClick);
}

function openTokenModal() {
  document.getElementById('tokenInput').value = '';
  document.getElementById('tokenModal').hidden = false;
}

function saveToken() {
  const t = document.getElementById('tokenInput').value.trim();
  if (!t) return;
  setToken(t);
  editor.token = t;
  document.getElementById('tokenModal').hidden = true;
  enterEditMode();
}

function enterEditMode() {
  editor.enabled = true;
  editor.token = getToken();
  document.body.classList.add('editing');
  document.getElementById('editBar').hidden = false;
  rerenderCurrent();
}

function exitEditMode() {
  editor.enabled = false;
  document.body.classList.remove('editing');
  document.getElementById('editBar').hidden = true;
  rerenderCurrent();
}

function rerenderCurrent() {
  if (state.currentPage === 'highschool' || state.currentPage === 'university') {
    renderContentPage(state.currentPage);
  }
}

function onEditActionClick(e) {
  const t = e.target.closest('[data-edit-action]');
  if (!t || !editor.enabled) return;
  const action = t.dataset.editAction;
  const page = t.dataset.page;
  const sectionId = t.dataset.section;
  const eventId = t.dataset.event;
  if (action === 'add') openEventModal(page, sectionId, null);
  else if (action === 'edit') openEventModal(page, sectionId, eventId);
  else if (action === 'remove') removeCurrentEvent(page, sectionId, eventId);
}
```

- [ ] **Step 2: `index.html` 新增 CSS（追加到 `</style>` 前）**

```css
/* ===== 编辑模式 ===== */
.edit-btn { position: fixed; right: 18px; bottom: 18px; width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--line-light); background: rgba(255,255,255,0.85); color: var(--text-secondary); font-size: 18px; cursor: pointer; z-index: 60; box-shadow: 0 2px 10px rgba(0,0,0,0.06); }
.edit-bar { position: fixed; left: 0; right: 0; bottom: 0; height: 48px; display: flex; align-items: center; justify-content: center; gap: 12px; background: #111; color: #fff; font-size: 0.85rem; z-index: 70; }
.edit-bar button { border: 1px solid rgba(255,255,255,0.4); background: transparent; color: #fff; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
.edit-bar button.primary { background: #2563eb; border-color: #2563eb; }
.photo-card .edit-tools { position: absolute; top: 6px; right: 6px; display: none; gap: 4px; }
body.editing .photo-card .edit-tools { display: flex; }
.edit-tools button { border: none; background: rgba(0,0,0,0.55); color: #fff; font-size: 0.72rem; padding: 3px 7px; border-radius: 4px; cursor: pointer; }
.grid-add { display: flex; align-items: center; justify-content: center; min-height: 120px; border: 1px dashed var(--line-light); border-radius: 12px; color: var(--text-muted); cursor: pointer; background: transparent; font-size: 0.9rem; }
.modal { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 80; }
.modal-box { background: #fff; border-radius: 14px; padding: 24px; width: min(560px, 92vw); max-height: 86vh; overflow: auto; }
.modal-box h3 { margin: 0 0 16px; font-size: 1.1rem; font-weight: 500; }
.modal-box label { display: block; font-size: 0.8rem; color: var(--text-secondary); margin: 12px 0 4px; }
.modal-box input[type=text], .modal-box textarea { width: 100%; border: 1px solid var(--line-light); border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 0.9rem; box-sizing: border-box; }
.modal-box textarea { min-height: 90px; resize: vertical; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.modal-actions button { padding: 8px 16px; border-radius: 8px; border: 1px solid var(--line-light); background: #fff; cursor: pointer; font-size: 0.9rem; }
.modal-actions button.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.img-picker-item { display: flex; align-items: center; gap: 10px; padding: 6px 0; }
.img-picker-item img { width: 60px; height: 60px; object-fit: cover; border-radius: 6px; }
.img-picker-item .img-name { flex: 1; font-size: 0.8rem; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.img-picker-item button { border: none; background: none; color: #c0392b; cursor: pointer; font-size: 0.8rem; }
.layout-row { display: flex; gap: 12px; }
.layout-row label { margin: 0; font-size: 0.85rem; }
```

- [ ] **Step 3: `index.html` 新增 DOM（追加到 `</body>` 前）**

```html
<button id="editBtn" class="edit-btn" title="编辑">✎</button>
<div id="editBar" class="edit-bar" hidden>
  <span>编辑模式中</span>
  <button id="publishBtn" class="primary">保存并发布</button>
  <button id="exitEditBtn">退出</button>
</div>

<div id="tokenModal" class="modal" hidden>
  <div class="modal-box">
    <h3>输入 GitHub Token 解锁编辑</h3>
    <label>Personal Access Token</label>
    <input type="text" id="tokenInput" placeholder="github_pat_...">
    <div class="modal-actions">
      <button id="tokenSaveBtn" class="primary">解锁</button>
    </div>
  </div>
</div>

<div id="eventModal" class="modal" hidden>
  <div class="modal-box">
    <h3 id="eventModalTitle">事件</h3>
    <label>标题</label><input type="text" id="evTitle">
    <label>描述</label><textarea id="evDesc"></textarea>
    <label>图片</label>
    <div id="evImgs"></div>
    <button type="button" id="evAddImg">＋ 上传图片</button>
    <input type="file" id="evImgFile" accept="image/*" multiple hidden>
    <label>备注</label><input type="text" id="evCaption">
    <label>排版</label>
    <div class="layout-row">
      <label><input type="radio" name="evLayout" value=""> 上图下文</label>
      <label><input type="radio" name="evLayout" value="split"> 左图右文</label>
    </div>
    <div class="modal-actions">
      <button id="evCancel">取消</button>
      <button id="evSave" class="primary">保存</button>
    </div>
  </div>
</div>
```

- [ ] **Step 4: 在 `renderContentPage` 的 grid 分支注入编辑控件**：在 `.photo-grid` 渲染处，若 `isEditMode()`，在网格前加 `＋新增事件` 按钮、每个 `photo-card` 内加 `编辑/删除` 工具（带 `data-edit-action` / `data-page` / `data-section` / `data-event`）。

- [ ] **Step 5: 端到端验证**：headless Edge 打开首页，确认右下角出现 `editBtn`；`editBar`/`tokenModal` 初始 hidden；点击编辑按钮弹出 tokenModal（用 dump-dom 或注入脚本模拟点击后检查 hidden 状态）。

- [ ] **Step 6: 提交**

```bash
git add js/editor.js index.html
git commit -m "feat: 编辑模式入口与解锁"
```

---

### Task 7: 事件表单（新增/编辑 + 图片选择）

**Files:**
- Modify: `js/editor.js`

**Interfaces:**
- Consumes: `newEvent/addEvent/updateEvent/removeEvent` (content.js)；`compressImage/generateImageName` (image.js)；`setDraft` (storage.js)。
- Produces: `openEventModal(page, sectionId, eventId)`, `saveEvent()`, `removeCurrentEvent(page, sectionId, eventId)`。

- [ ] **Step 1: 在 `js/editor.js` 追加表单逻辑**

```js
let evModalState = { page: '', sectionId: '', eventId: null, images: [], removedImages: [] };

function openEventModal(page, sectionId, eventId) {
  evModalState = { page: page, sectionId: sectionId, eventId: eventId, images: [], removedImages: [] };
  const pageData = contentData[page];
  const section = pageData.sections.find(s => s.id === sectionId);
  const ev = eventId ? section.events.find(e => e.id === eventId) : null;
  document.getElementById('eventModalTitle').textContent = ev ? '编辑事件' : '新增事件';
  document.getElementById('evTitle').value = ev ? ev.title : '';
  document.getElementById('evDesc').value = ev ? ev.desc : '';
  document.getElementById('evCaption').value = ev ? ev.caption : '';
  const layout = (ev && ev.layout) || '';
  document.querySelectorAll('input[name=evLayout]').forEach(r => { r.checked = (r.value === layout); });
  if (ev) evModalState.images = ev.imgs.slice();
  renderImgPicker();
  document.getElementById('eventModal').hidden = false;
}

function renderImgPicker() {
  const box = document.getElementById('evImgs');
  box.innerHTML = '';
  evModalState.images.forEach(function (src, idx) {
    const item = document.createElement('div');
    item.className = 'img-picker-item';
    const isCover = (src === currentCover());
    item.innerHTML =
      '<img src="' + src + '">' +
      '<span class="img-name">' + (isCover ? '[封面] ' : '') + src.split('/').pop() + '</span>' +
      '<button data-idx="' + idx + '" data-act="cover">封面</button>' +
      '<button data-idx="' + idx + '" data-act="del">删除</button>';
    box.appendChild(item);
  });
}

function currentCover() {
  return evModalState.images.length ? evModalState.images[0] : '';
}

box 事件委托（绑定于 initEditor 一次）：
document.getElementById('evImgs').addEventListener('click', function (e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx, 10);
  if (btn.dataset.act === 'cover') {
    const src = evModalState.images.splice(idx, 1)[0];
    evModalState.images.unshift(src);
  } else if (btn.dataset.act === 'del') {
    const removed = evModalState.images.splice(idx, 1)[0];
    evModalState.removedImages.push(removed);
  }
  renderImgPicker();
});

document.getElementById('evAddImg').addEventListener('click', function () { document.getElementById('evImgFile').click(); });
document.getElementById('evImgFile').addEventListener('change', async function (e) {
  const files = Array.from(e.target.files || []);
  for (const f of files) {
    const blob = await compressImage(f, 1600, 0.8);
    const name = generateImageName('jpg');
    editorPendingImages.push({ name: name, blob: blob });
    const url = URL.createObjectURL(blob);
    evModalState.images.push(url);
  }
  e.target.value = '';
  renderImgPicker();
});
```

> 注：表单内新图用 `URL.createObjectURL` 预览，发布时再把 `editorPendingImages` 转成 `images/<name>.jpg` 正式路径（见 Task 8）。为简化，编辑期间 `images` 数组里新图是临时 URL，保存事件时需将临时 URL 映射回正式路径。

- [ ] **Step 2: 保存与删除事件**

```js
function saveEvent() {
  const title = document.getElementById('evTitle').value.trim();
  if (!title) { alert('标题不能为空'); return; }
  // 临时 URL → 正式路径映射
  const urlToPath = {};
  editorPendingImages.forEach(function (p) { urlToPath[URL.createObjectURL(p.blob)] = null; });
  const finalImages = evModalState.images.map(function (src) {
    if (src.indexOf('blob:') === 0) return 'images/' + editorPendingImages.find(p => src === URL.createObjectURL(p.blob)).name + '.jpg';
    return src;
  });
  const patch = {
    title: title,
    desc: document.getElementById('evDesc').value,
    imgs: finalImages,
    caption: document.getElementById('evCaption').value,
    cover: finalImages[0] || '',
    layout: document.querySelector('input[name=evLayout]:checked').value,
  };
  const pageData = contentData[evModalState.page];
  if (evModalState.eventId) {
    pageData.sections = updateEvent(pageData.sections, evModalState.sectionId, evModalState.eventId, patch);
  } else {
    const ev = newEvent();
    Object.assign(ev, patch);
    pageData.sections = addEvent(pageData.sections, evModalState.sectionId, ev);
  }
  setDraft(contentData);
  document.getElementById('eventModal').hidden = true;
  rerenderCurrent();
}

function removeCurrentEvent(page, sectionId, eventId) {
  if (!confirm('确认删除该事件？')) return;
  const pageData = contentData[page];
  pageData.sections = removeEvent(pageData.sections, sectionId, eventId);
  setDraft(contentData);
  rerenderCurrent();
}
```

- [ ] **Step 3: 绑定表单按钮**：在 `initEditor` 里补 `evSave`/`evCancel`/`evImgFile`/`evAddImg` 等监听。

- [ ] **Step 4: 端到端验证**：headless 注入脚本进入编辑模式 + 打开表单，确认表单字段填充、新增事件后 `contentData` 变化、draft 写入 localStorage。

- [ ] **Step 5: 提交**

```bash
git add js/editor.js
git commit -m "feat: 事件表单与图片选择"
```

---

### Task 8: 发布流程（保存并发布）

**Files:**
- Modify: `js/editor.js`

**Interfaces:**
- Consumes: `GitHubClient.publish` (github.js)；`blobToBase64` (image.js)；`serializeData` (content.js)；`clearDraft` (storage.js)。
- Produces: `publish()`。

- [ ] **Step 1: 实现 `publish()`**

```js
async function publish() {
  const pubBtn = document.getElementById('publishBtn');
  if (!editor.token) { openTokenModal(); return; }
  pubBtn.disabled = true; pubBtn.textContent = '发布中…';
  try {
    // 新图 → addImages
    const addImages = [];
    for (const p of editorPendingImages) {
      const base64 = await blobToBase64(p.blob);
      addImages.push({ path: 'images/' + p.name + '.jpg', base64: base64 });
    }
    // 已从所有事件移除的图片 → removeImages（对比 data.json 当前引用的集合）
    const removeImages = collectRemovedImages();
    const client = new GitHubClient({ token: editor.token, owner: editor.owner, repo: editor.repo, branch: editor.branch });
    await client.publish({ dataJson: serializeData(contentData), addImages: addImages, removeImages: removeImages });
    editorPendingImages.length = 0;
    clearDraft();
    pubBtn.textContent = '已发布 ✓';
    setTimeout(function () { pubBtn.textContent = '保存并发布'; pubBtn.disabled = false; }, 3000);
  } catch (err) {
    alert('发布失败：' + err.message);
    pubBtn.textContent = '保存并发布'; pubBtn.disabled = false;
  }
}

function collectRemovedImages() {
  const used = new Set();
  ['highschool', 'university'].forEach(function (pk) {
    contentData[pk].sections.forEach(function (s) {
      s.events.forEach(function (ev) {
        ev.imgs.forEach(function (i) { used.add(i); });
      });
    });
  });
  const all = Object.keys(editorPendingImages).map(function () { return ''; });
  // 简化：仅对本次会话明确删除的图做清理。删除图记录在 editor.removedImages 中。
  return (editor.removedImages || []).filter(function (p) { return !used.has(p); });
}
```

> 注：`editor.removedImages` 需在 `removeCurrentEvent` / 表单删除图时累积真实路径（`images/...`）。在 Task 7 的删除逻辑里，若删除的是正式路径（非 blob:），push 到 `editor.removedImages`。实现时补一处累积。

- [ ] **Step 2: 补全 `editor.removedImages` 累积**：在 `editor` 对象加 `removedImages: []`；`removeCurrentEvent` 里把被删事件的 `imgs` 中非 blob 路径 push 进去；表单删除图时同样处理。

- [ ] **Step 3: 端到端验证（需真实 Token）**：用户提供一把 Token 后，在浏览器里新增一个测试事件并发布，确认 GitHub 出现提交、Pages 更新。此步骤需用户配合，作为最终验收。

- [ ] **Step 4: 提交**

```bash
git add js/editor.js
git commit -m "feat: 保存并发布流程"
```

---

### Task 9: 使用说明文档 + 收尾验证

**Files:**
- Create: `README.md`（或追加到现有说明）—— 描述「如何创建 Token、如何进入编辑、如何发布」。
- Modify: `data.json`（如需，与 fallback-data 保持同步）。

- [ ] **Step 1: 写使用说明**（Token 创建步骤、编辑/发布操作、注意事项：Token 保密、1MB 图片限制、发布延迟）。

- [ ] **Step 2: 全量回归**：`node --test` 全跑；headless 验证首页/高中/大学渲染、编辑模式、兜底路径（临时移除 data.json 后页面仍渲染 fallback 内容）。

- [ ] **Step 3: 提交**

```bash
git add README.md
git commit -m "docs: 可编辑功能使用说明"
```

---

## Self-Review 结论

- Spec 覆盖：数据抽离（T1-T3）、编辑模式（T6）、事件表单（T7）、图片压缩（T4）、发布与安全（T5/T8）、边界（T3 兜底、T8 冲突/删除）、Token（T6/T9）均有对应任务。非目标（板块/首页不可编辑）通过「只在事件层加控件」实现。
- 占位符：Task 1 Step 4a 的 `/* ... */` 是「从现有文件迁入」的明确操作指令，非待补充细节。
- 类型一致性：`contentData`、`ensureEventIds`、`GitHubClient`、`editorPendingImages` 等命名贯穿一致。
