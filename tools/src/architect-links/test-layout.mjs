import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const failures = [];
function check(name, cond, extra) {
  if (cond) console.log("  ok  ", name);
  else {
    failures.push(name + (extra ? " — " + extra : ""));
    console.log("  FAIL", name, extra || "");
  }
}

for (const file of ["data.js", "layout.js", "app.js"]) {
  execFileSync("node", ["--check", path.join(__dirname, file)], { stdio: "pipe" });
  check("syntax " + file, true);
}

function load() {
  const context = { window: {}, console, module: { exports: {} }, exports: {} };
  context.globalThis = context;
  context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "data.js"), "utf8"), context, { filename: "data.js" });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "layout.js"), "utf8"), context, { filename: "layout.js" });
  return context;
}

const ctx = load();
const L = ctx.ArchitectTreeLayout;
const people = ctx.PEOPLE;
check("expanded people loaded", people && people.length >= 58, people && people.length);

const viewports = [
  { w: 1024, h: 768 },
  { w: 1180, h: 820 },
  { w: 1920, h: 1072 },
  { w: 390, h: 844 }
];

vm.runInNewContext(fs.readFileSync(path.join(__dirname, "study.js"), "utf8"), ctx);
for (const width of [320, 390, 759, 760, ...viewports.map(v => v.w)]) {
  const layout = L.layoutTree(people, { viewWidth: width });
  const names = layout.eras.map(b => b.name);
  check(width + " renders all defined movements exactly once", new Set(names).size === names.length &&
    Object.keys(ctx.MOVEMENTS).every(name => names.includes(name)));
  check(width + " groups into five time regions", layout.bands.length === 5);
  check(width + " allows horizontal exploration within the board", layout.width >= Math.max(2000,width) &&
    layout.eras.every(b => b.x >= 0 && b.x + b.width <= layout.width));
  check(width + " uses the responsive branch arrangement", new Set(layout.eras.map(b => b.side)).size === 2);
  const rows = layout.eras.flatMap(b => b.people.filter(row => row.p.era === b.name));
  check(width + " retains every primary person once", rows.length === people.length &&
    new Set(rows.map(r => r.p.id)).size === people.length);
  check(width + " retains all work lookup IDs", people.every(p => {
    return p.works.every((w, i) => {
      const branch = layout.eras.find(b => b.name === (p.workTopics?.[i] || p.era));
      return branch.works.some(row => row.work === w && row.id === p.id + "::" + i);
    });
  }));
  check(width + " movement branches stay apart", layout.eras.every((a,i) =>
    layout.eras.slice(i + 1).every(b => !L.boxesOverlap(
      {x:a.x,y:a.y,w:a.width,h:a.height},{x:b.x,y:b.y,w:b.width,h:b.height},8))));
  check(width + " names and work titles stay within each branch", layout.eras.every(b => {
    return b.people.every(p => p.y >= 0 && p.y + p.height <= b.height &&
      p.lines.every(line => L.estimateTextWidth(line,16) <= 174) &&
      p.works.every((w,i) => w.y >= 0 && w.y+w.height <= b.height &&
        w.lines.every(line=>L.estimateTextWidth(line,14)<=228) &&
        (!i || p.works[i-1].y+p.works[i-1].height<=w.y)));
  }));
  check(width + " includes secondary-only movements", layout.eras.some(b =>
    b.name === "对理性主义的充实与提高" && b.related.some(p => p.id === "gropius")));
}
for (const group of ctx.GROUP_ORDER) {
  const filtered = people.filter(p => p.group === group);
  const layout = L.layoutTree(filtered, {viewWidth:390});
  check(group + " filter keeps the visible people and their branches", layout.eras.flatMap(b => b.members).length === filtered.length &&
    layout.eras.every(b => [...b.members, ...b.related].every(p => p.group === group)));
}

// Card stays inside the viewport, including awkward anchors.
const awkward = [
  { vp: { w: 390, h: 700 }, anchor: { x: 8, y: 10, w: 80, h: 36 }, side: "left" },
  { vp: { w: 390, h: 700 }, anchor: { x: 300, y: 640, w: 80, h: 36 }, side: "right" },
  { vp: { w: 1024, h: 768 }, anchor: { x: 900, y: 20, w: 120, h: 36 }, side: "right" },
  { vp: { w: 1180, h: 820 }, anchor: { x: 40, y: 20, w: 120, h: 36 }, side: "left" }
];
awkward.forEach((c, i) => {
  const placed = L.placeCard(c.anchor, 280, 240, c.vp, c.side, 10);
  const inside = placed.x >= 10 && placed.y >= 10 && placed.x + placed.w <= c.vp.w - 10 + 0.01 && placed.y + placed.h <= c.vp.h - 10 + 0.01;
  check("card " + i + " stays on screen", inside, JSON.stringify(placed));
});

const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
check("SVG text has stroke none", /text,\s*\.tree-svg tspan\s*\{[^}]*stroke:\s*none\s*!important/.test(css) || css.includes("stroke: none !important"));
check("no halo stroke on labels", !css.includes("stroke-width: 5px") && !css.includes("paint-order: stroke fill"));
check("selected leaf text stays ink", /leaf-node\.is-active \.leaf-label[\s\S]{0,80}fill:\s*var\(--ink\)/.test(css));
check("selected leaf is not white fill on the name", !/leaf-node\.is-active \.leaf-label[^}]*fill:\s*#fff/.test(css));
check("tree view hides topbar without leaving padding", css.includes("body.is-tree .topbar") && css.includes("body.is-tree .app") && css.includes("padding: 0"));
check("node card is a floating dialog", css.includes(".node-card") && css.includes("position: fixed"));

const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
check("index loads layout.js", html.includes('src="layout.js'));
const treePage = app.slice(app.indexOf("function treePage"), app.indexOf("function cardsPage"));
check("treePage omits top chrome, filters, inspector, and 目录", !treePage.includes("inspector") && !treePage.includes("tree-chrome") && !treePage.includes("filterbar") && !treePage.includes("<h1>") && treePage.includes("node-card") && !treePage.includes("tree-fab") && !treePage.includes("目录"));
check("era, people and works use in-place buttons", ["era", "person", "work"].every(kind => app.includes('action(b.name, "' + kind + '"')));
check("Escape and blank click close the card", app.includes("hideNodeCard()") && app.includes('e.key === "Escape"'));
check("work titles render directly inside their movement", app.includes('textRows(w.lines') && app.includes('"piece-title"'));
check("storage key unchanged", app.includes('KEY = "arch-links-v1"') || app.includes("KEY = 'arch-links-v1'"));
check("old routes still exist", app.includes("function cardsPage") && app.includes("function quizPage") && app.includes("function progressPage") && app.includes("function graphPage") && app.includes('person/'));
check("index cache-busts styles, scripts and favicon", /styles\.css\?v=/.test(html) && /layout\.js\?v=/.test(html) && /app\.js\?v=/.test(html) && /data\.js\?v=/.test(html) && /interaction\.js\?v=/.test(html) && /favicon\.svg\?v=/.test(html));
check("CJK width estimate is conservative", L.estimateTextWidth("戰", 10) >= 11.2);
check("digit width estimate is conservative", L.estimateTextWidth("8888", 100) >= 288);

console.log("\n" + (failures.length ? failures.length + " failed:\n - " + failures.join("\n - ") : "All layout checks passed."));
if (failures.length) process.exit(1);
