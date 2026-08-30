const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const devServer = require('../scripts/dev-server.cjs');

test('injectLiveReload 在 body 结束前注入客户端且不会重复注入', () => {
  const html = '<!doctype html><html><body><h1>首页</h1></body></html>';
  const once = devServer.injectLiveReload(html);
  const twice = devServer.injectLiveReload(once);

  assert.match(once, /new EventSource\('\/__live_reload'\)/);
  assert.ok(once.indexOf('new EventSource') < once.indexOf('</body>'));
  assert.equal(twice, once);
});

test('resolveRequestPath 只允许访问项目目录内部文件', () => {
  const root = path.resolve('D:/example-project');

  assert.equal(
    devServer.resolveRequestPath(root, '/images/photo.jpg'),
    path.join(root, 'images', 'photo.jpg')
  );
  assert.equal(devServer.resolveRequestPath(root, '/..%2Fsecret.txt'), null);
  assert.equal(devServer.resolveRequestPath(root, '/%2e%2e%5csecret.txt'), null);
});

test('shouldReload 仅响应网站资源并忽略 git 与文档目录', () => {
  assert.equal(devServer.shouldReload('index.html'), true);
  assert.equal(devServer.shouldReload('data.json'), true);
  assert.equal(devServer.shouldReload('js/editor.js'), true);
  assert.equal(devServer.shouldReload('images/cover.png'), true);
  assert.equal(devServer.shouldReload('.git/index'), false);
  assert.equal(devServer.shouldReload('docs/notes.md'), false);
});

test('resolveWindowsCommand 优先使用 ComSpec 并能从 SystemRoot 构造绝对路径', () => {
  assert.equal(
    devServer.resolveWindowsCommand({ ComSpec: 'C:\\Windows\\System32\\cmd.exe' }),
    'C:\\Windows\\System32\\cmd.exe'
  );
  assert.equal(
    devServer.resolveWindowsCommand({ SystemRoot: 'D:\\Windows' }),
    path.join('D:\\Windows', 'System32', 'cmd.exe')
  );
});

test('createDevServer 通过 HTTP 提供真实数据并仅对 HTML 注入刷新客户端', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xuxuan-dev-server-'));
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><body>本地首页</body>');
  fs.writeFileSync(path.join(root, 'data.json'), '{"name":"线上同源数据"}');

  const instance = devServer.createDevServer({ rootDir: root, port: 0, watch: false });
  await instance.start();
  t.after(async () => {
    await instance.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  const home = await fetch(instance.url + '/');
  const data = await fetch(instance.url + '/data.json');
  const missing = await fetch(instance.url + '/missing.txt');

  assert.equal(home.status, 200);
  assert.match(await home.text(), /new EventSource\('\/__live_reload'\)/);
  assert.deepEqual(await data.json(), { name: '线上同源数据' });
  assert.equal(data.headers.get('cache-control'), 'no-store');
  assert.equal(missing.status, 404);
});

test('probeExistingServer 能识别正在运行的本项目服务器', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xuxuan-existing-server-'));
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><body>本地首页</body>');
  const instance = devServer.createDevServer({ rootDir: root, port: 0, watch: false });
  await instance.start();
  t.after(async () => {
    await instance.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  assert.equal(await devServer.probeExistingServer(instance.url), true);
});

test('probeExistingServer 不会把其他本地服务误认为本项目', async (t) => {
  const unrelated = http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"server":"another-project"}');
  });
  await new Promise(function (resolve) { unrelated.listen(0, '127.0.0.1', resolve); });
  t.after(function () { return new Promise(function (resolve) { unrelated.close(resolve); }); });
  const address = unrelated.address();

  assert.equal(await devServer.probeExistingServer('http://127.0.0.1:' + address.port), false);
});
