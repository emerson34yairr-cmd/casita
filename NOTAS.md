# Notas de la casita

Cómo funciona por dentro, con qué me tropecé, y qué falta. Escrito para que dentro de tres
meses cualquiera (yo incluido) pueda retomarlo sin volver a averiguar lo mismo.

---

## El mapa del archivo

Todo vive en `casita-fuente.html`. Por orden:

| Zona | Qué hace |
|---|---|
| Constantes | tamaño del mundo, nivel del mar, la casa, largo del día (`DAY_LENGTH = 600` s) |
| `Assets` | dibuja **todas** las texturas a mano en canvas y las mete en un atlas 5×5 |
| `Constructor` | monta geometría en cajas con el mismo atlas pixelado del terreno |
| `World` | genera la isla por chunks, malla solo las caras expuestas, guarda dónde quedó cada árbol |
| `Casa` | la casa, los muebles, el hogar, el huerto, los manzanos y el muelle |
| `Nav` | por dónde se puede andar |
| `Personaje` / `Ptera` | el gato y la ptera, con sus poses |
| `CamaraIso` / `CamaraPrimera` | las dos cámaras |
| `Ambiente` | cielo, sol, luciérnagas, mariposas, nubes, humo y lluvia |
| `Sonido` | todo sintetizado con WebAudio, sin un solo archivo de audio |
| `Juego` | el bucle, la interfaz, el guardado y las interacciones |

## Decisiones que conviene no deshacer

**Three.js va incrustado, no desde un CDN.** El juego se publica en sitios con CSP estricta
(los artifacts de Claude, por ejemplo) donde un `<script src="https://cdn...">` no carga y la
pantalla se queda en la portada **sin ningún error visible**. Por eso `index.html` lleva la
librería dentro. Para regenerarlo desde el fuente: sustituir la etiqueta del CDN por
`<script>` + el contenido de three.js r128, y quitar `<!DOCTYPE>`, `<html>`, `<head>` y
`<body>` si el destino envuelve el contenido en su propio esqueleto.

**Nada de archivos externos.** Ni texturas, ni fuentes, ni sonidos. Todo se dibuja en canvas
o se sintetiza. Es lo que permite que el juego sea un archivo suelto.

**El teléfono baja la calidad solo.** `ES_MOVIL` limita el pixel ratio a 1.6, apaga el
antialias, usa sombras baratas y reduce nubes, humo, mariposas y gotas de lluvia. No quitarlo.

## Tropiezos ya resueltos (no repetirlos)

- **Un `Points` de three.js dibuja siempre un CUADRADO.** La textura de la gota de lluvia era
  de 4×16 y se estiraba hasta quedar un puntito borroso invisible. La raya hay que pintarla
  dentro de una textura **cuadrada**.
- **El material del atlas es `transparent:true`** y, pegado a un muro de los que se recortan,
  desaparece. El hogar se construye con cajas de material opaco justo por eso.
- **El hueco de una chimenea tiene que ser hueco de verdad**: fondo + dos jambas + dintel. Una
  caja oscura "de relleno" dentro tapa el fuego.
- **`(pointer: coarse)` no basta** para decidir si es un aparato táctil: un portátil con
  pantalla táctil daba positivo y salía la interfaz de dedo. Ahora también se mira que no haya
  un puntero fino **con hover** (así un iPad con lápiz sigue contando como táctil).
- **Chrome headless con tiempo virtual congela las transiciones CSS.** Las capturas parecían
  decir que el modo foto no funcionaba: se quedaba siempre en el primer fotograma del fundido.
  Para hacer capturas fiables hay que inyectar `* { transition: none !important }`.
- **El muro de teclas de PC en el móvil** era lo que más afeaba: ahora la ayuda depende del
  aparato, se aparta sola a los 15 s y vuelve con el botón `?`.

## Hasta dónde aguanta la isla (medido, 2 de agosto de 2026)

La isla **4 veces más grande** pasó a ser la principal (probada en iPhone: se ve bien y no va
lenta). La original se quedó en `pequena/`, por si hace falta comparar. Se midió con un banco
de pruebas (Chrome headless, GL por software) que rehace la isla entera de una sentada y lee
`renderer.info`:

| | `pequena/` | **la de ahora** | probada también |
|---|---|---|---|
| `WORLD_CHUNKS` / `ISLA_R` | 5 / 54 | **10 / 110** | 16 / 190 |
| Chunks | 100 | 400 | 1024 |
| Trabajo de CPU para montar la isla | 100 ms | 327 ms | ~900 ms |
| Rejilla de navegación (`Nav`, va de golpe) | 15 ms | 159 ms | 263 ms |
| Memoria (heap JS) | 39 MB | 91 MB | **206 MB** |
| **Draw calls** | 114 | **123** | **117** |
| Triángulos por fotograma | 61 716 | 60 570 | 64 070 |

