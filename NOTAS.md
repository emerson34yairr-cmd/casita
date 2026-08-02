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

## Lo que voy a hacer (por orden)

- [ ] **Que el gato haga cosas solo** cuando no lo controlas: dormir si tiene sueño, ir a
      comer, tumbarse al sol. Ahora se queda quieto y se nota.
- [ ] **Recoger conchas y piedras en la playa**, que la orilla está vacía y es lo más bonito
      de la isla.
- [ ] **Que la pesca dé cosas distintas** (peces, una bota, un tesoro) y llevar la cuenta.
- [ ] **Guardar también el huerto** en la partida: ahora se guardan hora, necesidades y dónde
      estabas, pero las parcelas vuelven a empezar vacías.
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
