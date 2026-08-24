const fs = require('fs');
const path = require('path');
const { ensureEventIds, serializeData } = require('../js/content.js');
const { FALLBACK_DATA } = require('../js/fallback-data.js');

function countEvents(data) {
  let n = 0;
  Object.keys(data).forEach(function (k) {
    data[k].sections.forEach(function (s) { n += s.events.length; });
  });
  return n;
}

const data = ensureEventIds(FALLBACK_DATA);
const out = path.join(__dirname, '..', 'data.json');
fs.writeFileSync(out, serializeData(data));
console.log('data.json 已生成，事件数：' + countEvents(data));