**Lo que hay que quedarse:** dibujar cuesta lo mismo con la isla grande. Three.js descarta lo
que no entra en cámara, así que los chunks de más solo ocupan memoria; los fotogramas no se
enteran. Lo que crece es la **carga** y la **memoria**.

- El techo práctico es la **memoria**: a radio 190 son 206 MB de heap y Safari en iPhone mata
  pestañas por ahí. Radio 110 (91 MB) va sobrado.
- La carga está troceada (`stream()`, 8 ms por fotograma en móvil), así que no congela: solo
  tarda más la barra.
- **`Nav.construir` sí es un tirón de golpe** al acabar de cargar: recorre el mundo entero dos
  veces. A radio 190 son 263 ms de parón. Si algún día se crece más, esto es lo primero que
  hay que trocear.
- Para ir **más allá** de radio ~150 hay que enganchar `stream()` al bucle del juego y
  descargar los chunks lejanos. La mitad está hecha: la función ya trocea por milisegundos,
  solo se llama una vez, al arrancar.

Una isla grande **no vale solo con subir el radio**: a radio 110 salía un disco de galleta,
plano y con el bosque igual de espeso en todas partes. Por eso lleva además costa ondulada
(un `fbm` que mueve el radio ±22), cerros de verdad (`WORLD_HEIGHT` a 48 para que quepan) y
densidad de árboles por zonas, para que haya claros y bosque cerrado.

## El icono de la pantalla de inicio no se actualizaba

Pasó de verdad: se republicó el juego y el icono que estaba añadido a la pantalla de inicio
del iPhone seguía abriendo la versión vieja. Dos cosas lo causaban y las dos están arregladas:

1. **La versión nueva estaba en otra URL** (`/casita/grande/`), y el icono apuntaba a
   `/casita/`. Ahora la buena vive en la raíz y `grande/` solo redirige.
2. **La caché de un web app en iOS es muy pegajosa.** Ahora hay un `sw.js` que va **primero a
   la red** y solo tira de caché si no hay conexión, así que abrir el icono siempre trae lo
   último. Si alguna vez se quiere lo contrario (que cargue instantáneo aunque esté viejo),
   es ahí donde hay que cambiarlo — pero entonces vuelve el problema.

`app.webmanifest` + `apple-touch-icon.png` son lo que le dan icono propio y pantalla completa.
El icono se genera con Pillow a 32×32 y se amplía con NEAREST (`icono.py` en el scratchpad),
para que salga de bloques como el juego.

**Ojo:** un web app ya añadido a la pantalla de inicio **antes** de que existiera el
`sw.js` no se entera. Hay que borrarlo de la pantalla y volver a añadirlo una vez; a partir
de ahí se actualiza solo.

## Cómo se compila y cómo se prueba (nuevo)

`casita-fuente.html` es **lo único que se edita**. `index.html` se genera:

```sh
./.build/construir.sh          # mete three.js incrustado y escribe index.html
node .build/revisar.js         # sintaxis de los <script> de dentro
node .build/probar.js          # abre el juego en Chromium de verdad y mira si peta
node .build/pruebas.js         # las pruebas de las cosas: orilla, pesca, guardado, gato
```

Lo único que hace `construir.sh` es sustituir la etiqueta del CDN de three.js por la
librería entera (`.build/three-inline.html`). Comprobado: partiendo del fuente sin tocar,
reproduce el `index.html` publicado byte por byte.

**Trampa de las pruebas en Chromium:** aquí no hay tarjeta gráfica, se renderiza por
software a pocos fotogramas por segundo, y el bucle topa `dt` a 0,1 s. Resultado: el reloj
**del juego** avanza unas 4 veces más despacio que el de la pared. Cualquier prueba que
espere algo del juego tiene que mirar `juego.tiempo`, no contar segundos reales. Se perdió
un rato persiguiendo un fallo de la autonomía del gato que no existía: era la prueba, que
esperaba 23 s reales creyendo que eran 23 s de juego (eran 4).

## Los árboles se apuntaban tres veces (bug viejo)

`plantTrees` se llama **por cada chunk** y recorre una rejilla de celdas que se mete en
los vecinos, para que los árboles que caen en un borde salgan enteros. `put()` recorta los
bloques que no son de este chunk — pero el `arboles.push` no se recortaba, así que cada
árbol acababa en la lista tres o cuatro veces: **871 apuntes para 251 árboles**.

