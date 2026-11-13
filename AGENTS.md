# AI 代理工作规则

1. 先读 `README.md`，了解结构和构建方式。
2. 只改 `tools/src/` 源码，然后运行 `node tools/build.js` 生成 `index.html`；不要直接手改 `index.html`。
3. 在分支上工作（命名 `agent/issue-<编号>`），通过 PR 合并；除错别字级小修外不要直接推 `main`，未经仓库主人同意不要合并。
4. 提交前运行 `node tools/check.js`（无报错、无溢出），PR 附改动页面截图。
5. 合并后验证线上 https://galileo21stt.github.io/jzs-site/ 已更新。
6. 不要提交日志、密钥、`node_modules`、压缩包或 >50MB 的文件；不要删除 `img/` 原图。
7. 内容以教材和真题为准，引用页码；不确定的内容在 PR 里注明。
8. 回复和文档用中文。

9. 前端 HTML/CSS/DOM/浏览器 JavaScript 或响应式、交互、无障碍、性能任务开始前，先读取 `.agents/skills/modern-web-guidance/SKILL.md`（Claude Code 也可通过 `.claude/skills/modern-web-guidance/SKILL.md`）并用上游 CLI `search` → `retrieve` 查询相关指南；纯后端、构建或文案任务无需触发。
10. 新浏览器能力要兼顾 iPhone/iPad Safari 与桌面 Chromium；若不是 Baseline Widely available，按照官方指南提供兼容性降级。保留现有题库、图片、路由和页面功能，不因接入 Skill 进行无关重构。
11. 原有 `node tools/build.js`、`node tools/check.js`、截图验收仍是强制流程。已配置 Playwright 时可补 390／768／1440px 浏览器冒烟测试，不能拿它代替现有 Puppeteer 检查；未执行的检查如实说明。
12. Skill 只是 Agent 开发指导，不是生产网站依赖；未经主人确认不合并、部署或更改 Pages 设置。
