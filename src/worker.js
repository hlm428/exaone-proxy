/**
 * EXAONE 聊天代理（Cloudflare Worker）
 * - 接收聊天页的 POST /v1/chat/completions，转发到 https://api.exaone.ai/v1/chat/completions
 * - Authorization 头原样透传（聊天页把 EXAONE Key 放在 Authorization: Bearer 里）
 * - 统一处理 CORS：Access-Control-Allow-Origin: *（浏览器直连 EXAONE 被拦，这里放行）
 * - 不缓存、不落日志，Key 只经过 Worker 内存
 */

const UPSTREAM = 'https://api.exaone.ai/v1/chat/completions';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-api-key',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request) {
    // 预检请求直接放行
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: { message: '只接受 POST（/v1/chat/completions）' } }), {
        status: 405,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    const auth = request.headers.get('authorization') || request.headers.get('x-api-key') || '';
    if (!auth) {
      return new Response(JSON.stringify({ error: { message: '缺少 Authorization 头（Bearer <EXAONE Key>）' } }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    let body = await request.text();
    // 允许聊天页传相对模型名，转发前补默认模型
    try {
      const json = JSON.parse(body);
      if (!json.model) json.model = 'k-exaone-2.5-32b';
      body = JSON.stringify(json);
    } catch {
      /* 原样转发 */
    }
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        Authorization: auth.startsWith('Bearer') || auth.startsWith('Bearer ') ? auth : `Bearer ${auth}`,
        'Content-Type': 'application/json',
      },
      body,
    });
    // 上游响应原样传回 + CORS 头
    const headers = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
    headers.set('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
