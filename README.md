# La casita

Un juego cozy en 3D que cabe en un solo archivo: una isla de voxels, una casa con la luz
encendida y alguien que solo quiere pasar un buen rato.

**Jugar:** https://emerson34yairr-cmd.github.io/casita/

Funciona en el móvil. En el iPhone, desde Safari: *Compartir → Añadir a pantalla de inicio*
y se ve a pantalla completa (el propio juego te lo recuerda la primera vez).

## Qué hay

- Isla de voxels generada por procedimiento, con su mar y su playa
- **Tres clases de árbol**, cada una en su sitio: frondosos en el bosque, **pinos** en los
  cerros y **palmeras** en la costa. Las palmeras dan **cocos**: los coges del árbol (y se
  le quitan de verdad), van al zurrón, y vuelven a salir solos al cabo de un rato
- **El gato va a lo suyo**: si lo dejas un rato se busca la vida según lo que necesite —
  se va a dormir, come, se arrima al fuego, toma el sol, se queda mirando el mar o pasea.
  En cuanto tocas algo, suelta y te obedece
- Casa con muebles usables: cama, cocina, sofá, tele, mesa, **estantería**, **escritorio**
  y **hogar encendido**
- **Huerto**: se siembra, se riega y se cosecha (si llueve, se riega solo)
- **Manzanos** con fruta que vuelve a salir
- **Muelle para pescar**: echas el sedal, esperas, y cuando pica hay que recoger a tiempo.
  Sale de todo: sardinas, doradas, gambas, algún pulpo, una bota vieja… y muy de vez en
  cuando un tesoro
- **Cosas en la orilla**: conchas, piedras y estrellas de mar repartidas por toda la playa,
  para recoger. Lo que juntas se ve en el zurrón y se guarda
- **Lo que juntas sirve**: los bichos que pescas se guardan y te los comes tocándolos en el
  zurrón cuando te haga falta (cada uno alimenta lo suyo)
- **Taller** (tecla `T` o el botón 🔨): con conchas, piedras, estrellas y el tesoro se hacen
  cinco adornos para la casa — un móvil para la puerta, un farolillo que se enciende solo de
  noche, un mojón de piedras, una guirnalda de estrellas y el cofre del tesoro. Cada uno se
  hace una vez y se queda puesto. Con los cocos salen además una maceta y una alfombra
- **El cofre se abre**: te enseña todo lo que has juntado desde el primer día — y ese
  número no baja aunque te comas el pez o gastes las conchas
- Ciclo de día y noche con luciérnagas, estrellas y las ventanas encendidas
- **Chimenea con humo**, mariposas, nubes y **chubascos** de vez en cuando
- Sonido ambiente sintetizado: viento, pájaros de día, grillos de noche, lluvia, y **pasos
  que suenan distinto** según pises hierba, arena, madera o el filo del agua
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
| `T` | taller: hacer cosas con lo que encuentres |

**Móvil:** arrastra a la izquierda para el mando, toca el suelo para ir andando, pellizca
para el zoom, y los botones de la esquina para lo demás.

## Cómo está hecho

Todo el juego es **un archivo HTML**. Three.js va incrustado dentro (no se carga de ningún
CDN), así que el archivo funciona solo: lo abres y ya está, sin servidor ni instalar nada.

- `index.html` — el juego listo para jugar (three.js incrustado, ~790 KB)
- `casita-fuente.html` — el mismo juego pero **sin** three.js incrustado, que es el archivo
  que se edita. Mucho más cómodo de leer (~187 KB)
- `pequena/` — la isla original, cuatro veces más pequeña, por si se quiere comparar
- `sw.js`, `app.webmanifest`, `icono-*.png` — lo que hace que en el iPhone se comporte como
  una app de verdad: icono propio, pantalla completa y, sobre todo, que **se actualice sola**
- `NOTAS.md` — cómo funciona por dentro, los tropiezos que ya están resueltos, y lo que falta

Para reconstruir `index.html` a partir del fuente:

```sh
./.build/construir.sh      # y para comprobar que no se rompió nada:
node .build/revisar.js     # sintaxis
node .build/probar.js      # que el juego arranca de verdad en un navegador
node .build/pruebas.js     # que la orilla, la pesca, el guardado y el gato hacen lo suyo
```

## Deploy

GitHub Pages sirviendo `index.html` desde la raíz de `main`.
