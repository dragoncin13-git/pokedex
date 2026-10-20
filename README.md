# Pokédex 8-bit (PWA)

Frontend de una Pokédex estilo anime, azul y en 8 bits, con los 150 Pokémon originales. Funciona como PWA (se instala en el celular y abre sin internet) y se puede meter en una app de Android Studio.

Es HTML, CSS y JavaScript sin frameworks, así que no hay que compilar nada: se copia a XAMPP y listo.

## Estructura

```
pokedex/
├── index.html          ← la Pokédex
├── manifest.json       ← datos de la PWA (nombre, íconos, colores)
├── sw.js               ← service worker (offline + instalable)
├── css/styles.css      ← tema azul 8-bit
├── icons/              ← íconos pixel-art
├── js/
│   ├── config.js       ← ★ URL del back y opciones
│   ├── api.js          ← cliente HTTP (timeout, reintentos) y normalización
│   ├── tipos.js        ← tabla de tipos → calcula debilidades
│   ├── voz.js          ← botón de voz + guion que se lee
│   ├── imagenes.js     ← imágenes del usuario (IndexedDB)
│   └── app.js          ← pantalla, navegación, eventos
└── android/MainActivity.kt  ← app Android Studio (WebView + voz nativa)
```

## Qué hace

| Requisito | Cómo quedó |
|---|---|
| Azul, 8 bits | Fuente *Press Start 2P*, bordes pixelados, scanlines y sprites sin suavizado. La lente azul parpadea cuando habla, como en el anime. |
| Pasar del 1 al 150 | Cruceta ◀ ▶ (▲ va al #001 y ▼ al #150), flechas del teclado, deslizar sobre la pantalla y buscador por número o nombre. Del 150 pasa al 1 y del 1 al 150. Precarga el anterior y el siguiente. |
| Voz | Botón 🔊: lo tocas y habla, y si lo tocas otra vez mientras habla, se calla (🔇). Dice nombre, categoría, tipo, debilidades (×2 y ×4), inmunidades, descripción, de quién evoluciona, a quién puede evolucionar y cómo (nivel, piedra, intercambio, amistad…) y las variantes. Atajo en PC: barra espaciadora. |
| Añadir imágenes | "＋ AÑADIR IMAGEN" (galería o cámara del cel). Se guardan en el dispositivo por Pokémon. Si tocas una, puedes ponerla como **principal** (sale en la pantalla en lugar del sprite) o borrarla. |
| Variantes | Mega, Gigamax, formas regionales (Alola/Galar/Hisui), hembra y shiny. Botones ✨ SHINY y 🖼 HD (arte oficial). |
| Extra | Stats con barras, altura y peso, resistencias, cadena evolutiva clicable (las evoluciones de generaciones posteriores, como Steelix o Espeon, aparecen pero bloqueadas). |

## 1. Correrlo con XAMPP

1. Copia la carpeta `pokedex` a `C:\xampp\htdocs\pokedex`.
2. Arranca **Apache** en el panel de XAMPP.
3. Abre `http://localhost/pokedex/`.

Consume el back del curso (ver sección 3).

> ⚠️ Tiene que abrirse por `http://localhost/...`, no con doble clic al `index.html` (`file://`), porque los módulos JS y el service worker no funcionan así.

### Probarlo en el celular

La PWA (instalar y modo offline) solo se activa en **HTTPS o `localhost`**. Si en el cel abres `http://192.168.x.x/pokedex`, se ve y funciona, pero no se instala. Hay tres formas de resolverlo:

- **Por USB (recomendada):** conecta el cel con depuración USB, corre `adb reverse tcp:80 tcp:80` y abre en el Chrome del cel `http://localhost/pokedex/`. Después, en el menú ⋮, toca **Instalar app**.
- **Por WiFi:** en el Chrome del cel entra a `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, agrega `http://IP-DE-TU-PC` y reinicia Chrome.
- **Para la entrega:** súbelo a cualquier hosting con HTTPS (GitHub Pages, Netlify).

## 2. Android Studio

Hay dos caminos:

**A) Instalar la PWA desde Chrome (lo más simple).** Usa la voz de Chrome y no hay que escribir nada en Android Studio. Solo se necesita para `adb reverse` o el emulador.

**B) App nativa con WebView.** Es la que deberías usar si el profe pide un APK. Ojo: **el WebView de Android no trae voz** (`speechSynthesis` no existe ahí). Por eso `android/MainActivity.kt` incluye un puente `AndroidTTS` con el `TextToSpeech` nativo, y `voz.js` lo detecta solo. El mismo archivo también habilita el selector de imágenes y el almacenamiento.

