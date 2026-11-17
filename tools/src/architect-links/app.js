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

  let lastLayout = null;
  let menuOpen = false;

  function layoutApi() {
    return window.ArchitectTreeLayout;
  }

  function flowerMark(x, y) {
    const r = 6.5;
    const d = 4.6;
    const pts = [[x, y - d], [x + d, y], [x, y + d], [x - d, y]];
    return pts.map((pt) => '<circle class="flower-petals" cx="' + pt[0] + '" cy="' + pt[1] + '" r="' + r + '"/>').join("") +
      '<circle class="flower-core" cx="' + x + '" cy="' + y + '" r="2.1"/>';
  }

  function renderTreeSvg(layout) {
    const { width, height, trunkX, padTop, innerH, people, eras, works, years, dirTop, dirBot } = layout;
    const yTop = padTop;
    const yBot = padTop + innerH;
    const byId = Object.fromEntries(people.map((item) => [item.p.id, item]));

    const yearEls = years.map((y) => {
      return '<line class="guide-year" x1="' + (trunkX - 8) + '" y1="' + y.tickY + '" x2="' + (trunkX + 8) + '" y2="' + y.tickY + '"/>' +
        '<text class="year' + (y.major ? " major" : "") + '" text-anchor="end" x="' + (y.labelX + y.labelW) + '" y="' + (y.tickY + 4) + '">' + y.year + "</text>";
    }).join("");

    const trunk = '<line class="trunk" x1="' + trunkX + '" y1="' + yTop + '" x2="' + trunkX + '" y2="' + yBot + '"/>' +
      '<path class="root" d="M' + trunkX + "," + yBot + " l-18,16 M" + trunkX + "," + yBot + " l0,18 M" + trunkX + "," + yBot + ' l18,16"/>';

    const dir = '<text class="year major" x="' + dirTop.x + '" y="' + (dirTop.y + 14) + '">' + esc(dirTop.text) + "</text>" +
      '<text class="year" x="' + dirBot.x + '" y="' + (dirBot.y + 14) + '">' + esc(dirBot.text) + "</text>";

    const branchEls = eras.map((e) => {
      const parts = ["M" + trunkX + "," + e.midY + " H" + e.stubX + " M" + e.stubX + "," + e.minY + " V" + e.maxY];
      e.members.forEach((p) => {
        const item = byId[p.id];
        if (!item) return;
        parts.push("M" + e.stubX + "," + item.y + " H" + item.innerX);
      });
      return '<path class="branch dimmable" d="' + parts.join(" ") + '"/>';
    }).join("");

    const eraLabels = eras.map((e) => {
      return '<g class="era-hit dimmable" tabindex="0" role="button" data-kind="era" data-id="' + esc(e.name) + '" aria-label="思潮 ' + esc(e.name) + '">' +
        '<text class="era-label" text-anchor="' + e.labelAnchor + '" x="' + e.labelX + '" y="' + (e.labelY + 14) + '">' + esc(e.name) + "</text></g>";
    }).join("");

    const leaves = people.map((item) => {
      const x = item.x - item.w / 2;
      const y = item.y - item.h / 2;
      return '<g class="leaf-node dimmable" tabindex="0" role="button" data-kind="person" data-id="' + esc(item.p.id) + '" aria-label="建筑师 ' + esc(item.p.name) + '">' +
        '<rect class="leaf-bg" x="' + x + '" y="' + y + '" width="' + item.w + '" height="' + item.h + '" rx="8"/>' +
        '<text class="leaf-label" text-anchor="middle" x="' + item.x + '" y="' + (item.y + 5) + '">' + esc(item.p.name) + "</text></g>";
    }).join("");

    const flowerEls = works.map((w) => {
      return '<g class="flower-node dimmable" tabindex="0" role="button" data-kind="work" data-id="' + esc(w.id) + '" data-person="' + esc(w.personId) + '" aria-label="作品 ' + esc(w.work[0]) + " " + esc(w.work[1]) + '">' +
        '<circle class="flower-hit" cx="' + w.x + '" cy="' + w.y + '" r="' + w.hitR + '"/>' +
        flowerMark(w.x, w.y) +
        "</g>";
    }).join("");

    return '<svg id="treeSvg" class="tree-svg" viewBox="0 0 ' + width + " " + height + '" width="' + width + '" height="' + height + '" role="img" aria-label="外国近现代建筑史时间树，时间自下而上">' +
      yearEls + trunk + dir + branchEls + eraLabels + leaves + flowerEls +
      "</svg>";
  }

  function eraCardHtml(name) {
    const members = PEOPLE.filter((p) => p.era === name);
    if (!members.length) return "<p>未找到这条思潮。</p>";
    const tokens = members.flatMap((p) => {
      const s = personSpan(p);
      return [[s.start, s.end]];
    });
    const span = spanOf(tokens);
    const years = span ? Math.round(span.start) + "–" + Math.round(span.end) : "";
    const list = members.map((p) =>
      '<button type="button" class="relation" data-kind="person" data-id="' + esc(p.id) + '"><strong>' + esc(p.name) + "</strong><small>" + esc(p.year) + "</small></button>"
    ).join("");
    return '<div class="kicker">枝 · 思潮 / 流派</div><h2>' + esc(name) + "</h2>" +
      '<div class="english">' + esc(years) + "</div>" +
      "<p>这是一条思想或流派线索，不是唯一历史归属。下面是出现在这根枝上的建筑师。</p>" +
      "<h3>建筑师</h3><div class=\"relate-list\">" + list + "</div>";
  }

  function workCardHtml(id) {
    const parts = id.split("::");
    const pid = parts[0];
    const wi = +parts[1];
    const p = peopleById[pid];
    const w = p && p.works && p.works[wi];
    if (!p || !w) return "<p>未找到这件作品。</p>";
    return '<div class="kicker">花 · 作品</div><h2>' + esc(w[0]) + "</h2>" +
      '<div class="english">' + esc(w[1]) + "</div>" +
      "<p>" + esc(w[2]) + "</p>" +
      '<p class="muted">所属建筑师：' + esc(p.name) + " · " + esc(p.era) + "</p>" +
      '<div class="actions">' +
        '<button type="button" class="action-btn" data-kind="person" data-id="' + esc(p.id) + '">查看 ' + esc(p.name) + "</button>" +
        '<button type="button" class="action-btn primary" data-person="' + esc(p.id) + '">完整卡片</button>' +
      "</div>";
  }

  function personCardHtml(id) {
    const p = peopleById[id];
    if (!p) return "<p>未找到这个人物。</p>";
    const works = (p.works || []).map((w, wi) =>
      '<button type="button" class="work" data-kind="work" data-id="' + esc(p.id + "::" + wi) + '"><strong>' + esc(w[0]) + "</strong><small>" + esc(w[1]) + "</small></button>"
    ).join("");
    const rel = (p.relate || []).map(([rid, why]) =>
      '<button type="button" class="relation" data-kind="person" data-id="' + esc(rid) + '"><strong>' + esc(label(rid)) + "</strong><small>" + esc(why) + "</small></button>"
    ).join("");
    return '<div class="kicker">叶 · 建筑师</div><h2>' + esc(p.name) + "</h2>" +
      '<div class="english">' + esc(p.en) + " · " + esc(p.year) + "</div>" +
      '<p class="muted">' + esc(p.era) + " · " + esc(p.group) + "</p>" +
      "<p>" + esc(p.idea) + "</p>" +
      (works ? "<h3>作品</h3><div class=\"works-list\">" + works + "</div>" : "") +
      (rel ? "<h3>横向关联</h3><div class=\"relate-list\">" + rel + "</div>" : "") +
      '<div class="actions">' +
        '<button type="button" class="action-btn primary" data-person="' + esc(p.id) + '">完整卡片</button>' +
        '<button type="button" class="action-btn" data-start-one="' + esc(p.id) + '">闭卷测这个人物</button>' +
      "</div>";
  }

  function nodeCardHtml(sel) {
    if (!sel) return "";
    if (sel.kind === "era") return eraCardHtml(sel.id);
    if (sel.kind === "work") return workCardHtml(sel.id);
    return personCardHtml(sel.id);
  }

  function closeTreeMenu() {
    menuOpen = false;
    const menu = $("#treeMenu");
    const fab = $("#treeFab");
    if (menu) menu.hidden = true;
    if (fab) fab.setAttribute("aria-expanded", "false");
  }

  function hideNodeCard() {
    treeSel = null;
    const card = $("#nodeCard");
    if (card) {
      card.hidden = true;
      card.innerHTML = "";
    }
    applyTreeHighlight();
  }

  function positionNodeCard() {
    const card = $("#nodeCard");
    const api = layoutApi();
    if (!card || card.hidden || !treeSel || !api) return;
    const kind = treeSel.kind;
    const id = treeSel.id;
    let node = null;
    $$("#treeSvg [data-kind]").forEach((el) => {
      if (el.getAttribute("data-kind") === kind && el.getAttribute("data-id") === id) node = el;
    });
    if (!node) return;
    node.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
    const nr = node.getBoundingClientRect();
    const cw = Math.min(320, Math.max(200, window.innerWidth - 20));
    card.style.position = "fixed";
    card.style.width = cw + "px";
    card.style.left = "0px";
    card.style.top = "0px";
    card.style.maxHeight = "min(60vh, 480px)";
    const ch = Math.min(card.scrollHeight, Math.min(window.innerHeight * 0.6, 480));
    const prefer = nr.left + nr.width / 2 > window.innerWidth / 2 ? "left" : "right";
    const placed = api.placeCard(
      { x: nr.left, y: nr.top, w: nr.width, h: nr.height },
      cw,
      ch,
      { w: window.innerWidth, h: window.innerHeight },
      prefer,
      10
    );
    card.style.left = placed.x + "px";
    card.style.top = placed.y + "px";
    card.style.width = placed.w + "px";
    card.style.maxHeight = placed.h + "px";
  }

  function showNodeCard() {
    const card = $("#nodeCard");
    if (!card) return;
    if (!treeSel) {
      card.hidden = true;
      card.innerHTML = "";
      return;
    }
    card.hidden = false;
    card.innerHTML = nodeCardHtml(treeSel) +
      '<button type="button" class="node-card-close" data-close-card="1" aria-label="关闭">关闭</button>';
    positionNodeCard();
  }

  function applyTreeHighlight() {
    const svg = $("#treeSvg");
    if (!svg) return;
    const q = search.trim().toLowerCase();
    const matchIds = new Set(filteredPeople().map((p) => p.id));
    const hasQuery = !!q;
    const sel = treeSel;
    svg.classList.toggle("is-filtering", hasQuery || !!sel);

    $$(".dimmable, .leaf-node, .flower-node, .era-hit", svg).forEach((el) => {
      el.classList.remove("is-match", "is-active");
    });

    function markMatch(el) {
      if (!el) return;
      el.classList.add("is-match");
    }

    if (hasQuery) {
      PEOPLE.forEach((p) => {
        if (!matchIds.has(p.id)) return;
        markMatch($('[data-kind="person"][data-id="' + p.id + '"]', svg));
        $$('[data-person="' + p.id + '"]', svg).forEach(markMatch);
        $$('[data-id^="' + p.id + '::"]', svg).forEach(markMatch);
        $$('[data-kind="era"]', svg).forEach((el) => {
          if (el.getAttribute("data-id") === p.era) markMatch(el);
        });
      });
    }
    if (sel) {
      $$("#treeSvg [data-kind]").forEach((el) => {
        if (el.getAttribute("data-kind") === sel.kind && el.getAttribute("data-id") === sel.id) {
          el.classList.add("is-active", "is-match");
        }
      });
      if (sel.kind === "person") {
        $$('[data-person="' + sel.id + '"], [data-id^="' + sel.id + '::"]', svg).forEach((n) => n.classList.add("is-match"));
        const p = peopleById[sel.id];
        if (p) {
          $$('[data-kind="era"]', svg).forEach((el) => {
            if (el.getAttribute("data-id") === p.era) el.classList.add("is-match");
          });
        }
      } else if (sel.kind === "work") {
        const pid = sel.id.split("::")[0];
        markMatch($('[data-kind="person"][data-id="' + pid + '"]', svg));
      } else if (sel.kind === "era") {
        PEOPLE.filter((p) => p.era === sel.id).forEach((p) => {
          markMatch($('[data-kind="person"][data-id="' + p.id + '"]', svg));
          $$('[data-person="' + p.id + '"]', svg).forEach(markMatch);
        });
      }
    }
  }

  function scrollTreeToYear(year, frac) {
    const st = $("#treeStage");
    if (!st || !lastLayout) return;
    const y = lastLayout.yearToY(year);
    st.scrollTop = Math.max(0, y - st.clientHeight * (frac == null ? 0.42 : frac));
    st.scrollLeft = Math.max(0, lastLayout.trunkX - st.clientWidth / 2);
  }

  function treePage() {
    const viewW = Math.max(320, (document.getElementById("main") || document.body).clientWidth || window.innerWidth || 1024);
    const layout = layoutApi().layoutTree(PEOPLE, { viewWidth: viewW });
    lastLayout = layout;
    return '<div class="tree-page">' +
      '<div class="tree-stage" id="treeStage">' +
        '<div class="tree-canvas" id="treeCanvas">' + renderTreeSvg(layout) + "</div>" +
      "</div>" +
      '<aside class="node-card" id="nodeCard" hidden role="dialog" aria-label="节点说明"></aside>' +
      '<button type="button" class="tree-fab" id="treeFab" aria-expanded="false" aria-controls="treeMenu" aria-haspopup="true">目录</button>' +
      '<div class="tree-menu" id="treeMenu" hidden role="menu">' +
        '<label class="tree-search"><span class="visually-hidden">检索建筑师、思潮或作品</span>' +
        '<input id="treeSearch" type="search" placeholder="检索人物、思潮、作品" autocomplete="off" enterkeyhint="search"></label>' +
        '<button type="button" data-view="cards">人物卡</button>' +
        '<button type="button" data-view="quiz">闭卷复测</button>' +
        '<button type="button" data-view="graph">关系索引</button>' +
        '<button type="button" data-view="progress">复习记录</button>' +
      "</div>" +
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
    document.body.classList.toggle("is-tree", view === "tree");
    $$(".nav-btn, .mobile-nav button").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-view") === (view === "person" ? "cards" : view));
    });
    ["#searchInput", "#treeSearch"].forEach((sel) => {
      const input = $(sel);
      if (input && input.value !== search) input.value = search;
    });
  }

  function render() {
    const main = $("#main");
    const route = current();
    const stage = $("#treeStage");
    if (stage) treeScroll = { top: stage.scrollTop, left: stage.scrollLeft };
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
      if (st) {
        if (treeScroll != null && didInitialTreeScroll) {
          st.scrollTop = treeScroll.top;
          st.scrollLeft = treeScroll.left;
        } else {
          scrollTreeToYear(1920, 0.42);
          didInitialTreeScroll = true;
        }
      }
      if (treeSel) showNodeCard();
      if (menuOpen) {
        const menu = $("#treeMenu");
        const fab = $("#treeFab");
        if (menu) menu.hidden = false;
        if (fab) fab.setAttribute("aria-expanded", "true");
      }
    }
    const draft = $("#quizDraft");
    if (draft) {
      draft.focus({ preventScroll: true });
    }
  }

  function selectNode(kind, id, opts) {
    if (!id) {
      hideNodeCard();
      return;
    }
    treeSel = { kind, id };
    if (current().view !== "tree") return;
    if (opts && opts.openPerson && kind === "person") {
      goPerson(id);
      return;
    }
    applyTreeHighlight();
    showNodeCard();
  }

  function treeNodes() {
    return $$("#treeSvg [data-kind]");
  }

  document.addEventListener("click", (e) => {
    const act = e.target.closest("button, [data-card], [data-kind], a.brand, .tree-fab");
    if (!act) {
      if (current().view === "tree" && !e.target.closest("#nodeCard, #treeMenu")) {
        hideNodeCard();
        closeTreeMenu();
      }
      return;
    }
    if (act.id === "treeFab") {
      menuOpen = !menuOpen;
      const menu = $("#treeMenu");
      if (menu) menu.hidden = !menuOpen;
      act.setAttribute("aria-expanded", menuOpen ? "true" : "false");
      if (menuOpen) {
        const input = $("#treeSearch");
        if (input) input.focus();
      }
      return;
    }
    if (act.dataset.closeCard) { hideNodeCard(); return; }
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
      if (current().view === "tree") {
        menuOpen = true;
        const menu = $("#treeMenu");
        const fab = $("#treeFab");
        if (menu) menu.hidden = false;
        if (fab) fab.setAttribute("aria-expanded", "true");
        const input = $("#treeSearch");
        if (input) input.focus();
      } else {
        const input = $("#searchInput");
        if (input) input.focus();
      }
      return;
    }
    if (e.key === "Escape") {
      const activeId = document.activeElement && document.activeElement.id;
      if ((activeId === "searchInput" || activeId === "treeSearch") && search) {
        search = "";
        $$("#searchInput, #treeSearch").forEach((el) => { el.value = ""; });
        if (current().view === "tree") applyTreeHighlight();
        else render();
        return;
      }
      if (current().view === "tree") {
        if (treeSel) hideNodeCard();
        closeTreeMenu();
      }
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && e.target.dataset && e.target.dataset.kind) {
      e.preventDefault();
      selectNode(e.target.dataset.kind, e.target.dataset.id);
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
    if (e.target.id === "searchInput" || e.target.id === "treeSearch") {
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
  window.addEventListener("scroll", () => {
    if (current().view === "tree" && treeSel) positionNodeCard();
  }, true);

  if (!location.hash) location.replace("#tree");
  else render();
})();
