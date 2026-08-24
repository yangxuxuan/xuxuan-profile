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
