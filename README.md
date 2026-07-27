# economist-quiz

中级经济师刷题站（人力方向 + 经济基础公共课）。

## 结构
- `docs/` —— 已纠错 + 前端授权闸门的静态站（GitHub Pages 部署源）。含 `index.html` / `styles.css` / `app.js` / `access.js`（授权码+哈希）/ `gate.js`（闸门逻辑）/ `questions.js`（题库，e2-28 已纠错）。
- `archive/static-2026-07-24/` —— 7/24 晚旧版（无纠错、无访问控制），归档备查。

## 部署（GitHub Pages，从分支）
仓库 **Settings → Pages → Build and deployment → Source 选「Deploy from a branch」→ Branch: `main`，Folder: `/docs`** → Save。
之后 push 到 `main` 即自动重新部署，站点地址：
`https://<用户名>.github.io/economist-quiz/`

进入刷题需输入 12 个授权码之一。

## 本地预览
起一个本地静态服务后访问 `docs/index.html`（直接双击打开因跨域可能加载不出题库，建议用 `python -m http.server`）。

## 备忘
- 后端强鉴权版（`quiz-server/` / scrypt / 管理密码 / render.yaml）仅存于 Mac 本机，未公开部署；待 Mac 回归后补入并升级到 Render。
- 当前 GitHub Pages 为静态前端闸门，授权仅防误进，非真安全，适合内部学习群。
