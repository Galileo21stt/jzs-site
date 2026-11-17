import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const shotDir = path.join(repoRoot, "docs", "shots", "architect-links");
fs.mkdirSync(shotDir, { recursive: true });

const require = createRequire("/tmp/al-test/node_modules/puppeteer-core/package.json");
const puppeteer = require("/tmp/al-test/node_modules/puppeteer-core/lib/cjs/puppeteer/puppeteer-core.js");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2"
};

function startServer(root, port) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(root)) {
      res.writeHead(403); res.end(); return;
    }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(err.code === "ENOENT" ? 404 : 500); res.end(String(err)); return; }
      res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

const failures = [];
function check(name, cond, extra) {
  if (cond) console.log("  ok  ", name);
  else {
    failures.push(name + (extra ? " — " + extra : ""));
    console.log("  FAIL", name, extra || "");
  }
}

async function withPage(browser, size, fn) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" && !/favicon\.ico/i.test(text)) errors.push("console: " + text);
  });
  page.on("response", (res) => {
    if (res.status() >= 400 && !/favicon\.ico/i.test(res.url())) errors.push(res.status() + " " + res.url());
  });
  await page.setViewport(size);
  const result = await fn(page, errors);
  await page.close();
  return result;
}

const PORT = Number(process.env.PORT || 8876);
const base = `http://127.0.0.1:${PORT}/tools/src/architect-links/`;

const server = await startServer(repoRoot, PORT);
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/usr/bin/google-chrome-stable",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"]
});

