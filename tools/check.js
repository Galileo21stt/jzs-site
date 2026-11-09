const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const errs = [], bad = [];
  const page = await b.newPage();
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push('CONSOLE ' + m.type() + ' ' + m.text()); });
  page.on('requestfailed', r => bad.push(r.url()));
  page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  const url = 'file://' + require('path').resolve(__dirname, '..', 'index.html');
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]) {
    await page.setViewport(vp);
    const routes = ['#/', '#/timeline', '#/quiz', '#/issues', '#/search/伯尼尼', '#/search/1/6', ...['zj03','zj01','zj02','wj02','wj09','wj07','wj08','wj01','wj05','wj04','wj06','wj03'].map(i => '#/t/' + i)];
    for (const r of routes) {
      await page.goto(url + r); await new Promise(z => setTimeout(z, 250));
      const info = await page.evaluate(() => ({ secs: document.querySelectorAll('.sec').length, err: !!document.querySelector('.err'), len: document.querySelector('#view').textContent.length,
        overflow: document.documentElement.scrollWidth - innerWidth }));
      console.log(vp.width, r, JSON.stringify(info));
      if (r.startsWith('#/t/')) {
        // 筛选、遮挡、原图、关系图
        await page.evaluate(() => { const c = [...document.querySelectorAll('.chip[data-fk]')].find(x => x.dataset.fv !== '*'); c && c.click();
          const cm = document.querySelector('.colmask'); cm && cm.click(); const g = document.querySelector('.rg-g'); g && g.click(); const p = document.querySelector('.rg-p'); p && p.click();
          const bd = document.querySelector('[data-band="x"]'); bd && bd.click(); const mq = document.querySelector('[data-mcq] .opt'); mq && mq.click();
          document.querySelector('[data-act="viewer"]').click(); document.querySelector('[data-z="1"]').click(); const im = document.querySelector('[data-img="1"]'); im && im.click();
          document.querySelector('.tp-act [data-act="mask"]').click(); const m = document.querySelector('#view .m'); m && m.dispatchEvent(new MouseEvent('click',{bubbles:true})); document.querySelector('[data-act="revall"]').click();
          document.querySelector('[data-act="mask"]').click(); document.querySelector('[data-act="vclose"]').click();
          const iss = document.querySelector('.iss[data-iss]'); iss && iss.click(); });
        await new Promise(z => setTimeout(z, 150));
        const paths = await page.evaluate(() => [...document.querySelectorAll('.rg-s path')].length);
        if (paths) console.log('   rg paths', paths);
      }
    }
    // quiz flow
    await page.goto(url + '#/quiz'); await page.evaluate(() => document.querySelector('[data-deck="zj03"]').click());
    await page.evaluate(() => { document.querySelector('[data-qa="flip"]').click(); document.querySelector('[data-qa="ok"]').click(); });
    await page.evaluate(() => document.querySelector('[data-deck="wj07"]').click()); await page.evaluate(() => { document.querySelector('#qz .opt').click(); document.querySelector('#qz .fc-res .btn').click(); });
    console.log('quiz ok', await page.evaluate(() => localStorage.getItem('jzs.quiz')));
    await page.evaluate(() => localStorage.clear());
  }
  console.log('ERRORS', errs.length, errs.slice(0, 20)); console.log('BAD', bad.length, bad.slice(0, 10));
  await b.close();
})();
