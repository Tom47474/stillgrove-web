# Stillgrove Web

React + TypeScript + Vite 的树洞 H5 前端。界面包括邮箱注册登录、会话列表、历史消息、流式回复、反馈和账号注销。长期记忆由服务端自动处理。

## 本地运行

先启动后端、MySQL 和 Redis，再执行：

```bash
npm install
npm run dev
```

Vite 将 `/api` 代理到 `http://localhost:8080`。聊天接口使用 `fetch` 读取 SSE，登录使用 Session Cookie 与 CSRF token。配置百炼 API Key 后才能收到 AI 回复；未配置时后端返回 503。记忆检索需要 Qdrant。

生产部署时让同域反向代理转发 `/api` 到后端，并使用 HTTPS。若前后端跨域部署，还需设置后端 `STILLGROVE_CORS_ORIGIN` 并核对 Cookie 的 SameSite 策略。
