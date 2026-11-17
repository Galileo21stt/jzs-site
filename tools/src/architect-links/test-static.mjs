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

for (const file of ["data.js", "app.js"]) {
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
check("keeps storage key arch-links-v1", app.includes('KEY = "arch-links-v1"') || app.includes("KEY = 'arch-links-v1'"));
check("does not draw always-on career twigs", !app.includes("const twigs") && !app.includes('class="twig'));
check("renders work captions", app.includes("work-caption") && app.includes("function workCaption"));
check("renders year guides to the trunk", app.includes("year-guide"));
check("flowers keep accessible names", app.includes("<title>") && app.includes("aria-label"));
check("leaf type is at least 14px", /leaf-label\s*\{[^}]*font-size:\s*14px/.test(css));
check("era type is at least 15px", /era-label[\s\S]{0,120}font-size:\s*15px/.test(css));
check("captions appear on hover or selection", css.includes(".flower-bundle:hover .work-caption") && css.includes(".flower-bundle.is-open .work-caption"));
check("year guides are hidden until hover or selection", css.includes(".year-guide") && css.includes("opacity: 0") && css.includes(".flower-bundle:hover .year-guide"));

const workCount = people.reduce((n, p) => n + (p.works || []).length, 0);
check("at least 30 works remain attached to people", workCount >= 30, workCount);
const unnamed = people.flatMap((p) => (p.works || []).filter((w) => !w[0] || !w[1]));
check("every work has a title and date", unnamed.length === 0, JSON.stringify(unnamed));

console.log("\n" + (failures.length ? failures.length + " failed:\n - " + failures.join("\n - ") : "All static checks passed."));
if (failures.length) process.exit(1);
