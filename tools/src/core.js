// ===== 渲染工具 =====
const RENDER = {};      // 每篇专题：RENDER[id] = () => html
const AFTER = {};       // 渲染后挂载（画关系线等）：AFTER[id] = (root) => {}
const DECKS = [];       // 自测卡组

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ISSUE_MAP = Object.fromEntries(ISSUES.map(r => [r[0], r]));

// 数字/年代自动遮挡：只匹配阿拉伯数字（含小数、分数、范围、常见量词）
const NUM_RE = /\d+(?:\.\d+)?(?:\s*[\/:：~～\-—]\s*\d+(?:\.\d+)?)?(?:\s*(?:km|m²|hm²|m|米|年代|年|层|根|间|种|架|檩|等|进|座|步|朵|个|人|次|排|路|开间|倍|号))?/g;
function fmtPlain(s) {
  let out = '', last = 0;
  s = String(s);
  for (const m of s.matchAll(NUM_RE)) {
    // 跳过「02.png」这类和「№」后跟的数字之外的情况：数字前后是英文字母时不遮
    const pre = s[m.index - 1] || '', post = s[m.index + m[0].length] || '';
    if (/[A-Za-z]/.test(pre) || /[A-Za-z]/.test(post) && !/m$/.test(m[0])) continue;
    out += esc(s.slice(last, m.index)) + `<span class="m m-n">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(s.slice(last));
}
// 标记：{w|作品} {t|名词} {n|数字} {x|不遮挡原样} {sic|原图写法} {?12} **强调** 《书名》→作品
const TOK_RE = /\{(w|t|n|x|sic)\|([^{}]*)\}|\{\?(\d+)\}|\*\*(.+?)\*\*|《([^》]+)》/g;
function fmt(s) {
  if (s == null) return '';
  if (Array.isArray(s)) return s.map(x => `<div class="ln">${fmt(x)}</div>`).join('');
  s = String(s);
  let out = '', last = 0;
  for (const m of s.matchAll(TOK_RE)) {
    out += fmtPlain(s.slice(last, m.index));
    if (m[1] === 'w') out += `<span class="m m-w">${esc(m[2])}</span>`;
    else if (m[1] === 't') out += `<span class="m m-t">${esc(m[2])}</span>`;
    else if (m[1] === 'n') out += `<span class="m m-n">${esc(m[2])}</span>`;
    else if (m[1] === 'x') out += esc(m[2]);
    else if (m[1] === 'sic') out += `<span class="sic" title="原图写法，照录">原图作「${esc(m[2])}」</span>`;
    else if (m[3]) out += issueBadge(+m[3]);
    else if (m[4] != null) out += `<b class="hl">${fmt(m[4])}</b>`;
    else if (m[5] != null) out += `<span class="m m-w">《${esc(m[5])}》</span>`;
    last = m.index + m[0].length;
  }
  return out + fmtPlain(s.slice(last));
}
function issueBadge(n) {
  const r = ISSUE_MAP[n]; if (!r) return '';
  const cls = r[4] === '错' ? 'iss-err' : 'iss-q';
  return `<button class="iss ${cls}" data-iss="${n}" title="${esc(r[4] + '：' + r[3])}">${r[4]}${n}</button>`;
}
const strip = h => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/\s+/g, ' ').trim();

// 区块
function sec(id, title, inner, sub) {
  return `<section class="sec" id="s-${id}" data-title="${esc(title)}"><h2 class="sec-h"><span>${esc(title)}</span>${sub ? `<small>${fmt(sub)}</small>` : ''}</h2>${inner}</section>`;
}
function h3(t, sub) { return `<h3 class="h3">${esc(t)}${sub ? ` <small>${fmt(sub)}</small>` : ''}</h3>`; }

// 项目—内容 表（原图样式）
function kv(rows, cls = '') {
  return `<div class="tw"><table class="kv ${cls}"><tbody>${rows.map(r => {
    if (r.length === 3) return `<tr><th class="k0">${fmt(r[0])}</th><th class="k1">${fmt(r[1])}</th><td>${fmt(r[2])}</td></tr>`;
    return `<tr><th>${fmt(r[0])}</th><td>${fmt(r[1])}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
// 横向对比矩阵：cols 第一项是左上角；rows: [行名, c1, c2, ...]；可「挡列」
function mx(o) {
  const cols = o.cols;
  const head = `<thead><tr>${cols.map((c, i) => i === 0 ? `<th class="corner">${fmt(c)}</th>` :
    `<th data-c="${i}"><div class="thc"><span>${fmt(c)}</span><button class="colmask" data-c="${i}" title="遮挡/显示这一列，背诵用">遮</button></div></th>`).join('')}</tr></thead>`;
  const body = o.rows.map(r => {
    if (r.group) return `<tr class="grp"><th colspan="${cols.length}">${fmt(r.group)}</th></tr>`;
    return `<tr${r.hl ? ' class="rowhl"' : ''}>${(r.cells || r).map((c, i) => i === 0 ? `<th class="rh">${fmt(c)}</th>` :
      `<td data-c="${i}"${c === '—' || c === '' || c == null ? ' class="empty"' : ''}>${c == null || c === '' ? '<span class="na">—</span>' : fmt(c)}</td>`).join('')}</tr>`;
  }).join('');
  return `<div class="tw mxw${o.wide ? ' wide' : ''}"><table class="mx ${o.cls || ''}" ${o.id ? `id="${o.id}"` : ''}>${head}<tbody>${body}</tbody></table></div>${o.foot ? `<p class="foot">${fmt(o.foot)}</p>` : ''}`;
}
// 易混 VS 对照
function vs(o) {
  const side = (s, c) => `<div class="vs-side ${c}"><div class="vs-h">${fmt(s.h)}</div>${(s.items || []).map(x => `<div class="vs-i">${fmt(x)}</div>`).join('')}</div>`;
  return `<div class="vs">${o.title ? `<div class="vs-t"><span class="tag-confuse">易混</span>${fmt(o.title)}</div>` : ''}
    <div class="vs-b">${side(o.a, 'a')}<div class="vs-mid">VS</div>${side(o.b, 'b')}</div>
    ${o.same ? `<div class="vs-same"><b>相同：</b>${fmt(o.same)}</div>` : ''}${o.note ? `<div class="vs-note">${fmt(o.note)}</div>` : ''}</div>`;
}
// 多列对照（3 个以上的易混组）
function vsn(title, cols, note) {
  return `<div class="vs"><div class="vs-t"><span class="tag-confuse">易混</span>${fmt(title)}</div><div class="vsn">${cols.map((c, i) =>
    `<div class="vs-side c${i}"><div class="vs-h">${fmt(c.h)}</div>${c.items.map(x => `<div class="vs-i">${fmt(x)}</div>`).join('')}</div>`).join('')}</div>${note ? `<div class="vs-note">${fmt(note)}</div>` : ''}</div>`;
}
// 易混提示条
function pits(list) {
  return `<div class="pits">${list.map(x => `<div class="pit"><span class="tag-confuse">易混</span><div>${fmt(x)}</div></div>`).join('')}</div>`;
}
// 流程（箭头串联）
function flow(steps, cls = '') {
  return `<div class="flow ${cls}">${steps.map((s, i) => `${i ? '<div class="fl-ar" aria-hidden="true">→</div>' : ''}<div class="fl-s${s.hl ? ' hl' : ''}"><div class="fl-h">${fmt(s.h)}</div>${s.d ? `<div class="fl-d">${fmt(s.d)}</div>` : ''}</div>`).join('')}</div>`;
}
function callout(type, html) {
  const lab = { tip: '可直接用', warn: '注意', src: '来源说明', q: '真题' }[type] || '';
  return `<div class="co co-${type}">${lab ? `<b class="co-l">${lab}</b>` : ''}<div>${fmt(html)}</div></div>`;
}
function defs(list) { // 名词解释卡
  return `<div class="defs">${list.map(([t, d, ex]) => `<div class="def"><div class="def-t">${fmt('{t|' + t + '}')}${ex ? `<small>${fmt(ex)}</small>` : ''}</div><div class="def-d">${fmt(d)}</div></div>`).join('')}</div>`;
}
// 可筛选卡片
// items: {t, s, f:{facet:[...]}, rows:[[l,c]], note}
function cards(id, items, facets, opts = {}) {
  const fhtml = facets.map(f => {
    const vals = f.order || [...new Set(items.flatMap(it => it.f[f.k] || []))];
    return `<div class="fc-row"><span class="fc-l">${esc(f.label)}</span>${['全部', ...vals].map((v, i) =>
      `<button class="chip${i === 0 ? ' on' : ''}" data-fk="${f.k}" data-fv="${i === 0 ? '*' : esc(v)}">${esc(v)}</button>`).join('')}</div>`;
  }).join('');
  const ch = items.map(it => {
    const data = facets.map(f => `data-f-${f.k}="${esc((it.f[f.k] || []).join('|'))}"`).join(' ');
    const tags = facets.filter(f => !f.hideTag).flatMap(f => (it.f[f.k] || []).map(v => `<span class="ctag ctag-${f.k}">${esc(v)}</span>`)).join('');
    return `<article class="card" ${data}><header class="card-h"><div class="card-t">${fmt(it.t)}</div>${it.s ? `<div class="card-s">${fmt(it.s)}</div>` : ''}<div class="ctags">${tags}</div></header>
      ${it.rows && it.rows.length ? `<table class="kv kv-card"><tbody>${it.rows.map(r => `<tr><th>${fmt(r[0])}</th><td>${fmt(r[1])}</td></tr>`).join('')}</tbody></table>` : ''}
      ${it.note ? `<div class="card-n">${fmt(it.note)}</div>` : ''}</article>`;
  }).join('');
  return `<div class="cardsw" id="cw-${id}"><div class="facets">${fhtml}<div class="fc-count"><span class="cnt">${items.length}</span> / ${items.length} 项${opts.footnote ? ` · <span class="muted">${fmt(opts.footnote)}</span>` : ''}</div></div><div class="cards">${ch}</div></div>`;
}
const chipsList = (arr, cls = '') => `<span class="chips ${cls}">${arr.map(x => `<span class="pill">${fmt(x)}</span>`).join('')}</span>`;
