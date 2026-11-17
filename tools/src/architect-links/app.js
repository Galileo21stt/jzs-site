(function () {
  "use strict";

  const PEOPLE = Array.isArray(window.PEOPLE) ? window.PEOPLE : [];
  const GROUP_ORDER = window.GROUP_ORDER || ["起源与过渡", "现代主义", "战后转向", "后现代与解构"];
  const RELATION_TOPICS = window.RELATION_TOPICS || [];
  const COMPARE_PAIRS = window.COMPARE_PAIRS || [];
  const KEY = "arch-links-v1";
  const VALID_RATES = ["again", "hard", "good"];
  const YEAR_MIN = 1850;
  const YEAR_MAX = 2016;
  const peopleById = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
  const label = (id) => (peopleById[id] && peopleById[id].name) || id;

  const storeDefault = () => ({ version: 1, reviews: {}, drafts: {} });
  function load() {
    try {
      const x = JSON.parse(localStorage.getItem(KEY) || "null");
      if (x && x.version === 1 && x.reviews && x.drafts) return x;
    } catch (e) {}
    return storeDefault();
  }
  let store = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); }
    catch (e) { toast("本机浏览器禁止存储，建议导出记录备份"); }
  }

  let filter = "全部";
  let search = "";
  let quizMode = "seed";
  let quizOrder = [];
  let quizIdx = 0;
  let revealed = false;
  let quizRound = 0;
  let treeSel = null; // {kind, id}
  let showWorks = true;
  let showRelate = false;
  let treeScroll = null;
  let didInitialTreeScroll = false;

  function today() {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  }
  function after(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  }
  function stats() {
    const rs = Object.values(store.reviews).filter((x) => VALID_RATES.includes(x.rate));
    return {
      total: PEOPLE.length,
      seed: PEOPLE.filter((p) => p.seed).length,
      reviewed: rs.length,
      due: rs.filter((r) => r.due <= today()).length,
      again: rs.filter((r) => r.rate === "again").length,
      hard: rs.filter((r) => r.rate === "hard").length,
      good: rs.filter((r) => r.rate === "good").length
    };
  }
  function toast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2800);
  }

  function extractYears(str) {
    if (!str && str !== 0) return [];
    const s = String(str);
    const out = [];
    const decadeRe = /(\d{4})s/g;
    let m;
    const used = [];
    while ((m = decadeRe.exec(s))) {
      const y = +m[1];
      out.push([y, y + 9]);
      used.push([m.index, m.index + m[0].length]);
    }
    let rest = s;
    used.sort((a, b) => b[0] - a[0]).forEach(([a, b]) => { rest = rest.slice(0, a) + " " + rest.slice(b); });
    const rangeRe = /(\d{4})\s*[–\-至到]\s*(\d{4})/g;
    const ranges = [];
    while ((m = rangeRe.exec(rest))) {
      out.push([+m[1], +m[2]]);
      ranges.push([m.index, m.index + m[0].length]);
    }
    ranges.sort((a, b) => b[0] - a[0]).forEach(([a, b]) => { rest = rest.slice(0, a) + " " + rest.slice(b); });
    const singleRe = /(\d{4})/g;
    while ((m = singleRe.exec(rest))) out.push([+m[1], +m[1]]);
    return out;
  }
  function spanOf(tokens, fallback) {
    if (!tokens.length) return fallback || null;
    const start = Math.min.apply(null, tokens.map((t) => t[0]));
    const end = Math.max.apply(null, tokens.map((t) => t[1]));
    return { start, end, mid: (start + end) / 2 };
  }
  function personSpan(p) {
    const tokens = extractYears(p.year).concat((p.works || []).flatMap((w) => extractYears(w[1])));
    return spanOf(tokens, { start: 1900, end: 1900, mid: 1900 });
  }
  function workYear(w) {
    const sp = spanOf(extractYears(w[1]), null);
    return sp ? sp.start : null;
  }
  function personMatches(p, q) {
    if (!q) return true;
    const blob = [
      p.name, p.en, p.era, p.group, p.year, p.idea, p.method, p.question, p.answer, p.trap,
      (p.tags || []).join(" "),
      (p.works || []).map((w) => w.join(" ")).join(" "),
      (p.relate || []).map((r) => label(r[0]) + " " + r[1]).join(" ")
    ].join(" ").toLowerCase();
    return blob.includes(q);
  }
  function filteredPeople() {
    const q = search.trim().toLowerCase();
    return PEOPLE.filter((p) => {
      if (filter === "本次错题" && !p.seed) return false;
      if (filter !== "全部" && filter !== "本次错题" && p.group !== filter && p.era !== filter && !(p.tags || []).includes(filter)) return false;
      return personMatches(p, q);
    });
  }

  function current() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (h.startsWith("person/")) return { view: "person", id: h.slice(7) };
    if (h === "home" || h === "" || h === "tree") return { view: "tree" };
    if (["cards", "quiz", "graph", "progress"].includes(h)) return { view: h };
    return { view: "tree" };
  }
  function setView(view) {
    location.hash = view === "tree" ? "tree" : view;
    if (current().view === view) render();
    if (view !== "tree") window.scrollTo({ top: 0, behavior: "auto" });
  }
  function goPerson(id) {
    if (peopleById[id]) location.hash = "person/" + id;
  }

  function badges(p) {
    const tags = [p.era].concat(p.tags || []);
    const uniq = [];
    tags.forEach((t) => { if (t && !uniq.includes(t)) uniq.push(t); });
    return uniq.map((t) => "<span>" + esc(t) + "</span>").join("");
  }

  function wikiPhoto(p) {
    return "https://commons.wikimedia.org/w/index.php?search=" + encodeURIComponent(p.photo || p.name) + "&title=Special:MediaSearch&go=Go&type=image";
  }

  /* ---------- tree layout ---------- */
  function layoutTree(minWidth, isMobile) {
    const padTop = 36;
    const padBottom = 90;
    const innerH = Math.max(1680, (YEAR_MAX - YEAR_MIN) * (isMobile ? 11 : 13));
    const height = padTop + innerH + padBottom;
    let trunkX = isMobile ? 80 : 420;
    const yearToY = (year) => padTop + ((YEAR_MAX - year) / (YEAR_MAX - YEAR_MIN)) * innerH;

    const erasMap = new Map();
    PEOPLE.forEach((p) => {
      const era = p.era || "未分组";
      if (!erasMap.has(era)) erasMap.set(era, []);
      erasMap.get(era).push(p);
    });
    const eras = Array.from(erasMap.entries()).map(([name, members]) => {
      const tokens = members.flatMap((p) => {
        const s = personSpan(p);
        return [[s.start, s.end]];
      });
      const span = spanOf(tokens);
      return { name, members, span };
    }).sort((a, b) => a.span.mid - b.span.mid);

    const groups = GROUP_ORDER.map((name) => {
      const members = PEOPLE.filter((p) => p.group === name);
      const tokens = members.flatMap((p) => {
        const s = personSpan(p);
        return [[s.start, s.end]];
      });
      return { name, members, span: spanOf(tokens) };
    }).filter((g) => g.span);

    // swimlanes for architects so overlapping spans don't collide
    const peopleLayout = PEOPLE.map((p) => {
      const span = personSpan(p);
      return { p, span, era: p.era || "未分组" };
    }).sort((a, b) => a.span.start - b.span.start || a.span.mid - b.span.mid);

    // Compact columns by nearby mid-years only. Do not reserve a vertical
    // "career bar" lane — that reads as a Gantt chart and leaves a hollow middle.
    const eraSide = {};
    eras.forEach((e) => { eraSide[e.name] = "right"; });

    const LEAF_W = 180;
    const LEAF_H = 36;
    const BRANCH = 170;
    const COL_W = 250;
    trunkX = isMobile ? 80 : 148;

    peopleLayout.forEach((item) => {
      item.side = "right";
      item.y = yearToY(item.span.mid);
      item.y0 = yearToY(item.span.end);
      item.y1 = yearToY(item.span.start);
    });
    const colBottoms = [];
    peopleLayout.slice().sort((a, b) => a.y - b.y).forEach((item) => {
      let lane = 0;
      while (lane < colBottoms.length && item.y < colBottoms[lane] + LEAF_H + 10) lane++;
      if (lane === colBottoms.length) colBottoms.push(item.y);
      else colBottoms[lane] = item.y;
      item.lane = lane;
      item.x = trunkX + BRANCH + lane * COL_W + LEAF_W / 2;
    });
    const width = trunkX + BRANCH + Math.max(1, colBottoms.length) * COL_W + 80;

    const byId = Object.fromEntries(peopleLayout.map((x) => [x.p.id, x]));
    const eraLayout = eras.map((e) => {
      const ms = e.members.map((p) => byId[p.id]);
      const side = eraSide[e.name];
      const dir = side === "right" ? 1 : -1;
      const midY = yearToY(e.span.mid);
      const stubX = trunkX + dir * 88;
      const minY = Math.min.apply(null, ms.map((m) => m.y).concat([midY]));
      const maxY = Math.max.apply(null, ms.map((m) => m.y).concat([midY]));
      const labelY = midY;
      const labelX = trunkX + dir * 18;
      return { ...e, side, dir, midY, stubX, minY, maxY, labelX, labelY, membersL: ms };
    });

    // nudge era labels that collide
    const bySide = { left: [], right: [] };
    eraLayout.forEach((e) => bySide[e.side].push(e));
    Object.values(bySide).forEach((arr) => {
      arr.sort((a, b) => a.labelY - b.labelY);
      for (let i = 1; i < arr.length; i++) {
        if (arr[i].labelY - arr[i - 1].labelY < 22) {
          arr[i].labelY = arr[i - 1].labelY + 22;
        }
      }
    });

    const works = [];
    peopleLayout.forEach((item) => {
      const list = (item.p.works || []).map((w, wi) => ({ w, wi, year: workYear(w) })).filter((x) => x.year != null);
      list.forEach((entry, fi) => {
        const n = list.length;
        const gap = 26;
        const clusterW = Math.max(0, (n - 1) * gap);
        const startX = item.x + LEAF_W / 2 + 22;
        works.push({
          id: item.p.id + "::" + entry.wi,
          personId: item.p.id,
          work: entry.w,
          year: entry.year,
          yearY: yearToY(entry.year),
          x: startX + fi * gap,
          y: item.y,
          captionX: startX + clusterW + 16,
          captionY: item.y - ((n - 1) * 11) + fi * 22,
          index: fi,
          side: "right"
        });
      });
    });

    return { width, height, trunkX, padTop, padBottom, innerH, yearToY, people: peopleLayout, eras: eraLayout, groups, works, isMobile, leafW: LEAF_W, leafH: LEAF_H };
  }

  function flowerMark(x, y, id, title) {
    const r = 4.2;
    const d = 5.4;
    const petals = [
      [x, y - d], [x + d, y], [x, y + d], [x - d, y]
    ].map((pt) => '<circle class="flower-petals" cx="' + pt[0] + '" cy="' + pt[1] + '" r="' + r + '"/>').join("");
    return petals + '<circle class="flower-core" cx="' + x + '" cy="' + y + '" r="2.1"/>';
  }

  function workCaption(w) {
    const title = w.work[0] + "  ·  " + w.work[1];
    const textW = Math.min(220, 16 + title.length * 12);
    const x = w.captionX;
    const y = w.captionY;
    return '<g class="work-caption" pointer-events="none">' +
      '<rect class="work-caption-bg" x="' + x + '" y="' + (y - 14) + '" width="' + textW + '" height="22" rx="4"/>' +
      '<text class="work-label" x="' + (x + 8) + '" y="' + (y + 2) + '">' + esc(title) + "</text></g>";
  }

  function renderTreeSvg(layout) {
    const { width, height, trunkX, yearToY, people, eras, groups, works } = layout;
    const yTop = yearToY(YEAR_MAX);
    const yBot = yearToY(YEAR_MIN);
    const years = [];
    for (let y = YEAR_MIN; y <= YEAR_MAX; y += 10) years.push(y);

    const yearMarks = years.map((y) => {
      const yy = yearToY(y);
      const major = y % 20 === 0;
      return '<line class="guide-year" x1="' + (trunkX - 28) + '" y1="' + yy + '" x2="' + (trunkX + 28) + '" y2="' + yy + '"/>' +
        '<text class="year' + (major ? " major" : "") + '" text-anchor="end" x="' + (trunkX - 34) + '" y="' + (yy + 4) + '">' + y + "</text>";
    }).join("");

    const groupBands = groups.map((g, i) => {
      const y0 = yearToY(g.span.end);
      const y1 = yearToY(g.span.start);
      const x = 8 + (i % 2) * 4;
      const h = Math.max(8, y1 - y0);
      return '<rect class="group-band dimmable" x="' + x + '" y="' + y0 + '" width="6" height="' + h + '" rx="1"/>' +
        '<text class="group-label dimmable" x="' + (x + 10) + '" y="' + (y0 + 12) + '" transform="rotate(-90 ' + (x + 10) + ' ' + (y0 + 12) + ')">' + esc(g.name) + "</text>";
    }).join("");

    const trunk = '<line class="trunk" x1="' + trunkX + '" y1="' + yTop + '" x2="' + trunkX + '" y2="' + yBot + '"/>' +
      '<path class="root" d="M' + trunkX + "," + yBot + " l-18,16 M" + trunkX + "," + yBot + " l0,18 M" + trunkX + "," + yBot + ' l18,16"/>';

    const dirArrow = '<text class="year major" x="' + (trunkX + 12) + '" y="' + (yTop - 10) + '">更晚 ↑</text>' +
      '<text class="year" x="' + (trunkX + 12) + '" y="' + (yBot + 32) + '">更早 ↓ 起源</text>';

    const branchLines = eras.map((e) => {
      const parts = ['M' + trunkX + "," + e.midY + " H" + e.stubX + " M" + e.stubX + "," + e.minY + " V" + e.maxY];
      e.membersL.forEach((m) => {
        parts.push("M" + e.stubX + "," + m.y + " H" + m.x);
      });
      return '<path class="branch dimmable" data-era="' + esc(e.name) + '" d="' + parts.join(" ") + '"/>';
    }).join("");

    const eraLabels = eras.map((e) => {
      const anchor = e.side === "right" ? "start" : "end";
      const x = e.side === "right" ? trunkX + 10 : trunkX - 10;
      return '<g class="era-hit dimmable" tabindex="0" role="button" data-kind="era" data-id="' + esc(e.name) + '">' +
        '<text class="era-label" text-anchor="' + anchor + '" x="' + x + '" y="' + (e.labelY - 10) + '">' + esc(e.name) + "</text></g>";
    }).join("");

    const leafW = layout.leafW || 180;
    const leafH = layout.leafH || 36;
    const leaves = people.map((item) => {
      const x = item.x - leafW / 2;
      const y = item.y - leafH / 2;
      return '<g class="leaf-node dimmable" tabindex="0" role="button" data-kind="person" data-id="' + esc(item.p.id) + '" aria-label="' + esc(item.p.name) + '">' +
        '<rect class="leaf-bg" x="' + x + '" y="' + y + '" width="' + leafW + '" height="' + leafH + '" rx="10"/>' +
        '<text class="leaf-label" text-anchor="middle" x="' + item.x + '" y="' + (item.y + 5) + '">' + esc(item.p.name) + "</text></g>";
    }).join("");

    const flowerEls = showWorks ? works.map((w) => {
      const title = w.work[0] + "（" + w.work[1] + "）";
      const guide = '<path class="year-guide" data-person="' + esc(w.personId) + '" d="M' + w.x + "," + w.y + " L" + trunkX + "," + w.yearY + '"/>';
      const yearTag = '<text class="work-year" x="' + w.x + '" y="' + (w.y + 18) + '" text-anchor="middle">' + esc(String(w.year)) + "</text>";
      return '<g class="flower-bundle dimmable" data-kind="work" data-id="' + esc(w.id) + '" data-person="' + esc(w.personId) + '">' +
        guide +
        '<g class="flower-node" tabindex="0" role="button" data-kind="work" data-id="' + esc(w.id) + '" aria-label="' + esc(title) + '">' +
        flowerMark(w.x, w.y, w.id, title) +
        "<title>" + esc(title) + "</title></g>" +
        yearTag + workCaption(w) +
        "</g>";
    }).join("") : "";

    let relate = "";
    if (showRelate) {
      const seen = new Set();
      PEOPLE.forEach((p) => {
        (p.relate || []).forEach(([id]) => {
          const a = people.find((x) => x.p.id === p.id);
          const b = people.find((x) => x.p.id === id);
          if (!a || !b) return;
          const key = [p.id, id].sort().join("::");
          if (seen.has(key)) return;
          seen.add(key);
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2 - 24;
          relate += '<path class="relate-line dimmable" data-relate="' + esc(key) + '" d="M' + a.x + "," + a.y + " Q" + mx + "," + my + " " + b.x + "," + b.y + '"/>';
        });
      });
    }

    const vbW = width;
    return '<svg class="tree-svg" id="treeSvg" viewBox="0 0 ' + vbW + " " + height + '" width="' + vbW + '" height="' + height + '" role="img" aria-label="外国近现代建筑史时间树，时间自下而上">' +
      groupBands + yearMarks + trunk + dirArrow + branchLines + relate + eraLabels + flowerEls + leaves +
      "</svg>";
  }

  function inspectorHtml() {
    const s = treeSel;
    if (!s) {
      return '<div class="kicker">怎么读这棵树</div>' +
        "<h2>时间在主干上，关系不要挤在一根线上。</h2>" +
        '<p class="lede">自下而上是时间：下面是起源，上面更晚。枝是思潮或流派线索，叶是建筑师，花是作品。同一人可以同时属于时段带、思潮枝和若干标签，横向关联会另外标出，不把历史收成唯一归属。</p>' +
        '<div class="note">数据沿用原人物卡，未改事实表述。花朵旁的数字是作品年份；悬停、聚焦或选中后会显示作品全名，并有细线连回主干上的年代。</div>' +
        '<p class="faint">键盘：Tab 移动，Enter 打开完整卡片，/ 检索，Esc 取消选择。方向键沿时间上下移动。</p>';
    }
    if (s.kind === "era") {
      const members = PEOPLE.filter((p) => p.era === s.id);
      const other = PEOPLE.filter((p) => p.era !== s.id && ((p.tags || []).some((t) => t.includes(s.id) || s.id.includes(t)) || p.group === s.id));
      return '<div class="kicker">枝 · 思潮 / 流派 / 思想</div><h2>' + esc(s.id) + "</h2>" +
        '<div class="note">这是便于复习的线索，不是唯一标签。人物仍可能与其他思潮发生关系。</div>' +
        "<h3>这条枝上的建筑师</h3>" +
        members.map((p) => '<button class="relation" data-person="' + esc(p.id) + '"><strong>' + esc(p.name) + '</strong><small>' + esc(p.year) + " · " + esc((p.tags || []).join(" · ")) + "</small></button>").join("") +
        (other.length ? "<h3>可能相关（未作为本枝主线索）</h3>" + other.map((p) => '<button class="relation" data-person="' + esc(p.id) + '"><strong>' + esc(p.name) + '</strong><small>' + esc(p.era) + " · " + esc((p.tags || []).join(" · ")) + "</small></button>").join("") : "");
    }
    if (s.kind === "work") {
      const [pid, wi] = s.id.split("::");
      const p = peopleById[pid];
      const w = p && p.works && p.works[+wi];
      if (!p || !w) return "<p>未找到这件作品。</p>";
      return '<div class="kicker">花 · 建筑作品 / 文本</div><h2>' + esc(w[0]) + "</h2>" +
        '<div class="english">' + esc(w[1]) + "</div>" +
        "<p>" + esc(w[2]) + "</p>" +
        '<p class="muted">所属建筑师：' + esc(p.name) + " · " + esc(p.era) + "</p>" +
        '<div class="note">作品按自身年份落在时间主干附近，不必与人物的活动中点重合。</div>' +
        '<div class="actions"><button class="action-btn primary" data-person="' + esc(p.id) + '">打开 ' + esc(p.name) + " 的卡片</button></div>";
    }
    const p = peopleById[s.id];
    if (!p) return "<p>未找到这个人物。</p>";
    const works = (p.works || []).map((w) => '<div class="work"><strong>' + esc(w[0]) + "</strong><small>" + esc(w[1]) + "</small><p>" + esc(w[2]) + "</p></div>").join("");
    const rel = (p.relate || []).map(([id, why]) => '<button class="relation" data-person="' + esc(id) + '"><strong>' + esc(label(id)) + '</strong><small>' + esc(why) + "</small></button>").join("");
    return '<div class="kicker">叶 · 建筑师</div><h2>' + esc(p.name) + "</h2>" +
      '<div class="english">' + esc(p.en) + " · " + esc(p.year) + "</div>" +
      '<div class="tag-list">' + badges(p) + "</div>" +
      '<p class="muted">时段带：' + esc(p.group) + " ｜ 思潮枝：" + esc(p.era) + "</p>" +
      "<p>" + esc(p.idea) + "</p>" +
      "<h3>作品</h3><div class=\"works-list\">" + works + "</div>" +
      "<h3>横向关联</h3>" + rel +
      '<div class="actions">' +
        '<button class="action-btn primary" data-person="' + esc(p.id) + '">打开完整卡片</button>' +
        '<button class="action-btn" data-start-one="' + esc(p.id) + '">闭卷测这个人物</button>' +
      "</div>";
  }

  function applyRailHighlight() {
    const rail = $("#railTree");
    if (!rail) return;
    const q = search.trim().toLowerCase();
    const matchIds = new Set(filteredPeople().map((p) => p.id));
    const hasQuery = !!(q || (filter !== "全部"));
    $$(".rail-item", rail).forEach((li) => {
      const btn = $("[data-kind]", li);
      if (!btn) return;
      const kind = btn.dataset.kind;
      const id = btn.dataset.id;
      let isMatch = true;
      if (hasQuery) {
        if (kind === "person") isMatch = matchIds.has(id);
        else if (kind === "work") isMatch = matchIds.has(id.split("::")[0]);
        else if (kind === "era") isMatch = PEOPLE.some((p) => p.era === id && matchIds.has(p.id));
      }
      const isActive = !!(treeSel && treeSel.kind === kind && treeSel.id === id);
      li.classList.toggle("is-match", !!(hasQuery && isMatch) || isActive);
      li.classList.toggle("is-dim", hasQuery && !isMatch && !isActive);
      li.classList.toggle("is-active", isActive);
    });
    const panel = $("#inspector");
    if (panel) panel.innerHTML = inspectorHtml();
  }

  function applyTreeHighlight() {
    applyRailHighlight();
    const svg = $("#treeSvg");
    if (!svg) return;
    const q = search.trim().toLowerCase();
    const matchIds = new Set(filteredPeople().map((p) => p.id));
    const hasQuery = !!(q || (filter !== "全部"));
    const sel = treeSel;
    svg.classList.toggle("is-filtering", hasQuery || !!sel);

    $$(".dimmable, .leaf-node, .flower-node, .flower-bundle, .era-hit, .relate-line, .work-label", svg).forEach((el) => {
      el.classList.remove("is-match", "is-active", "is-open");
    });

    function markMatch(el) {
      if (!el) return;
      el.classList.add("is-match");
      // also mark ancestor dimmable / node
      const node = el.closest(".leaf-node, .flower-node, .era-hit, .dimmable") || el;
      node.classList.add("is-match");
    }

    if (hasQuery) {
      PEOPLE.forEach((p) => {
        if (!matchIds.has(p.id)) return;
        markMatch($('[data-kind="person"][data-id="' + p.id + '"]', svg));
        $$('[data-person="' + p.id + '"]', svg).forEach(markMatch);
        $$('[data-id^="' + p.id + '::"]', svg).forEach(markMatch);
        markMatch($('[data-kind="era"][data-id="' + CSS.escape(p.era) + '"]', svg));
      });
    }
    if (sel) {
      if (sel.kind === "person") {
        const el = $('[data-kind="person"][data-id="' + sel.id + '"]', svg);
        if (el) { el.classList.add("is-active", "is-match"); }
        $$('[data-person="' + sel.id + '"], [data-id^="' + sel.id + '::"]', svg).forEach((n) => {
          n.classList.add("is-match");
          if (n.classList.contains("flower-bundle")) n.classList.add("is-open");
        });
        const p = peopleById[sel.id];
        if (p) {
          const era = $('[data-kind="era"][data-id="' + CSS.escape(p.era) + '"]', svg);
          if (era) era.classList.add("is-match");
          (p.relate || []).forEach(([id]) => {
            const o = $('[data-kind="person"][data-id="' + id + '"]', svg);
            if (o) o.classList.add("is-match");
          });
        }
      } else if (sel.kind === "era") {
        const el = $('[data-kind="era"][data-id="' + CSS.escape(sel.id) + '"]', svg);
        if (el) el.classList.add("is-active", "is-match");
        $$('[data-era="' + CSS.escape(sel.id) + '"]', svg).forEach((n) => n.classList.add("is-match"));
        PEOPLE.filter((p) => p.era === sel.id).forEach((p) => {
          const leaf = $('[data-kind="person"][data-id="' + p.id + '"]', svg);
          if (leaf) leaf.classList.add("is-match");
          $$('[data-id^="' + p.id + '::"]', svg).forEach((n) => n.classList.add("is-match"));
        });
      } else if (sel.kind === "work") {
        const el = $('[data-kind="work"][data-id="' + CSS.escape(sel.id) + '"]', svg);
        if (el) el.classList.add("is-active", "is-match");
        const pid = sel.id.split("::")[0];
        const leaf = $('[data-kind="person"][data-id="' + pid + '"]', svg);
        if (leaf) leaf.classList.add("is-match");
        const lab = $('[data-work-label="' + CSS.escape(sel.id) + '"]', svg);
        if (lab) lab.classList.add("is-match");
      }
    }
    const panel = $("#inspector");
    if (panel) panel.innerHTML = inspectorHtml();
  }


  function railEvents() {
    const events = [];
    PEOPLE.forEach((p) => {
      const span = personSpan(p);
      events.push({ kind: "era", year: span.mid, id: p.era, title: p.era, sort: span.mid - 0.2, p: null });
      events.push({ kind: "person", year: span.mid, id: p.id, title: p.name, sub: p.en + " · " + p.year, sort: span.mid, p });
      (p.works || []).forEach((w, wi) => {
        const y = workYear(w);
        if (y == null) return;
        events.push({ kind: "work", year: y, id: p.id + "::" + wi, title: w[0], sub: w[1] + " · " + p.name, sort: y + 0.2, p, work: w });
      });
    });
    const seenEra = new Set();
    const uniq = [];
    events.sort((a, b) => a.sort - b.sort || String(a.id).localeCompare(String(b.id)));
    events.forEach((e) => {
      if (e.kind === "era") {
        if (seenEra.has(e.id)) return;
        seenEra.add(e.id);
      }
      uniq.push(e);
    });
    return uniq;
  }

  function renderMobileRail() {
    const events = railEvents();
    const q = search.trim().toLowerCase();
    const matchIds = new Set(filteredPeople().map((p) => p.id));
    const hasQuery = !!(q || (filter !== "全部"));
    return '<p class="rail-dir">手机上按时间列表阅读：<strong>上面更早，下面更晚</strong>。桌面时间树仍自下而上，与草图一致。</p>' +
      '<ol class="rail-tree" id="railTree">' + events.map((e) => {
        let relatedId = e.kind === "work" ? e.id.split("::")[0] : (e.kind === "person" ? e.id : null);
        if (e.kind === "era") {
          const members = PEOPLE.filter((p) => p.era === e.id);
          relatedId = members.some((p) => matchIds.has(p.id)) ? "era-match" : null;
        }
        const isMatch = !hasQuery || e.kind === "era"
          ? (e.kind !== "era" ? matchIds.has(relatedId) : PEOPLE.some((p) => p.era === e.id && matchIds.has(p.id)))
          : matchIds.has(relatedId);
        const isActive = treeSel && treeSel.kind === e.kind && treeSel.id === e.id;
        const cls = "rail-item is-" + e.kind + (isActive ? " is-active" : "") + (hasQuery ? (isMatch ? " is-match" : " is-dim") : "");
        if (e.kind === "era") {
          return '<li class="' + cls + '"><span class="rail-dot"></span><div class="rail-year">' + Math.round(e.year) + '</div><button type="button" class="rail-card" data-kind="era" data-id="' + esc(e.id) + '"><strong class="rail-title">枝 · ' + esc(e.title) + "</strong></button></li>";
        }
        if (e.kind === "person") {
          return '<li class="' + cls + '"><span class="rail-dot"></span><div class="rail-year">' + Math.round(e.year) + '</div><button type="button" class="rail-card" data-kind="person" data-id="' + esc(e.id) + '"><strong>叶 · ' + esc(e.title) + "</strong><small>" + esc(e.sub) + "</small></button></li>";
        }
        return '<li class="' + cls + '"><span class="rail-dot"></span><div class="rail-year">' + e.year + '</div><button type="button" class="rail-card" data-kind="work" data-id="' + esc(e.id) + '"><strong>花 · ' + esc(e.title) + "</strong><small>" + esc(e.sub) + "</small></button></li>";
      }).join("") + "</ol>";
  }

  function treePage() {
    const isMobile = window.innerWidth < 880;
    const stageW = Math.max(1100, (document.getElementById("main") || document.body).clientWidth - (window.innerWidth >= 1080 ? 320 : 0));
    const layout = isMobile ? null : layoutTree(stageW, false);
    const s = stats();
    return '<div class="tree-page">' +
      '<div class="tree-stage" id="treeStage">' +
        '<div class="tree-chrome">' +
          '<div class="kicker">时间主干 · 思潮枝 · 建筑师叶 · 作品花</div>' +
          "<h1>外国近现代建筑史时间树</h1>" +
          '<p class="lede">先沿主干看时间，再沿枝看思潮，叶片是建筑师，旁边的花是作品。时间自下而上。悬停或选中花朵可看作品名，并连回它在主干上的年份；时段带可以重叠，不是唯一归属。</p>' +
          '<div class="toolbar">' +
            '<div class="legend" aria-hidden="true">' +
              '<span><i class="lg-trunk"></i>时间主干</span>' +
              '<span><i class="lg-branch"></i>思潮 / 流派</span>' +
              '<span><i class="lg-leaf"></i>建筑师</span>' +
              '<span><i class="lg-flower"></i>作品</span>' +
            "</div>" +
            '<div class="row">' +
              '<button type="button" class="chip' + (showWorks ? " is-active" : "") + '" data-toggle="works">作品花朵</button>' +
              '<button type="button" class="chip' + (showRelate ? " is-active" : "") + '" data-toggle="relate">横向关联</button>' +
              '<button type="button" class="chip" data-scroll="roots">到起源</button>' +
              '<button type="button" class="chip" data-scroll="now">到当代</button>' +
            "</div>" +
          "</div>" +
          '<div class="filterbar" aria-label="时段筛选">' +
            '<button type="button" class="chip' + (filter === "全部" ? " is-active" : "") + '" data-filter="全部">全部 ' + s.total + "</button>" +
            '<button type="button" class="chip' + (filter === "本次错题" ? " is-active" : "") + '" data-filter="本次错题">本次 6 题 ' + s.seed + "</button>" +
            GROUP_ORDER.map((g) => '<button type="button" class="chip' + (filter === g ? " is-active" : "") + '" data-filter="' + esc(g) + '">' + esc(g) + "</button>").join("") +
          "</div>" +
        "</div>" +
        '<div class="tree-canvas" id="treeCanvas">' + (isMobile ? renderMobileRail() : renderTreeSvg(layout)) + "</div>" +
      "</div>" +
      '<aside class="inspector" id="inspector">' + inspectorHtml() + "</aside>" +
    "</div>";
  }

  function cardsPage() {
    const results = filteredPeople();
    const s = stats();
    const groups = filter === "全部" || filter === "本次错题" ? GROUP_ORDER : [filter];
    const chips = ["全部", "本次错题"].concat(GROUP_ORDER);
    return '<div class="page">' +
      '<div class="kicker">人物卡片库</div>' +
      "<h1>先看成一张卡片，再放回时间树。</h1>" +
      '<p class="lede">共 ' + s.total + " 人。检索与筛选和时间树共用；打开卡片可读思想、手法、作品和横向关联。</p>" +
      '<div class="stats"><div class="stat"><strong>' + s.total + '</strong><span>建筑师</span></div><div class="stat"><strong>' + s.seed + '</strong><span>本次错题关联</span></div><div class="stat"><strong>' + s.reviewed + '</strong><span>已有自评</span></div><div class="stat"><strong>' + s.due + '</strong><span>今日待复测</span></div></div>' +
      '<div class="filterbar">' + chips.map((c) => '<button type="button" class="chip' + (filter === c ? " is-active" : "") + '" data-filter="' + esc(c) + '">' + esc(c) + "</button>").join("") + "</div>" +
      (results.length ? groups.map((g) => {
        const list = results.filter((p) => p.group === g);
        if (!list.length) return "";
        return '<h2 style="margin:28px 0 12px">' + esc(g) + "</h2>" +
          '<div class="card-grid">' + list.map((p) => {
            const r = store.reviews[p.id];
            return '<button class="person-card" data-person="' + esc(p.id) + '"><div class="tag-list">' + badges(p) + "</div><h3>" + esc(p.name) + '</h3><div class="english">' + esc(p.en) + " · " + esc(p.year) + "</div><p>" + esc(p.idea) + "</p>" +
              (r ? '<p class="faint">自评：' + (r.rate === "again" ? "不会" : r.rate === "hard" ? "模糊" : "会") + " · 下次 " + r.due + "</p>" : "") +
              "</button>";
          }).join("") + "</div>";
      }).join("") : '<div class="empty">没有符合检索或筛选的人物。</div>') +
    "</div>";
  }

  function detailPage(p) {
    if (!p) return cardsPage();
    const r = store.reviews[p.id];
    const works = (p.works || []).map((w) => '<div class="work"><strong>' + esc(w[0]) + "</strong><small>" + esc(w[1]) + "</small><p>" + esc(w[2]) + "</p></div>").join("");
    const relations = (p.relate || []).map(([id, why]) => '<button class="relation" data-person="' + esc(id) + '"><strong>' + esc(label(id)) + "</strong><small>" + esc(why) + "</small></button>").join("");
    const source = p.source
      ? '<a class="linkish" target="_blank" rel="noopener noreferrer" href="' + esc(p.source) + '">外部参考资料 ↗</a>'
      : "补充学习卡，未做逐条教材定位";
    const rateText = r ? ("最近自评：" + (r.rate === "again" ? "不会" : r.rate === "hard" ? "模糊" : "会") + " · 下次 " + r.due) : "还没有复测记录";
    return '<div class="page">' +
      '<button type="button" class="back-link" data-view="tree">← 返回时间树</button> ' +
      '<button type="button" class="back-link" data-view="cards">人物库</button>' +
      '<section class="detail-head"><div><div class="kicker">' + esc(p.group) + " / " + esc(p.year) + "</div>" +
      "<h1>" + esc(p.name) + '</h1><div class="english">' + esc(p.en) + '</div><div class="tag-list">' + badges(p) + "</div></div>" +
      '<div><button type="button" class="action-btn primary" data-start-one="' + esc(p.id) + '">闭卷测这个人物</button></div></section>' +
      '<div class="detail-grid"><div>' +
        '<section class="info-panel"><h3>思想立场</h3><p>' + esc(p.idea) + "</p></section>" +
        '<section class="info-panel" style="margin-top:12px"><h3>设计手法</h3><p>' + esc(p.method) + "</p></section>" +
        '<section class="info-panel" style="margin-top:12px"><h3>作品对应</h3><div class="works-list">' + works + "</div></section>" +
        '<section class="info-panel" style="margin-top:12px"><h3>横向关联</h3><div class="relate-list">' + relations + "</div></section>" +
      "</div><div>" +
        '<section class="info-panel"><div class="kicker">复述问题</div><h3>' + esc(p.question) + "</h3>" +
        '<p class="faint">' + rateText + "</p>" +
        '<button type="button" class="action-btn" data-start-one="' + esc(p.id) + '">进入闭卷练习</button></section>' +
        '<section class="info-panel" style="margin-top:12px"><h3>真实建筑图源</h3><p class="muted">在维基共享资源中按作品检索图片，便于对照，不替代教材图版。</p>' +
        '<p><a class="linkish" target="_blank" rel="noopener noreferrer" href="' + esc(wikiPhoto(p)) + '">打开图源检索 ↗</a></p>' +
        '<p class="faint" style="margin-top:10px">' + source + "</p></section>" +
      "</div></div></div>";
  }

  function makeQuiz(mode, solo) {
    quizMode = solo ? "solo" : (mode || quizMode);
    let ids = solo
      ? [solo]
      : quizMode === "seed"
        ? PEOPLE.filter((p) => p.seed).map((p) => p.id)
        : quizMode === "due"
          ? PEOPLE.filter((p) => store.reviews[p.id] && store.reviews[p.id].due <= today()).map((p) => p.id)
          : PEOPLE.map((p) => p.id);
    if (quizMode === "all") {
      ids.sort((a, b) => {
        const x = store.reviews[a], y = store.reviews[b];
        const score = (r) => r ? (r.rate === "again" ? 0 : r.rate === "hard" ? 1 : r.due <= today() ? 2 : 4) : 3;
        return score(x) - score(y) || a.localeCompare(b);
      });
    }
    if (quizRound > 0 && ids.length > 1) {
      const n = quizRound % ids.length;
      ids = ids.slice(n).concat(ids.slice(0, n));
    }
    quizOrder = ids;
    quizIdx = 0;
    revealed = false;
  }
  function next() {
    revealed = false;
    quizIdx++;
    if (quizIdx >= quizOrder.length) {
      quizRound++;
      makeQuiz(quizMode);
      toast("本轮已完成，已重新编排一批");
    }
    render();
  }
  function record(rate) {
    const id = quizOrder[quizIdx];
    if (!id || !revealed || !VALID_RATES.includes(rate)) return;
    const prev = store.reviews[id] || { tries: 0 };
    const days = rate === "again" ? 1 : rate === "hard" ? 3 : 7;
    store.reviews[id] = { rate, last: today(), due: after(days), tries: (prev.tries || 0) + 1 };
    save();
    toast("已记录：" + label(id) + " · " + (rate === "again" ? "明天" : days + "天后") + "复测");
    next();
  }
  function quizPage() {
    if (!quizOrder.length) makeQuiz(quizMode);
    const s = stats();
    const p = peopleById[quizOrder[quizIdx]];
    const tabs = [["seed", "本次 6 题"], ["due", "今日待复测 (" + s.due + ")"], ["all", "全部人物"]];
    return '<div class="page"><div class="kicker">闭卷复测</div>' +
      " <h1>闭卷，才能知道会不会。</h1>" +
      '<p class="lede">先独立写出要点，再揭晓参考答案。只有你自己点击“会 / 模糊 / 不会”后才记录复习状态。记录仍保存在本机，键名不变。</p>' +
      '<div class="filterbar">' + tabs.map(([id, name]) => '<button type="button" class="chip' + (quizMode === id ? " is-active" : "") + '" data-quiz-mode="' + id + '">' + name + "</button>").join("") + "</div>" +
      '<div class="quiz-layout"><section class="quiz-card">' +
      (p
        ? '<div class="quiz-kicker">第 ' + (quizIdx + 1) + " / " + quizOrder.length + " 题 · " + (p.seed ? "本次错题关联" : "延伸复测") + "</div>" +
          "<h2>" + esc(p.name) + '</h2><div class="english">' + esc(p.en) + "</div>" +
          '<div class="quiz-prompt">' + esc(p.question) + "</div>" +
          '<textarea id="quizDraft" class="answer-textarea" placeholder="先把脑海中的知识点写下来，别急着看答案…" aria-label="闭卷作答">' + esc(store.drafts[p.id] || "") + "</textarea>" +
          '<div class="actions"><button type="button" class="action-btn primary" data-reveal="1">' + (revealed ? "收起参考答案" : "揭晓参考答案") + "</button>" +
          '<button type="button" class="action-btn ghost" data-person="' + p.id + '">查看关联卡</button></div>' +
          (revealed
            ? '<div class="answer-box"><strong>参考要点</strong><p>' + esc(p.answer) + '</p><p class="faint">易混：' + esc(p.trap) + "</p></div>" +
              '<p class="faint">根据自己的作答而不是眼熟程度评估：</p>' +
              '<div class="rating-row">' +
                '<button type="button" class="rate-btn" data-rate="again">不会 · 明天复测</button>' +
                '<button type="button" class="rate-btn" data-rate="hard">模糊 · 3 天后</button>' +
                '<button type="button" class="rate-btn" data-rate="good">会 · 7 天后</button>' +
              "</div>"
            : "")
        : '<div class="empty">这组暂时没有到期内容。可以切到“本次 6 题”或“全部人物”。</div>') +
      '</section><aside class="quiz-aside"><h3>复习规则</h3><p class="muted">不是机械地从第 1 题反复刷。全部人物优先安排你自评“不会、模糊”和已经到期的项目。</p>' +
      '<ol class="muted-list"><li>先闭卷输出</li><li>对照参考要点</li><li>自主评估</li><li>按 1 / 3 / 7 天复测</li></ol>' +
      '<div class="note">当前为单设备本地记录；换浏览器或清除站点数据前，先在“复习记录”导出备份。</div></aside></div></div>';
  }

  function graphPage() {
    return '<div class="page"><div class="kicker">关系索引</div>' +
      "<h1>时间树之外，再记几条思想对照。</h1>" +
      '<p class="lede">这些链条和对照来自原关系索引，用来提醒不可混同的概念。点击名字打开完整卡片。它们不是树上的唯一从属。</p>' +
      RELATION_TOPICS.map((topic, i) =>
        '<section class="group-section" style="margin-bottom:12px"><div class="kicker">线索 ' + String(i + 1).padStart(2, "0") + "</div><h2>" + esc(topic.title) + "</h2>" +
        '<p class="muted">' + esc(topic.sub) + '</p><div class="group-chain">' +
        topic.ids.map((id) => {
          const p = peopleById[id];
          return '<button type="button" class="mini-node" data-person="' + id + '"><strong>' + esc(p.name) + "</strong><span>" + esc((p.tags || []).join(" · ")) + "</span></button>";
        }).join("") + "</div></section>"
      ).join("") +
      '<h2 style="margin:28px 0 12px">最值得记的横向对照</h2>' +
      '<div class="relation-grid">' + COMPARE_PAIRS.map(([a, b, text]) =>
        '<div class="connection-card"><div class="comparison"><button type="button" class="linkish" data-person="' + a + '">' + esc(label(a)) + '</button> ↔ <button type="button" class="linkish" data-person="' + b + '">' + esc(label(b)) + '</button></div><p>' + esc(text) + '</p></div>'
      ).join("") + "</div></div>";
  }

  function progressPage() {
    const s = stats();
    const rs = PEOPLE.filter((p) => store.reviews[p.id]).sort((a, b) => (store.reviews[a.id].due || "").localeCompare(store.reviews[b.id].due || ""));
    const due = rs.filter((p) => store.reviews[p.id].due <= today());
    return '<div class="page"><div class="kicker">复习记录</div><h1>复习记录</h1>' +
      '<p class="lede">只有完成闭卷练习并主动自评的卡片才计入记录。数据仅保存在当前设备的浏览器，与改版前使用同一存储键。</p>' +
      '<div class="stats"><div class="stat"><strong>' + s.reviewed + '</strong><span>已自评人物</span></div><div class="stat"><strong>' + s.again + '</strong><span>自评不会</span></div><div class="stat"><strong>' + s.hard + '</strong><span>自评模糊</span></div><div class="stat"><strong>' + s.due + '</strong><span>到期待复测</span></div></div>' +
      '<div class="quiz-layout"><section class="progress-panel"><h3>到期队列</h3>' +
      (due.length ? due.map((p) => {
        const r = store.reviews[p.id];
        return '<button type="button" class="row-item" data-start-one="' + p.id + '"><strong>' + esc(p.name) + "</strong><span class=\"faint\">" + esc(r.due) + " · 到期</span></button>";
      }).join("") + '<div class="actions"><button type="button" class="action-btn primary" data-quiz-mode="due">练今日到期</button></div>'
        : '<p class="muted">暂时没有到期项目。</p>') +
      '</section><section class="progress-panel"><h3>个人数据</h3>' +
      (rs.length ? rs.map((p) => {
        const r = store.reviews[p.id];
        const word = r.rate === "again" ? "不会" : r.rate === "hard" ? "模糊" : "会";
        return '<div class="row-item"><strong>' + esc(p.name) + '</strong><span class="faint">' + word + " · 下次 " + esc(r.due) + " · " + (r.tries || 1) + " 次</span></div>";
      }).join("") : '<p class="muted">还没有自评记录。</p>') +
      '<div class="actions"><button type="button" class="action-btn" id="exportBtn">导出复习记录</button>' +
      '<button type="button" class="action-btn ghost" id="importBtn">导入记录</button>' +
      '<button type="button" class="back-link" id="resetBtn">清空本机复习记录</button></div>' +
      '<p class="faint">导出格式仍为 architect-links-review v1，可与旧版互导。</p></section></div></div>';
  }

  function download() {
    const payload = { format: "architect-links-review", version: 1, exported_at: new Date().toISOString(), reviews: store.reviews, drafts: store.drafts };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "建筑师人物关联卡_复习记录_" + today() + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("复习记录已导出");
  }
  function importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const x = JSON.parse(reader.result);
        if (x.format !== "architect-links-review" || x.version !== 1 || !x.reviews || typeof x.reviews !== "object") throw Error("文件格式不匹配");
        let added = 0;
        Object.entries(x.reviews).forEach(([id, r]) => {
          if (!peopleById[id] || !VALID_RATES.includes(r.rate) || !/^\d{4}-\d{2}-\d{2}$/.test(r.due || "")) return;
          const prev = store.reviews[id];
          if (!prev || String(r.last || "") >= String(prev.last || "")) {
            store.reviews[id] = { rate: r.rate, last: r.last || r.due, due: r.due, tries: Math.max(0, Number(r.tries) || 1) };
            added++;
          }
        });
        if (x.drafts && typeof x.drafts === "object") {
          Object.entries(x.drafts).forEach(([id, value]) => {
            if (peopleById[id] && typeof value === "string") store.drafts[id] = value;
          });
        }
        save();
        render();
        toast("已导入 " + added + " 条复习记录");
      } catch (e) {
        toast("无法导入：文件不是可识别的复习记录");
      }
    };
    reader.readAsText(file);
  }

  function syncChrome() {
    const view = current().view;
    $$(".nav-btn, .mobile-nav button").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-view") === (view === "person" ? "cards" : view));
    });
    const input = $("#searchInput");
    if (input && input.value !== search) input.value = search;
  }

  function render() {
    const main = $("#main");
    const route = current();
    const stage = $("#treeStage");
    if (stage) treeScroll = stage.scrollTop;
    let html;
    if (route.view === "tree") html = treePage();
    else if (route.view === "cards") html = cardsPage();
    else if (route.view === "person") html = detailPage(peopleById[route.id]);
    else if (route.view === "quiz") html = quizPage();
    else if (route.view === "graph") html = graphPage();
    else if (route.view === "progress") html = progressPage();
    else html = treePage();
    main.innerHTML = html;
    syncChrome();
    if (route.view === "tree") {
      applyTreeHighlight();
      const st = $("#treeStage");
      const mobile = window.innerWidth < 880;
      if (st) {
        if (mobile) {
          if (treeScroll != null && didInitialTreeScroll) st.scrollTop = treeScroll;
          else { st.scrollTop = 0; didInitialTreeScroll = true; }
        } else if (treeScroll != null && didInitialTreeScroll) {
          st.scrollTop = treeScroll;
        } else {
          st.scrollTop = st.scrollHeight - st.clientHeight;
          didInitialTreeScroll = true;
        }
      }
    }
    const draft = $("#quizDraft");
    if (draft) {
      draft.focus({ preventScroll: true });
    }
  }

  function selectNode(kind, id, opts) {
    treeSel = id ? { kind, id } : null;
    if (current().view !== "tree") return;
    if (opts && opts.openPerson && kind === "person") {
      goPerson(id);
      return;
    }
    applyTreeHighlight();
    const panel = $("#inspector");
    if (panel && window.innerWidth < 1080) panel.scrollIntoView({ block: "nearest", behavior: "auto" });
  }

  function treeNodes() {
    return $$("#treeSvg [data-kind]");
  }

  document.addEventListener("click", (e) => {
    const act = e.target.closest("button, [data-card], [data-kind], a.brand");
    if (!act) return;
    if (act.id === "exportBtn") { download(); return; }
    if (act.id === "importBtn") { $("#fileImport").click(); return; }
    if (act.id === "resetBtn") {
      if (confirm("确认清空本机全部复习记录和草稿吗？此操作不能撤销。")) {
        store = storeDefault();
        save();
        render();
        toast("本机记录已清空");
      }
      return;
    }
    if (act.dataset.toggle === "works") { showWorks = !showWorks; render(); return; }
    if (act.dataset.toggle === "relate") { showRelate = !showRelate; render(); return; }
    if (act.dataset.scroll === "roots") {
      const st = $("#treeStage");
      if (st) st.scrollTop = window.innerWidth < 880 ? 0 : st.scrollHeight;
      return;
    }
    if (act.dataset.scroll === "now") {
      const st = $("#treeStage");
      if (st) st.scrollTop = window.innerWidth < 880 ? st.scrollHeight : 0;
      return;
    }
    if (act.dataset.filter) { filter = act.dataset.filter; render(); return; }
    if (act.dataset.person) { goPerson(act.dataset.person); return; }
    if (act.dataset.view) { setView(act.dataset.view); return; }
    if (act.dataset.startOne) { makeQuiz("solo", act.dataset.startOne); setView("quiz"); return; }
    if (act.dataset.quizMode) { quizRound = 0; makeQuiz(act.dataset.quizMode); setView("quiz"); return; }
    if (act.dataset.reveal) { revealed = !revealed; render(); return; }
    if (act.dataset.rate) { record(act.dataset.rate); return; }
    if (act.dataset.kind) {
      const open = e.detail === 2;
      if (act.dataset.kind === "person" && (e.metaKey || e.ctrlKey || open)) {
        goPerson(act.dataset.id);
        return;
      }
      selectNode(act.dataset.kind, act.dataset.id);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      const input = $("#searchInput");
      if (input) input.focus();
      return;
    }
    if (e.key === "Escape") {
      if (document.activeElement && document.activeElement.id === "searchInput" && search) {
        search = "";
        $("#searchInput").value = "";
        if (current().view === "tree") applyTreeHighlight();
        else render();
        return;
      }
      if (treeSel && current().view === "tree") {
        treeSel = null;
        applyTreeHighlight();
      }
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && e.target.dataset && e.target.dataset.kind) {
      e.preventDefault();
      if (e.key === "Enter" && e.target.dataset.kind === "person") goPerson(e.target.dataset.id);
      else selectNode(e.target.dataset.kind, e.target.dataset.id);
      return;
    }
    if ((e.key === "ArrowUp" || e.key === "ArrowDown") && current().view === "tree") {
      const nodes = treeNodes().filter((n) => n.dataset.kind === "person");
      if (!nodes.length) return;
      const active = document.activeElement;
      let idx = nodes.indexOf(active);
      if (idx < 0 && treeSel && treeSel.kind === "person") idx = nodes.findIndex((n) => n.dataset.id === treeSel.id);
      if (idx < 0) idx = e.key === "ArrowUp" ? 0 : nodes.length - 1;
      else idx = e.key === "ArrowUp" ? Math.max(0, idx - 1) : Math.min(nodes.length - 1, idx + 1);
      e.preventDefault();
      nodes[idx].focus();
      selectNode("person", nodes[idx].dataset.id);
    }
  });

  document.addEventListener("input", (e) => {
    if (e.target.id === "searchInput") {
      search = e.target.value;
      if (current().view === "tree") applyTreeHighlight();
      else if (current().view === "cards") render();
    }
    if (e.target.id === "quizDraft" && quizOrder[quizIdx]) {
      store.drafts[quizOrder[quizIdx]] = e.target.value;
      save();
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "fileImport") importData(e.target.files && e.target.files[0]);
  });
  window.addEventListener("hashchange", () => {
    render();
    if (current().view !== "tree") window.scrollTo({ top: 0, behavior: "auto" });
  });
  let resizeT;
  window.addEventListener("resize", () => {
    if (current().view !== "tree") return;
    clearTimeout(resizeT);
    resizeT = setTimeout(render, 150);
  });

  if (!location.hash) location.replace("#tree");
  else render();
})();
