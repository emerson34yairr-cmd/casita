# La casita

Un juego cozy en 3D que cabe en un solo archivo: una isla de voxels, una casa con la luz
encendida y alguien que solo quiere pasar un buen rato.

**Jugar:** https://emerson34yairr-cmd.github.io/casita/

Funciona en el móvil. En el iPhone, desde Safari: *Compartir → Añadir a pantalla de inicio*
y se ve a pantalla completa (el propio juego te lo recuerda la primera vez).

## Qué hay

- Isla de voxels generada por procedimiento, con su mar, sus árboles y su playa
- Casa con muebles usables: cama, cocina, sofá, tele, mesa y **hogar encendido**
- **Huerto**: se siembra, se riega y se cosecha (si llueve, se riega solo)
- **Manzanos** con fruta que vuelve a salir
- **Muelle para pescar**: echas el sedal, esperas, y cuando pica hay que recoger a tiempo
- Ciclo de día y noche con luciérnagas, estrellas y las ventanas encendidas
- **Chimenea con humo**, mariposas, nubes y **chubascos** de vez en cuando
- Sonido ambiente sintetizado: viento, pájaros de día, grillos de noche, lluvia
- **Modo foto** (tecla O): se va la interfaz y quedan bandas de cine
- La partida **se guarda sola** y se pausa cuando cambias de pestaña

## Controles

**Teclado y ratón**

| | |
|---|---|
| `WASD` | mover |
| `Espacio` | saltar / aletear (con la ptera) |
| Clic | caminar, o usar lo que toques |
| Arrastrar | mover la vista |
| Botón derecho / rueda | girar / zoom |
| `V` | primera persona |
| `C` | cambiar entre el gato y la ptera |
| `F` | centrar la cámara |
| `Q` `E` | girar |
| `R` | techo |
| `G` | agua |
| `P` | pausa |
| `M` | silencio |
| `O` | modo foto |

**Móvil:** arrastra a la izquierda para el mando, toca el suelo para ir andando, pellizca
para el zoom, y los botones de la esquina para lo demás.

## Cómo está hecho

Todo el juego es **un archivo HTML**. Three.js va incrustado dentro (no se carga de ningún
CDN), así que el archivo funciona solo: lo abres y ya está, sin servidor ni instalar nada.

- `index.html` — el juego listo para jugar (three.js incrustado, ~790 KB)
- `casita-fuente.html` — el mismo juego pero **sin** three.js incrustado, que es el archivo
  que se edita. Mucho más cómodo de leer (~187 KB)
- `NOTAS.md` — cómo funciona por dentro, los tropiezos que ya están resueltos, y lo que falta

Para reconstruir `index.html` a partir del fuente solo hay que meter three.js r128 dentro y
quitarle las etiquetas `html`/`head`/`body`. Está explicado en `NOTAS.md`.

## Deploy

GitHub Pages sirviendo `index.html` desde la raíz de `main`.
