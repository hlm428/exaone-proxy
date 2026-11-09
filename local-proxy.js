/**
 * EXAONE 本地代理（node 零依赖）——给手机用的局域网线路：
 *   电脑上 `node local-proxy.js` → 手机连同一 Wi-Fi →
 *   聊天页设置里接口地址填 http://<电脑局域网IP>:8787/v1
 * 转发逻辑与 Cloudflare Worker 版一致（Authorization 透传 + CORS *）。
 */
const http = require('http');

const UPSTREAM = 'https://api.exaone.ai/v1/chat/completions';
const PORT = process.env.PORT || 8787;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-api-key',
  'Access-Control-Max-Age': '86400',
};

function lanIP() {
  const os = require('os');
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const it of ifs[name] || []) {
      if (it.family === 'IPv4' && !it.internal) return it.address;
    }
  }
  return '127.0.0.1';
}

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  if (req.method !== 'POST' || !req.url.includes('/chat/completions')) {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: { message: '只接受 POST */chat/completions' } }));
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', async () => {
    try {
      const json = JSON.parse(body);
      if (!json.model) json.model = 'k-exaone-2.5-32b';
      body = JSON.stringify(json);
    } catch {
      /* 原样转发 */
    }
    try {
      const https = require('https');
      const url = new URL(UPSTREAM);
      const upReq = https.request(
        {
          hostname: url.hostname,
          path: url.pathname,
          method: 'POST',
          headers: {
            Authorization: req.headers['authorization'] || req.headers['x-api-key'] || '',
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (upRes) => {
          res.writeHead(upRes.statusCode || 502, {
            'Content-Type': upRes.headers['content-type'] || 'application/json',
          });
          upRes.pipe(res);
        },
      );
      upReq.on('error', (e) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: '上游连接失败：' + e.message } }));
      });
      upReq.write(body);
      upReq.end();
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: e.message } }));
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('EXAONE 本地代理已启动：http://localhost:' + PORT + '/v1');
  console.log('手机（同一 Wi-Fi）请填：http://' + lanIP() + ':' + PORT + '/v1');
  console.log('Ctrl+C 停止。');
});
