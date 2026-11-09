// ================= 应用 =================
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const TOPIC = Object.fromEntries(TOPICS.map(t => [t.id, t]));
const VAL_ORDER = { '高': 0, '中': 1, '低': 2 };
const sorted = zone => TOPICS.filter(t => t.zone === zone).sort((a, b) => VAL_ORDER[a.value] - VAL_ORDER[b.value]);
const ZONE = { zj: '中建史', wj: '外建史' };
const LS = { get(k, d) { try { const v = localStorage.getItem('jzs.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
             set(k, v) { try { localStorage.setItem('jzs.' + k, JSON.stringify(v)); } catch (e) {} } };

// ---------- 时间轴数据（只放素材里出现的条目，顺序轴） ----------
const ERAS = [
 ['古埃及', {s:[], p:['伊姆霍泰普'], b:['玛斯塔巴','昭赛尔陵墓','吉萨金字塔群','哈特什帕苏墓','太阳神庙'], q:[]}, ['wj02','wj01']],
 ['古两河', {s:[], p:[], b:['山岳台','萨艮二世王宫','帕赛玻里斯宫'], q:[]}, ['wj02']],
 ['爱琴文明', {s:[], p:[], b:['克诺索斯宫','迈锡尼狮子门'], q:[]}, ['wj02']],
 ['古希腊', {s:[], p:['毕达哥拉斯','菲狄亚斯','伊克底努','穆尼西克里'], b:['雅典卫城','帕特农','伊瑞克提翁','奖杯亭'], q:['阿索斯广场']}, ['wj02','wj01','wj05']],
 ['古罗马', {s:[], p:['维特鲁威','阿格里巴','阿德良'], b:['万神庙','大角斗场','巴西利卡','浴场'], q:['罗曼努姆','凯撒','奥古斯都','图拉真']}, ['wj02','wj01','wj05']],
 ['中世纪', {s:[], p:[], b:[], q:['比萨大教堂广场']}, ['wj05']],
 ['文艺复兴', {s:['早期','盛期','晚期（教条/手法主义）'], p:['伯鲁乃列斯基','阿尔伯蒂','伯拉孟特','米开朗基罗','帕拉第奥','维尼奥拉'], b:['圣彼得大教堂（8 步）','坦比哀多','圆厅别墅'], q:['安农齐阿塔','卡比多','圣马可']}, ['wj08','wj01','wj05']],
 ['巴洛克', {s:['巴洛克'], p:['伯尼尼','波洛米尼','斯帕奇'], b:['四喷泉圣卡罗教堂','罗马耶稣会教堂'], q:['圣彼得广场','波波洛','纳沃纳','西班牙大台阶']}, ['wj08','wj01','wj05']],
 ['法国古典主义', {s:['法国古典主义'], p:['佩罗','于·阿·孟莎','勒诺特'], b:['卢浮宫东立面','凡尔赛镜厅'], q:['旺道姆广场']}, ['wj08','wj01','wj05']],
 ['洛可可', {s:['洛可可'], p:['勃夫杭'], b:['苏俾士府邸公主沙龙'], q:['南锡广场群','调和广场']}, ['wj08','wj01','wj05']],
 ['复古思潮', {s:['古典复兴','浪漫主义','折衷主义'], p:['苏夫洛','布雷','勒杜','申克尔','加尼埃'], b:['巴黎万神庙','柏林宫廷剧院','英国国会大厦','巴黎歌剧院'], q:[]}, ['wj08','wj04','wj01']],
 ['19 世纪城市与新材料', {s:['两材'], p:['奥斯曼','霍华德','帕克斯顿','詹尼'], b:['塞文河铁桥','水晶宫','埃菲尔铁塔','机械馆'], q:['巴黎改建','田园城市']}, ['wj04','wj03','wj01']],
 ['探求新建筑', {s:['工艺美术运动','新艺术运动','维也纳学派/分离派','芝加哥学派','德意志制造联盟'], p:['莫里斯','霍塔','瓦格纳','路斯','沙利文','贝伦斯'], b:['红屋','都灵路12号住宅','透平机车间','法古斯工厂'], q:[]}, ['wj08','wj04','wj01']],
 ['战后初期（原图分组）', {s:['表现主义','未来主义','风格派','构成主义'], p:['门德尔松','马里内蒂','里特维德','塔特林'], b:['爱因斯坦天文台','乌德勒支住宅'], q:[]}, ['wj08','wj04']],
 ['现代建筑五大师', {s:['理性主义','有机建筑','人情化'], p:['格罗皮乌斯','柯布西耶','密斯','赖特','阿尔托'], b:['包豪斯校舍','萨伏伊','德国馆','流水别墅','维堡图书馆'], q:[]}, ['wj09']],
 ['战后七大思潮', {s:['理性主义充实提高','粗野主义','技术精美','典雅主义','高度工业技术','人情化地域性','个性与象征'], p:['丹下健三','小沙里宁','斯通','罗杰斯&皮亚诺','伍重'], b:['马赛公寓','蓬皮杜中心','悉尼歌剧院','东馆'], q:['《雅典宪章》1933']}, ['wj07','wj08','wj01','wj03']],
 ['后现代七大流派', {s:['后现代主义','解构主义','新理性主义','新地域主义','新现代主义','新高技派','极简主义'], p:['文丘里','盖里','罗西','西扎','迈耶','福斯特'], b:['母亲住宅','毕尔巴鄂古根海姆','格蒂中心','汇丰银行'], q:['意大利广场','《马丘比丘宪章》1977','《北京宪章》1999']}, ['wj06','wj08','wj01','wj05','wj03']],
];
const DYN = [
 ['汉', {m:[], s:[], g:['陵：方锥陵台「方上」']}],
 ['北魏', {m:[], s:['嵩岳寺塔'], g:[]}],
 ['隋', {m:['（摩尼殿始建于隋）'], s:['神通寺四门塔 {n|611}'], g:[]}],
 ['唐', {m:['南禅寺大殿 {n|782}','佛光寺大殿 {n|857}','含元殿','麟德殿'], s:['小雁塔 {n|707}','净藏禅师塔 {n|746}','经幢出现'], g:['大明宫（三朝纵列）','乾陵（因山为陵、上下宫）']}],
 ['五代', {m:[], s:['虎丘云岩寺塔 {n|961}','保俶塔等'], g:[]}],
 ['辽', {m:['独乐寺观音阁（重建）','应县释迦塔'], s:[], g:[]}],
 ['宋', {m:['隆兴寺摩尼殿','晋祠圣母殿'], s:['料敌塔','祐国寺塔','泉州双石塔','万安桥','经幢发展'], g:['宋陵（五音姓利）']}],
 ['元', {m:['永乐宫三清殿'], s:['经幢少见'], g:[]}],
 ['明', {m:[], s:['大正觉寺金刚宝座塔'], g:['明孝陵、十三陵（方城明楼）']}],
 ['清', {m:['太和殿'], s:['（金刚宝座塔仅见明清）'], g:[]}],
 ['素材未注朝代', {m:['孔庙大成殿'], s:[], g:['紫禁城','天坛','北海','避暑山庄','颐和园','苏州私家园林']}],
];

// ---------- 页面 ----------
function home() {
  const counts = TOPICS.reduce((a, t) => (a[t.value] = (a[t.value] || 0) + 1, a), {});
  const card = (t, i) => { const thumb = MANIFEST[t.id].find(x => !x.cover) || MANIFEST[t.id][0];
    return `<a class="tc v-${VAL_ORDER[t.value]}" href="#/t/${t.id}">
      <div class="tc-thumb"><img src="img/tiles/${thumb.tiles[0][0]}" alt="原表格长图顶部" loading="lazy"></div>
      <div class="tc-body"><div class="tc-top"><span class="rank">${i + 1}</span><span class="val val-${VAL_ORDER[t.value]}">价值 ${t.value}</span><span class="tc-no">${ZONE[t.zone]} ${t.no}</span></div>
      <h3>${esc(t.title)}</h3><p class="tc-r">${esc(t.reason)}</p><div class="tc-v">${t.views.map(v => `<span>${esc(v)}</span>`).join('')}</div>
      <div class="tc-f"><span>${MANIFEST[t.id].filter(x=>!x.cover).length} 张长图</span><span>${ISSUES.filter(r => r[1].includes(t.id)).length} 处勘误</span><span>赞 ${t.likes} · 藏 ${t.favs}</span></div></div></a>`; };
  return `<div class="home">
   <section class="hero"><div class="hero-band"><span class="vt">中外建史表格</span></div><div class="hero-main">
     <h1>中外建史 · 横向对比背诵站</h1><p class="lead">把 12 篇表格长图拆成可筛选、可对照、可遮挡背诵的交互视图。按浙大 355 真题价值排序：<b class="val val-0">高 ${counts['高']}</b> <b class="val val-1">中 ${counts['中']}</b> <b class="val val-2">低 ${counts['低']}</b>，另附 ${ISSUES.length} 条勘误。</p>
     <p class="advice">${esc(ADVICE)}</p>
     <div class="hero-act"><a class="btn pri" href="#/timeline">总时间轴：古代 → 后现代</a><a class="btn" href="#/t/wj01/graph">人物关系图</a><a class="btn" href="#/quiz">开始自测</a><a class="btn" href="#/issues">勘误清单</a></div>
     <p class="muted small">${esc(BASIS)}</p></div></section>
   <div class="zones">${['zj', 'wj'].map(z => `<section class="zone"><h2 class="zone-h"><span>${ZONE[z]}</span><small>${sorted(z).length} 篇 · 按价值高→低</small></h2><div class="tcs">${sorted(z).map(card).join('')}</div></section>`).join('')}</div></div>`;
}
function topicPage(id) {
  const t = TOPIC[id]; let body = '';
  try { body = RENDER[id](); } catch (e) { console.error(e); body = `<p class="err">渲染出错：${esc(e.message)}</p>`; }
  const iss = ISSUES.filter(r => r[1].includes(id));
  if (iss.length) body += sec('iss', '本篇勘误（未改原笔记，供核对）', issueTable(iss));
  const idx = sorted(t.zone).indexOf(t), list = sorted(t.zone), prev = list[idx - 1], next = list[idx + 1];
  return `<div class="tp"><div class="tp-band" aria-hidden="true"><span class="vt">${esc(t.full)}</span></div><div class="tp-main">
    <header class="tp-head"><div class="crumb"><a href="#/">首页</a> / ${ZONE[t.zone]} / 第 ${idx + 1} 位</div>
     <div class="tp-tt"><span class="val val-${VAL_ORDER[t.value]}">价值 ${t.value}</span><h1>${esc(ZONE[t.zone])} ${t.no}｜${esc(t.title)}</h1></div>
     <p class="tc-r">${esc(t.reason)}</p>
     <div class="tp-act"><button class="btn pri" data-act="viewer">原表格长图对照</button><button class="btn" data-act="mask">背诵模式</button><a class="btn" href="${esc(t.url)}" target="_blank" rel="noopener">小红书原帖 ↗</a></div></header>
    <nav class="toc" aria-label="本页目录"></nav><div class="tp-body">${body}</div>
    <div class="pn">${prev ? `<a href="#/t/${prev.id}">← ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a href="#/t/${next.id}">${esc(next.title)} →</a>` : ''}</div></div></div>`;
}
function issueTable(list) {
  return mx({ cols: ['#', '篇目', '笔记原文', '教材 / 问题', '判定'], rows: list.map(r => [String(r[0]), r[1].split(' ').map(x => TOPIC[x] ? `${ZONE[TOPIC[x].zone]} ${TOPIC[x].no}` : x).join(' / '), r[2], r[3], r[4] === '错' ? '**错**' : '可疑']), cls: 'iss-t' });
}
function issuesPage() {
  return `<div class="page"><h1>与教材不符或可疑处</h1><p class="muted">判定：<b>错</b>＝与教材原文明确不符或笔误；<b>可疑</b>＝教材未检出、被夸大或归类不当。来自打分笔记，原笔记未改动。页面里的 <button class="iss iss-err">错9</button> <button class="iss iss-q">可疑4</button> 标记都链接到这里。</p>
   <div class="chips-row">${['全部', '错', '可疑'].map((x, i) => `<button class="chip${i ? '' : ' on'}" data-issf="${x}">${x}</button>`).join('')}</div>${issueTable(ISSUES)}</div>`;
}
function timelinePage() {
  const L = [['s', '流派 / 思潮'], ['p', '人物'], ['b', '建筑'], ['q', '广场 / 城市']];
  const chip = (x, tid) => `<a class="tlc" href="#/t/${tid}">${fmt(x)}</a>`;
  const wj = `<div class="tw tlw"><table class="mx tlx"><thead><tr><th class="corner">外建史</th>${ERAS.map((e, i) => `<th><span class="era-n">${i + 1}</span>${esc(e[0])}</th>`).join('')}</tr></thead><tbody>
    ${L.map(([k, l]) => `<tr><th class="rh">${l}</th>${ERAS.map(e => `<td>${e[1][k].map(x => chip(x, e[2][0])).join('')}</td>`).join('')}</tr>`).join('')}
    <tr><th class="rh">去哪篇看</th>${ERAS.map(e => `<td>${e[2].map(id => `<a class="tlt" href="#/t/${id}">${ZONE[TOPIC[id].zone]}${TOPIC[id].no}</a>`).join('')}</td>`).join('')}</tr></tbody></table></div>`;
  const ZL = [['m', '木构单体', 'zj03'], ['s', '砖石塔 / 石构', 'zj02'], ['g', '宫殿 · 陵寝 · 园林', 'zj01']];
  const zj = `<div class="tw tlw"><table class="mx tlx"><thead><tr><th class="corner">中建史</th>${DYN.map(d => `<th>${esc(d[0])}</th>`).join('')}</tr></thead><tbody>
    ${ZL.map(([k, l, tid]) => `<tr><th class="rh">${l}</th>${DYN.map(d => `<td>${d[1][k].map(x => chip(x, tid)).join('')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `<div class="page"><h1>总时间轴：古代 → 战后 → 后现代</h1>
   <p class="muted">顺序轴（列＝时期，从左到右），不是比例尺——素材大多没给具体年份，只有标注过的年份才显示。每个格子可点进对应专题。背诵模式下年份会被遮住。</p>
   <div class="era-strip">${ERAS.map((e, i) => `<span class="es" style="--h:${200 + i * 9}">${esc(e[0])}</span>`).join('')}</div>${wj}
   <h2 class="sec-h"><span>中建史：朝代轴</span></h2>${zj}
   <p class="foot">「素材未注朝代」一列：紫禁城、天坛、园林等在素材里没有写朝代，所以不归入明/清列。</p></div>`;
}
function searchPage(q) {
  q = (q || '').trim(); let res = [];
  if (q) TOPICS.forEach(t => { const tmp = document.createElement('div'); tmp.innerHTML = RENDER[t.id]();
    $$('.sec', tmp).forEach(s => { const sid = s.id.slice(2); $$('tr, .card, .vs-i, .pit, .def, .fl-s, .ph-w, .ecl, .sq-c', s).forEach(el => {
      const tx = el.textContent.replace(/\s+/g, ' ').trim(); if (tx.includes(q) && tx.length < 600 && !res.some(r => r.tx === tx)) res.push({ t, sid, sec: s.dataset.title, tx }); }); }); });
  const hl = tx => esc(tx).split(esc(q)).join(`<mark>${esc(q)}</mark>`);
  return `<div class="page"><h1>搜索</h1><form class="srch big" id="sform"><input type="search" name="q" value="${esc(q)}" placeholder="人名、作品、术语，如：叉柱造 / 伯尼尼 / 1/6" aria-label="搜索"><button class="btn pri">搜</button></form>
   ${q ? `<p class="muted">「${esc(q)}」共 ${res.length} 条${res.length > 150 ? '（显示前 150 条）' : ''}</p>` : ''}
   <div class="sres">${res.slice(0, 150).map(r => `<a class="sr" href="#/t/${r.t.id}/${r.sid}"><div class="sr-h">${ZONE[r.t.zone]} ${r.t.no}｜${esc(r.t.title)} › ${esc(r.sec)}</div><div class="sr-t">${hl(r.tx)}</div></a>`).join('')}</div></div>`;
}

// ---------- 自测 ----------
let Q = null;
function quizPage() {
  const st = LS.get('quiz', {});
  return `<div class="page"><h1>自测</h1><p class="muted">两种方式：① 这里的闪卡/选择题；② 任意专题页打开「背诵模式」，名词、作品、年代被遮住，点一下揭开。闪卡记录保存在本机浏览器。</p>
   <div class="decks">${DECKS.map(d => { const s = st[d.id] || {}; const known = Object.values(s).filter(v => v === 1).length;
     return `<button class="deck" data-deck="${d.id}"><span class="deck-n">${esc(d.name)}</span><span class="deck-c">${d.cards.length} 张 · ${d.mcq ? '选择题' : '闪卡'}</span><span class="deck-p"><i style="width:${Math.round(known / d.cards.length * 100)}%"></i></span><span class="deck-c">已记住 ${known}</span></button>`; }).join('')}</div>
   <div id="qz"></div></div>`;
}
function startDeck(id, onlyWeak) {
  const d = DECKS.find(x => x.id === id); const st = LS.get('quiz', {})[id] || {};
  let order = d.cards.map((c, i) => i).filter(i => !onlyWeak || st[i] !== 1);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  Q = { d, order, pos: 0, ok: 0, bad: 0, shown: false };
  drawCard(); $('#qz').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function drawCard() {
  const box = $('#qz'); if (!box || !Q) return; const { d, order, pos } = Q;
  if (!order.length) { box.innerHTML = `<div class="fc done">这一组都记住了 👍 <button class="btn" data-qa="all">全部重来</button></div>`; return; }
  if (pos >= order.length) { box.innerHTML = `<div class="fc done"><h3>本轮完成</h3><p>记得 ${Q.ok} · 不熟 ${Q.bad}</p><button class="btn pri" data-qa="weak">只练不熟的</button> <button class="btn" data-qa="all">全部重来</button></div>`; return; }
  const [q, a] = d.cards[order[pos]];
  const head = `<div class="fc-top"><b>${esc(d.name)}</b><span>${pos + 1} / ${order.length}</span><a href="#/t/${d.topic}">去专题页 →</a></div><div class="fc-bar"><i style="width:${pos / order.length * 100}%"></i></div>`;
  if (d.mcq) {
    box.innerHTML = `<div class="fc">${head}<div class="fc-q">${esc(q)}</div><div class="fc-hint">属于哪一派？</div><div class="mcq-o">${d.options.map(o => `<button class="opt" data-opt="${esc(o)}">${esc(o)}</button>`).join('')}</div><div class="fc-res"></div></div>`;
  } else {
    box.innerHTML = `<div class="fc">${head}<div class="fc-q">${esc(q)}</div><button class="fc-a ${Q.shown ? 'show' : ''}" data-qa="flip">${Q.shown ? fmt(a).replace(/class="m /g, 'class="') : '<span class="fc-cover">点击揭开答案（先在心里回忆）</span>'}</button>
     <div class="fc-btns"><button class="btn bad" data-qa="bad" ${Q.shown ? '' : 'disabled'}>✗ 不熟</button><button class="btn ok" data-qa="ok" ${Q.shown ? '' : 'disabled'}>✓ 记得</button></div><p class="muted small">快捷键：空格 揭开 · → 记得 · ← 不熟</p></div>`;
  }
}
function markCard(v) {
  const st = LS.get('quiz', {}); const d = Q.d; st[d.id] = st[d.id] || {}; st[d.id][Q.order[Q.pos]] = v; LS.set('quiz', st);
  v === 1 ? Q.ok++ : Q.bad++; Q.pos++; Q.shown = false; drawCard();
}
function mountMCQ(root) {
  $$('[data-mcq]', root).forEach(box => { const d = DECKS.find(x => x.id === box.dataset.mcq); let i = Math.floor(Math.random() * d.cards.length), score = [0, 0];
    const draw = () => { const [q, a] = d.cards[i];
      box.innerHTML = `<div class="fc inline"><div class="fc-q">${esc(q)}</div><div class="mcq-o">${d.options.map(o => `<button class="opt" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div><div class="fc-res"></div><div class="muted small">本页得分：${score[0]} / ${score[1]}</div></div>`;
      $$('.opt', box).forEach(b => b.onclick = () => { if (box.dataset.done) return; box.dataset.done = 1; score[1]++;
        const right = b.dataset.o === a; if (right) score[0]++; b.classList.add(right ? 'right' : 'wrong'); $$('.opt', box).find(x => x.dataset.o === a).classList.add('right');
        $('.fc-res', box).innerHTML = `${right ? '✓ 对' : '✗ 应为「' + esc(a) + '」'} <button class="btn sm">下一题</button>`;
        $('.fc-res .btn', box).onclick = () => { delete box.dataset.done; i = Math.floor(Math.random() * d.cards.length); draw(); }; }); };
    draw(); });
}

// ---------- 关系图连线 ----------
function mountRG(root, id) {
  const rg = $('#rg-' + id, root); if (!rg) return;
  const svg = $('.rg-s', rg), L = $('.rg-l', rg), R = $('.rg-r', rg);
  const draw = () => {
    if (!rg.offsetParent) return;
    const box = rg.getBoundingClientRect(), sb = svg.getBoundingClientRect();
    const ps = $$('.rg-p', R), gs = $$('.rg-g', L);
    // 左侧节点放到其人物的平均高度，避免交叉
    const cy = el => { const b = el.getBoundingClientRect(); return b.top - box.top + b.height / 2; };
    let lastBottom = 0;
    gs.forEach(g => { const mine = ps.filter(p => p.dataset.g.split(' ').includes(g.dataset.k)); const h = g.offsetHeight;
      let y = mine.length ? mine.reduce((s, p) => s + cy(p), 0) / mine.length - h / 2 : lastBottom;
      y = Math.max(y, lastBottom + 4); g.style.top = y + 'px'; lastBottom = y + h; });
    L.style.height = Math.max(lastBottom, R.offsetHeight) + 'px';
    svg.setAttribute('height', Math.max(lastBottom, R.offsetHeight)); svg.setAttribute('width', sb.width);
    let out = '';
    ps.forEach(p => { const y2 = cy(p); const multi = p.classList.contains('multi');
      p.dataset.g.split(' ').forEach(k => { const g = gs.find(x => x.dataset.k === k); if (!g) return; const y1 = cy(g);
        out += `<path d="M0 ${y1} C ${sb.width * .5} ${y1}, ${sb.width * .5} ${y2}, ${sb.width} ${y2}" class="rg-e${multi ? ' multi' : ''}" data-k="${k}" data-p="${esc(p.querySelector('.rg-pn').textContent)}"/>`; }); });
    svg.innerHTML = out;
  };
  const sel = (fn) => { rg.classList.add('sel'); $$('.on', rg).forEach(x => x.classList.remove('on')); fn(); };
  $$('.rg-g', rg).forEach(g => g.onclick = () => { if (g.classList.contains('on')) { rg.classList.remove('sel'); g.classList.remove('on'); $$('.on', rg).forEach(x => x.classList.remove('on')); return; }
    sel(() => { g.classList.add('on'); $$('.rg-p', rg).forEach(p => p.dataset.g.split(' ').includes(g.dataset.k) && p.classList.add('on')); $$(`path[data-k="${g.dataset.k}"]`, svg).forEach(e => e.classList.add('on')); }); });
  $$('.rg-p', rg).forEach(p => p.onclick = ev => { if (ev.target.closest('.m')) return; sel(() => { p.classList.add('on'); p.dataset.g.split(' ').forEach(k => { const g = $(`.rg-g[data-k="${k}"]`, rg); g && g.classList.add('on'); });
    $$('path', svg).forEach(e => e.dataset.p === p.querySelector('.rg-pn').textContent && e.classList.add('on')); }); });
  draw(); requestAnimationFrame(draw); setTimeout(draw, 300);
  rg._draw = draw;
}

// ---------- 原图对照 ----------
let viewerTopic = null, zoom = 1;
function openViewer(id) {
  viewerTopic = id; const v = $('#viewer'); const imgs = MANIFEST[id]; const t = TOPIC[id];
  v.innerHTML = `<div class="vw-h"><b>原表格长图 · ${ZONE[t.zone]} ${t.no}</b><div class="vw-tabs">${imgs.map((m, i) => `<button class="chip${i === (imgs[0].cover && imgs.length > 1 ? 1 : 0) ? ' on' : ''}" data-img="${i}">${m.cover ? '封面' : m.orig.replace(/^.*_(\d+)\..*$/, '$1.png')}</button>`).join('')}</div>
    <div class="vw-z"><button class="btn sm" data-z="-1" aria-label="缩小">−</button><span class="zv">100%</span><button class="btn sm" data-z="1" aria-label="放大">＋</button><a class="btn sm" id="vw-orig" target="_blank">原始文件</a><button class="btn sm" data-act="vclose" aria-label="关闭原图">✕</button></div></div>
    <div class="vw-b"><div class="vw-in"></div></div>`;
  showImg(imgs[0].cover && imgs.length > 1 ? 1 : 0);
  document.body.classList.add('vw-open'); zoom = 1; setZoom(0);
  setTimeout(() => $$('.rg').forEach(r => r._draw && r._draw()), 60);
}
function showImg(i) {
  const m = MANIFEST[viewerTopic][i]; $$('#viewer [data-img]').forEach(b => b.classList.toggle('on', +b.dataset.img === i));
  $('#vw-orig').href = 'img/orig/' + m.orig;
  $('#viewer .vw-in').innerHTML = m.tiles.map(([f, h]) => `<img src="img/tiles/${f}" loading="lazy" alt="" style="aspect-ratio:${m.tw}/${h}">`).join('') + `<p class="foot">${m.w}×${m.h}px 原图已切片显示；需要最清晰时点「原始文件」。</p>`;
  $('#viewer .vw-b').scrollTop = 0;
}
function setZoom(d) { zoom = Math.min(4, Math.max(1, zoom + d * .5)); const inn = $('#viewer .vw-in'); if (inn) inn.style.width = zoom * 100 + '%'; const zv = $('#viewer .zv'); if (zv) zv.textContent = Math.round(zoom * 100) + '%'; }
function closeViewer() { document.body.classList.remove('vw-open'); viewerTopic = null; setTimeout(() => $$('.rg').forEach(r => r._draw && r._draw()), 60); }

// ---------- 背诵遮挡 ----------
const MK = { on: LS.get('mask', false), cats: LS.get('maskCats', { t: true, w: true, n: true }) };
function applyMask() {
  const b = document.body; b.classList.toggle('mask-on', MK.on);
  ['t', 'w', 'n'].forEach(k => b.classList.toggle('mk-' + k, MK.on && MK.cats[k]));
  $('#maskbar').hidden = !MK.on; $$('[data-act="mask"]').forEach(x => x.classList.toggle('on', MK.on));
  $$('#maskbar [data-cat]').forEach(x => x.classList.toggle('on', !!MK.cats[x.dataset.cat]));
  applyMaskCount();
}
function applyMaskCount() {
  const c = $('#mk-count'); if (!c) return;
  const sel = ['t', 'w', 'n'].filter(k => MK.cats[k]).map(k => '#view .m-' + k).join(',');
  const all = sel ? $$(sel) : []; const rev = all.filter(x => x.classList.contains('rev')).length;
  c.textContent = MK.on ? `已揭开 ${rev} / ${all.length}` : '';
}

// ---------- 路由 ----------
function route() {
  const h = location.hash.replace(/^#/, '') || '/'; const parts = h.split('/').filter(Boolean);
  const view = $('#view'); let html, tid = null;
  if (parts[0] === 't' && TOPIC[parts[1]]) { tid = parts[1]; html = topicPage(tid); }
  else if (parts[0] === 'timeline') html = timelinePage();
  else if (parts[0] === 'quiz') html = quizPage();
  else if (parts[0] === 'issues') html = issuesPage();
  else if (parts[0] === 'search') html = searchPage(decodeURIComponent(parts.slice(1).join('/')));
  else html = home();
  view.innerHTML = html;
  $$('.topnav a').forEach(a => a.classList.toggle('on', ('#/' + parts.join('/')).startsWith(a.getAttribute('href')) && a.getAttribute('href') !== '#/' || (!parts.length && a.getAttribute('href') === '#/')));
  document.body.dataset.topic = tid || '';
  $('#fab').hidden = !tid;
  if (tid) {
    const toc = $('.toc', view); toc.innerHTML = $$('.sec', view).map(s => `<button data-goto="${s.id}">${esc(s.dataset.title.replace(/（.*?）|：.*$/g, ''))}</button>`).join('');
    AFTER[tid] && AFTER[tid](view); mountMCQ(view);
    if (viewerTopic && viewerTopic !== tid) openViewer(tid);
    document.title = `${ZONE[TOPIC[tid].zone]} ${TOPIC[tid].no} ${TOPIC[tid].title} · 中外建史`;
    if (parts[2]) { const el = $('#s-' + parts[2], view); if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 30); else scrollTo(0, 0); } else scrollTo(0, 0);
  } else { if (viewerTopic) closeViewer(); document.title = '中外建史横向对比背诵站'; scrollTo(0, 0); }
  if (parts[0] === 'search') { const f = $('#sform'); f.onsubmit = e => { e.preventDefault(); location.hash = '#/search/' + encodeURIComponent(f.q.value); }; }
  applyMask();
}

// ---------- 事件 ----------
document.addEventListener('click', e => {
  const t = e.target;
  // 遮挡：点击揭开 / 再遮
  const m = t.closest('.m'); if (m && document.body.classList.contains('mask-on') && document.body.classList.contains('mk-' + [...m.classList].find(c => /^m-/.test(c)).slice(2))) { e.preventDefault(); e.stopPropagation(); m.classList.toggle('rev'); applyMaskCount(); return; }
  const cm = t.closest('td.cm'); if (cm && !t.closest('.iss')) { cm.classList.toggle('rev'); return; }
  const iss = t.closest('.iss[data-iss]'); if (iss) { showIssue(+iss.dataset.iss, iss); return; }
  const colb = t.closest('.colmask'); if (colb) { const tb = colb.closest('table'); const c = colb.dataset.c; const on = !colb.classList.contains('on'); colb.classList.toggle('on', on); colb.textContent = on ? '显' : '遮';
    $$(`td[data-c="${c}"]`, tb).forEach(td => { td.classList.toggle('cm', on); td.classList.remove('rev'); }); return; }
  const chip = t.closest('.chip[data-fk]'); if (chip) { filterCards(chip); return; }
  const go = t.closest('[data-goto]'); if (go) { const el = document.getElementById(go.dataset.goto); el && el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  const act = t.closest('[data-act]'); if (act) { const a = act.dataset.act;
    if (a === 'viewer') { viewerTopic ? closeViewer() : openViewer(document.body.dataset.topic); }
    if (a === 'vclose') closeViewer();
    if (a === 'mask') { MK.on = !MK.on; LS.set('mask', MK.on); applyMask(); }
    if (a === 'revall') { $$('#view .m').forEach(x => x.classList.add('rev')); $$('#view td.cm').forEach(x => x.classList.add('rev')); applyMaskCount(); }
    if (a === 'rehide') { $$('#view .rev').forEach(x => x.classList.remove('rev')); applyMaskCount(); }
    return; }
  const cat = t.closest('[data-cat]'); if (cat) { const k = cat.dataset.cat; MK.cats[k] = !MK.cats[k]; LS.set('maskCats', MK.cats); applyMask(); return; }
  const img = t.closest('[data-img]'); if (img) { showImg(+img.dataset.img); return; }
  const z = t.closest('[data-z]'); if (z) { setZoom(+z.dataset.z); return; }
  const dk = t.closest('[data-deck]'); if (dk) { startDeck(dk.dataset.deck); return; }
  const qa = t.closest('[data-qa]'); if (qa && Q) { const a = qa.dataset.qa;
    if (a === 'flip') { Q.shown = true; drawCard(); } else if (a === 'ok') markCard(1); else if (a === 'bad') markCard(0);
    else if (a === 'weak') startDeck(Q.d.id, true); else if (a === 'all') startDeck(Q.d.id); return; }
  const opt = t.closest('.opt[data-opt]'); if (opt && Q) { const ans = Q.d.cards[Q.order[Q.pos]][1]; const right = opt.dataset.opt === ans; if ($('#qz .fc-res').textContent) return;
    opt.classList.add(right ? 'right' : 'wrong'); $$('#qz .opt').find(x => x.dataset.opt === ans).classList.add('right');
    $('#qz .fc-res').innerHTML = `${right ? '✓ 对' : '✗ 应为「' + esc(ans) + '」'} <button class="btn sm pri">下一题</button>`;
    $('#qz .fc-res .btn').onclick = () => markCard(right ? 1 : 0); return; }
  const isf = t.closest('[data-issf]'); if (isf) { $$('[data-issf]').forEach(x => x.classList.toggle('on', x === isf)); const v = isf.dataset.issf;
    $$('.iss-t tbody tr').forEach(tr => tr.style.display = v === '全部' || tr.lastElementChild.textContent.trim() === v ? '' : 'none'); return; }
  if (!t.closest('.pop')) $$('.pop').forEach(p => p.remove());
});
function showIssue(n, anchor) {
  $$('.pop').forEach(p => p.remove()); const r = ISSUE_MAP[n]; const p = document.createElement('div'); p.className = 'pop';
  p.innerHTML = `<b class="${r[4] === '错' ? 'tx-err' : 'tx-q'}">${r[4]} #${n}</b><div><small>笔记原文</small>${esc(r[2])}</div><div><small>教材 / 问题</small>${esc(r[3])}</div><a href="#/issues">查看全部勘误 →</a>`;
  document.body.appendChild(p); const b = anchor.getBoundingClientRect();
  p.style.left = Math.max(8, Math.min(innerWidth - p.offsetWidth - 8, b.left)) + 'px'; p.style.top = (b.bottom + scrollY + 6) + 'px';
}
function filterCards(chip) {
  const w = chip.closest('.cardsw'); const k = chip.dataset.fk;
  $$(`.chip[data-fk="${k}"]`, w).forEach(c => c.classList.toggle('on', c === chip));
  const act = {}; $$('.chip.on[data-fk]', w).forEach(c => { if (c.dataset.fv !== '*') act[c.dataset.fk] = c.dataset.fv; });
  let n = 0; $$('.card', w).forEach(cd => { const ok = Object.entries(act).every(([fk, fv]) => (cd.dataset['f' + fk[0].toUpperCase() + fk.slice(1)] || '').split('|').includes(fv)); cd.hidden = !ok; if (ok) n++; });
  $('.cnt', w).textContent = n;
}
document.addEventListener('keydown', e => {
  if (e.target.matches('input, select, textarea')) return;
  if (Q && $('#qz .fc') && !Q.d.mcq) { if (e.key === ' ') { e.preventDefault(); if (!Q.shown) { Q.shown = true; drawCard(); } } else if (e.key === 'ArrowRight' && Q.shown) markCard(1); else if (e.key === 'ArrowLeft' && Q.shown) markCard(0); }
  if (e.key === 'o' && document.body.dataset.topic) viewerTopic ? closeViewer() : openViewer(document.body.dataset.topic);
  if (e.key === 'm') { MK.on = !MK.on; LS.set('mask', MK.on); applyMask(); }
  if (e.key === 'Escape') { closeViewer(); $$('.pop').forEach(p => p.remove()); }
});
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => $$('.rg').forEach(r => r._draw && r._draw()), 120); });
$('#gsearch').addEventListener('submit', e => { e.preventDefault(); const v = $('#gsearch input').value.trim(); if (v) location.hash = '#/search/' + encodeURIComponent(v); });
addEventListener('hashchange', route);
route();
