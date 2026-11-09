const puppeteer = require('puppeteer');
(async () => { const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); const [,, route, out, w, h, js, full] = process.argv;
  await p.setViewport({ width: +w, height: +h, deviceScaleFactor: 1, isMobile: +w < 700, hasTouch: +w < 700 });
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html') + route); await new Promise(z => setTimeout(z, 400));
  if (js) { await p.evaluate(js); await new Promise(z => setTimeout(z, 900)); }
  await p.screenshot({ path: out, fullPage: full === '1' }); await b.close(); })();