Pasos:
1. Crea un proyecto nuevo **Empty Views Activity**, en Kotlin, con minSdk 24.
2. Reemplaza `MainActivity.kt` por el de `android/` y ajusta el `package`.
3. En `activity_main.xml` deja solo un `<WebView android:id="@+id/web" .../>` en `match_parent`.
4. En `AndroidManifest.xml` agrega el permiso `INTERNET`, `android:usesCleartextTraffic="true"` y el bloque `<queries>` del TTS. Todo está comentado arriba del `.kt`.
5. La URL ya viene puesta para el emulador: `10.0.2.2` es el localhost de tu PC. Para el cel por USB, usa `http://localhost/pokedex/` con `adb reverse tcp:80 tcp:80`.

Si el teléfono no tiene voz en español, instálala en *Ajustes → Sistema → Idioma → Salida de texto a voz*.

## 3. El back del curso (ya conectado)

`js/config.js` ya apunta a `https://pokedex-backend-g1ql.onrender.com` (documentación en `/docs`). Cumple el mismo papel que el `VITE_API_URL` de la guía, pero sin necesitar Vite. Si cambia la URL, solo se edita `BACKEND_URL`.

| Endpoint | Dónde se usa |
|---|---|
| `GET /health` | Al abrir la app se manda un ping para que Render empiece a despertar cuanto antes. |
| `GET /api/pokemon/:id` | Ficha principal: tipos, stats, habilidades (con la oculta marcada), sprites y `evolvesFrom`/`evolvesTo`. |
| `GET /api/pokemon?limit&offset&search&type` | Botón **☰ LISTA**: cuadrícula paginada ("CARGAR MÁS" según `meta.total`), búsqueda con debounce y filtro por tipo. También alimenta el autocompletado del buscador. |
| `GET /api/types` | Los chips de tipo de la lista, con su `pokemonCount`. |

**Cosas del back que resuelve el front:**
- **Cold start (se duerme a los 15 min):** cada petición tiene timeout y reintentos con espera creciente (2 s, 4 s, 8 s…). Si una petición tarda más de 3 s, la pantalla muestra *"DESPERTANDO SERVIDOR… (hasta 50 s)"*. Además, el service worker usa **stale-while-revalidate** con `/api/*`, así que lo que ya viste abre al instante aunque Render esté dormido.
- **Errores:** un 404 muestra "POKÉMON NO ENCONTRADO", un 5xx muestra "ERROR DEL SERVIDOR" y la falta de red muestra "SIN CONEXIÓN". Los tres tienen botón **REINTENTAR**. También aparece un banner amarillo cuando el dispositivo está offline.
- **Unidades:** `height` viene en decímetros y `weight` en hectogramos, así que se dividen entre 10 para mostrar metros y kilos.
- **Debilidades:** el back no las trae, así que se calculan con la tabla de tipos (`tipos.js`).
- **Todo en inglés y sin el *cómo* de la evolución:** con `ENRIQUECER_CON_POKEAPI: true`, el front completa los datos con PokéAPI: descripción y categoría en español, método de evolución (nivel, piedra, intercambio…) y variantes (Mega, Gigamax, regionales). Si PokéAPI falla, se queda con lo del back. En ese caso la descripción en inglés **se lee con voz en inglés** y lo demás en español, y la cadena evolutiva se arma recorriendo `evolvesFrom`/`evolvesTo`.
- **Imágenes:** el back no tiene endpoint para subirlas, así que se guardan en el dispositivo (IndexedDB).

**Relación con el BACKLOG.md:** cubre la Épica 0 (PWA, capa de datos, SW), la 1 (lista, búsqueda, filtro, estados de carga/vacío/error, badges de tipo), la 2 (detalle, stats, evolución clicable, 404, deep link `#25`), la 3 (filtro por tipo con conteo) y la 4 (offline, banner, `loading="lazy"`).

Si el back se cae el día de la entrega, pon `MODO: 'pokeapi'` en `config.js` y la app sigue funcionando igual.

## Notas

- Si cambias archivos del front, sube `VERSION` en `sw.js` (`pokedex-v2`…) para que los celulares que ya la instalaron se actualicen.
- Los tipos siguen la tabla moderna (por eso Clefairy es Hada), igual que el back.
- Con PokéAPI activo, la cadena evolutiva muestra también las evoluciones de generaciones posteriores (por ejemplo Espeon), pero bloqueadas, porque el back solo tiene las 150.
