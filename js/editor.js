// 编辑模式：解锁、事件增删改、图片选择、发布。

const editor = { enabled: false, token: '', owner: 'yangxuxuan', repo: 'xuxuan-profile', branch: 'main' };
const editorPendingImages = []; // { name, blob, url } 待发布的新图

function isEditMode() { return editor.enabled; }

function initEditor() {
  document.getElementById('enterEditBtn').addEventListener('click', function () {
    if (!getToken()) openTokenModal();
    else enterEditMode();
  });

  document.getElementById('tokenCancelBtn').addEventListener('click', function () {
    document.getElementById('tokenModal').hidden = true;
  });
  document.getElementById('tokenSaveBtn').addEventListener('click', saveToken);
  document.getElementById('discardBtn').addEventListener('click', discardEdit);
  document.getElementById('saveExitBtn').addEventListener('click', saveAndExit);
  document.getElementById('publishBtn').addEventListener('click', publish);
  document.getElementById('evCancel').addEventListener('click', function () {
    document.getElementById('eventModal').hidden = true;
  });
  document.getElementById('evSave').addEventListener('click', saveEvent);
  document.getElementById('evAddCover').addEventListener('click', function () {
    document.getElementById('evCoverFile').click();
  });
  document.getElementById('evCoverFile').addEventListener('change', onCoverFileChange);
  document.getElementById('evCover').addEventListener('click', onCoverPickerClick);
  document.getElementById('evAddImg').addEventListener('click', function () {
    document.getElementById('evImgFile').click();
  });
  document.getElementById('evImgFile').addEventListener('change', onImgFileChange);
  document.getElementById('evImgs').addEventListener('click', onImgPickerClick);

  document.addEventListener('click', onEditActionClick);
}

// ===== 解锁 =====
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
  document.getElementById('enterEditBtn').hidden = true;
  document.getElementById('discardBtn').hidden = false;
  document.getElementById('saveExitBtn').hidden = false;
  document.getElementById('publishBtn').hidden = false;
  rerenderCurrent();
}

function exitEditMode() {
  editor.enabled = false;
  document.body.classList.remove('editing');
  document.getElementById('enterEditBtn').hidden = false;
  document.getElementById('discardBtn').hidden = true;
  document.getElementById('saveExitBtn').hidden = true;
  document.getElementById('publishBtn').hidden = true;
  rerenderCurrent();
}

function discardEdit() {
  if (!confirm('确定放弃所有还没发布的修改？')) return;
  clearDraft();
  editorPendingImages.length = 0;
  contentData = JSON.parse(JSON.stringify(publishedData));
  exitEditMode();
}

function saveAndExit() {
  setDraft(contentData);
  exitEditMode();
}

function rerenderCurrent() {
  if (state.currentPage === 'highschool' || state.currentPage === 'university') {
    renderContentPage(state.currentPage);
  }
}

// ===== 事件增删改入口 =====
function onEditActionClick(e) {
  const t = e.target.closest('[data-edit-action]');
  if (!t || !editor.enabled) return;
  e.stopPropagation();
  const action = t.dataset.editAction;
  const page = t.dataset.page;
  const sectionId = t.dataset.section;
  const eventId = t.dataset.event;
  if (action === 'add') openEventModal(page, sectionId, null);
  else if (action === 'edit') openEventModal(page, sectionId, eventId);
  else if (action === 'remove') removeCurrentEvent(page, sectionId, eventId);
}

// ===== 表单 =====
let evModalState = { page: '', sectionId: '', eventId: null, cover: '', images: [] };

function openEventModal(page, sectionId, eventId) {
  evModalState = { page: page, sectionId: sectionId, eventId: eventId, cover: '', images: [] };
  const pageData = contentData[page];
  const section = pageData.sections.find(function (s) { return s.id === sectionId; });
  const ev = eventId ? section.events.find(function (e) { return e.id === eventId; }) : null;

  document.getElementById('eventModalTitle').textContent = ev ? '编辑事件' : '新增事件';
  document.getElementById('evTitle').value = ev ? ev.title : '';
  document.getElementById('evDesc').value = ev ? ev.desc : '';
  document.getElementById('evCaption').value = ev ? ev.caption : '';
  const layout = (ev && ev.layout) || '';
  document.querySelectorAll('input[name=evLayout]').forEach(function (r) { r.checked = (r.value === layout); });
  if (ev) {
    evModalState.cover = ev.cover || '';
    evModalState.images = ev.imgs.slice();
    // 旧数据可能把封面同时存进了 imgs[0]，编辑时剥离，避免下次保存后封面重复出现在详情里
    if (evModalState.cover && evModalState.images[0] === evModalState.cover) {
      evModalState.images.shift();
    }
  }
  renderImgPicker();
  document.getElementById('eventModal').hidden = false;
}

function renderImgPicker() {
  renderCoverPicker();
  renderImgsPicker();
}

