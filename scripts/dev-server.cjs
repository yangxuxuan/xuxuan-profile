const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const SERVER_ID = 'xuxuan-profile-dev-server';
const LIVE_RELOAD_MARKER = 'data-xuxuan-live-reload';
const LIVE_RELOAD_CLIENT = [
  '<script ' + LIVE_RELOAD_MARKER + '>',
  "(() => {",
  "  const events = new EventSource('/__live_reload');",
  "  events.onmessage = (event) => { if (event.data === 'reload') location.reload(); };",
  '})();',
  '</script>',
].join('\n');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp',
};

function injectLiveReload(html) {
  if (html.includes(LIVE_RELOAD_MARKER)) return html;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, LIVE_RELOAD_CLIENT + '\n</body>');
  }
  return html + '\n' + LIVE_RELOAD_CLIENT;
}

function resolveRequestPath(rootDir, requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(String(requestPath).split('?')[0]);
  } catch (error) {
    return null;
  }

  const normalized = decoded.replace(/\\/g, '/');
  const relative = normalized.replace(/^\/+/, '');
  const root = path.resolve(rootDir);
  const candidate = path.resolve(root, relative || '.');
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  return candidate === root || candidate.startsWith(prefix) ? candidate : null;
}

function shouldReload(filename) {
  if (!filename) return false;
  const normalized = String(filename).replace(/\\/g, '/').toLowerCase();
  if (normalized.startsWith('.git/') || normalized.startsWith('docs/') || normalized.startsWith('test/')) {
    return false;
  }
  return ['.html', '.css', '.js', '.json', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
    .includes(path.extname(normalized));
}

async function probeExistingServer(baseUrl) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, 1000);
  try {
    const statusUrl = new URL('/__xuxuan_status', baseUrl);
    const response = await fetch(statusUrl, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) return false;
    const data = await response.json();
    return data && data.server === SERVER_ID;
  } catch (error) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function createDevServer(options) {
  const rootDir = path.resolve(options.rootDir);
  const requestedPort = options.port === undefined ? 8765 : options.port;
  const watchEnabled = options.watch !== false;
  const hostname = options.hostname || '127.0.0.1';
  const clients = new Set();
  let watcher = null;
  let reloadTimer = null;
  let currentUrl = '';

  function broadcastReload() {
    for (const client of clients) {
      try {
        client.write('data: reload\n\n');
      } catch (error) {
        clients.delete(client);
      }
    }
  }

  const server = http.createServer(async function (req, res) {
    let url;
    try {
      url = new URL(req.url, 'http://' + hostname);
    } catch (error) {
      res.writeHead(400).end('Bad request');
      return;
    }

    if (url.pathname === '/__xuxuan_status') {
      const content = Buffer.from(JSON.stringify({ server: SERVER_ID }), 'utf8');
      res.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Length': content.length,
        'Content-Type': 'application/json; charset=utf-8',
      });
      res.end(content);
      return;
    }

    if (url.pathname === '/__live_reload') {
      res.writeHead(200, {
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Content-Type': 'text/event-stream',
      });
      res.write(': connected\n\n');
      clients.add(res);
      req.on('close', function () { clients.delete(res); });
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
      return;
    }

    let filePath = resolveRequestPath(rootDir, url.pathname);
    if (!filePath) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    try {
      const stat = await fs.promises.stat(filePath);
      if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
      const extension = path.extname(filePath).toLowerCase();
      const headers = {
        'Cache-Control': 'no-store',
        'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
      };
      let content = await fs.promises.readFile(filePath);
      if (extension === '.html') content = Buffer.from(injectLiveReload(content.toString('utf8')), 'utf8');
      headers['Content-Length'] = content.length;
      res.writeHead(200, headers);
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
        res.writeHead(404).end('Not found');
      } else {
        res.writeHead(500).end('Server error');
      }
    }
  });

  function start() {
    return new Promise(function (resolve, reject) {
      function onError(error) {
        server.off('listening', onListening);
        reject(error);
      }
      function onListening() {
        server.off('error', onError);
        const address = server.address();
        currentUrl = 'http://' + hostname + ':' + address.port;
        if (watchEnabled) {
          watcher = fs.watch(rootDir, { recursive: true }, function (eventType, filename) {
            if (!shouldReload(filename)) return;
            clearTimeout(reloadTimer);
            reloadTimer = setTimeout(broadcastReload, 120);
          });
        }
        resolve(currentUrl);
      }
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(requestedPort, hostname);
    });
  }

  function close() {
    clearTimeout(reloadTimer);
    if (watcher) watcher.close();
    for (const client of clients) client.end();
    clients.clear();
    if (!server.listening) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      server.close(function (error) { if (error) reject(error); else resolve(); });
    });
  }

  return {
    broadcastReload: broadcastReload,
    close: close,
    get url() { return currentUrl; },
    start: start,
  };
}

function resolveWindowsCommand(env) {
  if (env.ComSpec) return env.ComSpec;
  if (env.SystemRoot) return path.join(env.SystemRoot, 'System32', 'cmd.exe');
  return 'cmd.exe';
}

function openBrowser(url) {
  const child = spawn(resolveWindowsCommand(process.env), ['/c', 'start', '', url], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

if (require.main === module) {
  const rootDir = path.resolve(__dirname, '..');
  const port = Number(process.env.XUXUAN_DEV_PORT) || 8765;
  const instance = createDevServer({ rootDir: rootDir, port: port, watch: true });

  instance.start().then(function () {
    console.log('');
    console.log('  本地网站已启动：' + instance.url + '/');
    console.log('  保存网页、脚本、数据或图片后，浏览器会自动刷新。');
    console.log('  关闭此窗口即可停止本地网站，不会影响任何项目数据。');
    console.log('');
    openBrowser(instance.url + '/');
  }).catch(async function (error) {
    if (error.code === 'EADDRINUSE') {
      const existingUrl = 'http://127.0.0.1:' + port;
      if (await probeExistingServer(existingUrl)) {
        console.log('本地网站已经在运行，正在重新打开浏览器：' + existingUrl + '/');
        openBrowser(existingUrl + '/');
        return;
      }
      console.error('端口 ' + port + ' 已被其他程序占用，无法启动本地网站。');
    } else {
      console.error('本地网站启动失败：' + error.message);
    }
    process.exitCode = 1;
  });

  async function shutdown() {
    await instance.close();
    process.exit(0);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = {
  createDevServer: createDevServer,
  injectLiveReload: injectLiveReload,
  probeExistingServer: probeExistingServer,
  resolveRequestPath: resolveRequestPath,
  resolveWindowsCommand: resolveWindowsCommand,
  shouldReload: shouldReload,
};
