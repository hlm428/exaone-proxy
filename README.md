# exaone-chat-proxy · EXAONE 聊天代理（Cloudflare Worker）

解决 https://hlm428.github.io/yuejian-chat/ 直连 EXAONE 的跨域问题：Worker 接收聊天页请求 → 转发 `https://api.exaone.ai/v1/chat/completions`（Authorization 原样透传）→ 响应加 `Access-Control-Allow-Origin: *` 返回。

## 部署（二选一，推荐 A）

**A. 正式账号（永久，推荐）**
```bash
npx wrangler login      # 浏览器授权一次
npx wrangler deploy     # 得到 https://exaone-chat-proxy.<你的子域>.workers.dev
```

**B. 临时预览（免登录，但浏览器访问会被 Cloudflare 人机质询拦截，仅 curl/服务端可用）**
```bash
npx wrangler deploy --temporary
```

## 部署后

把得到的 workers.dev 地址填进聊天页「⚙️ 设置 → 接口地址」：`https://exaone-chat-proxy.<子域>.workers.dev/v1`，填上 EXAONE Key 就能聊。

## 已验证（curl 全链路）

- POST + Authorization 转发 → EXAONE 401 原样透传 ✓
- 响应带 `Access-Control-Allow-Origin: *` 全套 CORS 头 ✓
- 缺 Key → Worker 直接 401 明确提示 ✓

免费档每天 10 万次请求，不用绑卡。Key 只经过 Worker 内存，不落日志。