Se notaba de verdad, y llevaba así desde siempre: `manzanos()` coge "los 7 más cercanos" y
eran **7 muebles encima de 2 árboles**, con cinco racimos de manzanas superpuestos en el
mismo sitio y seis avisos de fruta madura por árbol.

El arreglo es una línea: el tronco sólo cae en un chunk, y ése es el dueño del apunte
(`suyo`). Si algún día se apunta otra cosa desde `plantTrees`, acordarse.

## Las tres especies de árbol

Cada una donde le toca, no repartidas al azar: al azar por toda la isla quedaba a puré.

| | Dónde | Cómo |
|---|---|---|
| Frondoso | en medio | copa redonda, `WOOD` + `LEAVES` |
| Pino | `h >= SEA_LEVEL+11`, y un 26 % del bosque | cono a pisos, más alto, `PINOCHA` |
| Palmera | `h <= SEA_LEVEL+3` (la costa) | tronco pelado + penacho, `TRONCO_P` + `PALMA` |

**Para saber de qué especie es un árbol hay que mirar AL LADO del tronco.** El tronco se
dibuja después de la copa y la pisa, así que en la columna central siempre hay madera por
muy pino que sea. Una prueba se pasó un rato diciendo que no había pinos por esto.

Los cocos son **bloques del mundo** (`COCO`), no una malla colgada como las manzanas: al
coger uno desaparece del árbol de verdad. Eso pidió un `World.setBlock` que no existía.
**Ojo al chunk vecino**: la malla de cada uno mira una capa de bloques de alrededor
(`fillPadded`), así que tocar un bloque del borde deja al de al lado con un agujero o una
cara de más. `setBlock` lo remalla si hace falta.

## Dos trampas de Nav que costaron sangre

**Un "mueble" hace más de lo que parece.** Las cosas de la orilla se montaron como
muebles para que el clic de siempre las encontrara sin tocar el sistema de toques. Pero
`Nav.construir` hace dos cosas con cada mueble:

1. `bloquear(m.rect)` — deja de ser caminable.
2. `abrir(m.anclaX ± 0.4, …, PISO)` — **le pone a su celda de aproximación la altura
   `PISO`**, que es la duela de dentro de casa (17,06).

Lo segundo nunca había molestado porque todos los muebles de fuera que existían
(manzanos, huerto, muelle) están en la explanada de la casa, justo a la altura de `PISO`.
Las conchas fueron lo primero que se puso lejos: la playa está a 12, así que 48 celdas de
arena se quedaban **cinco bloques en el aire** y el gato se subía al vacío al acercarse.

Arreglado con la marca `noEstorba: true`, que salta las dos cosas. Si algún día se pone
otro mueble lejos de la casa, acordarse de esto.

**Los adornos fabricados sí tienen que estorbar.** No son muebles, así que no entran en la
rejilla: el gato los atravesaba, y eso choca con que la cama y el sofá sí paren. Los que
ocupan sitio llevan un `estorba: [x0,z0,x1,z1]` en su receta y `ponerAdorno()` se lo pasa a
`nav.bloquear`. Se **retoca** la rejilla en vez de rehacerla: `Nav.construir` recorre el
mundo entero dos veces, son ~160 ms de parón, y es un tirón feo por poner una torrecita de
piedras. El móvil y la guirnalda no llevan hueco porque cuelgan.

## El zurrón, el taller y el guardado v4

El inventario dejó de ser un contador. Dos cosas lo usan:

**Comer.** Pescar ya NO alimenta al sacar la pieza: el pez se guarda y te lo comes tocándolo
en el zurrón (`juego.comer`). Pescar da la alegría, comer da la comida. Lo que alimenta va
en el campo `alimenta` de `COSAS`; lo que no lo lleva no se puede comer (el pez globo).

**El taller** (`RECETAS`, botón 🔨 o tecla T). Cada receta se hace **una vez**: son adornos
con sitio fijo, y así juntarlo todo es una colección con final. Al fabricar se gasta el
material, se monta la pieza y se guarda.

Para añadir una receta: una entrada en `RECETAS` + su rama en `Casa.adorno()`. Si ocupa
sitio en el suelo, ponerle `estorba`. El id se guarda en la partida: cambiarle el nombre a
uno rompe las partidas guardadas.

