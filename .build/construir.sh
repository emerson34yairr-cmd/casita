#!/bin/sh
# Regenera index.html a partir de casita-fuente.html.
#
# Lo unico que cambia entre los dos archivos es la etiqueta del CDN de three.js: aqui
# se sustituye por la libreria entera incrustada, porque el juego se publica en sitios
# con CSP estricta donde un <script src="https://..."> no carga y la pantalla se queda
# en la portada sin ningun error visible.
#
# La copia de three.js (.build/three-inline.html) NO se guarda en el repo: son 600 KB
# que ya estan dentro de index.html. Si falta, se saca del propio index.html.
set -e
cd "$(dirname "$0")/.."

if [ ! -f .build/three-inline.html ]; then
  echo "no esta .build/three-inline.html: lo saco del index.html actual"
  [ -f index.html ] || { echo "...pero tampoco hay index.html. Sin three.js no se puede."; exit 1; }
  # se busca la etiqueta <script> que ABRE el bloque donde esta la licencia de three.js
  # (contar lineas a ojo desde @license es fragil: hay dos de comentario por medio)
  DE=$(awk '/^<script>$/ {ultimo=NR} /@license/ {print ultimo; exit}' index.html)
  [ -n "$DE" ] || { echo "no encuentro three.js dentro de index.html"; exit 1; }
  A=$(awk -v d="$DE" 'NR>d && /^<\/script>$/ {print NR; exit}' index.html)
  [ -n "$A" ] || { echo "no encuentro donde acaba el bloque de three.js"; exit 1; }
  sed -n "${DE},${A}p" index.html > .build/three-inline.html
  echo "sacadas $(wc -c < .build/three-inline.html) bytes de three.js"
fi

LINEA=$(grep -n 'three.min.js' casita-fuente.html | cut -d: -f1)
[ -n "$LINEA" ] || { echo "no encuentro la etiqueta del CDN en casita-fuente.html"; exit 1; }
head -n "$((LINEA - 1))" casita-fuente.html  >  index.html.nuevo
cat .build/three-inline.html                 >> index.html.nuevo
tail -n "+$((LINEA + 1))" casita-fuente.html >> index.html.nuevo
mv index.html.nuevo index.html
echo "index.html regenerado ($(wc -l < index.html) lineas)"
