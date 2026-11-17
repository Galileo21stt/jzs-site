# 外国近现代建筑史时间树（v2）

全屏只保留中间一棵时间树：主干是时间（自下而上），枝是思潮 / 流派，叶是建筑师，花是作品。点到节点后，才会在该节点旁边弹出一张小说明卡。点空白或按 Esc 关闭。检索、人物卡、闭卷复测、关系索引和本机复习记录都还在，但不占用树页面两侧。

这是 `jzs-site` 仓库里的独立页面，不经过 `tools/build.js`，也不改主站 12 篇对比表格页。

## 线上地址

- 时间树（本页）：https://galileo21stt.github.io/jzs-site/tools/src/architect-links/
- 仓库主站：https://galileo21stt.github.io/jzs-site/
- 仓库：https://github.com/Galileo21stt/jzs-site

GitHub Pages 从 `main` 分支根目录发布。只要不改仓库根目录的 `index.html`、`img/` 和 `tools/src` 里除本目录以外的文件，主站其他页面不会被这次改动改写。本仓库的 Pages 部署不会影响其他站点。

## 读法与操作

- **主干**：时间，自下而上。下面是起源，上面更晚。年代刻度在主干旁，与叶片、花朵错开。
- **枝**：人物卡里的 `era`。同一建筑师不以唯一归属被锁死。点枝上的思潮名，旁边出现这条线索的说明和人物列表。
- **叶**：建筑师。点叶，旁边出现人物说明（思想、作品目录、横向关联）。选中时叶片仍是白底深色字，只加克莱因蓝描边，不再把名字改成白字。
- **花**：作品。默认只显示花朵标记，不堆作品全名或年份串。点花，旁边出现该作品说明。
- 说明卡会限制在视口内。触屏只需点按，不必悬停。
- 树页面没有顶部检索栏、导航、标题说明、筛选条，没有常驻右栏，也没有右下角「目录」按钮。点叶、花，或人物旁卡里的作品名，都只在节点旁打开说明卡，不会跳到完整人物页。完整人物卡、闭卷复测仍走原来的路由（`#cards`、`#quiz`、`#person/…`），复习记录键名仍为 `arch-links-v1`。

界面用黑、白、灰和克莱因蓝（`#002FA7`）。动效尽量少，并尊重 `prefers-reduced-motion`。

## 目录结构

| 路径 | 内容 |
|---|---|
| `index.html` | 页面骨架 |
| `styles.css` | 样式 |
| `data.js` | 学习数据（`window.PEOPLE` 等，与改版前事实表述一致） |
| `layout.js` | 时间树几何布局、重叠检测、说明卡位置计算 |
| `interaction.js` | 节点点击路由（作品/叶/枝优先原位说明卡） |
| `app.js` | 渲染、路由、检索、详情、闭卷与复习记录 |
| `test-static.mjs` | 数据与源码自检（不打开浏览器） |
| `test-layout.mjs` | 语法、三档视口重叠、说明卡出界、关键样式与结构检查 |
| `test-events.mjs` | 作品花朵、旁卡作品名等真实点击路径，以及纯树无「目录」按钮 |
| `legacy/index-2026-11-17-cards.html` | 改版前「人物关联卡」单页备份 |
| `README.md` | 本说明 |

## 数据源

人物、思想、手法、作品、设问与易混点，沿用 2026-11-17 上线的人物关联卡人工编排数据。教材背景与主站相同：罗小未《外国近现代建筑史》第二版等。`seed=true` 只表示与首批 6 道练习有关，不代表已系统验收掌握等级。本页自拟题不得称为浙大真题。部分卡片提供外部参考链接；图源检索指向维基共享资源，不替代教材图版。

v2 没有改这些事实字段，只改了树的阅读方式和界面。若以后要补人物或作品，只改 `data.js` 中的 `window.PEOPLE`。

## 本地运行

在仓库根目录：

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000/tools/src/architect-links/
```

也可在本目录直接 `python3 -m http.server 8000`，此时地址为 `http://localhost:8000/`。不需要运行 `node tools/build.js`。

自检（不打开浏览器）：

```bash
node tools/src/architect-links/test-static.mjs
node tools/src/architect-links/test-layout.mjs
node tools/src/architect-links/test-events.mjs
```

`test-layout.mjs` 会检查 1024×768、1180×820、390 宽下节点/标签框是否重叠，以及说明卡是否被限制在视口内。`test-events.mjs` 会模拟点击人物旁卡里的「帕米欧肺病疗养院 1933」和带 `data-person` 的花朵，断言仍停在树上并打开作品卡，而不是进入 `#person/aalto`。这些都不是真实浏览器渲染或 Safari 验收。

## 测试限制

本轮只跑了静态检查和布局单元测试，没有用本机或无头浏览器做视觉回归，也**没有在 iPad Safari 上实测**。上一轮公网 Safari 出现的白字描边重影、花/年份/作品名挤在同一行，已在源码里按根因处理（去掉 SVG 文字 stroke / paint-order 描边，选中叶保持深色字，作品名改到点击后的说明卡），但最终观感仍需在真实 Safari / iPad 上验收后才能确认。窄屏 390 宽的布局测试允许画布宽于视口并水平移动，以便主干居中、双侧展枝；不宣称手机界面已目视通过。

## 部署

1. 只在本目录改页面（以及必要时的本 README、根 README 中与本页有关的一句说明）。
2. 在分支上提交，开 Pull Request；不要直接推 `main`，不要 `--force`，不要跳过 hooks。
3. 审查通过后按仓库惯例合并到 `main`。GitHub Pages 会从 `main` 根目录自动发布，约 1 分钟后检查线上地址。
4. 不要把这次发布理解成一次「全站重建」。

## 回滚

- 标签：`architect-links-v0-cards-20261117`（提交 `31dd44a`，人物关联卡单页）
- 上一版全屏前的时间树（v1，带顶栏与右栏）：`main` 上合并 PR #6 的提交 `6a8f602`
- 文件副本：`legacy/index-2026-11-17-cards.html`

```bash
# 回到 v1 时间树（顶栏 / 右栏那一版）
git checkout 6a8f602 -- tools/src/architect-links
# 或回到更早的人物关联卡单页
git checkout architect-links-v0-cards-20261117 -- tools/src/architect-links
# 不要 force push main
```

本地存储键仍为 `arch-links-v1`，导出格式仍为 `architect-links-review` v1，可与旧版记录互导。
