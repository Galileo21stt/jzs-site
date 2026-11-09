# AI 代理工作规则

1. 先读 `README.md`，了解结构和构建方式。
2. 只改 `tools/src/` 源码，然后运行 `node tools/build.js` 生成 `index.html`；不要直接手改 `index.html`。
3. 在分支上工作（命名 `agent/issue-<编号>`），通过 PR 合并；除错别字级小修外不要直接推 `main`，未经仓库主人同意不要合并。
4. 提交前运行 `node tools/check.js`（无报错、无溢出），PR 附改动页面截图。
5. 合并后验证线上 https://galileo21stt.github.io/jzs-site/ 已更新。
6. 不要提交日志、密钥、`node_modules`、压缩包或 >50MB 的文件；不要删除 `img/` 原图。
7. 内容以教材和真题为准，引用页码；不确定的内容在 PR 里注明。
8. 回复和文档用中文。
