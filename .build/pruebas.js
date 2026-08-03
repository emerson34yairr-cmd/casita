/* Pruebas de lo que se añadió: orilla, pesca, guardado y gato autónomo.
   Abre el juego de verdad en Chromium y lo toca; no comprueba que el código
   "parezca" correcto, comprueba lo que hace.                                  */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const OUT = '/workspace/casita/.build/capturas';
fs.mkdirSync(OUT, { recursive: true });
const THREE_JS = fs.readFileSync('/workspace/casita/.build/three-inline.html', 'utf8')
  .replace(/^<script>/, '').replace(/<\/script>\s*$/, '');

const r = [];
const ok = (q, c, det) => { r.push({ q, c, det }); console.log(`${c ? '  OK  ' : ' FALLO'} ${q}${det ? '  — ' + det : ''}`); };

async function nuevaPagina(browser, borrarAlmacen) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 720 } });
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', e => page.errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') page.errs.push('CONSOLE: ' + m.text()); });
  await page.route('**/three.min.js', ro =>
    ro.fulfill({ contentType: 'application/javascript', body: THREE_JS }));
  return { ctx, page };
}

async function entrar(page) {
  await page.goto('file:///workspace/casita/casita-fuente.html', { waitUntil: 'load', timeout: 120000 });
  await page.addStyleTag({ content: '*{transition:none !important}' });
  await page.waitForFunction(() => { const b = document.getElementById('entrar'); return b && !b.disabled; },
                             { timeout: 300000 });
  await page.click('#entrar');
  await page.waitForFunction(() => window.juego && window.juego.persona && window.juego.casa, { timeout: 120000 });
  await page.waitForTimeout(2500);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });

  /* ============ 1. la orilla existe y está sobre arena ============ */
  let { ctx, page } = await nuevaPagina(browser);
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await entrar(page);

  const orilla = await page.evaluate(() => {
    const c = juego.casa.conchas || [];
    return {
      cuantas: c.length,
      clases: [...new Set(c.map(m => m.cosa))].sort(),
      // ¿están todas sobre arena que asome del agua?
      sobreArena: c.every(m => {
        const h = juego.world.height(Math.floor(m.x), Math.floor(m.z));
        return h > 10 && h <= 11;            // SEA_LEVEL=10, playa = h<=SEA_LEVEL+1
      }),
      // ¿repartidas por la costa, o amontonadas?
      angulos: new Set(c.map(m => Math.round(Math.atan2(m.z, m.x) / Math.PI * 8))).size,
      radios: c.map(m => Math.round(Math.hypot(m.x, m.z))),
    };
  });
  ok('se siembran cosas en la orilla', orilla.cuantas >= 20, `${orilla.cuantas} repartidas`);
  ok('hay de las tres clases', orilla.clases.length === 3, orilla.clases.join(', '));
  ok('todas sobre arena fuera del agua', orilla.sobreArena);
  ok('repartidas por toda la costa', orilla.angulos >= 12, `${orilla.angulos}/16 sectores`);

  /* ============ 2. recoger suma al zurrón ============ */
  const recogida = await page.evaluate(() => {
    const m = juego.casa.conchas.find(c => !c.recogida);
    const antes = juego.inventario[m.cosa] || 0;
    juego.recogerDeOrilla(m);
    return {
      cosa: m.cosa, antes, despues: juego.inventario[m.cosa] || 0,
      invisible: m.grupo.visible === false, marcada: !!m.recogida,
      panel: document.getElementById('zurron').classList.contains('on'),
      texto: document.getElementById('zurron').textContent.trim(),
    };
  });
  ok('recoger suma al zurrón', recogida.despues === recogida.antes + 1, `${recogida.cosa}: ${recogida.antes}→${recogida.despues}`);
  ok('la cosa recogida desaparece', recogida.invisible && recogida.marcada);
  ok('el panel del zurrón aparece', recogida.panel, recogida.texto.replace(/\s+/g, ' '));

  // recogerla otra vez no debe volver a sumar
  const doble = await page.evaluate(() => {
    const m = juego.casa.conchas.find(c => c.recogida);
    const antes = juego.inventario[m.cosa];
    juego.recogerDeOrilla(m);
    return { antes, despues: juego.inventario[m.cosa] };
  });
  ok('recoger dos veces la misma no duplica', doble.antes === doble.despues, `${doble.antes} → ${doble.despues}`);

  /* ============ 3. la pesca da cosas distintas ============ */
  const pesca = await page.evaluate(() => {
    const cuenta = {};
    for (let i = 0; i < 3000; i++) {
      const total = PESCA.reduce((a, c) => a + c.peso, 0);
      let t = Math.random() * total, s = PESCA[PESCA.length - 1];
      for (const c of PESCA) { t -= c.peso; if (t <= 0) { s = c; break; } }
      cuenta[s.cosa] = (cuenta[s.cosa] || 0) + 1;
    }
    return cuenta;
  });
  ok('la pesca da variedad', Object.keys(pesca).length === 7, Object.keys(pesca).join(', '));
  ok('el tesoro es raro de verdad', pesca.tesoro / 3000 < 0.05 && pesca.tesoro > 0,
     `${(pesca.tesoro / 30).toFixed(1)}% de las veces`);
  ok('casi siempre sale algo de comer',
     (pesca.sardina + pesca.dorada + pesca.gamba + pesca.pulpo) / 3000 > 0.6,
     `${((pesca.sardina + pesca.dorada + pesca.gamba + pesca.pulpo) / 30).toFixed(0)}%`);

  // pescar de verdad, por el camino real
  const pescado = await page.evaluate(async () => {
    const m = juego.casa.pescadero;
    juego.persona.x = m.anclaX; juego.persona.z = m.anclaZ;
    juego.pescar(m);
    juego.pescando.espera = 0; juego.pescaTick(0.1); juego.pescaTick(0.1);
    const picaba = juego.pescando && juego.pescando.pica > 0;
    const antes = JSON.stringify(juego.inventario);
    juego.recoger();
    return { picaba, antes, despues: JSON.stringify(juego.inventario), texto: document.getElementById('estado').textContent };
  });
  ok('pescar de verdad anota la pieza', pescado.antes !== pescado.despues, pescado.texto);

  /* ============ 4. el huerto y el zurrón sobreviven a salir y volver ============ */
  const guardado = await page.evaluate(() => {
    juego.casa.parcelas[0].estado = 3; juego.casa.parcelas[0].crece = 0.4;
    juego.casa.parcelas[2].estado = 1; juego.casa.parcelas[2].regada = 30;
    juego.pintarParcela(juego.casa.parcelas[0]);
    juego.guardarPartida();
    return { crudo: localStorage.getItem('casita_partida'), inv: JSON.stringify(juego.inventario) };
  });
  const gj = JSON.parse(guardado.crudo);
  ok('el guardado sube a v3', gj.v === 3, JSON.stringify(gj).slice(0, 130) + '…');
  ok('el huerto va dentro', Array.isArray(gj.h) && gj.h.length === 6, JSON.stringify(gj.h));
  ok('el zurrón va dentro', !!gj.i && Object.keys(gj.i).length > 0, JSON.stringify(gj.i));
  ok('las conchas recogidas van dentro', Array.isArray(gj.c) && gj.c.length >= 1, JSON.stringify(gj.c));

  await page.close(); await ctx.close();

  // recargar de cero con esa partida
  ({ ctx, page } = await nuevaPagina(browser));
  await page.addInitScript(g => { try { localStorage.setItem('casita_partida', g); } catch (e) {} }, guardado.crudo);
  await entrar(page);
  const vuelta = await page.evaluate(() => ({
    p0: [juego.casa.parcelas[0].estado, +juego.casa.parcelas[0].crece.toFixed(2)],
    p2: [juego.casa.parcelas[2].estado, Math.round(juego.casa.parcelas[2].regada)],
    verSe: juego.casa.parcelas[0].etapas[2].visible,
    inv: JSON.stringify(juego.inventario),
    recogidas: (juego.casa.conchas || []).filter(m => m.recogida).length,
    visiblesOk: (juego.casa.conchas || []).every(m => m.grupo.visible === !m.recogida),
  }));
  ok('el huerto vuelve como estaba', vuelta.p0[0] === 3 && vuelta.p2[0] === 1,
     `parcela 0 = ${vuelta.p0}, parcela 2 = ${vuelta.p2}`);
  ok('y además SE VE plantado', vuelta.verSe);
  ok('el zurrón vuelve como estaba', vuelta.inv === guardado.inv, vuelta.inv);
  ok('las conchas recogidas no reaparecen', vuelta.recogidas >= 1 && vuelta.visiblesOk,
     `${vuelta.recogidas} sigue(n) recogida(s)`);
  await page.close(); await ctx.close();

  /* ============ 5. una partida vieja (v2) sigue cargando ============ */
  ({ ctx, page } = await nuevaPagina(browser));
  await page.addInitScript(() => {
    localStorage.setItem('casita_partida', JSON.stringify({
      t: 900, n: { energia: 40, hambre: 30, diversion: 50 }, x: 4, z: 9, v: 2
    }));
  });
  await entrar(page);
  const vieja = await page.evaluate(() => ({
    entro: !!juego.persona && !juego.cargando,
    tiempo: Math.round(juego.tiempo),
    energia: Math.round(juego.necesidades.energia),
    huertoVacio: juego.casa.parcelas.every(m => m.estado === 0),
    zurronVacio: Object.keys(juego.inventario).length === 0,
    panelOculto: !document.getElementById('zurron').classList.contains('on'),
  }));
  // el reloj sigue corriendo entre que entra y que se lee, así que se mira la horquilla
  ok('una partida v2 entra sin romperse', vieja.entro && vieja.tiempo >= 900 && vieja.tiempo < 960,
     `t=${vieja.tiempo} (guardado 900), energía=${vieja.energia}`);
  ok('v2: el huerto arranca vacío', vieja.huertoVacio);
  ok('v2: el zurrón arranca vacío y oculto', vieja.zurronVacio && vieja.panelOculto);
  ok('v2 no deja errores en consola', page.errs.length === 0, page.errs.slice(0, 2).join(' | ') || 'ninguno');
  await page.close(); await ctx.close();

  /* ============ 6. partidas rotas no cuelgan el juego ============ */
  for (const [nom, val] of [['basura', '{{{no es json'], ['a medias', '{"t":100}'],
                            ['huerto corrupto', '{"t":10,"n":{},"h":"no soy lista","i":5,"c":"tampoco","v":3}']]) {
    ({ ctx, page } = await nuevaPagina(browser));
    await page.addInitScript(v => localStorage.setItem('casita_partida', v), val);
    await entrar(page);
    const vivo = await page.evaluate(() => !!window.juego && !!juego.persona && !juego.cargando);
    ok(`partida ${nom} no cuelga el juego`, vivo, page.errs.length ? page.errs[0] : 'sin errores');
    await page.close(); await ctx.close();
  }

  /* ============ 7. el gato va a lo suyo ============ */
  ({ ctx, page } = await nuevaPagina(browser));
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await entrar(page);

  /* OJO con los tiempos: aquí el navegador va por GL de software a pocos fotogramas
     por segundo, y el bucle topa dt a 0,1 s. O sea que el reloj DEL JUEGO avanza
     mucho más despacio que el de la pared. Todo lo que espere algo del juego tiene
     que mirar el reloj del juego (juego.tiempo), no contar segundos reales. */
  const solo = await page.evaluate(async () => {
    const esperar = ms => new Promise(r => setTimeout(r, ms));
    const p = juego.gato;
    const p0 = { x: p.x, z: p.z };
    const hechas = [];
    let movio = 0;
    const t0 = juego.tiempo;
    while (juego.tiempo - t0 < 95 && hechas.length < 3) {   // 95 s de reloj del juego
      await esperar(250);
      if (juego.auto && !hechas.includes(juego.auto.nombre)) hechas.push(juego.auto.nombre);
      movio = Math.max(movio, Math.hypot(p.x - p0.x, p.z - p0.z));
    }
    return { movio: +movio.toFixed(2), hechas, ocio: Math.round(juego.ocio) };
  });
  ok('el gato se mueve solo', solo.movio > 1.5, `se alejó ${solo.movio} bloques`);
  ok('y elige cosas que hacer', solo.hechas.length >= 1, solo.hechas.join(', ') || '(ninguna)');
  await page.screenshot({ path: `${OUT}/gato-solo.png` });

  /* Manda tú: tiene que obedecer al instante.
     Se pulsa una tecla DE VERDAD (page.keyboard), no juego.gato.mando(): el bucle
     llama a leerMando() cada fotograma y reescribe el mando, así que empujarlo desde
     fuera no prueba nada — se pierde antes de que el gato lo mire. */
  const antesDeTocar = await page.evaluate(async () => {
    const esperar = ms => new Promise(r => setTimeout(r, ms));
    const t0 = juego.tiempo;
    while (!juego.auto && juego.tiempo - t0 < 90) await esperar(250);
    const p = juego.gato;
    return { teniaAuto: juego.auto ? juego.auto.nombre : null, pose: p.poseActual,
             estado: p.estado, x: p.x, z: p.z };
  });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2500);
  const trasTocar = await page.evaluate(() => ({
    auto: juego.auto, pose: juego.gato.poseActual, estado: juego.gato.estado,
    x: juego.gato.x, z: juego.gato.z, ruta: !!juego.gato.ruta
  }));
  await page.keyboard.up('KeyW');
  const avanzo = Math.hypot(trasTocar.x - antesDeTocar.x, trasTocar.z - antesDeTocar.z);
  ok('al tocar el mando suelta lo suyo', trasTocar.auto === null,
     `estaba en "${antesDeTocar.teniaAuto || 'nada'}"`);
  ok('y le corta el viaje que llevaba', !trasTocar.ruta);
  ok('y se pone a andar donde le mandas', avanzo > 0.5, `se movió ${avanzo.toFixed(2)} bloques`);

  /* El caso peliagudo: interrumpirlo mientras está TUMBADO al sol. Si no se levanta,
     se desliza por el suelo en postura de dormir. */
  const tumbado = await page.evaluate(async () => {
    const esperar = ms => new Promise(r => setTimeout(r, ms));
    juego.necesidades.energia = 90; juego.necesidades.hambre = 90; juego.necesidades.diversion = 90;
    juego.esNoche = false; juego.ambiente.lluvia = 0;
    juego.ultimaAuto = null;
    juego.auto = null; juego.ocio = 999;
    juego.empezarAuto('sol');                        // que se vaya a tumbar
    const t0 = juego.tiempo;
    while (juego.gato.poseActual !== 'acostado' && juego.tiempo - t0 < 60) await esperar(200);
    return { llegoATumbarse: juego.gato.poseActual === 'acostado', pose: juego.gato.poseActual };
  });
  if (tumbado.llegoATumbarse) {
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(2000);
    const despues = await page.evaluate(() => ({ pose: juego.gato.poseActual, auto: juego.auto }));
    await page.keyboard.up('KeyW');
    ok('se levanta si lo interrumpes tumbado', despues.pose === 'de pie' && despues.auto === null,
       `acostado → ${despues.pose}`);
  } else {
    ok('se levanta si lo interrumpes tumbado', false, `no llegó a tumbarse (pose: ${tumbado.pose})`);
  }

  // la autonomía vuelve sola
  const vuelve = await page.evaluate(async () => {
    const esperar = ms => new Promise(r => setTimeout(r, ms));
    juego.gato.mando(0, 0, 0);
    const t0 = juego.tiempo;
    while (!juego.auto && juego.tiempo - t0 < 90) await esperar(250);
    return { auto: juego.auto ? juego.auto.nombre : null, ocio: Math.round(juego.ocio) };
  });
  ok('la autonomía vuelve sola tras dejarlo', vuelve.auto !== null, vuelve.auto || `ocio=${vuelve.ocio}s`);

  // el gato no acaba en el agua ni dentro de un muro
  const donde = await page.evaluate(async () => {
    const esperar = ms => new Promise(r => setTimeout(r, ms));
    const malos = [];
    const t0 = juego.tiempo;
    while (juego.tiempo - t0 < 120) {
      await esperar(250);
      const p = juego.gato;
      const h = juego.world.height(Math.floor(p.x), Math.floor(p.z));
      if (h <= 10 && p.y < 11) malos.push(`agua en ${p.x.toFixed(0)},${p.z.toFixed(0)}`);
      if (p.y < -1) malos.push('se cayó del mundo');
    }
    return malos;
  });
  ok('no acaba metido en el agua ni fuera del mundo', donde.length === 0, donde.slice(0, 3).join('; ') || 'limpio');

  await page.screenshot({ path: `${OUT}/final.png` });
  ok('sin errores de consola en toda la sesión', page.errs.length === 0,
     page.errs.slice(0, 3).join(' | ') || 'ninguno');
  await page.close(); await ctx.close();

  await browser.close();
  const mal = r.filter(x => !x.c);
  console.log(`\n=== ${r.length - mal.length}/${r.length} pruebas pasan ===`);
  if (mal.length) { console.log('FALLAN:'); mal.forEach(m => console.log('  - ' + m.q + (m.det ? '  (' + m.det + ')' : ''))); }
  process.exit(mal.length ? 1 : 0);
})();
