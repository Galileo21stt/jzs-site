# 中外建史横向对比背诵站

浙大建筑学考研（355）复习用的交互式背诵网站：把 12 篇中外建史对比表格长图拆成可筛选、可对照、可遮挡背诵的视图，并按 2005—2026 真题（回忆版）标注重点。

- **线上地址**：https://galileo21stt.github.io/jzs-site/ （手机可直接打开）
- **仓库**：https://github.com/Galileo21stt/jzs-site

## 目录结构

| 路径 | 内容 |
|---|---|
| `index.html` | 部署的成品页面（由构建脚本生成，**不要手改**） |
| `img/` | 表格原图 `orig/`、切片 `tiles/`、`manifest.json`（页面直接引用） |
| `tools/src/` | 页面源码：`shell.html` 骨架、`style.css`、`core.js`、`app.js`、数据 `topics_zj.js` / `topics_wj_a.js` / `topics_wj_b.js` / `data_meta.js` |
| `tools/build.js` | 把 `tools/src` + `img/manifest.json` 打包成 `index.html` |
| `tools/check.js` | 无头浏览器逐路由自检（报错、溢出） |
| `tools/shot.js` | 截图：`node tools/shot.js <路由> <输出.png> [宽] [高] [整页1/0]` |
| `tools/prep_img.py` | 从原始长图目录复制、切片生成 `img/`（需 Pillow） |
| `docs/` | 交付说明 `delivery_notes.md` 与截图 `shots/` |

## 本地构建与运行

```bash
npm install          # 仅自检/截图需要 puppeteer
node tools/build.js  # 修改 tools/src 后重新生成 index.html
python3 -m http.server 8000   # 打开 http://localhost:8000
node tools/check.js  # 可选：自检
```

图片更新：`python3 tools/prep_img.py <原始长图根目录> img`（原始长图不在仓库内，`img/orig` 已保留全部原图）。

## 部署

GitHub Pages 从 `main` 分支根目录发布。合并到 `main` 后约 1 分钟生效，用 `curl` 或浏览器检查线上页面。

## 数据来源

- 表格内容：小红书公开的中外建史对比表格笔记（12 篇）
- 真题：浙大 355 真题检索库 2005—2026（回忆版，非官方）
- 教材：潘谷西《中国建筑史》第7版、陈志华《外国建筑史》第4版、罗小未《外国近现代建筑史》第二版

## 如何迭代

1. 在 Issues 里用模板提「问题反馈」或「改进建议」，写清页面路由、现象、期望。
2. AI 代理（见 `AGENTS.md`）在 `agent/issue-<编号>` 分支上修改 `tools/src`，运行 `node tools/build.js` 和自检。
3. 开 PR 关联 issue（`Fixes #编号`），附截图；确认后合并到 `main`，Pages 自动更新。