try {
  console.log("base", base);

  await withPage(browser, { width: 1440, height: 900, deviceScaleFactor: 1 }, async (page, errors) => {
    console.log("\n[desktop tree]");
    await page.goto(base, { waitUntil: "networkidle0", timeout: 30000 });
    check("no page errors on load", errors.length === 0, errors.join(" | "));
    const title = await page.title();
    check("title mentions 时间树", title.includes("时间树"));
    const peopleCount = await page.$$eval(".leaf-node", (els) => els.length);
    check("renders 19 architect leaves", peopleCount === 19, "got " + peopleCount);
    const eraCount = await page.$$eval(".era-hit", (els) => els.length);
    check("renders era branches", eraCount >= 10, "got " + eraCount);
    const flowerCount = await page.$$eval(".flower-node", (els) => els.length);
    check("renders work flowers", flowerCount >= 30, "got " + flowerCount);
    const text = await page.evaluate(() => document.body.innerText);
    check("explains bottom-up time", text.includes("自下而上") || text.includes("更晚") && text.includes("更早"));
    check("explains non-unique belonging", text.includes("唯一") || text.includes("重叠"));
    for (const name of ["威廉·莫里斯", "密斯·凡·德·罗", "雷姆·库哈斯", "弗兰克·劳埃德·赖特"]) {
      check("leaf visible: " + name, text.includes(name));
    }
    const svgBox = await page.$eval("#treeSvg", (el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, overflow: el.scrollWidth };
    });
    check("svg has usable height", svgBox.h > 1000, JSON.stringify(svgBox));

    // search
    await page.fill ? null : null;
    await page.screenshot({ path: path.join(shotDir, "01-tree-desktop.png"), fullPage: false });
    // also capture a mid/top crop after jumping to contemporary, then go back to roots
    await page.click('[data-scroll="now"]');
    await new Promise((r) => setTimeout(r, 80));
    await page.screenshot({ path: path.join(shotDir, "01b-tree-desktop-now.png"), fullPage: false });
    await page.click('[data-scroll="roots"]');
    await new Promise((r) => setTimeout(r, 80));
    await page.click("#searchInput");
    await page.type("#searchInput", "密斯");
    await page.waitForTimeout?.(200) || await new Promise((r) => setTimeout(r, 200));
    const hl = await page.$eval("#treeSvg", (svg) => ({
      filtering: svg.classList.contains("is-filtering"),
      matchLeaves: svg.querySelectorAll(".leaf-node.is-match").length
    }));
    check("search highlights leaves", hl.filtering && hl.matchLeaves >= 1, JSON.stringify(hl));

    await page.screenshot({ path: path.join(shotDir, "01c-tree-search-mies.png"), fullPage: false });

    // click a leaf -> inspector
    await page.evaluate(() => {
      const el = document.querySelector('.leaf-node[data-id="mies"]');
      el && el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 150));
    const inspector = await page.$eval("#inspector", (el) => el.innerText);
    check("inspector shows Mies", inspector.includes("密斯"));
    check("inspector keeps idea text", inspector.includes("少即是多") || inspector.includes("流动"));

    // open full card
    await page.evaluate(() => {
      const btn = document.querySelector('#inspector [data-person="mies"]');
      btn && btn.click();
    });
    await page.waitForSelector(".info-panel");
    const detail = await page.evaluate(() => document.body.innerText);
    check("detail has idea/method/works/relate", 
      detail.includes("思想立场") && detail.includes("设计手法") && detail.includes("作品对应") && detail.includes("横向关联"));
    check("detail did not rewrite people name", detail.includes("密斯·凡·德·罗"));
    await page.screenshot({ path: path.join(shotDir, "02-detail-mies.png"), fullPage: false });
    const detErrors = errors.slice();
    check("no errors after detail", detErrors.length === 0, detErrors.join(" | "));
  });

  await withPage(browser, { width: 1440, height: 900 }, async (page, errors) => {
    console.log("\n[quiz/progress/graph]");
    await page.goto(base + "#quiz", { waitUntil: "networkidle0" });
    const q = await page.evaluate(() => document.body.innerText);
    check("quiz heading present", q.includes("闭卷"));
    check("quiz starts with a person", /史密森|阿尔托|密斯|文丘里|艾森曼|格罗皮乌斯/.test(q));
    await page.click("[data-reveal='1']");
    await new Promise((r) => setTimeout(r, 100));
    const revealed = await page.evaluate(() => document.body.innerText);
    check("quiz reveals answer", revealed.includes("参考要点") || revealed.includes("易混"));
    const hasRates = await page.$$eval("[data-rate]", (els) => els.map((e) => e.getAttribute("data-rate")).join(","));
    check("quiz rating buttons", hasRates.includes("again") && hasRates.includes("good"), hasRates);
    await page.click('[data-rate="good"]');
    await new Promise((r) => setTimeout(r, 200));
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem("arch-links-v1");
      return raw && JSON.parse(raw);
    });
    check("review saved under arch-links-v1", !!(stored && stored.version === 1 && Object.keys(stored.reviews || {}).length >= 1), JSON.stringify(stored && stored.reviews));

    await page.goto(base + "#progress", { waitUntil: "networkidle0" });
    const prog = await page.evaluate(() => document.body.innerText);
    check("progress sees exported format note", prog.includes("architect-links-review"));
    check("progress has export button", await page.$("#exportBtn").then((x) => !!x));

    await page.goto(base + "#graph", { waitUntil: "networkidle0" });
    const g = await page.evaluate(() => document.body.innerText);
    check("graph keeps original topics", g.includes("工业设计的形成") && g.includes("少即是多") && g.includes("少即是乏味"));
    await page.screenshot({ path: path.join(shotDir, "03-graph.png"), fullPage: false });
    check("no errors in quiz/graph/progress", errors.length === 0, errors.join(" | "));
  });

  await withPage(browser, { width: 390, height: 844, isMobile: true, hasTouch: true }, async (page, errors) => {
    console.log("\n[mobile]");
    await page.goto(base + "#tree", { waitUntil: "networkidle0" });
    const peopleCount = await page.$$eval(".rail-item.is-person, .leaf-node", (els) => els.length);
    check("mobile still has 19 people", peopleCount === 19, "got " + peopleCount);
    const hasRail = await page.$("#railTree");
    check("mobile uses readable rail list", !!hasRail);
    const first = await page.$eval(".rail-item", (el) => el.innerText);
    check("mobile list starts earlier in time", /莫里斯|红屋|186|1859|工艺/.test(first), first.slice(0, 80));
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, bodyOverflow: document.body.scrollWidth };
    });
    // tree canvas may legally be wider than viewport and scroll inside .tree-stage
    const stage = await page.$eval(".tree-stage", (el) => ({
      clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, overflowX: getComputedStyle(el).overflowX
    }));
    check("tree stage is a scroll container or fits", stage.scrollWidth <= stage.clientWidth + 2 || ["auto", "scroll", "overlay"].includes(stage.overflowX), JSON.stringify({ overflow, stage }));
    const mobileNav = await page.$eval(".mobile-nav", (el) => getComputedStyle(el).display !== "none");
    check("mobile nav visible", mobileNav);
    await page.screenshot({ path: path.join(shotDir, "04-tree-mobile.png"), fullPage: false });
    check("no mobile page errors", errors.length === 0, errors.join(" | "));
  });

  await withPage(browser, { width: 1440, height: 900 }, async (page, errors) => {
    console.log("\n[keyboard and cards]");
    await page.goto(base + "#tree", { waitUntil: "networkidle0" });
    await page.keyboard.press("Slash");
    const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
    check("/ focuses search", focused === "searchInput", focused);
    await page.goto(base + "#cards", { waitUntil: "networkidle0" });
    const cards = await page.$$eval(".person-card", (els) => els.length);
    check("cards view lists people", cards === 19, "got " + cards);
    await page.screenshot({ path: path.join(shotDir, "05-cards.png"), fullPage: false });
    check("no errors on cards", errors.length === 0, errors.join(" | "));
  });

  // data integrity: PEOPLE unchanged in count and key fields vs legacy file
  const dataFile = fs.readFileSync(path.join(__dirname, "data.js"), "utf8");
  const legacy = fs.readFileSync(path.join(__dirname, "legacy", "index-2026-11-17-cards.html"), "utf8");
  check("data.js still assigns window.PEOPLE", dataFile.includes("window.PEOPLE = ["));
  for (const id of ["smithson", "morris", "koolhaas", "wright", "lecorbusier"]) {
    check("legacy id kept in data.js: " + id, dataFile.includes("id:'" + id + "'"));
    check("legacy id kept in old page: " + id, legacy.includes("id:'" + id + "'"));
  }
  check("storage key unchanged", fs.readFileSync(path.join(__dirname, "app.js"), "utf8").includes("arch-links-v1"));

} finally {
  await browser.close();
  server.close();
}

console.log("\n" + (failures.length ? failures.length + " failed:\n - " + failures.join("\n - ") : "All checks passed."));
if (failures.length) process.exit(1);
