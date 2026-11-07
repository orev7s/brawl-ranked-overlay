import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { config } from './config.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

function sendJson(res, code, body) {
  const data = JSON.stringify(body);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const target = path.normalize(path.join(root, decoded));
  if (!target.startsWith(root)) return null;
  return target;
}

export function createServer(engine, poller) {
  const clients = new Set();

  poller.on('state', (state) => {
    const frame = `data: ${JSON.stringify(state)}\n\n`;
    for (const res of clients) {
      try {
        res.write(frame);
      } catch {
        clients.delete(res);
      }
    }
  });

  function authorize(url) {
    if (!config.controlToken) return true;
    return url.searchParams.get('key') === config.controlToken;
  }

  async function handler(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const route = url.pathname;

    if (route === '/api/state') return sendJson(res, 200, engine.state());

    if (route === '/api/stream') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      });
      res.write(`retry: 2000\n\n`);
      res.write(`data: ${JSON.stringify(engine.state())}\n\n`);
      clients.add(res);
      const ping = setInterval(() => {
        try {
          res.write(': ping\n\n');
        } catch {
          clearInterval(ping);
          clients.delete(res);
        }
      }, 25000);
      req.on('close', () => {
        clearInterval(ping);
        clients.delete(res);
      });
      return;
    }

    if (route.startsWith('/api/session/')) {
      if (!authorize(url)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
      const action = route.split('/').pop();
      if (!['start', 'reset', 'end', 'refresh'].includes(action)) return sendJson(res, 404, { ok: false });
      if (action === 'refresh') {
        await poller.tick();
      } else {
        engine.action(action);
        poller.push();
      }
      return sendJson(res, 200, engine.state());
    }

    if (route === '/api/demo') {
      if (!authorize(url)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
      if (req.method !== 'POST') return sendJson(res, 405, { ok: false });
      const body = await readBody(req);
      if (['win', 'loss', 'rankup', 'rankdown'].includes(body.action)) {
        engine.forceDemo(body.action);
        poller.push();
      } else {
        engine.setDemo(body.enabled !== false);
        await engine.poll();
        poller.push();
      }
      return sendJson(res, 200, engine.state());
    }

    if (route === '/overlay' || route === '/overlay/') return serveFile(res, 'overlay.html');
    if (route === '/control' || route === '/control/') {
      if (!authorize(url)) {
        res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8' });
        return res.end('Control panel locked. Add ?key=YOUR_CONTROL_TOKEN to the URL.');
      }
      return serveFile(res, 'control.html');
    }
    if (route === '/') {
      res.writeHead(302, { location: '/overlay' });
      return res.end();
    }

    return serveFile(res, route.slice(1));
  }

  function serveFile(res, rel) {
    const file = safeJoin(config.publicDir, rel);
    if (!file) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        return res.end('Not found');
      }
      const ext = path.extname(file).toLowerCase();
      // Text assets revalidate every load so edits show up immediately.
      // Images and fonts can sit in the cache.
      const reloadable = ['.html', '.css', '.js', '.mjs', '.json'].includes(ext);
      res.writeHead(200, {
        'content-type': MIME[ext] || 'application/octet-stream',
        'cache-control': reloadable ? 'no-cache' : 'public, max-age=86400',
      });
      res.end(data);
    });
  }

  return http.createServer((req, res) => {
    handler(req, res).catch((err) => {
      sendJson(res, 500, { ok: false, error: err?.message || 'Server error' });
    });
  });
}