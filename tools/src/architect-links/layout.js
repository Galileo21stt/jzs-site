/* Geometry for the movement tree and its floating reading cards. */
(function (root) {
  "use strict";

  function estimateTextWidth(text, fontSize) {
    var w = 0;
    var s = String(text || "");
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c <= 0x1f) continue;
      if (c === 0x20) w += fontSize * 0.38;
      else if (c >= 48 && c <= 57) w += fontSize * 0.72;
      else if (c <= 0x7f) w += fontSize * 0.70;
      else if (c >= 0xff01 && c <= 0xff60) w += fontSize * 1.05;
      else w += fontSize * 1.12;
    }
    return w;
  }

  function boxesOverlap(a, b, gap) {
    gap = gap == null ? 0 : gap;
    return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap &&
      a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
  }

  function clampCard(card, viewport, pad) {
    pad = pad == null ? 10 : pad;
    var w = Math.min(card.w, Math.max(80, viewport.w - pad * 2));
    var h = Math.min(card.h, Math.max(60, viewport.h - pad * 2));
    var maxX = viewport.w - pad - w;
    var maxY = viewport.h - pad - h;
    var x = card.x;
    var y = card.y;
    if (maxX < pad) x = pad;
    else x = Math.min(Math.max(pad, x), maxX);
    if (maxY < pad) y = pad;
    else y = Math.min(Math.max(pad, y), maxY);
    return { x: x, y: y, w: w, h: h };
  }

  function placeCard(anchor, cardW, cardH, viewport, preferSide, pad) {
    pad = pad == null ? 10 : pad;
    var y = anchor.y + (anchor.h || 0) / 2 - cardH / 2;
    function tryX(x) {
      return clampCard({ x: x, y: y, w: cardW, h: cardH }, viewport, pad);
    }
    var first = preferSide === "left" ? anchor.x - cardW - 12 : anchor.x + (anchor.w || 0) + 12;
    var second = preferSide === "left" ? anchor.x + (anchor.w || 0) + 12 : anchor.x - cardW - 12;
    var a = tryX(first);
    if (!boxesOverlap(a, { x: anchor.x, y: anchor.y, w: anchor.w || 0, h: anchor.h || 0 }, 2)) return a;
    var b = tryX(second);
    if (!boxesOverlap(b, { x: anchor.x, y: anchor.y, w: anchor.w || 0, h: anchor.h || 0 }, 2)) return b;
    // Prefer the placement that keeps more of the card away from the node.
    var overlapW = function (c) {
      var x1 = Math.max(c.x, anchor.x);
      var x2 = Math.min(c.x + c.w, anchor.x + (anchor.w || 0));
      var y1 = Math.max(c.y, anchor.y);
      var y2 = Math.min(c.y + c.h, anchor.y + (anchor.h || 0));
      return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    };
    return overlapW(a) <= overlapW(b) ? a : b;
  }

  // Reading order within a period is thematic. Periods deliberately overlap.
  const periods = [
    { id: "revival", title: "18世纪后半叶至19世纪", names: ["古典复兴", "浪漫主义", "折衷主义", "技术转型", "工艺美术运动"] },
    { id: "reform", title: "19世纪末至20世纪初", names: ["新艺术运动", "青年风格派", "维也纳分离派", "维也纳学派", "维也纳现代性", "荷兰建筑革新", "芬兰民族浪漫主义", "芝加哥学派", "德意志制造联盟"] },
    { id: "modern", title: "20世纪上半叶", names: ["包豪斯", "早期现代主义", "现代主义", "有机建筑", "现代主义的人情化", "表现主义", "未来主义", "风格派", "构成主义"] },
    { id: "postwar", title: "二战后至1970年代", names: ["战后现代主义", "对理性主义的充实与提高", "新粗野主义", "结构与技术表现", "个性与象征", "战后日本现代建筑", "新陈代谢派", "战后转向"] },
    { id: "plural", title: "1960年代以来", names: ["后现代主义", "新理性主义", "高技派", "形式与语言探索", "解构主义", "新现代与地域回应", "当代建筑理论"] }
  ];

  function textLines(text, width, size) {
    const lines = [];
    let line = "", used = 0;
    for (const char of text) {
      const advance = estimateTextWidth(char, size);
      if (line && used + advance > width) {
        lines.push(line.trimEnd());
        line = ""; used = 0;
      }
      line += char;
      used += advance;
    }
    if (line) lines.push(line.trimEnd());
    return lines;
  }

  function layoutTree(people, opts = {}) {
    const width = Math.max(2000, opts.viewWidth || 1024);
    const trunkX = width / 2;
    const branchWidth = 930;
    const bands = [], eras = [];
    let top = 14;
    for (const period of periods.slice().reverse()) {
      const branches = [];
      for (const name of period.names) {
        const members = people.filter(p => p.era === name);
        const related = people.filter(p => p.era !== name && (p.affiliations || []).includes(name));
        if (!members.length && !related.length) continue;
        const branch = { name, members, related, width: branchWidth, people: [], works: [] };
        let y = 8;
        for (const p of [...members, ...related]) {
          const name = p.shortName || p.name;
          const item = { p, lines: textLines(name, 174, 16), works: [], related: p.era !== branch.name };
          const start = y;
          for (const [i, work] of (p.works || []).entries()) {
            if ((p.workTopics?.[i] || p.era) !== branch.name) continue;
            const lines = textLines(work[0], 228, 14);
            const height = Math.max(37, lines.length * 19 + 15);
            const row = { id: p.id + "::" + i, personId: p.id, work, y, lines, height };
            item.works.push(row);
            branch.works.push(row);
            y += height;
          }
          item.height = Math.max(44, item.lines.length * 20 + 20);
          y = Math.max(y, start + item.height);
          item.y = (start + y - item.height) / 2;
          branch.people.push(item);
          y += 17;
        }
        branch.height = Math.max(92, y + 12);
        branches.push(branch);
      }
      if (!branches.length) continue;
      const band = { id: period.id, title: period.title, y: top, branches };
      bands.push(band);
      const next = [top + 68, top + 119];
      branches.forEach((b, i) => {
        const lane = next[0] <= next[1] ? 0 : 1;
        b.side = lane === 0 ? "right" : "left";
        b.x = b.side === "right" ? trunkX + 28 : trunkX - 28 - branchWidth;
        b.y = next[lane];
        // Offset paired forks slightly so each movement has its own junction.
        b.forkY = b.y + b.height * .43;
        b.offset = 48 + (i % 3) * 14;
        next[lane] += b.height + 46;
        eras.push(b);
      });
      top = Math.max(...next) + 20;
    }
    return { width, height: top + 62, trunkX, bands, eras, narrow: opts.viewWidth < 760 };
  }

  const api = { layoutTree, clampCard, placeCard, estimateTextWidth, boxesOverlap };
  root.ArchitectTreeLayout = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