El formato de `casita_partida` pasó de `v:2` a `v:4`. Lo nuevo: `h` (el huerto, parcela a
parcela), `i` (el zurrón), `c` (qué cosas de la orilla ya se recogieron, por su número) y
`f` (los adornos fabricados, por su id: sólo el id, la geometría se remonta al entrar).

**Una partida `v:2` tiene que seguir cargando**, con el huerto sin plantar y el zurrón
vacío. Cada bloque de `restaurarPartida` comprueba antes de tocar nada, y hay pruebas que
meten a mano una partida vieja, una partida a medias y una partida con basura dentro.

Todo lo que se recoja o se pesque **tiene que pasar por `juego.anotar(cosa)`**: es lo único
que suma al zurrón, repinta el panel y guarda. Si algo suma por su cuenta, no se guardará.
Las claves del inventario son las de `COSAS`: cambiarle el nombre a una rompe las partidas
guardadas, añadir una nueva no.

## Cosas de la orilla

La arena que asoma del agua es una franja de **un bloque de alto** (`h === SEA_LEVEL + 1`;
por encima ya es hierba), y la costa ondula ±22 bloques. Buscar sitio a radio fijo dejaba
media playa vacía: salían 14 de 48 y agrupadas en 9 de los 16 sectores. Ahora se recorre el
contorno entero (720 ángulos) apuntando dónde hay arena, y luego se reparten las cosas por
esa lista.

El sitio de cada una sale de `hash01`, **no de `Math.random`**: tiene que ser el mismo en
cada partida para poder guardar "la número 7 ya la recogí".

## Lo que voy a hacer (por orden)

- [x] ~~Que el gato haga cosas solo~~ — hecho: tras 8 s sin que toques nada elige según sus
      necesidades (dormir, comer, arrimarse al fuego, sofá, tomar el sol, mirar el mar,
      pasear), con pesos y sin repetir lo anterior. **La regla que manda: en cuanto tocas
      algo, `tocado()` lo corta en el mismo fotograma.** Si estaba tumbado, se levanta —
      sin eso se deslizaba por el suelo en postura de dormir.
- [x] ~~Recoger conchas y piedras en la playa~~ — hecho: conchas, piedras y estrellas de mar.
- [x] ~~Que la pesca dé cosas distintas~~ — hecho: cinco bichos, la bota y el tesoro (3 %).
- [x] ~~Guardar también el huerto~~ — hecho, en el formato v:3.
- [x] ~~Que lo del zurrón sirva para algo~~ — hecho: los bichos se comen tocándolos, y con
      conchas, piedras, estrellas y el tesoro se fabrican cinco adornos para la casa.
- [x] ~~Árboles de más de una clase, y uno con fruta~~ — hecho: pinos, palmeras y el
      frondoso de siempre; las palmeras dan cocos.
- [ ] **Una receta que use cocos**: son la única cosa del zurrón que no sirve para
      fabricar. Una maceta, o un cuenco.
- [ ] **Más recetas**: ahora son cinco y se acaban. Un banco para el porche, una alfombra,
      un farol para dentro. Añadir una es una entrada en `RECETAS` y su rama en
      `Casa.adorno()`.
- [ ] **Que el cofre se abra** y enseñe de verdad lo que llevas dentro: ahora es un adorno.
- [ ] **Más muebles usables**: estantería para leer, ducha, escritorio.
- [ ] **Estaciones o al menos un otoño**: las hojas de los árboles tirando a naranja según el día.
- [ ] **Un diario de la casa**: "día 4, llovió, cosechaste dos tomates".
- [ ] **Sonido de pasos** según el suelo que pisas (hierba, madera, arena).

## Ideas para más adelante

- Muebles que se puedan mover y colocar
- Visitas: alguien que llega en barca de vez en cuando
- Un segundo islote al que ir volando con la ptera
- Fotos del modo foto que se puedan descargar

## Cómo probar cambios sin volverse loco

El juego se abre solo con hacer doble clic en `casita-fuente.html`. Para ver cosas concretas
sin esperar (la noche, la lluvia, el huerto crecido) lo más cómodo es abrir la consola del
navegador y tocar el objeto global `juego`:

```js
juego.tiempo += 330                    // adelantar el reloj ~13 horas: se hace de noche
juego.ambiente.lluviaObj = 0.9         // que empiece a llover
juego.ambiente.proxLluvia = 9999       // y que no pare
juego.casa.parcelas[0].estado = 3      // una parcela madura
juego.pintarParcela(juego.casa.parcelas[0])
juego.casa.techoManual = true          // quitar el techo para ver dentro
juego.modoFoto()                       // modo foto
```
