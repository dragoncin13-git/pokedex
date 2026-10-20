// =====================================================================
//  Pokédex 8-bit · App Android (WebView)
//
//  La web (index.html, css, js…) va EMPAQUETADA dentro del APK, así que
//  la app abre en el celular sin XAMPP ni la PC. Se sirve por HTTPS
//  "virtual" (https://appassets.androidplatform.net/assets/...) con
//  WebViewAssetLoader, que es lo que permite que sigan funcionando:
//
//   1) Los módulos JS (<script type="module">) y el service worker.
//   2) IndexedDB: las imágenes que añades se guardan en el celular.
//   3) El back en Render y PokéAPI (siguen siendo peticiones por internet).
//
//  Lo que el WebView NO trae y aquí se resuelve:
//   - Voz: no existe speechSynthesis → puente "AndroidTTS" con TextToSpeech.
//     (voz.js ya lo detecta solo.)
//   - Añadir imágenes: <input type="file"> necesita onShowFileChooser;
//     se ofrece galería y cámara.
//   - Botón atrás: cierra la lista/visor si están abiertos; si no, sale.
// =====================================================================
package com.ejemplo.pokedex

import android.annotation.SuppressLint
import android.content.ClipData
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.webkit.JavascriptInterface
import android.webkit.ServiceWorkerClient
import android.webkit.ServiceWorkerController
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.webkit.WebViewAssetLoader
import java.io.File
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private companion object {
        const val DOMINIO = "appassets.androidplatform.net"
        const val URL_APP = "https://$DOMINIO/assets/index.html"
        const val MAX_TTS = 3500 // TextToSpeech rechaza textos de ~4000+ caracteres
    }

    private lateinit var web: WebView
    private lateinit var assetLoader: WebViewAssetLoader
    private lateinit var tts: TextToSpeech
    @Volatile private var ttsListo = false
    @Volatile private var idActual = ""

    private var callbackArchivos: ValueCallback<Array<Uri>>? = null
    private var fotoCamara: Uri? = null

    // ---------- Selector de imágenes (galería + cámara) ----------
    private val selectorArchivos =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
            val cb = callbackArchivos ?: return@registerForActivityResult
            callbackArchivos = null

            var resultado: Array<Uri>? = null
            if (res.resultCode == RESULT_OK) {
                val uris = mutableListOf<Uri>()
                val data = res.data
                data?.clipData?.let { clip ->
                    for (i in 0 until clip.itemCount) uris.add(clip.getItemAt(i).uri)
                }
                if (uris.isEmpty()) data?.data?.let { uris.add(it) }
                // Si no vino nada en el resultado, fue la cámara: la foto está en nuestro archivo
                if (uris.isEmpty()) fotoCamara?.let { uris.add(it) }
                resultado = uris.toTypedArray()
            }
            fotoCamara = null
            cb.onReceiveValue(resultado)
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        web = findViewById(R.id.web)

        // Depurar con chrome://inspect solo en builds de depuración
        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        // ---------- Archivos de la web, desde los assets del APK ----------
        // "/assets/" (sin archivo) → index.html, para que el service worker pueda
        // guardar './' en caché igual que en el navegador.
        val assets = WebViewAssetLoader.AssetsPathHandler(this)
        assetLoader = WebViewAssetLoader.Builder()
            .setDomain(DOMINIO)
            .addPathHandler("/assets/") { ruta ->
                assets.handle(if (ruta.isEmpty() || ruta.endsWith("/")) ruta + "index.html" else ruta)
            }
            .build()

        // El service worker hace sus propias peticiones: también deben salir de los assets.
        ServiceWorkerController.getInstance().setServiceWorkerClient(object : ServiceWorkerClient() {
            override fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)
        })

        // ---------- Voz nativa ----------
        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val idiomas = listOf(Locale("es", "MX"), Locale("es", "US"), Locale("es", "ES"), Locale("es"))
                for (l in idiomas) {
                    val r = tts.setLanguage(l)
                    if (r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED) break
                }
                tts.setPitch(0.9f)
                ttsListo = true
            }
        }
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(id: String?) {}
            // Solo avisa cuando termina la ÚLTIMA frase vigente (no una que se cortó para leer otra)
            override fun onError(id: String?) { if (id == idActual) avisarFin() }
            override fun onDone(id: String?) { if (id == idActual) avisarFin() }
        })

        // ---------- WebView ----------
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true            // IndexedDB / localStorage (imágenes guardadas)
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
            builtInZoomControls = false
            setSupportZoom(false)
            textZoom = 100                      // que el tamaño de letra del sistema no rompa el pixel-art
        }
        web.addJavascriptInterface(PuenteVoz(), "AndroidTTS")

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            // Enlaces a otras webs → navegador, no dentro de la Pokédex
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.host == DOMINIO) return false
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, request.url)) }
                return true
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                v: WebView?, cb: ValueCallback<Array<Uri>>?, p: FileChooserParams?
            ): Boolean {
                callbackArchivos?.onReceiveValue(null)
                callbackArchivos = cb
                return try {
                    selectorArchivos.launch(crearSelectorImagen())
                    true
                } catch (e: Exception) {
                    callbackArchivos?.onReceiveValue(null)
                    callbackArchivos = null
                    false
                }
            }
        }

        // ---------- Botón atrás ----------
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val js = "(function(){var d=document.querySelector('dialog[open]');" +
                         "if(d){d.close();return 'cerrado';}return 'nada';})()"
                web.evaluateJavascript(js) { r ->
                    when {
                        r?.contains("cerrado") == true -> Unit
                        web.canGoBack() -> web.goBack()
                        else -> { isEnabled = false; onBackPressedDispatcher.onBackPressed() }
                    }
                }
            }
        })

        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) web.loadUrl(URL_APP)
    }

    // Galería (cualquier app de fotos) + opción de tomar una foto con la cámara
    private fun crearSelectorImagen(): Intent {
        val galeria = Intent(Intent.ACTION_GET_CONTENT).apply {
            type = "image/*"
            addCategory(Intent.CATEGORY_OPENABLE)
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        }
        val selector = Intent.createChooser(galeria, "Añadir imagen")

        runCatching {
            val carpeta = File(cacheDir, "camara").apply { mkdirs() }
            val archivo = File.createTempFile("foto_", ".jpg", carpeta)
            val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", archivo)
            fotoCamara = uri
            val camara = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                putExtra(MediaStore.EXTRA_OUTPUT, uri)
                clipData = ClipData.newRawUri("", uri)
                addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            selector.putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(camara))
        }
        return selector
    }

    private fun avisarFin() = runOnUiThread {
        web.evaluateJavascript("window.onTTSFin && window.onTTSFin()", null)
    }

    // Puente que usa voz.js (window.AndroidTTS.speak / stop)
    inner class PuenteVoz {
        @JavascriptInterface
        fun speak(texto: String) {
            if (!ttsListo) { avisarFin(); return }
            val trozos = partir(texto)
            val ids = trozos.indices.map { "pokedex-" + System.nanoTime() + "-" + it }
            idActual = ids.last()
            trozos.forEachIndexed { i, t ->
                tts.speak(t, if (i == 0) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD, null, ids[i])
            }
        }

        @JavascriptInterface
        fun stop() { idActual = ""; tts.stop() }
    }

    // Parte textos largos en trozos por frase para no pasar el límite del TTS
    private fun partir(texto: String): List<String> {
        if (texto.length <= MAX_TTS) return listOf(texto)
        val trozos = mutableListOf<String>()
        val actual = StringBuilder()
        Regex("[^.!?]+[.!?]*").findAll(texto).forEach { m ->
            val frase = m.value
            if (actual.length + frase.length > MAX_TTS && actual.isNotEmpty()) {
                trozos.add(actual.toString()); actual.clear()
            }
            actual.append(frase)
        }
        if (actual.isNotEmpty()) trozos.add(actual.toString())
        return trozos
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onPause() {
        // Si sales de la app, se calla y el botón 🔊 vuelve a su estado normal
        idActual = ""
        tts.stop()
        avisarFin()
        super.onPause()
    }

    override fun onDestroy() {
        tts.shutdown()
        web.destroy()
        super.onDestroy()
    }
}
