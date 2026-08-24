const test = require('node:test');
const assert = require('node:assert');
const c = require('../js/content.js');

const sample = {
  highschool: {
    name: '高中',
    grid: 'grid-2x2',
    sections: [
      {
        id: 'hs-study',
        name: '高考学习',
        desc: '',
        events: [
          { title: 'a', desc: '', imgs: [], caption: '', cover: '', layout: '' },
          { id: 'existing', title: 'b', desc: '', imgs: [], caption: '', cover: '', layout: '' },
        ],
      },
    ],
  },
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
  assert.equal(sections[0].events.length, 2);
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
