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
check("19 people loaded", people && people.length === 19, people && people.length);

const viewports = [
  { w: 1024, h: 768 },
  { w: 1180, h: 820 },
  { w: 390, h: 844 }
];

for (const vp of viewports) {
  const layout = L.layoutTree(people, { viewWidth: vp.w });
  const boxes = L.collectBoxes(layout);
  const hits = L.findOverlaps(boxes, L.BOX_GAP);
  check(vp.w + "x" + vp.h + " has no label/node overlaps", hits.length === 0, hits.map((h) => h.a.kind + ":" + h.a.id + " vs " + h.b.kind + ":" + h.b.id).join("; "));
  check(vp.w + "x" + vp.h + " lays out all 19 people", layout.people.length === 19);
  const works = people.reduce((n, p) => n + (p.works || []).filter((w) => L.workYear(w) != null).length, 0);
  check(vp.w + "x" + vp.h + " lays out dated works", layout.works.length === works, layout.works.length + " vs " + works);
  const sides = new Set(layout.people.map((p) => p.side));
  check(vp.w + "x" + vp.h + " uses both sides", sides.has("left") && sides.has("right"), [...sides].join(","));
  const minGap = Math.min.apply(null, layout.people.map((it) => {
    const inner = it.side === "right" ? it.x - it.w / 2 : it.x + it.w / 2;
    return Math.abs(inner - layout.trunkX);
  }));
  check(vp.w + "x" + vp.h + " trunk is staggered from leaves", minGap >= 80, "gap=" + minGap.toFixed(1));
  const crossed = boxes.filter((b) => b.kind !== "year" && b.kind !== "dir" && b.x < layout.trunkX && b.x + b.w > layout.trunkX);
  check(vp.w + "x" + vp.h + " no era/leaf/flower box crosses the trunk", crossed.length === 0, crossed.map((b) => b.kind + ":" + b.id).join(","));
  const leftN = layout.people.filter((p) => p.side === "left").length;
  const rightN = layout.people.filter((p) => p.side === "right").length;
  check(vp.w + "x" + vp.h + " both sides have people", leftN > 0 && rightN > 0, leftN + "/" + rightN);
  if (vp.w >= 1024) {
    check(vp.w + " tree width does not exceed viewport", layout.width <= vp.w + 1, "width=" + layout.width);
  }
  const mid = layout.width / 2;
  check(vp.w + "x" + vp.h + " trunk is centered in the canvas", Math.abs(layout.trunkX - mid) <= 80, "trunk=" + layout.trunkX.toFixed(1) + " mid=" + mid.toFixed(1));
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
check("index loads layout.js", html.includes('src="layout.js"'));
const treePage = app.slice(app.indexOf("function treePage"), app.indexOf("function cardsPage"));
check("treePage omits top chrome, filters, and inspector", !treePage.includes("inspector") && !treePage.includes("tree-chrome") && !treePage.includes("filterbar") && !treePage.includes("<h1>") && treePage.includes("node-card") && treePage.includes("tree-fab"));
check("clicking leaf/flower/era opens a node card", app.includes("function showNodeCard") && app.includes("function hideNodeCard") && app.includes('data-kind="person"') && app.includes('data-kind="work"') && app.includes('data-kind="era"'));
check("Escape and blank click close the card", app.includes("hideNodeCard()") && app.includes('e.key === "Escape"'));
check("flowers are marks only, no default work titles in SVG", !app.includes("work-caption") && !app.includes("work-label") && !app.includes("work-year"));
check("each leaf label is a single text node template", (app.match(/class="leaf-label"/g) || []).length === 1);
check("each era label is a single text node template", (app.match(/class="era-label"/g) || []).length === 1);
check("storage key unchanged", app.includes('KEY = "arch-links-v1"') || app.includes("KEY = 'arch-links-v1'"));
check("old routes still exist", app.includes("function cardsPage") && app.includes("function quizPage") && app.includes("function progressPage") && app.includes("function graphPage") && app.includes('person/'));

console.log("\n" + (failures.length ? failures.length + " failed:\n - " + failures.join("\n - ") : "All layout checks passed."));
if (failures.length) process.exit(1);
