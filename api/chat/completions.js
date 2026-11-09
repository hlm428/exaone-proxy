/**
 * Vercel Serverless Function：EXAONE 聊天代理（备用线路）
 * 路径 /api/chat/completions → 转发 https://api.exaone.ai/v1/chat/completions
 * Authorization 原样透传；响应带全套 CORS 头；OPTIONS 预检 204。
 */

const UPSTREAM = 'https://api.exaone.ai/v1/chat/completions';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-api-key',
  'Access-Control-Max-Age': '86400',
};

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: '只接受 POST（/api/chat/completions）' } });
    return;
  }
  const auth = req.headers['authorization'] || req.headers['x-api-key'] || '';
  if (!auth) {
    res.status(401).json({ error: { message: '缺少 Authorization 头（Bearer <EXAONE Key>）' } });
    return;
  }
  let body = req.body;
  if (typeof body === 'object' && body !== null) {
    if (!body.model) body.model = 'k-exaone-2.5-32b';
    body = JSON.stringify(body);
  } else {
    body = typeof body === 'string' && body ? body : '{}';
    try {
      const json = JSON.parse(body);
      if (!json.model) json.model = 'k-exaone-2.5-32b';
      body = JSON.stringify(json);
    } catch {
      /* 原样转发 */
    }
  }
  try {
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body,
    });
    res.status(upstream.status);
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (e) {
    res.status(502).json({ error: { message: '上游连接失败：' + e.message } });
  }
}
