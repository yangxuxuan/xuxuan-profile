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
