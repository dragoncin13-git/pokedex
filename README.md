# Pokédex 8-bit

Proyecto de PWA tipo Pokédex. Usamos un estilo azul en 8 bits y trabajamos con los 150 Pokémon originales, de Bulbasaur a Mewtwo. Los datos salen del back del curso (https://pokedex-backend-g1ql.onrender.com).

Integrantes: Bryan Puentes y Alison Carrasco


## Requisitos

Hay tres formas de probarla:

- En un celular Android 5.0 o superior, instalando el archivo pokedex.apk.
- En el PC con Visual Studio Code y la extensión Live Server.
- En el PC con XAMPP (Apache).

En cualquiera de los casos se necesita internet, porque los nombres, tipos, stats y descripciones vienen del back. Las imágenes de los Pokémon ya están en el proyecto, en la carpeta img.

En el PC recomendamos Chrome o Edge, porque son los navegadores donde mejor funciona la voz.


## Cómo ejecutarla

Celular:

1. Pasar pokedex.apk al celular y abrirlo.
2. Si Android lo pide, activar "Instalar apps desconocidas". Si sale el aviso de Play Protect, tocar "Más detalles" y luego "Instalar de todas formas". Pasa con cualquier APK que no venga de la Play Store.

Visual Studio Code:

1. Archivo > Abrir carpeta y elegir la carpeta pokedex.
2. Instalar Live Server (VS Code la sugiere al abrir la carpeta).
3. Dar clic en "Go Live", abajo a la derecha. Se abre en http://localhost:5500

XAMPP:

1. Copiar la carpeta pokedex en C:\xampp\htdocs
2. Iniciar Apache desde el panel de XAMPP.
3. Entrar a http://localhost/pokedex/

Importante: no se puede abrir index.html con doble clic, porque los módulos de JavaScript necesitan un servidor. Por eso hay que usar Live Server o XAMPP.

La primera vez que se abre puede demorar hasta unos 50 segundos. El back está en el plan gratuito de Render y se apaga cuando nadie lo usa. Mientras arranca, la pantalla dice "DESPERTANDO SERVIDOR", y después carga sola.


## Funcionalidades para revisar

1. Navegación del 1 al 150 con la cruceta. Las flechas izquierda y derecha pasan de uno en uno, la de arriba lleva al #001 y la de abajo al #150. Si está en el 150 y se le da siguiente, vuelve al 1. En el PC también funcionan las flechas del teclado, y en el celular se puede deslizar el dedo sobre la pantalla.

2. Voz. El botón amarillo de sonido lee el nombre, tipo, debilidades, descripción, si evoluciona y cómo (nivel, piedra, intercambio), las variantes y las habilidades. Si se presiona otra vez mientras habla, se calla.

3. Añadir imágenes. En la sección "MIS IMÁGENES" está el botón "AÑADIR IMAGEN". Al tocar una imagen se puede poner como principal, y en ese caso aparece en la pantalla en vez del sprite. También se puede borrar. Las imágenes quedan guardadas en el dispositivo.

4. Variantes. Los botones SHINY y HD cambian la imagen. En la sección de variantes salen las formas Mega, Gigamax, regionales y la versión hembra cuando existe. Charizard (#006) y Pikachu (#025) son buenos ejemplos.

5. Evolución. Se muestra la cadena completa y se puede tocar cada Pokémon para ir a su ficha. Eevee (#133) sirve para ver las ramificaciones.

6. Búsqueda. Debajo de la cruceta se puede escribir un número o un nombre y darle a IR.

7. Lista. El botón de tres rayas abre todos los Pokémon en cuadrícula, con buscador y filtro por tipo. Debajo hay un botón para cargar más.

8. Datos de cada Pokémon: tipos, debilidades (x2 y x4), resistencias, altura, peso, estadísticas y habilidades. La habilidad oculta aparece marcada.

9. Manejo de errores. Si se busca un nombre que no existe (por ejemplo "agumon") sale "No encontrado". Si se busca un número fuera de rango, como 200, avisa que solo hay del 1 al 150. Sin internet aparece una barra amarilla y un botón para reintentar.

10. PWA. En Chrome del PC aparece la opción de instalarla desde la barra de direcciones. Si ya se abrió una vez, carga aunque no haya conexión.


## Sobre los tipos

Trabajamos con los 17 tipos que nos pidieron: Acero, Agua, Bicho, Dragón, Eléctrico, Fantasma, Fuego, Hielo, Lucha, Normal, Planta, Psíquico, Roca, Siniestro, Tierra, Veneno y Volador.

El back maneja la tabla de tipos nueva, que incluye Hada. Como Hada no está en la lista, la convertimos como estaba en los juegos clásicos: Clefairy, Clefable, Jigglypuff y Wigglytuff quedan como Normal, y Mr. Mime como Psíquico. En el filtro, Siniestro aparece con 0, porque ninguno de los 150 originales es de ese tipo.

Las debilidades se calculan en el front a partir de los tipos, porque el back no las trae.


## Otras decisiones

El back devuelve los textos en inglés y no dice cómo evoluciona cada Pokémon. Para tener la descripción en español y el método de evolución, completamos esa información con PokéAPI. Si PokéAPI no responde, la app sigue funcionando con lo que manda el back, y en ese caso la descripción se lee en inglés.

El back tampoco tiene un endpoint para subir imágenes. Por eso las imágenes que agrega el usuario se guardan en el navegador o en el celular (IndexedDB).


## Endpoints que usamos

- GET /health: se llama al abrir la app para ir despertando el servidor.
- GET /api/pokemon/:id: la información de cada Pokémon.
- GET /api/pokemon?limit=&offset=&search=: la lista y la búsqueda.

La dirección del back está en js/config.js. Si el back llega a fallar, se puede cambiar MODO a 'pokeapi' y la app trabaja solo con PokéAPI.


## Problemas comunes

- Se queda en "DESPERTANDO SERVIDOR": hay que esperar, la primera carga es lenta.
- Sale "EL SERVIDOR NO RESPONDE": darle a REINTENTAR. Si no funciona, abrir https://pokedex-backend-g1ql.onrender.com/health en el navegador y volver a intentar.
- La página queda en blanco: probablemente se abrió con doble clic. Hay que usar Live Server o XAMPP.
- En el celular no se escucha la voz: revisar que haya una voz en español instalada (Ajustes > Sistema > Idioma > Salida de texto a voz) y que el volumen multimedia esté arriba.
- No se ven los cambios después de editar el código: recargar con Ctrl + F5.
- El APK no se instala encima de una versión anterior: desinstalar la anterior y volver a instalar.


## Tecnologías

HTML, CSS y JavaScript con módulos, sin frameworks. Para la PWA usamos service worker y manifest. La voz usa la Web Speech API en el navegador y TextToSpeech en el APK. Las imágenes del usuario se guardan con IndexedDB. El APK es una app en Java con un WebView que carga la página.


## Estructura

```
pokedex/
  index.html            pantalla principal
  css/styles.css        estilos
  js/config.js          dirección del back y configuración
  js/api.js             peticiones al back y a PokéAPI
  js/app.js             lógica de la pantalla y navegación
  js/voz.js             voz
  js/tipos.js           tipos y debilidades
  js/imagenes.js        imágenes del usuario
  img/                  imágenes de los Pokémon
  sw.js                 service worker
  manifest.json         manifest de la PWA
  android-apk/          código del APK
  pokedex.apk           instalador para Android
  DOCUMENTACION_TECNICA.md
```
