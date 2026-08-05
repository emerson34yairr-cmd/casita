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
const RECETAS_IDS = ['movil', 'farolillo', 'mojon', 'guirnalda', 'cofre'];

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

  /* Las cosas de la orilla son "muebles" para que el clic las encuentre, pero un
     mueble normal (a) bloquea el paso y (b) le pone a su celda de aproximación la
     altura de la duela de casa. En la playa eso dejaba el suelo cinco bloques en el
     aire. Se comprueban las dos cosas, que no se ven mirando el código. */
  /* Se mira la celda DE LA CONCHA, no la de aproximación: esa cae 0,9 bloques más
     allá y puede ser agua o hierba por derecho propio, que no es cosa nuestra. */
  const navOrilla = await page.evaluate(() => {
    const malAltura = [], bloqueadas = [];
    for (const m of juego.casa.conchas) {
      const suelo = juego.world.height(Math.floor(m.x), Math.floor(m.z)) + 1;
      const dice = juego.nav.altura(m.x, m.z);
      if (Math.abs(dice - suelo) > 0.1)
        malAltura.push(`${m.x.toFixed(0)},${m.z.toFixed(0)}: nav ${dice.toFixed(1)} vs arena ${suelo}`);
      if (!juego.nav.caminable(m.x, m.z)) bloqueadas.push(`${m.x.toFixed(0)},${m.z.toFixed(0)}`);
    }
    return { malAltura, bloqueadas, piso: +PISO.toFixed(2) };
  });
  ok('no levantan el suelo de la playa a la altura de la casa', navOrilla.malAltura.length === 0,
     navOrilla.malAltura.slice(0, 2).join(' · ') || `las 48 a ras de arena (la duela está a ${navOrilla.piso})`);
  ok('se puede andar por encima de ellas', navOrilla.bloqueadas.length === 0,
     navOrilla.bloqueadas.length ? `${navOrilla.bloqueadas.length} celdas bloqueadas` : 'ninguna estorba');

  /* ============ 1b. las tres especies de árbol ============ */
  const bosque = await page.evaluate(() => {
    const B = { hoja: 7, pinocha: 10, troncoP: 11, palma: 12, coco: 13 };
    const cuenta = { hoja: 0, pinocha: 0, troncoP: 0, palma: 0, coco: 0 };
    // dónde crece cada especie: se mira la altura del suelo bajo cada tronco
    const alturas = { frondoso: [], pino: [], palmera: [] };
    for (const ch of juego.world.chunks.values()) {
      if (!ch.data) continue;
      for (let i = 0; i < ch.data.length; i++)
        for (const k in B) if (ch.data[i] === B[k]) cuenta[k]++;
    }
    /* Para saber de qué especie es un árbol hay que mirar AL LADO del tronco, no la
       columna central: el tronco se dibuja después de la copa y la pisa, así que en el
       centro siempre hay madera por muy pino que sea. */
    for (const a of juego.world.arboles) {
      const bx = Math.floor(a.x), bz = Math.floor(a.z);
      const h = juego.world.height(bx, bz);
      let especie = null;
      for (let dy = 2; dy <= 8 && !especie; dy++)
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const v = juego.world.getBlock(bx + dx, h + dy, bz + dz);
          if (v === 10) { especie = 'pino'; break; }
          if (v === 7) { especie = 'frondoso'; break; }
        }
      if (especie) alturas[especie].push(h);
    }
    for (const p of juego.world.palmeras) alturas.palmera.push(juego.world.height(Math.floor(p.x), Math.floor(p.z)));
    // objeto y no array con propiedades colgadas: page.evaluate serializa a JSON y
    // las propiedades sueltas de un array se pierden por el camino
    const rango = v => ({ n: v.length, min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null });
    return { cuenta, palmeras: rango(alturas.palmera), pinos: rango(alturas.pino),
             nPalm: juego.world.palmeras.length, nArb: juego.world.arboles.length };
  });
  ok('hay las tres especies en la isla',
     bosque.cuenta.hoja > 500 && bosque.cuenta.pinocha > 500 && bosque.cuenta.palma > 50,
     `hoja ${bosque.cuenta.hoja} · pinocha ${bosque.cuenta.pinocha} · palma ${bosque.cuenta.palma}`);
  ok('las palmeras salen en la costa', bosque.palmeras.n > 5 && bosque.palmeras.max <= 13,
     `${bosque.palmeras.n} palmeras, alturas ${bosque.palmeras.min}–${bosque.palmeras.max} (el mar está a 10)`);
  ok('los pinos no bajan a la playa', bosque.pinos.n > 10 && bosque.pinos.min > 13,
     `${bosque.pinos.n} pinos, alturas ${bosque.pinos.min}–${bosque.pinos.max}`);
  ok('las palmeras llevan cocos', bosque.cuenta.coco > 0 && bosque.cuenta.troncoP > 50,
     `${bosque.cuenta.coco} cocos en ${bosque.nPalm} palmeras apuntadas`);

  /* Que el árbol no salga del revés. Se lee la columna del tronco de cada pino:
     - arriba tiene que acabar en PINOCHA, no en tronco pelado asomando
     - abajo tiene que verse tronco antes de que empiece la copa
     - y la copa tiene que ser más ancha abajo que arriba, que es lo que la hace cono */
  const pinos = await page.evaluate(() => {
    const malos = { asomaTronco: 0, sinTronco: 0, alReves: 0, n: 0, solos: 0 };
    const ejemplos = [];
    /* La forma de la copa sólo se puede medir en un pino que esté SOLO. Los árboles
       se plantan cada 6 bloques y las copas se entrelazan: la de un vecino ocupa
       celdas que serían de éste (y al revés), así que en un bosque cerrado no hay
       manera de saber en la rejilla dónde acaba uno y empieza el otro. Lo de arriba
       —que no asome el tronco y que se vea por abajo— sí vale para todos, porque mira
       la columna del tronco, que es suya y no se la puede quedar nadie. */
    const vecinos = [...juego.world.arboles, ...juego.world.palmeras];
    const solo = a => !vecinos.some(b => b !== a && Math.hypot(b.x - a.x, b.z - a.z) < 8);
    for (const a of juego.world.arboles) {
      if (a.especie !== 'pino') continue;
      malos.n++;
      const bx = Math.floor(a.x), bz = Math.floor(a.z), h = juego.world.height(bx, bz);
      const col = [];
      for (let y = h + 1; y <= h + 16; y++) col.push(juego.world.getBlock(bx, y, bz));
      const ultimo = col.map((v, i) => [v, i]).filter(([v]) => v !== 0).pop();
      const remate = ultimo ? ultimo[0] : 0;
      if (remate !== 10) { malos.asomaTronco++; if (ejemplos.length < 3) ejemplos.push(`${bx},${bz} remata en ${remate}`); }
      if (col[0] !== 6) malos.sinTronco++;              // el primer bloque debe ser tronco
      /* Cono = la copa llega más lejos abajo que arriba.
         Se mide el ALCANCE (hasta qué distancia llega la pinocha) y se coge el máximo
         de varios niveles, no la anchura de uno solo: los árboles se plantan cada 6
         bloques y las copas se entrelazan, así que un frondoso vecino le roba celdas
         al pino —quedan de HOJA, porque la copa no pisa lo que ya está puesto— y
         contar por nivel daba tres pinos "del revés" que están perfectamente. */
      const alcance = y => { let r = 0;
        for (let d = 1; d <= 3; d++) for (const [dx, dz] of [[d,0],[-d,0],[0,d],[0,-d]])
          if (juego.world.getBlock(bx+dx, y, bz+dz) === 10) r = Math.max(r, d);
        return r; };
      const alto = ultimo ? ultimo[1] + 1 : 0;
      const maxEntre = (a, b) => { let r = 0;
        for (let dy = a; dy <= b; dy++) r = Math.max(r, alcance(h + dy)); return r; };
      const mitad = Math.round(alto / 2);
      if (!solo(a)) continue;
      malos.solos++;
      if (maxEntre(2, mitad) <= maxEntre(mitad + 1, alto))
        { malos.alReves++; if (ejemplos.length < 3) ejemplos.push(`cono ${bx},${bz}`); }
    }
    return { ...malos, ejemplos };
  });
  ok('a los pinos no les asoma el tronco por arriba', pinos.asomaTronco === 0,
     pinos.ejemplos.join(' · ') || `los ${pinos.n} rematan en copa`);
  ok('y se les ve el tronco por abajo', pinos.sinTronco === 0);
  ok('la copa del pino es más ancha abajo que arriba (los que están solos)',
     pinos.solos >= 5 && pinos.alReves === 0,
     pinos.alReves ? `${pinos.alReves} del revés de ${pinos.solos} solos`
                   : `${pinos.solos} pinos sueltos, todos en cono (de ${pinos.n})`);

  const manzanos = await page.evaluate(() => {
    const m = juego.casa.arboles.map(a => {
      const bx = Math.floor(a.x), bz = Math.floor(a.z), h = juego.world.height(bx, bz);
      let pinocha = 0, hoja = 0;
      for (let dy = 2; dy <= 10; dy++) for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0]]) {
        const v = juego.world.getBlock(bx+dx, h+dy, bz+dz);
        if (v === 10) pinocha++; else if (v === 7) hoja++;
      }
      return { pinocha, hoja };
    });
    return { total: m.length, enPino: m.filter(x => x.pinocha > x.hoja).length };
  });
  ok('las manzanas no salen en los pinos', manzanos.enPino === 0,
     `${manzanos.total} manzanos, ${manzanos.enPino} sobre pinocha`);

  /* Cada árbol UNA vez en la lista. plantTrees se llama por chunk y recorre una rejilla
     que se mete en los vecinos, así que sin cuidado cada árbol se apunta 3 ó 4 veces —
     y entonces "los 7 manzanos más cercanos" son 7 muebles encima de 2 árboles. */
  const repetidos = await page.evaluate(() => {
    const un = l => new Set(l.map(a => a.x + ',' + a.z)).size;
    return {
      arboles: [juego.world.arboles.length, un(juego.world.arboles)],
      palmeras: [juego.world.palmeras.length, un(juego.world.palmeras)],
      manzanos: [juego.casa.arboles.length, un(juego.casa.arboles)],
      cocoteros: [juego.casa.cocoteros_.length, un(juego.casa.cocoteros_)],
    };
  });
  const sinRepes = Object.values(repetidos).every(([n, u]) => n === u);
  ok('ningún árbol se apunta dos veces', sinRepes,
     Object.entries(repetidos).map(([k, [n, u]]) => `${k} ${n}/${u}`).join(' · '));

  /* ============ 1c. coger un coco ============ */
  const coco = await page.evaluate(() => {
    const m = juego.casa.cocoteros_[0];
    const bx = Math.floor(m.x), bz = Math.floor(m.z);
    const cerca = () => [[1, 0], [0, 1], [-1, 0], [0, -1]]
      .filter(([dx, dz]) => juego.world.getBlock(bx + dx, m.cocosY, bz + dz) === 13).length;
    const antes = cerca();
    juego.persona.x = m.anclaX; juego.persona.z = m.anclaZ;
    juego.cogerCoco(m);
    const trasCoger = { bloques: cerca(), inv: juego.inventario.coco || 0, maduro: m.maduro,
                        texto: document.getElementById('estado').textContent };
    juego.cogerCoco(m);                       // insistir no debe dar otro
    const insistiendo = juego.inventario.coco || 0;
    m.espera = 0; juego.frutaTick ? juego.frutaTick(1) : null;
    return { antes, ...trasCoger, insistiendo, sitios: (m.sitiosCoco || []).length };
  });
  ok('la palmera tenía cocos puestos en el mundo', coco.antes > 0, `${coco.antes} bloques de coco`);
  ok('coger un coco lo quita del árbol', coco.bloques === 0 && coco.sitios === coco.antes,
     `${coco.antes} → ${coco.bloques} bloques`);
  ok('y el coco va al zurrón', coco.inv === 1, coco.texto);
  ok('insistir en la misma palmera no da otro', coco.insistiendo === 1);

  const cocoVuelve = await page.evaluate(async () => {
    const esperar = ms => new Promise(r => setTimeout(r, ms));
    const m = juego.casa.cocoteros_[0];
    const bx = Math.floor(m.x), bz = Math.floor(m.z);
    m.espera = 0.2;                           // acelerar la espera de vuelta
    const t0 = juego.tiempo;
    while (!m.maduro && juego.tiempo - t0 < 20) await esperar(200);
    return { maduro: m.maduro, bloques: [[1, 0], [0, 1], [-1, 0], [0, -1]]
      .filter(([dx, dz]) => juego.world.getBlock(bx + dx, m.cocosY, bz + dz) === 13).length };
  });
  ok('los cocos vuelven a salir solos', cocoVuelve.maduro && cocoVuelve.bloques > 0,
     `${cocoVuelve.bloques} bloques de vuelta`);

  const cocoSeCome = await page.evaluate(() => {
    juego.inventario = { coco: 1 }; juego.necesidades.hambre = 20;
    juego.pintarInventario();
    const esComible = !!document.querySelector('#zurron li.comible[data-cosa="coco"]');
    juego.comer('coco');
    return { esComible, hambre: Math.round(juego.necesidades.hambre), queda: juego.inventario.coco };
  });
  ok('el coco se come desde el zurrón', cocoSeCome.esComible && cocoSeCome.hambre === 36 && !cocoSeCome.queda,
     `hambre 20 → ${cocoSeCome.hambre}`);

  const conchasLibres = await page.evaluate(() => juego.casa.conchas.filter(m => {
    const h = juego.world.height(Math.floor(m.x), Math.floor(m.z));
    return juego.world.getBlock(Math.floor(m.x), h + 1, Math.floor(m.z)) !== 0;
  }).length);
  ok('ninguna concha quedó dentro de un tronco de palmera', conchasLibres === 0,
     conchasLibres ? `${conchasLibres} atrapadas` : 'las 48 al aire libre');

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

  /* ============ 3b. comerse los bichos del zurrón ============ */
  const comida = await page.evaluate(() => {
    juego.inventario = { dorada: 2, bota: 1, globo: 1 };
    juego.necesidades.hambre = 30;
    juego.pintarInventario();
    const comibles = [...document.querySelectorAll('#zurron li.comible')].map(li => li.dataset.cosa);
    const noComibles = [...document.querySelectorAll('#zurron li:not(.comible)')].map(li => li.dataset.cosa);
    document.querySelector('#zurron li.comible').click();       // como si tocaras el pez
    return { comibles, noComibles, hambre: Math.round(juego.necesidades.hambre),
             quedan: juego.inventario.dorada, texto: document.getElementById('estado').textContent };
  });
  ok('sólo los bichos se pueden comer', comida.comibles.join() === 'dorada' && comida.noComibles.sort().join() === 'bota,globo',
     `comibles: ${comida.comibles} · no: ${comida.noComibles}`);
  ok('comerse un pez quita hambre', comida.hambre === 60, `30 → ${comida.hambre}`);
  ok('y lo descuenta del zurrón', comida.quedan === 1, `quedaba(n) ${comida.quedan}`);

  const ultimo = await page.evaluate(() => {
    document.querySelector('#zurron li.comible').click();       // la segunda y última
    return { hay: 'dorada' in juego.inventario, comibles: document.querySelectorAll('#zurron li.comible').length };
  });
  ok('al comerse el último desaparece del zurrón', !ultimo.hay && ultimo.comibles === 0);

  const pezNo = await page.evaluate(() => {
    juego.inventario = { globo: 1 };
    juego.necesidades.hambre = 40;
    juego.comer('globo');                       // el pez globo no alimenta
    juego.comer('sardina');                     // y de esta no tenemos ninguna
    return { hambre: Math.round(juego.necesidades.hambre), globo: juego.inventario.globo };
  });
  ok('no se come lo que no alimenta ni lo que no tienes', pezNo.hambre === 40 && pezNo.globo === 1);

  /* ============ 3c. el taller ============ */
  const taller = await page.evaluate(() => {
    juego.inventario = { concha: 3, piedra: 1 };
    juego.fabricados = [];
    juego.pintarInventario();
    juego.verTaller(true);
    const filas = [...document.querySelectorAll('.receta')];
    const botones = filas.map(f => { const b = f.querySelector('button'); return b ? !b.disabled : null; });
    return {
      abierto: document.getElementById('taller').classList.contains('on'),
      recetas: filas.length,
      // con 3 conchas y 1 piedra sólo debería poder hacerse el móvil
      sePuede: botones, nombres: filas.map(f => f.querySelector('.nom').textContent),
      botonVisible: document.getElementById('abrirTaller').classList.contains('on'),
    };
  });
  ok('el taller abre con todas las recetas', taller.abierto && taller.recetas === 5, taller.nombres.join(' · '));
  ok('sólo deja hacer lo que alcanza el material', JSON.stringify(taller.sePuede) === '[true,false,false,false,false]',
     taller.sePuede.map((s, i) => (s ? '✓' : '✗') + taller.nombres[i].split(' ')[0]).join(' '));
  ok('el botón del taller aparece al tener material', taller.botonVisible);

  const hecho = await page.evaluate(() => {
    document.querySelector('.receta button[data-receta="movil"]').click();
    return {
      fabricados: juego.fabricados.slice(),
      inv: JSON.stringify(juego.inventario),
      hayAdorno: !!(juego.casa.adornos && juego.casa.adornos.movil),
      enEscena: !!(juego.casa.adornos && juego.casa.adornos.movil.parent),
      filaHecha: document.querySelector('.receta').classList.contains('hecha'),
      texto: document.getElementById('estado').textContent,
    };
  });
  ok('fabricar deja el adorno puesto en la casa', hecho.hayAdorno && hecho.enEscena, hecho.texto);
  ok('y gasta el material', hecho.inv === '{}', `zurrón: ${hecho.inv}`);
  ok('y la receta queda marcada como hecha', hecho.filaHecha && hecho.fabricados.join() === 'movil');

  const repe = await page.evaluate(() => {
    juego.inventario = { concha: 9, piedra: 9 };
    const ok1 = juego.fabricar('movil');            // ya está hecho
    const ok2 = juego.fabricar('inventado');        // no existe
    juego.inventario = { piedra: 1 };
    const ok3 = juego.fabricar('mojon');            // hacen falta 4
    return { ok1, ok2, ok3, veces: juego.fabricados.filter(x => x === 'movil').length };
  });
  ok('no se puede fabricar dos veces lo mismo', repe.ok1 === false && repe.veces === 1);
  ok('ni una receta que no existe, ni sin material', repe.ok2 === false && repe.ok3 === false);
  await page.evaluate(() => juego.verTaller(false));

  /* ============ 4. el huerto y el zurrón sobreviven a salir y volver ============ */
  const guardado = await page.evaluate(() => {
    juego.casa.parcelas[0].estado = 3; juego.casa.parcelas[0].crece = 0.4;
    juego.casa.parcelas[2].estado = 1; juego.casa.parcelas[2].regada = 30;
    juego.pintarParcela(juego.casa.parcelas[0]);
    juego.inventario = { piedra: 1, dorada: 1 };      // algo que comprobar a la vuelta
    juego.guardarPartida();
    return { crudo: localStorage.getItem('casita_partida'), inv: JSON.stringify(juego.inventario) };
  });
  const gj = JSON.parse(guardado.crudo);
  ok('el guardado sube a v4', gj.v === 4, JSON.stringify(gj).slice(0, 130) + '…');
  ok('lo fabricado va dentro', Array.isArray(gj.f) && gj.f.join() === 'movil', JSON.stringify(gj.f));
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
    fabricados: juego.fabricados.slice(),
    adornoPuesto: !!(juego.casa.adornos && juego.casa.adornos.movil && juego.casa.adornos.movil.parent),
    recetaHecha: (() => { juego.verTaller(true);
      const f = document.querySelector('.receta'); const r = f && f.classList.contains('hecha');
      juego.verTaller(false); return r; })(),
  }));
  ok('el huerto vuelve como estaba', vuelta.p0[0] === 3 && vuelta.p2[0] === 1,
     `parcela 0 = ${vuelta.p0}, parcela 2 = ${vuelta.p2}`);
  ok('y además SE VE plantado', vuelta.verSe);
  ok('el zurrón vuelve como estaba', vuelta.inv === guardado.inv, vuelta.inv);
  ok('las conchas recogidas no reaparecen', vuelta.recogidas >= 1 && vuelta.visiblesOk,
     `${vuelta.recogidas} sigue(n) recogida(s)`);
  ok('el adorno fabricado sigue puesto al volver',
     vuelta.fabricados.join() === 'movil' && vuelta.adornoPuesto && vuelta.recetaHecha,
     `fabricados: ${vuelta.fabricados}`);
  await page.close(); await ctx.close();

  /* ============ 4b. los cinco adornos se montan sin romper nada ============ */
  ({ ctx, page } = await nuevaPagina(browser));
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await entrar(page);
  const todos = await page.evaluate(() => {
    const r = {};
    // por ponerAdorno, que es lo que usa el juego: monta la pieza Y avisa a la navegación
    for (const rec of RECETAS) {
      juego.ponerAdorno(rec);
      const g = juego.casa.adornos[rec.id];
      r[rec.id] = { montado: !!g, enEscena: !!(g && g.parent), hijos: g ? g.children.length : 0 };
    }
    const dosVeces = juego.casa.adorno('movil', juego.world) === juego.casa.adornos.movil;
    // ¿alguno se quedó bajo tierra o flotando en el cielo?
    const alturas = Object.values(juego.casa.adornos).map(g => {
      const b = new THREE.Box3().setFromObject(g);
      return { min: +b.min.y.toFixed(1), max: +b.max.y.toFixed(1) };
    });
    return { r, dosVeces, alturas, luces: juego.casa.luces.length };
  });
  const todosOk = RECETAS_IDS.every(id => todos.r[id].montado && todos.r[id].enEscena && todos.r[id].hijos > 0);
  ok('los cinco adornos se montan', todosOk,
     Object.entries(todos.r).map(([k, v]) => k + (v.enEscena ? '✓' : '✗')).join(' '));
  ok('montar el mismo dos veces no lo duplica', todos.dosVeces);
  ok('ninguno queda bajo tierra ni flotando',
     todos.alturas.every(a => a.min > 14 && a.max < 28),
     todos.alturas.map(a => a.min + '–' + a.max).join(', '));
  ok('el farolillo añade su luz', todos.luces >= 3, `${todos.luces} luces en la casa`);

  // los que ocupan sitio tienen que estorbar, como cualquier mueble
  const navAdornos = await page.evaluate(() => {
    const r = {};
    for (const rec of RECETAS) {
      if (!rec.estorba) { r[rec.id] = 'no ocupa (cuelga)'; continue; }
      const cx = (rec.estorba[0] + rec.estorba[2]) / 2, cz = (rec.estorba[1] + rec.estorba[3]) / 2;
      r[rec.id] = juego.nav.caminable(cx, cz) ? 'SE ATRAVIESA' : 'estorba ok';
    }
    return r;
  });
  ok('no se atraviesan los adornos que ocupan sitio',
     !Object.values(navAdornos).includes('SE ATRAVIESA'),
     Object.entries(navAdornos).map(([k, v]) => k + ': ' + v).join(' · '));
  await page.screenshot({ path: `${OUT}/adornos.png` });
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
    sinFabricar: juego.fabricados.length === 0,
    tallerOculto: !document.getElementById('abrirTaller').classList.contains('on'),
  }));
  // el reloj sigue corriendo entre que entra y que se lee, así que se mira la horquilla
  ok('una partida v2 entra sin romperse', vieja.entro && vieja.tiempo >= 900 && vieja.tiempo < 960,
     `t=${vieja.tiempo} (guardado 900), energía=${vieja.energia}`);
  ok('v2: el huerto arranca vacío', vieja.huertoVacio);
  ok('v2: el zurrón arranca vacío y oculto', vieja.zurronVacio && vieja.panelOculto);
  ok('v2: sin nada fabricado y sin botón de taller', vieja.sinFabricar && vieja.tallerOculto);
  ok('v2 no deja errores en consola', page.errs.length === 0, page.errs.slice(0, 2).join(' | ') || 'ninguno');
  await page.close(); await ctx.close();

  /* ============ 6. partidas rotas no cuelgan el juego ============ */
  for (const [nom, val] of [['basura', '{{{no es json'], ['a medias', '{"t":100}'],
                            ['huerto corrupto', '{"t":10,"n":{},"h":"no soy lista","i":5,"c":"tampoco","v":3}'],
                            ['recetas inventadas', '{"t":10,"n":{},"f":["noexiste","movil","noexiste"],"v":4}']]) {
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
