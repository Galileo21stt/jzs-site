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

for (const file of ["interaction.js", "app.js"]) {
  execFileSync("node", ["--check", path.join(__dirname, file)], { stdio: "pipe" });
  check("syntax " + file, true);
}

function el(tag, attrs, children) {
  const node = {
    tagName: String(tag).toUpperCase(),
    attrs: Object.assign({}, attrs || {}),
    children: [],
    parentNode: null,
    nodeType: 1,
    id: (attrs && attrs.id) || ""
  };
  node.getAttribute = (name) => Object.prototype.hasOwnProperty.call(node.attrs, name) ? String(node.attrs[name]) : null;
  node.hasAttribute = (name) => Object.prototype.hasOwnProperty.call(node.attrs, name);
  node.closest = () => null;
  (children || []).forEach((child) => {
    if (typeof child === "string") {
      const text = { nodeType: 3, textContent: child, parentNode: node, data: child };
      node.children.push(text);
    } else {
      child.parentNode = node;
      node.children.push(child);
    }
  });
  return node;
}

function loadApp() {
  const context = {
    ARCHITECT_TREE_TEST: true,
    console,
    location: {
      hash: "#tree",
      replace(h) { this.hash = h.startsWith("#") ? h : "#" + h; },
      assign(h) { this.hash = h.startsWith("#") ? h : "#" + h; }
    },
    document: {
      addEventListener() {},
      getElementById() { return { clientWidth: 1180, clientHeight: 800, scrollTop: 0, scrollLeft: 0 }; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      body: { clientWidth: 1180 }
    },
    window: null,
    globalThis: null,
    module: { exports: {} },
    exports: {},
    CSS: { escape: (s) => s }
  };
  context.globalThis = context;
  context.window = context;
  context.window.innerWidth = 1180;
  context.window.innerHeight = 800;
  context.window.addEventListener = function () {};
  context.window.removeEventListener = function () {};
  context.window.scrollTo = function () {};
  context.window.CSS = context.CSS;
  const files = ["data.js", "layout.js", "interaction.js", "app.js"];
  for (const f of files) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, f), "utf8"), context, { filename: f });
  }
  return context;
}

const ctx = loadApp();
const I = ctx.ArchitectTreeInteraction;
const App = ctx.ArchitectTreeApp;
check("interaction and app test hooks loaded", !!(I && I.interactionFromElement && App && App.personCardHtml && App.workCardHtml && App.treePage));

function sameIntent(actual, expected) {
  return actual && expected && actual.type === expected.type && actual.kind === expected.kind && actual.id === expected.id;
}

// 1) Flower on the tree, including the old data-person attribute that caused #person/aalto jumps.
const flowerTitle = el("title", {}, ["帕米欧肺病疗养院 1933"]);
const petal = el("circle", { class: "flower-petals" });
const flower = el("g", {
  class: "flower-node",
  tabindex: "0",
  role: "button",
  "data-kind": "work",
  "data-id": "aalto::0",
  "data-person": "aalto",
  "data-owner": "aalto",
  "aria-label": "作品 帕米欧肺病疗养院 1933"
}, [flowerTitle, petal]);
const fromPetal = I.interactionFromElement(petal);
const fromTitle = I.interactionFromElement(flowerTitle);
const fromFlower = I.interactionFromElement(flower);
check("clicking a flower petal selects the work, does not goPerson",
  sameIntent(fromPetal, { type: "select", kind: "work", id: "aalto::0" }),
  JSON.stringify(fromPetal));
check("clicking a flower label/title selects the work, does not goPerson",
  sameIntent(fromTitle, { type: "select", kind: "work", id: "aalto::0" }),
  JSON.stringify(fromTitle));
check("clicking the flower group selects the work, does not goPerson",
  sameIntent(fromFlower, { type: "select", kind: "work", id: "aalto::0" }),
  JSON.stringify(fromFlower));

// 2) Work row inside the person side card: the exact live trigger “帕米欧肺病疗养院 1933”.
const personHtml = App.personCardHtml("aalto");
check("person card lists 帕米欧肺病疗养院", personHtml.includes("帕米欧肺病疗养院") && personHtml.includes("1933"));
check("person card work buttons use data-kind=work and aalto::0",
  /<button type="button" class="work" data-kind="work" data-id="aalto::0">/.test(personHtml));
check("person card work buttons do not carry data-person",
  !/<button[^>]*class="work"[^>]*data-person=/.test(personHtml) &&
  !/<button[^>]*data-person=[^>]*class="work"/.test(personHtml));