function renderCoverPicker() {
  const box = document.getElementById('evCover');
  box.innerHTML = '';
  const src = evModalState.cover;
  if (!src) {
    const empty = document.createElement('div');
    empty.className = 'img-name';
    empty.style.color = 'var(--text-muted)';
    empty.textContent = '未设置封面';
    box.appendChild(empty);
    return;
  }
  const label = (src.indexOf('blob:') === 0) ? '新图' : src.split('/').pop();
  const item = document.createElement('div');
  item.className = 'img-picker-item';
  item.innerHTML =
    '<img src="' + src + '" alt="">' +
    '<span class="img-name">' + label + '</span>' +
    '<button type="button" data-act="clear-cover">清除</button>';
  box.appendChild(item);
}

function renderImgsPicker() {
  const box = document.getElementById('evImgs');
  box.innerHTML = '';
  evModalState.images.forEach(function (src, idx) {
    const label = (src.indexOf('blob:') === 0) ? '新图' : src.split('/').pop();
    const item = document.createElement('div');
    item.className = 'img-picker-item';
    item.innerHTML =
      '<img src="' + src + '" alt="">' +
      '<span class="img-name">' + label + '</span>' +
      '<button type="button" data-idx="' + idx + '" data-act="del">删除</button>';
    box.appendChild(item);
  });
}

function onCoverPickerClick(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  if (btn.dataset.act === 'clear-cover') {
    evModalState.cover = '';
    renderImgPicker();
  }
}

function onImgPickerClick(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  if (btn.dataset.act === 'del') {
    const idx = parseInt(btn.dataset.idx, 10);
    evModalState.images.splice(idx, 1);
    renderImgPicker();
  }
}

async function onCoverFileChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const blob = await compressImage(file, 1600, 0.8);
  const name = generateImageName('jpg');
  const url = URL.createObjectURL(blob);
  editorPendingImages.push({ name: name, blob: blob, url: url });
  evModalState.cover = url;
  e.target.value = '';
  renderImgPicker();
}

async function onImgFileChange(e) {
  const files = Array.from(e.target.files || []);
  for (const f of files) {
    const blob = await compressImage(f, 1600, 0.8);
    const name = generateImageName('jpg');
    const url = URL.createObjectURL(blob);
    editorPendingImages.push({ name: name, blob: blob, url: url });
    evModalState.images.push(url);
  }
  e.target.value = '';
  renderImgPicker();
}

function saveEvent() {
  const title = document.getElementById('evTitle').value.trim();
  if (!title) { alert('标题不能为空'); return; }

  function mapToPublished(src) {
    if (src.indexOf('blob:') === 0) {
      const p = editorPendingImages.find(function (x) { return x.url === src; });
      return p ? 'images/' + p.name : src;
    }
    return src;
  }
  const finalImages = evModalState.images.map(mapToPublished);
  const finalCover = evModalState.cover ? mapToPublished(evModalState.cover) : '';

  const patch = {
    title: title,
    desc: document.getElementById('evDesc').value,
    imgs: finalImages,
    caption: document.getElementById('evCaption').value,
    cover: finalCover,
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

// ===== 发布 =====
async function publish() {
  const pubBtn = document.getElementById('publishBtn');
  if (!editor.token) { openTokenModal(); return; }
  pubBtn.disabled = true; pubBtn.textContent = '发布中…';
  try {
    const addImages = [];
    for (const p of editorPendingImages) {
      const base64 = await blobToBase64(p.blob);
      addImages.push({ path: 'images/' + p.name, base64: base64 });
    }
    const client = new GitHubClient({ token: editor.token, owner: editor.owner, repo: editor.repo, branch: editor.branch });
    const removeImages = await computeRemovedImages(client);
    await client.publish({ dataJson: serializeData(contentData), addImages: addImages, removeImages: removeImages });

    editorPendingImages.length = 0;
    clearDraft();
    publishedData = JSON.parse(JSON.stringify(contentData));
    pubBtn.textContent = '已发布 ✓';
    setTimeout(function () {
      exitEditMode();
      pubBtn.textContent = '发布';
      pubBtn.disabled = false;
    }, 1200);
  } catch (err) {
    alert('发布失败：' + err.message);
    pubBtn.textContent = '发布';
    pubBtn.disabled = false;
  }
}

async function computeRemovedImages(client) {
  try {
    const cur = await client.getFile('data.json');
    if (!cur) return [];
    const oldData = JSON.parse(base64ToUtf8(cur.content));
    const oldImgs = new Set();
    Object.values(oldData).forEach(function (p) {
      p.sections.forEach(function (s) { s.events.forEach(function (e) {
        if (e.cover) oldImgs.add(e.cover);
        e.imgs.forEach(function (i) { oldImgs.add(i); });
      }); });
    });
    const newImgs = new Set();
    Object.values(contentData).forEach(function (p) {
      p.sections.forEach(function (s) { s.events.forEach(function (e) {
        if (e.cover) newImgs.add(e.cover);
        e.imgs.forEach(function (i) { newImgs.add(i); });
      }); });
    });
    return Array.from(oldImgs).filter(function (i) { return !newImgs.has(i); });
  } catch (e) {
    return [];
  }
}
