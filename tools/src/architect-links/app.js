(function () {
  "use strict";

  const PEOPLE = Array.isArray(window.PEOPLE) ? window.PEOPLE : [];
  const GROUP_ORDER = window.GROUP_ORDER || ["起源与过渡", "现代主义", "战后转向", "后现代与解构"];
  const RELATION_TOPICS = window.RELATION_TOPICS || [];
  const COMPARE_PAIRS = window.COMPARE_PAIRS || [];
  const KEY = "arch-links-v1";
  const VALID_RATES = ["again", "hard", "good"];
  const YEAR_MIN = 1750;
  const YEAR_MAX = 2016;
  const MOVEMENTS = window.MOVEMENTS || {};
  const QUESTIONS = window.ArchitectStudy.buildQuestions(PEOPLE);
  let treeGroup = "全部";
  let drillMode = "example", drillQueue = [], drillIdx = 0, drillReveal = false;
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
      p.name, p.en, p.era, p.group, p.year, p.idea, p.method, p.question, p.answer, p.trap, (p.affiliations || []).join(" "), MOVEMENTS[p.era] && MOVEMENTS[p.era].claim,
      (p.tags || []).join(" "),
      (p.works || []).map((w) => w.join(" ")).join(" "),
      (p.relate || []).map((r) => label(r[0]) + " " + r[1]).join(" ")
    ].join(" ").toLowerCase();
    return blob.includes(q);
  }
  function filteredPeople() {
    const q = search.trim().toLowerCase();
    return PEOPLE.filter((p) => {
      if (filter === "首版关联" && !p.seed) return false;
      if (filter !== "全部" && filter !== "首版关联" && p.group !== filter && p.era !== filter && !(p.tags || []).includes(filter) && !(p.affiliations || []).includes(filter)) return false;
      return personMatches(p, q);
    });
  }

  function current() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (h.startsWith("person/")) return { view: "person", id: h.slice(7) };
    if (h === "home" || h === "" || h === "tree") return { view: "tree" };
    if (["cards", "quiz", "graph", "progress", "movements", "drill"].includes(h)) return { view: h };
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
    const tags = [p.era].concat(p.affiliations || [], p.tags || []);
    const uniq = [];
    tags.forEach((t) => { if (t && !uniq.includes(t)) uniq.push(t); });
    return uniq.map((t) => "<span>" + esc(t) + "</span>").join("");
  }

  function wikiPhoto(p) {
    return "https://commons.wikimedia.org/w/index.php?search=" + encodeURIComponent(p.photo || p.name) + "&title=Special:MediaSearch&go=Go&type=image";
  }

  let lastLayout = null;
  let treeZoom = window.innerWidth < 760 ? .72 : .9, zoomControl = null;

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
    const { width, height, trunkX, eras, bands } = layout;
    const colors = ["#24675a", "#805335", "#425f89", "#756084", "#7d464d", "#58672e"];
    const palette = Object.fromEntries(Object.keys(MOVEMENTS).map((name, i) => [name, colors[i % colors.length]]));
    function textRows(lines, x, y, step, cls) {
      return '<text class="' + cls + '" x="' + x + '" y="' + y + '">' +
        lines.map((line, i) => '<tspan x="' + x + '" dy="' + (i ? step : 0) + '">' + esc(line) + '</tspan>').join('') + '</text>';
    }
    function action(topic, kind, id, name, cls, content) {
      return '<g tabindex="0" role="button" data-topic="' + esc(topic) + '" ' + (kind === "work" ? 'data-owner="' + esc(id.split("::")[0]) + '" ' : '') + 'data-kind="' + kind + '" data-id="' + esc(id) +
        '" aria-label="' + esc(name) + '" class="' + cls + ' dimmable">' + content + '</g>';
    }
    const branchEls = eras.map(b => {
      const d = b.side === "right" ? 1 : -1;
      const x = distance => trunkX + d * distance;
      const anchor = d > 0 ? "start" : "end";
      const head = b.offset;
      const titleWidth = Math.max(120, layoutApi().estimateTextWidth(b.name, 23) + 10);
      const hub = head + titleWidth;
      const y = b.forkY;
      function path(a, ay, z, zy, cls) {
        const mid = (a + z) / 2;
        return '<path class="board-line dimmable ' + cls + '" data-era="' + esc(b.name) +
          '" d="M ' + x(a) + ' ' + ay + ' C ' + x(mid) + ' ' + ay + ' ' + x(mid) + ' ' + zy + ' ' + x(z) + ' ' + zy + '"/>';
      }
      function dot(at, cy, r) {
        return '<circle class="board-dot" cx="' + x(at) + '" cy="' + cy + '" r="' + r + '"/>';
      }
      function hit(start, end, top, height) {
        return '<rect class="node-hit" x="' + Math.min(x(start), x(end)) + '" y="' + top +
          '" width="' + (end-start) + '" height="' + height + '" rx="6"/>';
      }
      const date = MOVEMENTS[b.name].period.split(/[；，]/)[0].replace(/(\d{4})s/g, "$1年代");
      const header = action(b.name, "era", b.name, "思潮 " + b.name, "era-hit",
        hit(head-10, hub, y-39, 65) + dot(head, y, 4) +
        textRows([b.name], x(head+3), y-12, 0, "era-label") + textRows([date], x(head+3), y+19, 0, "topic-date"));
      let lines = path(0, y+34, head, y, "bough") + path(head, y, hub, y, "bough");
      const nodes = b.people.map((item, i) => {
        const p = item.p;
        const py = b.y + item.y + item.height - 12;
        const twig = hub + 67 + (i % 3) * 14;
        const textWidth = Math.max(...item.lines.map(line => layoutApi().estimateTextWidth(line,16)));
        const end = twig + textWidth + 16;
        lines += path(hub, y, twig, py, item.related ? "affiliation" : "twig") + path(twig, py, end, py, "twig");
        const person = action(b.name, "person", p.id, "人物 " + p.name, "leaf-node",
          hit(twig-8, end, py-item.lines.length*20-8, item.lines.length*20+18) +
          dot(twig, py, 3) + textRows(item.lines, x(twig+6), py-8-(item.lines.length-1)*20, 20, "leaf-label"));
        const flowers = item.works.map(w => {
          const wy = b.y + w.y + w.height/2;
          const tip = end + 47;
          lines += path(end, py, tip, wy, "stem");
          return action(b.name, "work", w.id, "作品 " + w.work[0] + " " + w.work[1], "flower-node",
            hit(tip-8, tip+244, wy-w.height/2, w.height) +
            '<g transform="translate(' + x(tip) + ' ' + wy + ') scale(.48)">' + flowerMark(0,0) + '</g>' +
            textRows(w.lines, x(tip+13), wy+5-(w.lines.length-1)*9.5, 19, "piece-title"));
        }).join("");
        return person + flowers;
      }).join("");
      return '<g text-anchor="' + anchor + '" style="--branch-color:' + palette[b.name] + '">' + lines + header + nodes + '</g>';
    }).join("");
    const headings = bands.map(b =>
      '<g transform="translate(' + trunkX + ' ' + (b.y + 24) +  ')"><rect class="period-paper" x="' + (layout.narrow ? -3 : -112) + '" y="-18" width="224" height="36"/>' +
      '<text class="period-name" x="' + (layout.narrow ? 5 : 0) + '" y="6" text-anchor="' + (layout.narrow ? "start" : "middle") + '">' + esc(b.title) + '</text></g>').join("");
    return '<svg id="treeSvg" class="tree-svg" viewBox="0 0 ' + width + ' ' + height + '" width="' + width +
      '" height="' + height + '" role="group" aria-label="建筑史思潮专题树，时间自下而上"><line class="trunk" x1="' +
      trunkX + '" x2="' + trunkX + '" y1="35" y2="' + (height - 58) + '"/>' + branchEls + headings + '</svg>';
  }

  function movementMembers(name) {
    return PEOPLE.filter(p=>p.era===name || (p.affiliations || []).includes(name));
  }
  function movementBody(name) {
    const m=MOVEMENTS[name];
    if(!m) return '<p class="muted">这是一条人物思想线索，具体流派背景仍待补充。</p>';
    return '<div class="english">'+esc(m.period)+'</div><h3>为什么出现</h3><p>'+esc(m.background)+'</p><h3>主张与建筑表现</h3><p>'+esc(m.claim)+'</p><h3>关系边界／易混点</h3><p>'+esc(m.boundary)+'</p><p class="faint">'+esc(m.sourceRef)+'</p>';
  }
  function eraCardHtml(name) {
    const list=movementMembers(name).map(p=>'<button type="button" class="relation" data-kind="person" data-id="'+esc(p.id)+'"><strong>'+esc(p.name)+'</strong><small>'+esc(p.year)+'</small></button>').join('');
    return '<div class="kicker">枝 · 思潮 / 流派</div><h2>'+esc(name)+'</h2>'+movementBody(name)+'<h3>关联人物</h3><div class="relate-list">'+list+'</div>';
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
      '<p class="muted">关联人物：' + esc(p.name) + " · " + esc(p.workTopics?.[wi] || p.era) + "</p>" +
      '<p class="faint">' + esc(p.sourceRef || "首版学习卡；教材页码待定位") + "</p>" +
      '<div class="actions">' +
        '<button type="button" class="action-btn" data-kind="person" data-id="' + esc(p.id) + '">' + esc(p.name) + "</button>" +
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
    return '<div class="kicker">叶 · 人物</div><h2>' + esc(p.name) + "</h2>" +
      '<div class="english">' + esc(p.en) + " · " + esc(p.year) + "</div>" +
      '<p class="muted">' + esc(p.era) + " · " + esc(p.group) + "</p>" +
      "<p>" + esc(p.idea) + "</p><h3>怎么体现</h3><p>" + esc(p.method) + "</p>" +
      '<p class="faint">易混：' + esc(p.trap) + '</p><p class="faint">' + esc(p.sourceRef || "首版学习卡；教材页码待定位") + "</p>" +
      (works ? "<h3>作品</h3><div class=\"works-list\">" + works + "</div>" : "") +
      (rel ? "<h3>横向关联</h3><div class=\"relate-list\">" + rel + "</div>" : "");
  }

  function nodeCardHtml(sel) {
    if (!sel) return "";
    if (sel.kind === "era") return eraCardHtml(sel.id);
    if (sel.kind === "work") return workCardHtml(sel.id);
    return personCardHtml(sel.id);
  }

  const nodeCardPositions = new Map();
  let nodeCardActiveKey = null;
  function rememberNodeCardPosition() {
    const card = $("#nodeCard");
    if (card && nodeCardActiveKey) nodeCardPositions.set(nodeCardActiveKey, card.scrollTop || 0);
  }
  function hideNodeCard() {
    rememberNodeCardPosition();
    nodeCardActiveKey = null;
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
    const candidates = $$("#treeSvg [data-kind]").filter(el => el.dataset.kind === kind && el.dataset.id === id);
    const topic = treeSel.topic || (kind === "person" && peopleById[id]?.era);
    const node = candidates.find(el => el.dataset.topic === topic) || candidates[0];
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
    rememberNodeCardPosition();
    nodeCardActiveKey = treeSel.kind + ":" + treeSel.id;
    card.hidden = false;
    card.innerHTML = nodeCardHtml(treeSel) +
      '<button type="button" class="node-card-close" data-close-card="1" aria-label="关闭">关闭</button>';
    positionNodeCard();
    card.scrollTop = nodeCardPositions.get(nodeCardActiveKey) || 0;
    card.onscroll = rememberNodeCardPosition;
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
        $$('[data-owner="' + p.id + '"]', svg).forEach(markMatch);
        $$('[data-id^="' + p.id + '::"]', svg).forEach(markMatch);
        $$('[data-kind="era"]', svg).forEach((el) => {
          if (el.getAttribute("data-id") === p.era) markMatch(el);
        });
      });
    }
    if (sel) {
      const [pid, wi] = sel.id.split("::");
      const person = peopleById[pid];
      const topic = sel.topic || (sel.kind === "era" ? sel.id : person?.workTopics?.[wi] || person?.era);
      $$("#treeSvg [data-era]").filter(el => el.dataset.era === topic).forEach(markMatch);
      $$("#treeSvg [data-kind]").forEach(el => {
        const {kind, id, owner} = el.dataset;
        if (el.dataset.topic !== topic) return;
        if (sel.kind === "era" || kind === "era" || id === pid || (sel.kind === "person" && owner === pid)) markMatch(el);
        if (kind === sel.kind && id === sel.id) el.classList.add("is-active", "is-match");
      });
    }
  }

  function scrollToPeriod(id) {
    const stage = $("#treeStage");
    if (!stage || !lastLayout) return;
    const band = lastLayout.bands.find(b => b.id === id) || lastLayout.bands[0];
    if (!band) return;
    const first = band.branches[0];
    const narrow = stage.clientWidth < 760;
    const dx = narrow ? (first.side === "right" ? 1 : -1) * 235 : 0;
    stage.scrollTop = Math.max(0, band.y * treeZoom - 22);
    stage.scrollLeft = Math.max(0, (lastLayout.trunkX + dx) * treeZoom - stage.clientWidth / 2);
  }

  function treePage() {
    const viewW = Math.max(320, (document.getElementById("main") || document.body).clientWidth || window.innerWidth || 1024);
    const treePeople = treeGroup === "全部" ? PEOPLE : PEOPLE.filter(p=>p.group===treeGroup);
    const layout = layoutApi().layoutTree(treePeople, { viewWidth: viewW });
    lastLayout = layout;
    return '<div class="tree-page">' +
      '<div class="tree-tools"><strong>建筑史思潮树</strong><button type="button" data-view="movements">流派</button><button type="button" data-view="cards">查人物·作品</button><button type="button" data-view="drill">练关系</button><label><span class="visually-hidden">时间树范围</span><select id="treeGroup">' + ['全部'].concat(GROUP_ORDER).map(g=>'<option'+(g===treeGroup?' selected':'')+'>'+esc(g)+'</option>').join('')+'</select></label><label><span class="visually-hidden">跳到时期</span><select id="yearJump"><option value="">跳到时期</option>'+layout.bands.slice().reverse().map(b=>'<option value="'+b.id+'">'+esc(b.title)+'</option>').join('')+'</select></label></div>' +
      '<div class="tree-guide">拖动画布 · 双指缩放　｜　实线为主线，虚线为跨专题关联</div>' +
      '<div class="tree-stage" id="treeStage">' +
        '<div class="tree-canvas" id="treeCanvas">' + renderTreeSvg(layout) + "</div>" +
      "</div>" +
      '<div class="zoom-tools" role="group" aria-label="画布缩放"><button type="button" data-zoom="out" aria-label="缩小时间树">−</button><button type="button" data-zoom="reset" id="zoomValue" aria-label="恢复原始大小">100%</button><button type="button" data-zoom="in" aria-label="放大时间树">＋</button></div>' +
      '<aside class="node-card" id="nodeCard" hidden role="dialog" aria-label="节点说明"></aside>' +
    "</div>";
  }

  function cardsPage() {
    const results = filteredPeople();
    const s = stats();
    const groups = GROUP_ORDER.includes(filter) ? [filter] : GROUP_ORDER;
    const chips = ["全部", "首版关联"].concat(GROUP_ORDER);
    return '<div class="page">' +
      '<div class="kicker">人物卡片库</div>' +
      "<h1>先看成一张卡片，再放回时间树。</h1>" +
      '<p class="lede">共 ' + s.total + " 人。检索与筛选和时间树共用；打开卡片可读思想、手法、作品和横向关联。</p>" +
      '<div class="stats"><div class="stat"><strong>' + s.total + '</strong><span>人物／组合</span></div><div class="stat"><strong>' + s.seed + '</strong><span>首版题型关联</span></div><div class="stat"><strong>' + s.reviewed + '</strong><span>已有自评</span></div><div class="stat"><strong>' + s.due + '</strong><span>今日待复测</span></div></div>' +
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
    const source = p.sourceRef ? esc(p.sourceRef) + (p.source ? '<br><a class="linkish" target="_blank" rel="noopener noreferrer" href="' + esc(p.source) + '">外部参考资料 ↗</a>' : "") : p.source
      ? '<a class="linkish" target="_blank" rel="noopener noreferrer" href="' + esc(p.source) + '">外部参考资料 ↗</a>'
      : "补充学习卡，未做逐条教材定位";
    const rateText = r ? ("最近自评：" + (r.rate === "again" ? "不会" : r.rate === "hard" ? "模糊" : "会") + " · 下次 " + r.due) : "还没有复测记录";
    return '<div class="page">' +
      '<button type="button" class="back-link" data-view="tree">← 返回时间树</button> ' +
      '<button type="button" class="back-link" data-view="cards">人物库</button> <button type="button" class="back-link" data-locate="' + esc(p.id) + '">在时间树上定位</button>' +
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
    const tabs = [["seed", "首版 6 题"], ["due", "今日待复测 (" + s.due + ")"], ["all", "全部人物"]];
    return '<div class="page"><div class="kicker">闭卷复测</div>' +
      " <h1>闭卷，才能知道会不会。</h1>" +
      '<p class="lede">先独立写出要点，再揭晓参考答案。只有你自己点击“会 / 模糊 / 不会”后才记录复习状态。记录仍保存在本机，键名不变。</p>' +
      '<div class="filterbar">' + tabs.map(([id, name]) => '<button type="button" class="chip' + (quizMode === id ? " is-active" : "") + '" data-quiz-mode="' + id + '">' + name + "</button>").join("") + "</div>" +
      '<div class="quiz-layout"><section class="quiz-card">' +
      (p
        ? '<div class="quiz-kicker">第 ' + (quizIdx + 1) + " / " + quizOrder.length + " 题 · " + (p.seed ? "首版题型关联" : "延伸复测") + "</div>" +
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
        : '<div class="empty">这组暂时没有到期内容。可以切到“首版 6 题”或“全部人物”。</div>') +
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

  function movementsPage() {
    const q=search.trim().toLowerCase();
    const entries=Object.entries(MOVEMENTS).filter(([name,m])=>[name,m.period,m.background,m.claim,m.boundary,...movementMembers(name).map(p=>p.name)].join(' ').toLowerCase().includes(q));
    return '<div class="page"><div class="kicker">时间 · 思想 · 人物 · 作品</div><h1>先认清每根枝，再联系叶与花。</h1><p class="lede">流派会并行、交叉，也会在同一个人身上转变。这里的时间是大致活跃范围；关联不等于师承，思想相近也不等于同一流派。</p><div class="study-summary"><strong>'+Object.keys(MOVEMENTS).length+' 条思想线索</strong><span>'+PEOPLE.length+' 组人物</span><span>'+PEOPLE.reduce((n,p)=>n+p.works.length,0)+' 项作品与著作</span><button class="linkish" data-view="drill">闭卷练关系 →</button></div><div class="movement-grid">'+entries.map(([name,m])=>'<details class="movement-card"><summary><span>'+esc(m.period)+'</span><strong>'+esc(name)+'</strong><small>'+movementMembers(name).map(p=>esc(p.name)).join(' · ')+'</small></summary><div class="movement-body">'+movementBody(name)+'<div class="group-chain">'+movementMembers(name).map(p=>'<button type="button" class="mini-node" data-person="'+p.id+'">'+esc(p.name)+'</button>').join('')+'</div>'+(movementMembers(name).length?'<div class="actions"><button class="action-btn" data-branch="'+esc(name)+'">回时间树看这根枝</button></div>':'')+'</div></details>').join('')+'</div>'+(entries.length?'':'<p class="empty">没有匹配的流派；试试人物名或关键词。</p>')+'</div>';
  }

  function makeDrill() {
    const reviews=store.relationReviews || {};
    const candidates=QUESTIONS.filter(q=>drillMode==='due'?reviews[q.id] && reviews[q.id].due<=today():q.type===drillMode);
    const score=q=>!reviews[q.id]?2:reviews[q.id].due<=today()?(reviews[q.id].rate==='again'?0:1):3;
    drillQueue=candidates.map(q=>({q,tie:Math.random()})).sort((a,b)=>score(a.q)-score(b.q)||a.tie-b.tie).slice(0,10).map(x=>x.q);
    drillIdx=0; drillReveal=false;
  }
  function recordDrill(rate) {
    const q=drillQueue[drillIdx];
    if(!drillReveal || !q || !VALID_RATES.includes(rate)) return;
    store.relationReviews=store.relationReviews || {};
    const prev=store.relationReviews[q.id];
    store.relationReviews[q.id]={rate,last:today(),due:after(rate==='again'?1:rate==='hard'?3:7),tries:(prev && prev.tries || 0)+1};
    save(); drillIdx++; drillReveal=false;
    if(drillIdx>=drillQueue.length) { drillQueue=[]; toast('这一批已完成，已按待复测和未练内容重新编排'); }
    render();
  }
  function drillPage() {
    if(!drillQueue.length) makeDrill();
    const q=drillQueue[drillIdx];
    const due=Object.values(store.relationReviews||{}).filter(r=>r.due<=today()).length;
    const tabs=[['example','图中同型题'],['work','作品 → 人物'],['person','人物 → 思潮'],['idea','思想 → 人物'],['time','时间排序'],['due','到期复测 ('+due+')']];
    return '<div class="page"><div class="kicker">关系辨认 · 自拟练习</div><h1>把关系说出来。</h1><p class="lede">每批最多 10 题，先想再揭晓。不会／模糊／会分别在 1／3／7 天后复测。这里单独记录每条关系，不把一次练习算作掌握整个人物。</p><div class="filterbar">'+tabs.map(([id,name])=>'<button class="chip'+(drillMode===id?' is-active':'')+'" data-drill-mode="'+id+'">'+esc(name)+'</button>').join('')+'</div><section class="quiz-card relation-drill">'+(q?'<div class="quiz-kicker">'+(drillIdx+1)+' / '+drillQueue.length+' · '+esc(q.title)+'</div><h2 class="drill-prompt">'+esc(q.prompt)+'</h2><button class="action-btn primary" data-drill-reveal="1">'+(drillReveal?'收起答案':'我想好了，核对答案')+'</button>'+(drillReveal?'<div class="answer-box"><strong>参考关系</strong><p>'+esc(q.answer)+'</p><p class="muted">易混：'+esc(q.trap)+'</p><p class="faint">'+esc(q.sourceRef)+'</p>'+(q.personId?'<button class="linkish" data-person="'+q.personId+'">查看完整人物卡 →</button>':'')+'</div><div class="rating-row"><button class="rate-btn" data-drill-rate="again">不会 · 明天</button><button class="rate-btn" data-drill-rate="hard">模糊 · 3 天后</button><button class="rate-btn" data-drill-rate="good">会 · 7 天后</button></div>':''):'<p>暂时没有到期关系。可以切换题型开始新一批。</p>')+'</section><p class="faint">这些题由本站依据学习卡编写，不冒充所附试卷原题。自评仅保存在当前浏览器；可在复习记录中一并导出。</p></div>';
  }

  function progressPage() {
    const s = stats();
    const rs = PEOPLE.filter((p) => store.reviews[p.id]).sort((a, b) => (store.reviews[a.id].due || "").localeCompare(store.reviews[b.id].due || ""));
    const due = rs.filter((p) => store.reviews[p.id].due <= today());
    const relationRows=QUESTIONS.filter(q=>(store.relationReviews||{})[q.id]).sort((a,b)=>store.relationReviews[a.id].due.localeCompare(store.relationReviews[b.id].due));
    const relationSummary='<section class="progress-panel" style="margin:16px 0"><h3>关系练习：'+relationRows.length+' 条已自评</h3><p class="muted">单独记录每一道关系题，不计作整个人物已掌握。</p>'+relationRows.slice(0,10).map(q=>{const r=store.relationReviews[q.id];return '<div class="row-item"><strong>'+esc(q.prompt.split('\n')[0])+'</strong><span class="faint">'+(r.rate==='again'?'不会':r.rate==='hard'?'模糊':'会')+' · 下次 '+esc(r.due)+'</span></div>';}).join('')+'<button class="action-btn" data-drill-mode="due">练到期关系</button></section>';
    return '<div class="page"><div class="kicker">复习记录</div><h1>复习记录</h1>' +
      '<p class="lede">只有完成闭卷练习并主动自评的卡片才计入记录。数据仅保存在当前设备的浏览器，与改版前使用同一存储键。</p>' +
      '<div class="stats"><div class="stat"><strong>' + s.reviewed + '</strong><span>已自评人物</span></div><div class="stat"><strong>' + s.again + '</strong><span>自评不会</span></div><div class="stat"><strong>' + s.hard + '</strong><span>自评模糊</span></div><div class="stat"><strong>' + s.due + '</strong><span>到期待复测</span></div></div>' +
      relationSummary + '<div class="quiz-layout"><section class="progress-panel"><h3>人物到期队列</h3>' +
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
      }).join("") : '<p class="muted">还没有人物自评记录。</p>') +
      '<div class="actions"><button type="button" class="action-btn" id="exportBtn">导出复习记录</button>' +
      '<button type="button" class="action-btn ghost" id="importBtn">导入记录</button>' +
      '<button type="button" class="back-link" id="resetBtn">清空本机复习记录</button></div>' +
      '<p class="faint">导出格式仍为 architect-links-review v1，可与旧版互导。</p></section></div></div>';
  }

  function download() {
    const payload = { format: "architect-links-review", version: 1, exported_at: new Date().toISOString(), reviews: store.reviews, drafts: store.drafts, relationReviews: store.relationReviews || {} };
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
        if (x.relationReviews && typeof x.relationReviews === "object") {
          store.relationReviews=store.relationReviews || {};
          Object.entries(x.relationReviews).forEach(([id,r])=>{
            if (!QUESTIONS.some(q=>q.id===id) || !VALID_RATES.includes(r.rate) || !/^\d{4}-\d{2}-\d{2}$/.test(r.due||"")) return;
            if (!store.relationReviews[id] || String(r.last||"")>=String(store.relationReviews[id].last||"")) store.relationReviews[id]={rate:r.rate,last:r.last||r.due,due:r.due,tries:Math.max(1,Number(r.tries)||1)};
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
    const input = $("#searchInput");
    if (input && input.value !== search) input.value = search;
  }

  function render() {
    const main = $("#main");
    const route = current();
    const stage = $("#treeStage");
    if (stage) treeScroll = { top: stage.scrollTop, left: stage.scrollLeft };
    let html;
    if (route.view === "movements") html = movementsPage();
    else if (route.view === "drill") html = drillPage();
    else if (route.view === "tree") html = treePage();
    else if (route.view === "cards") html = cardsPage();
    else if (route.view === "person") html = detailPage(peopleById[route.id]);
    else if (route.view === "quiz") html = quizPage();
    else if (route.view === "graph") html = graphPage();
    else if (route.view === "progress") html = progressPage();
    else html = treePage();
    rememberNodeCardPosition();
    nodeCardActiveKey = null;
    main.innerHTML = html;
    syncChrome();
    if (route.view === "tree") {
      applyTreeHighlight();
      const st = $("#treeStage");
      if (st) {
        zoomControl=window.ArchitectTreeZoom.bind(st,$("#treeSvg"),{scale:treeZoom,onStart:hideNodeCard,onChange:(value)=>{treeZoom=value;const v=$("#zoomValue");if(v)v.textContent=Math.round(value*100)+"%";}});
        if (treeScroll != null && didInitialTreeScroll) {
          st.scrollTop = treeScroll.top;
          st.scrollLeft = treeScroll.left;
        } else {
          scrollToPeriod("reform");
          didInitialTreeScroll = true;
        }
      }
      if (treeSel) showNodeCard();
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
    treeSel = { kind, id, topic: opts?.topic };
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

  function handleDocumentClick(e) {
    const target = e.target && (e.target.nodeType === 3 ? e.target.parentNode : e.target);
    const act = (window.ArchitectTreeInteraction && window.ArchitectTreeInteraction.closestActionNode(target)) ||
      (target && target.closest && target.closest("button, [data-card], [data-kind], a.brand"));
    if (!act) {
      if (current().view === "tree" && !(target && target.closest && target.closest("#nodeCard"))) {
        hideNodeCard();
      }
      return;
    }
    const intent = window.ArchitectTreeInteraction
      ? window.ArchitectTreeInteraction.interactionFromElement(target, e)
      : null;
    if (act.dataset && act.dataset.zoom && zoomControl) { hideNodeCard();zoomControl.change(act.dataset.zoom==="reset"?1:treeZoom*(act.dataset.zoom==="in"?1.25:.8));return; }
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
    if (intent && intent.type === "dismiss") { hideNodeCard(); return; }
    if (intent && intent.type === "select") {
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      if (e && typeof e.stopPropagation === "function") e.stopPropagation();
      selectNode(intent.kind, intent.id, {topic: act.dataset?.topic});
      return;
    }
    if (act.dataset.locate && peopleById[act.dataset.locate]) {
      treeGroup=peopleById[act.dataset.locate].group; treeSel={kind:"person",id:act.dataset.locate}; treeScroll=null; didInitialTreeScroll=false; setView("tree"); return;
    }
    if (act.dataset.branch) {
      const name=act.dataset.branch;
      treeGroup="全部"; treeSel={kind:"era",id:name}; setView("tree");
      const era=lastLayout && lastLayout.eras.find(x=>x.name===name);
      if(era) { $("#treeStage").scrollTop=Math.max(0,era.y*treeZoom-12); showNodeCard(); }
      return;
    }
    if (act.dataset.drillMode) { drillMode=act.dataset.drillMode; drillQueue=[]; setView("drill"); return; }
    if (act.dataset.drillReveal) { drillReveal=!drillReveal; render(); return; }
    if (act.dataset.drillRate) { recordDrill(act.dataset.drillRate); return; }
    if (act.dataset.filter) { filter = act.dataset.filter; render(); return; }
    if (intent && intent.type === "goPerson") { goPerson(intent.id); return; }
    if (act.dataset.person && !act.dataset.kind) { goPerson(act.dataset.person); return; }
    if (act.dataset.view) { setView(act.dataset.view); return; }
    if (act.dataset.startOne) { makeQuiz("solo", act.dataset.startOne); setView("quiz"); return; }
    if (act.dataset.quizMode) { quizRound = 0; makeQuiz(act.dataset.quizMode); setView("quiz"); return; }
    if (act.dataset.reveal) { revealed = !revealed; render(); return; }
    if (act.dataset.rate) { record(act.dataset.rate); return; }
  }
  document.addEventListener("click", handleDocumentClick);

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
      if (current().view === "tree") { setView("cards"); }
      e.preventDefault();
      const input = $("#searchInput");
      if (input) input.focus();
      return;
    }
    if (e.key === "Escape") {
      const activeId = document.activeElement && document.activeElement.id;
      if (activeId === "searchInput" && search) {
        search = "";
        if ($("#searchInput")) $("#searchInput").value = "";
        if (current().view === "tree") applyTreeHighlight();
        else render();
        return;
      }
      if (current().view === "tree") {
        if (treeSel) hideNodeCard();
      }
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && e.target.dataset && e.target.dataset.kind) {
      e.preventDefault();
      selectNode(e.target.dataset.kind, e.target.dataset.id, {topic: e.target.dataset.topic});
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
      selectNode("person", nodes[idx].dataset.id, {topic: nodes[idx].dataset.topic});
    }
  });

  document.addEventListener("input", (e) => {
    if (e.target.id === "searchInput") {
      search = e.target.value;
      if (current().view === "tree") applyTreeHighlight();
      else if (["cards","movements"].includes(current().view)) render();
      else setView("cards");
    }
    if (e.target.id === "quizDraft" && quizOrder[quizIdx]) {
      store.drafts[quizOrder[quizIdx]] = e.target.value;
      save();
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "treeGroup") { treeGroup=e.target.value; treeSel=null; treeScroll=null; didInitialTreeScroll=false; render(); }
    if (e.target.id === "yearJump" && e.target.value) { hideNodeCard(); scrollToPeriod(e.target.value); e.target.value=""; }
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

  window.ArchitectTreeApp = {
    interactionFromElement: function (el, ev) {
      return window.ArchitectTreeInteraction.interactionFromElement(el, ev);
    },
    handleDocumentClick: handleDocumentClick,
    selectNode: selectNode,
    hideNodeCard: hideNodeCard,
    showNodeCard: showNodeCard,
    personCardHtml: personCardHtml,
    workCardHtml: workCardHtml,
    eraCardHtml: eraCardHtml,
    treePage: treePage,
    drillPage: drillPage, movementsPage: movementsPage,
    renderTreeSvg: renderTreeSvg,
    getTreeSel: function () { return treeSel; },
    setSearch: function (q) { search = q; }
  };

  if (!globalThis.ARCHITECT_TREE_TEST) {
    if (!location.hash) location.replace("#tree");
    else render();
  }
})();
