# 外国近现代建筑史时间树

用一棵可读的时间树，梳理外国近现代建筑史里「时间 — 思潮 / 流派 / 思想 — 建筑师 — 作品」的关系，并保留原人物卡的检索、详情、闭卷复测和本机复习记录。

这是 `jzs-site` 仓库里的独立页面，不经过 `tools/build.js`，也不改主站 12 篇对比表格页。

## 线上地址

- 时间树（本页）：https://galileo21stt.github.io/jzs-site/tools/src/architect-links/
- 仓库主站（中外建史对比背诵）：https://galileo21stt.github.io/jzs-site/
- 仓库：https://github.com/Galileo21stt/jzs-site

GitHub Pages 从 `main` 分支根目录发布。合并到 `main` 后约 1 分钟，本路径会更新；只要不改仓库根目录的 `index.html`、`img/` 和 `tools/src` 里除本目录以外的文件，主站其他页面不会被这次改动改写。本仓库的 Pages 部署不会影响 `mugoujia-site` 等其他站点。

## 用途与读法

- **主干**：时间，自下而上（下面是起源，上面更晚）。左侧时段带按人物卡里的 `group` 标出，时段可以重叠，不是唯一分期。
- **枝**：人物卡里的 `era`（思潮 / 流派 / 思想线索）。同一建筑师不以唯一归属被锁死；横向对照仍来自原 `relate` 数据，可用「横向关联」开关查看。
- **叶**：建筑师。
- **花**：作品，按作品自身年份落在时间上，不必与人物活动中点重合。
- 详情、闭卷复测、关系索引、复习记录均保留。本地存储键仍为 `arch-links-v1`，导出格式仍为 `architect-links-review` v1，可与旧版记录互导。

界面用黑、白、灰和克莱因蓝（`#002FA7`）。动效尽量少：键盘移动即时响应，并尊重 `prefers-reduced-motion`。

## 目录结构

| 路径 | 内容 |
|---|---|
| `index.html` | 页面骨架 |
| `styles.css` | 样式 |
| `data.js` | 学习数据（`window.PEOPLE` 等，与改版前事实表述一致） |
| `app.js` | 时间树、路由、检索、详情、闭卷与复习记录 |
| `legacy/index-2026-11-17-cards.html` | 改版前「人物关联卡」单页备份，用于回滚预览 |
| `README.md` | 本说明 |

## 数据源

人物、思想、手法、作品、设问与易混点，沿用 2026-11-17 上线的人物关联卡人工编排数据。教材背景与主站相同：罗小未《外国近现代建筑史》第二版等。`seed=true` 只表示与首批 6 道练习有关，不代表已系统验收掌握等级。本页自拟题不得称为浙大真题。部分卡片提供外部参考链接；图源检索指向维基共享资源，不替代教材图版。

改版时没有改这些事实字段的表述，只增加了时间树这一层视图。若以后要补人物或作品，只改 `data.js` 中的 `window.PEOPLE`，不要在视图层写死另一套史实。

## 本地运行

在仓库根目录：

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000/tools/src/architect-links/
```

也可在本目录直接 `python3 -m http.server 8000`，此时地址为 `http://localhost:8000/`。不需要运行 `node tools/build.js`。修改 `data.js` / `app.js` / `styles.css` 后刷新浏览器即可。

数据与源码自检（不打开浏览器）：

```bash
node tools/src/architect-links/test-static.mjs
```

作品名在花朵旁默认只显示年份；悬停、键盘聚焦或选中该人物后，会显示作品全名，并用细虚线连回主干上的对应年代。不要把这条虚线理解成“每个人一条生涯柱”。

## 部署

1. 只在本目录改页面（以及必要时的本 README、根 README 中与本页有关的一句说明）。
2. 在分支上提交，开 Pull Request；不要直接推 `main`，不要 `--force`，不要跳过 hooks。
3. 审查通过后按仓库惯例合并到 `main`。GitHub Pages 会从 `main` 根目录自动发布，约 1 分钟后检查线上地址。
4. 不要改其他仓库，也不要把这次发布理解成一次「全站重建」：主站构建产物 `index.html` 未被本改动生成或覆盖。

## 回滚

发布前已留下恢复点：

- Git 标签：`architect-links-v0-cards-20261117`（对应提交 `31dd44a`，改版前的人物关联卡单页）
- 文件副本：`legacy/index-2026-11-17-cards.html`

若新版需要撤回，可选其一：

```bash
# 仅回滚本目录到标签中的单页（会去掉 data.js / app.js 等拆分文件，恢复为单一 index.html）
git checkout architect-links-v0-cards-20261117 -- tools/src/architect-links
# 或者先把 legacy 副本拷回 index.html 预览，确认后再提交

# 检查后按正式流程开 PR 合并，不要 force push main
```

回滚后访问同一线上路径，即可重新看到旧版人物关联卡。主站其他页面同样不应被这次回滚牵动，只要不改它们的文件。

复习记录在浏览器本地，键名未改；回滚到旧版后，已导出或已保存在本机的记录仍可继续使用。
