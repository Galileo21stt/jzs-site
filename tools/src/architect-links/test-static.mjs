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

for (const file of ["data.js", "layout.js", "interaction.js", "app.js"]) {
  execFileSync("node", ["--check", path.join(__dirname, file)], { stdio: "pipe" });
  check("syntax " + file, true);
}

function loadPeople(source, label) {
  const context = { window: {}, console };
  context.window = context;
  vm.runInNewContext(source, context, { filename: label });
  return context.PEOPLE || context.window.PEOPLE;
}

const dataSrc = fs.readFileSync(path.join(__dirname, "data.js"), "utf8");
const legacyHtml = fs.readFileSync(path.join(__dirname, "legacy", "index-2026-11-17-cards.html"), "utf8");
const legacyScript = (legacyHtml.match(/<script>([\s\S]*?)<\/script>/) || [])[0] || "";
const people = loadPeople(dataSrc, "data.js");
const legacyStart = legacyHtml.indexOf("window.PEOPLE");
const legacyEnd = legacyHtml.indexOf("];", legacyStart) + 2;
const legacyPeople = loadPeople(legacyHtml.slice(legacyStart, legacyEnd) + ";", "legacy");

check("current data has 19 people", people && people.length === 19, people && people.length);
check("legacy data has 19 people", legacyPeople && legacyPeople.length === 19);

const byId = Object.fromEntries(people.map((p) => [p.id, p]));
const legacyById = Object.fromEntries(legacyPeople.map((p) => [p.id, p]));
const ids = people.map((p) => p.id);
check("ids match legacy order", JSON.stringify(ids) === JSON.stringify(legacyPeople.map((p) => p.id)), ids.join(","));

const factKeys = ["id", "name", "en", "era", "group", "year", "tags", "idea", "method", "works", "relate", "question", "answer", "trap", "photo", "source", "seed"];
let factDiffs = 0;
for (const id of ids) {
  const a = byId[id], b = legacyById[id];
  check("legacy still has " + id, !!b);
  if (!b) continue;
  for (const k of factKeys) {
    const sa = JSON.stringify(a[k] ?? null);
    const sb = JSON.stringify(b[k] ?? null);
    if (sa !== sb) {
      factDiffs++;
      check("field unchanged " + id + "." + k, false, sa + " vs " + sb);
    }
  }
}
check("no factual field changes", factDiffs === 0, factDiffs + " diffs");

const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
check("keeps storage key arch-links-v1", app.includes('KEY = "arch-links-v1"') || app.includes("KEY = 'arch-links-v1'"));
check("layout module is loaded", html.includes('src="layout.js') && fs.existsSync(path.join(__dirname, "layout.js")));
check("does not draw always-on career twigs", !app.includes("const twigs") && !app.includes('class="twig'));
check("does not paint a halo stroke on SVG text", !css.includes("stroke-width: 5px") && !css.includes("paint-order: stroke fill") && css.includes("stroke: none !important"));
check("selected leaf names stay dark", /leaf-node\.is-active \.leaf-label[\s\S]{0,80}fill:\s*var\(--ink\)/.test(css));
check("leaf type is at least 14px", /leaf-label[\s\S]{0,80}font-size:\s*14px/.test(css));
check("era type is at least 15px", /era-label[\s\S]{0,80}font-size:\s*15px/.test(css));
check("tree page uses a node card instead of a docked inspector", app.includes("function showNodeCard") && app.includes("node-card") && !app.includes('class="inspector"'));
check("flowers keep accessible names", app.includes("aria-label") && app.includes("作品 "));
check("tree page has no 目录 FAB", !app.includes("tree-fab") && !app.includes("目录") && !css.includes(".tree-fab"));
check("flower markup no longer carries data-person", !/flower-node[\s\S]{0,200}data-person=/.test(app));
check("index loads interaction.js", html.includes('src="interaction.js'));
check("index cache-busts CSS/JS/favicon with a stable version", /styles\.css\?v=/.test(html) && /layout\.js\?v=/.test(html) && /app\.js\?v=/.test(html) && /interaction\.js\?v=/.test(html) && /data\.js\?v=/.test(html) && /favicon\.svg\?v=/.test(html));
check("labels have an opaque backdrop, not a text stroke", css.includes(".label-bg") && css.includes("stroke: none !important") && !css.includes("paint-order: stroke fill"));

const workCount = people.reduce((n, p) => n + (p.works || []).length, 0);
check("at least 30 works remain attached to people", workCount >= 30, workCount);
const unnamed = people.flatMap((p) => (p.works || []).filter((w) => !w[0] || !w[1]));
check("every work has a title and date", unnamed.length === 0, JSON.stringify(unnamed));

console.log("\n" + (failures.length ? failures.length + " failed:\n - " + failures.join("\n - ") : "All static checks passed."));
if (failures.length) process.exit(1);
