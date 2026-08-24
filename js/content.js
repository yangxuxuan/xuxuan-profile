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
  module.exports = {
    createEventId: createEventId,
    newEvent: newEvent,
    ensureEventIds: ensureEventIds,
    serializeData: serializeData,
    addEvent: addEvent,
    updateEvent: updateEvent,
    removeEvent: removeEvent
  };
}
