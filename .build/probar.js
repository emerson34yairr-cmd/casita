/* Banco de pruebas: abre el juego de verdad en Chromium y comprueba cosas.
 * uso:  node .build/probar.js [ruta-html] [carpeta-de-capturas]
 * Se prueba sobre casita-fuente.html (no hace falta regenerar para probar).  */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const ARCHIVO = process.argv[2] || '/workspace/casita/casita-fuente.html';
const OUT = process.argv[3] || '/workspace/casita/.build/capturas';
require('fs').mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

  // el fuente pide three.js al CDN; aqui no hay red, asi que se sirve el local
  await page.route('**/three.min.js', r =>
    r.fulfill({ contentType: 'application/javascript',
                body: require('fs').readFileSync('/workspace/casita/.build/three-inline.html','utf8')
                        .replace(/^<script>/,'').replace(/<\/script>\s*$/,'') }));

  await page.goto('file://' + ARCHIVO, { waitUntil: 'load', timeout: 120000 });
  await page.addStyleTag({ content: '*{transition:none !important}' });
  await page.waitForFunction(() => { const b = document.getElementById('entrar'); return b && !b.disabled; },
                             { timeout: 300000 });
  await page.click('#entrar');
  await page.waitForFunction(() => window.juego && window.juego.persona, { timeout: 120000 });
  await page.waitForTimeout(6000);

  module.exports = { page, browser, errs };
  global.__pruebas = { page, browser, errs, OUT };

  const guion = process.env.GUION;
  if (guion) await require(guion)({ page, browser, errs, OUT });

  await page.screenshot({ path: `${OUT}/juego.png` });
  console.log('ERRORES DE CONSOLA:', errs.length ? errs.slice(0, 8).join(' | ') : 'ninguno');
  console.log(errs.length ? 'FALLO' : 'OK');
  await browser.close();
  process.exit(errs.length ? 1 : 0);
})();
