/* Comprueba la sintaxis de cada <script> incrustado en casita-fuente.html. */
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2] || '/workspace/casita/casita-fuente.html', 'utf8');
const bloques = [...src.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)];
let malos = 0;
bloques.forEach((m, i) => {
  const linea = src.slice(0, m.index).split('\n').length;
  try { new vm.Script(m[1], { filename: `bloque${i + 1}` }); }
  catch (e) { malos++; console.log(`FALLO bloque ${i + 1} (empieza en la linea ${linea}): ${e.message}`); }
});
console.log(`${bloques.length - malos}/${bloques.length} bloques de script OK`);
process.exit(malos ? 1 : 0);