const year = el("small", {}, ["1933"]);
const name = el("strong", {}, ["帕米欧肺病疗养院"]);
const workBtn = el("button", {
  type: "button",
  class: "work",
  "data-kind": "work",
  "data-id": "aalto::0"
}, [name, year]);
check("clicking 帕米欧肺病疗养院 in the person card selects the work",
  sameIntent(I.interactionFromElement(name), { type: "select", kind: "work", id: "aalto::0" }),
  JSON.stringify(I.interactionFromElement(name)));
check("clicking the 1933 year in the person card selects the work",
  sameIntent(I.interactionFromElement(year), { type: "select", kind: "work", id: "aalto::0" }),
  JSON.stringify(I.interactionFromElement(year)));
check("clicking the work button itself selects the work",
  sameIntent(I.interactionFromElement(workBtn), { type: "select", kind: "work", id: "aalto::0" }),
  JSON.stringify(I.interactionFromElement(workBtn)));

// 3) Real handleDocumentClick path: hash must stay on #tree, selection becomes the work.
const events = [];
const workClick = { target: name, preventDefault() { events.push("prevent"); }, stopPropagation() { events.push("stop"); } };
ctx.location.hash = "#tree";
App.handleDocumentClick(workClick);
check("handleDocumentClick on person-card work keeps hash on #tree",
  ctx.location.hash === "#tree" || ctx.location.hash === "tree",
  ctx.location.hash);
check("handleDocumentClick on person-card work selects aalto::0",
  App.getTreeSel() && App.getTreeSel().kind === "work" && App.getTreeSel().id === "aalto::0",
  JSON.stringify(App.getTreeSel()));

ctx.location.hash = "#tree";
App.handleDocumentClick({ target: petal, preventDefault() {}, stopPropagation() {} });
check("handleDocumentClick on flower keeps hash on #tree",
  ctx.location.hash === "#tree" || ctx.location.hash === "tree",
  ctx.location.hash);
check("handleDocumentClick on flower selects aalto::0, not person aalto",
  App.getTreeSel() && App.getTreeSel().kind === "work" && App.getTreeSel().id === "aalto::0",
  JSON.stringify(App.getTreeSel()));

// 4) Leaves and era still open in-place cards, not the full person route.
const leafLabel = el("text", { class: "leaf-label" }, ["阿尔瓦·阿尔托"]);
const leaf = el("g", { class: "leaf-node", "data-kind": "person", "data-id": "aalto" }, [leafLabel]);
check("clicking a leaf selects the person in place",
  sameIntent(I.interactionFromElement(leafLabel), { type: "select", kind: "person", id: "aalto" }),
  JSON.stringify(I.interactionFromElement(leafLabel)));
const eraText = el("text", { class: "era-label" }, ["现代主义的人情化"]);
const era = el("g", { class: "era-hit", "data-kind": "era", "data-id": "现代主义的人情化" }, [eraText]);
check("clicking an era label selects the era in place",
  sameIntent(I.interactionFromElement(eraText), { type: "select", kind: "era", id: "现代主义的人情化" }),
  JSON.stringify(I.interactionFromElement(eraText)));

ctx.location.hash = "#tree";
App.handleDocumentClick({ target: leafLabel, preventDefault() {}, stopPropagation() {} });
check("leaf click does not route to #person/aalto",
  (ctx.location.hash === "#tree" || ctx.location.hash === "tree") && App.getTreeSel().kind === "person",
  ctx.location.hash + " " + JSON.stringify(App.getTreeSel()));

// 5) Pure tree: no lingering 目录 FAB in the tree page markup.
const treeHtml = App.treePage();
check("tree page HTML has no 目录 button", !treeHtml.includes("目录") && !treeHtml.includes("tree-fab") && !treeHtml.includes("treeFab") && !treeHtml.includes("treeMenu"));
check("tree page still has the in-place node card host", treeHtml.includes("id=\"nodeCard\"") && treeHtml.includes("class=\"tree-svg\""));

const workHtml = App.workCardHtml("aalto::0");
check("work card is 帕米欧肺病疗养院 and has no 完整卡片 jump",
  workHtml.includes("帕米欧肺病疗养院") && workHtml.includes("1933") && !workHtml.includes("完整卡片") && !workHtml.includes("data-person="));
check("person card has no 完整卡片 or quiz jump",
  !personHtml.includes("完整卡片") && !personHtml.includes("闭卷测这个人物") && !personHtml.includes("data-start-one"));

const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
check("styles no longer define a directory FAB", !css.includes(".tree-fab") && !css.includes(".tree-menu"));
check("index loads interaction.js before app.js",
  html.indexOf('src="interaction.js') !== -1 && html.indexOf('src="interaction.js') < html.indexOf('src="app.js'));

console.log("\n" + (failures.length ? failures.length + " failed:\n - " + failures.join("\n - ") : "All event path checks passed."));
if (failures.length) process.exit(1);
