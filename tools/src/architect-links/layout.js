/* Time-tree geometry. Loaded as a plain script; also usable from Node tests. */
(function (root) {
  "use strict";

  var YEAR_MIN = 1750;
  var YEAR_MAX = 2016;
  var ERA_FONT = 15;
  var LEAF_FONT = 14;
  var YEAR_FONT = 13;
  var LEAF_H = 54;
  var LEAF_PAD_X = 16;
  var MIN_LEAF_W = 92;
  var GUTTER = 52;
  var ERA_COL = 86;
  var LEAF_GAP = 16;
  var LANE_GAP = 20;
  var FLOWER_STEP = 24;
  var FLOWER_R = 6.5;
  var FLOWER_HIT = 16;
  var BOX_GAP = 6;
  var DIR_FONT = 13;
  var TEXT_PAD_X = 6;
  var TEXT_PAD_Y = 3;
  var LABEL_LINE_GAP = 10;
  var LINE_TEXT_GAP = 4;

  function extractYears(str) {
    if (!str && str !== 0) return [];
    var s = String(str);
    var out = [];
    var decadeRe = /(\d{4})s/g;
    var m;
    var used = [];
    while ((m = decadeRe.exec(s))) {
      var y = +m[1];
      out.push([y, y + 9]);
      used.push([m.index, m.index + m[0].length]);
    }
    var rest = s;
    used.sort(function (a, b) { return b[0] - a[0]; }).forEach(function (pair) {
      rest = rest.slice(0, pair[0]) + " " + rest.slice(pair[1]);
    });
    var rangeRe = /(\d{4})\s*[–\-至到]\s*(\d{4})/g;
    while ((m = rangeRe.exec(rest))) out.push([+m[1], +m[2]]);
    rest = rest.replace(rangeRe, " ");
    var yearRe = /\d{4}/g;
    while ((m = yearRe.exec(rest))) {
      var yy = +m[0];
      if (yy >= 1700 && yy <= 2100) out.push([yy, yy]);
    }
    return out;
  }

  function spanOf(tokens, fallback) {
    if (!tokens || !tokens.length) return fallback || null;
    var start = Math.min.apply(null, tokens.map(function (t) { return t[0]; }));
    var end = Math.max.apply(null, tokens.map(function (t) { return t[1]; }));
    return { start: start, end: end, mid: (start + end) / 2 };
  }

  function personSpan(p) {
    var tokens = extractYears(p.year).concat((p.works || []).flatMap(function (w) {
      return extractYears(w[1]);
    }));
    return spanOf(tokens, { start: 1900, end: 1900, mid: 1900 });
  }

  function workYear(w) {
    var sp = spanOf(extractYears(w[1]), null);
    return sp ? sp.start : null;
  }

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

  function findOverlaps(boxes, minGap) {
    var hits = [];
    var gap = minGap == null ? BOX_GAP : minGap;
    for (var i = 0; i < boxes.length; i++) {
      for (var j = i + 1; j < boxes.length; j++) {
        var a = boxes[i], b = boxes[j];
        if (relatedOk(a, b)) continue;
        if (boxesOverlap(a, b, gap)) hits.push({ a: a, b: b });
      }
    }
    return hits;
  }

  function relatedOk(a, b) {
    // Flowers of the same person may sit close to each other; their hit
    // circles are still not allowed to overlap (handled with a tighter gap).
    if (a.kind === "flower" && b.kind === "flower" && a.personId === b.personId) {
      return !boxesOverlap(a, b, 2);
    }
    return false;
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

  function leafWidth(name) {
    return Math.max(MIN_LEAF_W, Math.ceil(estimateTextWidth(name, LEAF_FONT) + LEAF_PAD_X * 2));
  }

  function flowerCluster(n) {
    var cols = Math.min(Math.max(n, 0), 3);
    var rows = n ? Math.ceil(n / 3) : 0;
    return {
      cols: cols,
      rows: rows,
      w: cols ? (cols - 1) * FLOWER_STEP + FLOWER_HIT * 2 : 0,
      h: rows ? (rows - 1) * FLOWER_STEP + FLOWER_HIT * 2 : 0
    };
  }


  function padBox(b, px, py) {
    px = px == null ? TEXT_PAD_X : px;
    py = py == null ? TEXT_PAD_Y : py;
    return {
      kind: b.kind, id: b.id, personId: b.personId,
      x: b.x - px, y: b.y - py, w: b.w + px * 2, h: b.h + py * 2
    };
  }

  function expandBox(b, gap) {
    return { x: b.x - gap, y: b.y - gap, w: b.w + gap * 2, h: b.h + gap * 2, kind: b.kind, id: b.id };
  }

  function pointInBox(x, y, box, eps) {
    eps = eps == null ? 0.05 : eps;
    return x >= box.x - eps && x <= box.x + box.w + eps && y >= box.y - eps && y <= box.y + box.h + eps;
  }

  function segSegT(ax, ay, bx, by, cx, cy, dx, dy) {
    var rx = bx - ax, ry = by - ay;
    var sx = dx - cx, sy = dy - cy;
    var den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-8) return null;
    var t = ((cx - ax) * sy - (cy - ay) * sx) / den;
    var u = ((cx - ax) * ry - (cy - ay) * rx) / den;
    if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null;
    return Math.max(0, Math.min(1, t));
  }

  function clipSegmentByBox(seg, box) {
    var x1 = seg.x1, y1 = seg.y1, x2 = seg.x2, y2 = seg.y2;
    var ts = [0, 1];
    var edges = [
      [box.x, box.y, box.x + box.w, box.y],
      [box.x, box.y + box.h, box.x + box.w, box.y + box.h],
      [box.x, box.y, box.x, box.y + box.h],
      [box.x + box.w, box.y, box.x + box.w, box.y + box.h]
    ];
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      var t = segSegT(x1, y1, x2, y2, e[0], e[1], e[2], e[3]);
      if (t != null) ts.push(t);
    }
    ts.sort(function (a, b) { return a - b; });
    var uniq = [];
    ts.forEach(function (t) {
      if (!uniq.length || Math.abs(uniq[uniq.length - 1] - t) > 1e-5) uniq.push(t);
    });
    var pieces = [];
    for (var j = 0; j < uniq.length - 1; j++) {
      var t0 = uniq[j], t1 = uniq[j + 1];
      var mx = x1 + (x2 - x1) * ((t0 + t1) / 2);
      var my = y1 + (y2 - y1) * ((t0 + t1) / 2);
      if (pointInBox(mx, my, box, 0.05)) continue;
      var p = {
        x1: x1 + (x2 - x1) * t0,
        y1: y1 + (y2 - y1) * t0,
        x2: x1 + (x2 - x1) * t1,
        y2: y1 + (y2 - y1) * t1,
        kind: seg.kind,
        era: seg.era,
        personId: seg.personId
      };
      if (Math.hypot(p.x2 - p.x1, p.y2 - p.y1) >= 1.2) pieces.push(p);
    }
    return pieces;
  }

  function clipSegments(segments, boxes, gap) {
    var out = segments.slice();
    (boxes || []).forEach(function (box) {
      var b = gap ? expandBox(box, gap) : box;
      var next = [];
      out.forEach(function (seg) {
        clipSegmentByBox(seg, b).forEach(function (p) { next.push(p); });
      });
      out = next;
    });
    return out;
  }

  function segmentHitsBox(seg, box, gap) {
    var b = gap ? expandBox(box, gap) : box;
    var dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
    var len = Math.hypot(dx, dy);
    if (len < 0.5) return false;
    var steps = Math.max(4, Math.ceil(len / 2));
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      if (pointInBox(seg.x1 + dx * t, seg.y1 + dy * t, b, 0.02)) {
        // Endpoints that merely graze a leaf edge after clipping should not count
        // if they sit exactly on the boundary for < 1px; still a hit.
        return true;
      }
    }
    return false;
  }

  function findLineTextHits(segments, boxes, gap) {
    var hits = [];
    (segments || []).forEach(function (seg) {
      (boxes || []).forEach(function (box) {
        if (segmentHitsBox(seg, box, gap)) hits.push({ seg: seg, box: box });
      });
    });
    return hits;
  }

  function collectProtectedBoxes(layout) {
    var boxes = [];
    layout.years.forEach(function (y) {
      boxes.push(padBox({ kind: "year", id: String(y.year), x: y.labelX, y: y.labelY, w: y.labelW, h: y.labelH }));
    });
    if (layout.dirTop) boxes.push(padBox(Object.assign({ kind: "dir", id: "top" }, layout.dirTop)));
    if (layout.dirBot) boxes.push(padBox(Object.assign({ kind: "dir", id: "bot" }, layout.dirBot)));
    layout.eras.forEach(function (e) {
      var x = e.labelAnchor === "end" ? e.labelX - e.labelW : e.labelX;
      boxes.push(padBox({ kind: "era", id: e.name, x: x, y: e.labelY, w: e.labelW, h: e.labelH }));
    });
    layout.people.forEach(function (item) {
      // The pill already protects the name; no extra typographic pad needed,
      // but keep a 1px inset so a stem may meet the border.
      boxes.push({
        kind: "leaf", id: item.p.id,
        x: item.x - item.w / 2 + 0.5,
        y: item.y - item.h / 2 + 0.5,
        w: item.w - 1,
        h: item.h - 1
      });
    });
    return boxes;
  }

  function rawBranchSegments(layout) {
    var segs = [];
    var trunkX = layout.trunkX;
    var yTop = layout.padTop;
    var yBot = layout.padTop + layout.innerH;
    segs.push({ x1: trunkX, y1: yTop, x2: trunkX, y2: yBot, kind: "trunk" });
    layout.years.forEach(function (y) {
      segs.push({ x1: trunkX - 5, y1: y.tickY, x2: trunkX + 5, y2: y.tickY, kind: "tick" });
    });
    layout.eras.forEach(function (e) {
      segs.push({ x1: trunkX, y1: e.midY, x2: e.stubX, y2: e.midY, kind: "era-stub", era: e.name });
      segs.push({ x1: e.stubX, y1: e.minY, x2: e.stubX, y2: e.maxY, kind: "era-spine", era: e.name });
      e.members.forEach(function (p) {
        var item = layout.people.find(function (it) { return it.p.id === p.id; });
        if (!item) return;
        segs.push({ x1: e.stubX, y1: item.y, x2: item.innerX, y2: item.y, kind: "stem", era: e.name, personId: p.id });
      });
    });
    // Root ticks at the base of the trunk
    segs.push({ x1: trunkX, y1: yBot, x2: trunkX - 18, y2: yBot + 16, kind: "root" });
    segs.push({ x1: trunkX, y1: yBot, x2: trunkX, y2: yBot + 18, kind: "root" });
    segs.push({ x1: trunkX, y1: yBot, x2: trunkX + 18, y2: yBot + 16, kind: "root" });
    return segs;
  }

  function buildClippedLines(layout) {
    var protectedBoxes = collectProtectedBoxes(layout);
    var raw = rawBranchSegments(layout);
    var clipped = clipSegments(raw, protectedBoxes, LINE_TEXT_GAP);
    layout.protectedBoxes = protectedBoxes;
    layout.rawSegments = raw;
    layout.lineSegments = clipped;
    layout.lineTextHits = findLineTextHits(clipped, protectedBoxes, 0);
    return layout;
  }

  function assignEraSides(eras) {
    // Greedy: put each era on the side with less vertical occupancy in its span.
    var load = { left: [], right: [] };
    function occupied(side, y0, y1) {
      var n = 0;
      load[side].forEach(function (seg) {
        if (!(y1 < seg[0] || y0 > seg[1])) n += Math.min(y1, seg[1]) - Math.max(y0, seg[0]);
      });
      return n;
    }
    eras.slice().sort(function (a, b) { return a.span.mid - b.span.mid; }).forEach(function (e) {
      var y0 = e.minY, y1 = e.maxY;
      var left = occupied("left", y0, y1);
      var right = occupied("right", y0, y1);
      e.side = left <= right ? "left" : "right";
      load[e.side].push([y0, y1]);
    });
  }

  function packLanes(items, leafH, gap) {
    var bottoms = [];
    items.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (item) {
      var lane = 0;
      while (lane < bottoms.length && item.y < bottoms[lane] + leafH + gap) lane++;
      if (lane === bottoms.length) bottoms.push(item.y);
      else bottoms[lane] = item.y;
      item.lane = lane;
    });
    return bottoms.length;
  }

  function collectBoxes(layout) {
    var boxes = [];
    layout.years.forEach(function (y) {
      boxes.push({
        kind: "year", id: String(y.year),
        x: y.labelX, y: y.labelY, w: y.labelW, h: y.labelH
      });
    });
    if (layout.dirTop) boxes.push(Object.assign({ kind: "dir", id: "top" }, layout.dirTop));
    if (layout.dirBot) boxes.push(Object.assign({ kind: "dir", id: "bot" }, layout.dirBot));
    layout.eras.forEach(function (e) {
      var x = e.labelAnchor === "end" ? e.labelX - e.labelW : e.labelX;
      boxes.push({
        kind: "era", id: e.name,
        x: x, y: e.labelY, w: e.labelW, h: e.labelH
      });
    });
    layout.people.forEach(function (item) {
      boxes.push({
        kind: "leaf", id: item.p.id,
        x: item.x - item.w / 2, y: item.y - item.h / 2, w: item.w, h: item.h
      });
    });
    layout.works.forEach(function (w) {
      var vis = (FLOWER_R + 2) * 2;
      boxes.push({
        kind: "flower", id: w.id, personId: w.personId,
        x: w.x - vis / 2, y: w.y - vis / 2, w: vis, h: vis
      });
    });
    return boxes;
  }

  function resolveLabelOverlaps(layout) {
    var pass, hits, i;
    for (pass = 0; pass < 16; pass++) {
      hits = findOverlaps(collectBoxes(layout), BOX_GAP);
      if (!hits.length) return hits;
      var moved = false;
      for (i = 0; i < hits.length; i++) {
        var a = hits[i].a, b = hits[i].b;
        var era = a.kind === "era" ? a : b.kind === "era" ? b : null;
        var other = era === a ? b : a;
        if (era) {
          var ev = layout.eras.find(function (e) { return e.name === era.id; });
          if (!ev) continue;
          var dir = ev.side === "right" ? 1 : -1;
          if (other.kind === "year" || other.kind === "dir") {
            ev.labelX += dir * 10;
            ev.labelAnchor = ev.side === "right" ? "start" : "end";
            moved = true;
          } else if (other.kind === "era") {
            ev.labelY -= 12;
            if (ev.labelY + ev.labelH > ev.midY - 8) ev.labelY = ev.midY - 8 - ev.labelH;
            moved = true;
          } else if (other.kind === "leaf" || other.kind === "flower") {
            ev.labelY -= 8;
            ev.labelX += dir * 6;
            if (ev.labelY + ev.labelH > ev.midY - 8) ev.labelY = ev.midY - 8 - ev.labelH;
            moved = true;
          }
        } else if ((a.kind === "year" || a.kind === "dir") && (b.kind === "year" || b.kind === "dir")) {
          var later = a.y <= b.y ? a : b;
          var yv = layout.years.find(function (y) { return String(y.year) === later.id; });
          if (yv) {
            yv.labelY -= 8;
            yv.y = yv.labelY + yv.labelH / 2;
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
    // Recompute era label boxes from possibly nudged positions
    layout.eras.forEach(function (e) {
      e.labelW = estimateTextWidth(e.name, ERA_FONT);
      if (e.side === "right") {
        /* labelX is the text anchor x when start-aligned */
      }
    });
    return findOverlaps(collectBoxes(layout), BOX_GAP);
  }

  function layoutTree(people, opts) {
    opts = opts || {};
    people = people || [];
    var viewW = Math.max(320, opts.viewWidth || 1024);
    var padTop = 72;
    var padBottom = 88;
    var pxPerYear = opts.pxPerYear || 24;
    var innerH = Math.max((YEAR_MAX - YEAR_MIN) * pxPerYear, 1400);
    var height = padTop + innerH + padBottom;
    function yearToY(year) {
      return padTop + ((YEAR_MAX - year) / (YEAR_MAX - YEAR_MIN)) * innerH;
    }

    var erasMap = {};
    people.forEach(function (p) {
      var name = p.era || "未分组";
      if (!erasMap[name]) erasMap[name] = [];
      erasMap[name].push(p);
    });
    var eras = Object.keys(erasMap).map(function (name) {
      var members = erasMap[name];
      var tokens = members.map(function (p) {
        var s = personSpan(p);
        return [s.start, s.end];
      });
      var span = spanOf(tokens);
      return {
        name: name,
        members: members,
        span: span,
        minY: yearToY(span.end),
        maxY: yearToY(span.start),
        midY: yearToY(span.mid)
      };
    });
    eras.forEach(function (e) {
      if (e.maxY - e.minY < 28) {
        e.minY = e.midY - 14;
        e.maxY = e.midY + 14;
      }
    });
    assignEraSides(eras);
    var eraSide = {};
    eras.forEach(function (e) { eraSide[e.name] = e.side; });
    var eraCol = ERA_COL;
    eras.forEach(function (e) {
      eraCol = Math.max(eraCol, Math.ceil(estimateTextWidth(e.name, ERA_FONT) + TEXT_PAD_X * 2 + 8));
    });

    var peopleLayout = people.map(function (p) {
      var span = personSpan(p);
      var side = eraSide[p.era || "未分组"] || "right";
      return {
        p: p,
        span: span,
        side: side,
        y: yearToY(span.mid),
        w: Math.max(leafWidth(p.shortName || p.name), Math.ceil(estimateTextWidth(p.era, 11)+32)),
        h: LEAF_H
      };
    });

    var leftItems = peopleLayout.filter(function (it) { return it.side === "left"; });
    var rightItems = peopleLayout.filter(function (it) { return it.side === "right"; });
    packLanes(leftItems, LEAF_H, BOX_GAP + 8);
    packLanes(rightItems, LEAF_H, BOX_GAP + 8);

    function laneExtent(items) {
      var maxLane = 0;
      var colW = [];
      items.forEach(function (it) {
        var n = (it.p.works || []).filter(function (w) { return workYear(w) != null; }).length;
        var cluster = flowerCluster(n);
        var w = it.w + LANE_GAP + cluster.w;
        if (it.lane > maxLane) maxLane = it.lane;
        colW[it.lane] = Math.max(colW[it.lane] || 0, w);
      });
      var offsets = [];
      var acc = 0;
      for (var i = 0; i <= maxLane; i++) {
        offsets[i] = acc;
        acc += (colW[i] || MIN_LEAF_W) + (i < maxLane ? 0 : 0);
      }
      return { offsets: offsets, total: acc, colW: colW };
    }
    var leftExt = laneExtent(leftItems);
    var rightExt = laneExtent(rightItems);

    // Positions relative to trunk at 0, then shift
    var works = [];
    peopleLayout.forEach(function (item) {
      var dir = item.side === "right" ? 1 : -1;
      var ext = item.side === "right" ? rightExt : leftExt;
      var inner = GUTTER + eraCol + LEAF_GAP + (ext.offsets[item.lane] || 0);
      item.x = dir * (inner + item.w / 2);
      item.innerX = dir * inner;
      item.outerX = item.x + dir * (item.w / 2);
      var list = (item.p.works || []).map(function (w, wi) {
        return { w: w, wi: wi, year: workYear(w) };
      }).filter(function (x) { return x.year != null; });
      var cluster = flowerCluster(list.length);
      var startOuter = item.outerX + dir * (FLOWER_HIT + 8);
      list.forEach(function (entry, fi) {
        var col = fi % 3;
        var row = Math.floor(fi / 3);
        var cols = Math.min(list.length - row * 3, 3);
        var clusterW = (cols - 1) * FLOWER_STEP;
        var cx = startOuter + dir * (col * FLOWER_STEP);
        // Center the row on the outward axis starting from startOuter
        if (dir < 0) cx = startOuter - col * FLOWER_STEP;
        var cy = item.y - ((cluster.rows - 1) * FLOWER_STEP) / 2 + row * FLOWER_STEP;
        works.push({
          id: item.p.id + "::" + entry.wi,
          personId: item.p.id,
          work: entry.w,
          year: entry.year,
          yearY: yearToY(entry.year),
          x: cx,
          y: cy,
          index: fi,
          side: item.side,
          hitR: FLOWER_HIT
        });
      });
    });

    eras.forEach(function (e) {
      var dir = e.side === "right" ? 1 : -1;
      e.stubX = dir * (GUTTER + 10);
      e.labelW = estimateTextWidth(e.name, ERA_FONT);
      e.labelH = Math.ceil(ERA_FONT * 1.25);
      e.labelAnchor = e.side === "right" ? "start" : "end";
      // Keep 8–12px clear of the vertical spine, plus typographic pad.
      e.labelX = e.stubX + dir * (LABEL_LINE_GAP + TEXT_PAD_X);
      // Default: 8–12px clear above the mid-branch (and typical person stem).
      e.labelY = e.midY - LABEL_LINE_GAP - e.labelH;
      e.baseline = e.labelY + ERA_FONT * 0.88;
    });

    var years = [];
    var y0;
    for (y0 = 1760; y0 <= 2010; y0 += 10) {
      var yy = yearToY(y0);
      var tw = estimateTextWidth(String(y0), YEAR_FONT);
      years.push({
        year: y0,
        major: y0 % 20 === 0,
        tickY: yy,
        labelW: tw,
        labelH: 16,
        labelX: -(8 + LINE_TEXT_GAP + TEXT_PAD_X) - tw,
        labelY: yy - 8,
        y: yy
      });
    }

    var dirTop = {
      x: 8,
      y: padTop - 36,
      w: estimateTextWidth("更晚", DIR_FONT) + 16,
      h: 18,
      text: "更晚 ↑"
    };
    var dirBot = {
      x: 8,
      y: padTop + innerH + 28,
      w: estimateTextWidth("更早 · 起源", DIR_FONT) + 8,
      h: 18,
      text: "更早 ↓ 起源"
    };

    // Determine bounds and shift so trunk is centered in the content box,
    // with equal padding; width at least the viewport when it fits.
    function allX() {
      var xs = [];
      peopleLayout.forEach(function (it) {
        xs.push(it.x - it.w / 2, it.x + it.w / 2);
      });
      works.forEach(function (w) {
        xs.push(w.x - FLOWER_HIT, w.x + FLOWER_HIT);
      });
      eras.forEach(function (e) {
        if (e.side === "right") xs.push(e.labelX, e.labelX + e.labelW);
        else xs.push(e.labelX - e.labelW, e.labelX);
        xs.push(e.stubX);
      });
      years.forEach(function (y) { xs.push(y.labelX, y.labelX + y.labelW); });
      xs.push(dirTop.x, dirTop.x + dirTop.w, dirBot.x, dirBot.x + dirBot.w, 0);
      return xs;
    }

    var xs = allX();
    var minX = Math.min.apply(null, xs);
    var maxX = Math.max.apply(null, xs);
    var padX = 36;
    var contentW = Math.max(Math.abs(minX), Math.abs(maxX)) * 2 + padX * 2;
    var width = Math.max(viewW, contentW);
    var trunkX = width / 2;

    function shift(dx) {
      peopleLayout.forEach(function (it) {
        it.x += dx;
        it.innerX += dx;
        it.outerX += dx;
      });
      works.forEach(function (w) { w.x += dx; });
      eras.forEach(function (e) {
        e.stubX += dx;
        e.labelX += dx;
      });
      years.forEach(function (y) { y.labelX += dx; });
      dirTop.x += dx;
      dirBot.x += dx;
    }
    shift(trunkX);

    var layout = {
      width: width,
      height: height,
      trunkX: trunkX,
      padTop: padTop,
      padBottom: padBottom,
      innerH: innerH,
      yearToY: yearToY,
      people: peopleLayout,
      eras: eras,
      works: works,
      years: years,
      dirTop: dirTop,
      dirBot: dirBot,
      viewWidth: viewW,
      constants: {
        YEAR_MIN: YEAR_MIN,
        YEAR_MAX: YEAR_MAX,
        ERA_FONT: ERA_FONT,
        LEAF_FONT: LEAF_FONT,
        YEAR_FONT: YEAR_FONT,
        LEAF_H: LEAF_H,
        FLOWER_R: FLOWER_R,
        FLOWER_HIT: FLOWER_HIT,
        BOX_GAP: BOX_GAP,
        GUTTER: GUTTER
      }
    };

    var leftover = resolveLabelOverlaps(layout);
    layout.eras.forEach(function (e) {
      e.baseline = e.labelY + ERA_FONT * 0.88;
    });
    layout.years.forEach(function (y) {
      y.baseline = y.labelY + YEAR_FONT * 0.88;
    });
    layout.overlaps = leftover;
    layout.boxes = collectBoxes(layout);
    buildClippedLines(layout);
    layout.constants.LABEL_LINE_GAP = LABEL_LINE_GAP;
    layout.constants.LINE_TEXT_GAP = LINE_TEXT_GAP;
    layout.constants.TEXT_PAD_X = TEXT_PAD_X;
    layout.constants.TEXT_PAD_Y = TEXT_PAD_Y;
    layout.eraCol = eraCol;
    return layout;
  }

  var api = {
    YEAR_MIN: YEAR_MIN,
    YEAR_MAX: YEAR_MAX,
    ERA_FONT: ERA_FONT,
    LEAF_FONT: LEAF_FONT,
    YEAR_FONT: YEAR_FONT,
    BOX_GAP: BOX_GAP,
    FLOWER_HIT: FLOWER_HIT,
    extractYears: extractYears,
    spanOf: spanOf,
    personSpan: personSpan,
    workYear: workYear,
    estimateTextWidth: estimateTextWidth,
    boxesOverlap: boxesOverlap,
    findOverlaps: findOverlaps,
    collectBoxes: collectBoxes,
    collectProtectedBoxes: collectProtectedBoxes,
    clipSegments: clipSegments,
    segmentHitsBox: segmentHitsBox,
    findLineTextHits: findLineTextHits,
    rawBranchSegments: rawBranchSegments,
    buildClippedLines: buildClippedLines,
    padBox: padBox,
    clampCard: clampCard,
    placeCard: placeCard,
    layoutTree: layoutTree,
    leafWidth: leafWidth,
    LABEL_LINE_GAP: LABEL_LINE_GAP,
    LINE_TEXT_GAP: LINE_TEXT_GAP,
    TEXT_PAD_X: TEXT_PAD_X,
    TEXT_PAD_Y: TEXT_PAD_Y
  };

  root.ArchitectTreeLayout = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
