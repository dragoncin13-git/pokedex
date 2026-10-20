// =====================================================================
//  App Android (Android Studio) que envuelve la PWA en un WebView.
//  Proyecto: "Empty Views Activity", lenguaje Kotlin, minSdk 24.
//
//  Resuelve 3 cosas que un WebView NO hace solo:
//   1) Voz: WebView no tiene speechSynthesis → puente "AndroidTTS" con TextToSpeech.
//   2) Añadir imágenes: <input type="file"> necesita onShowFileChooser.
//   3) IndexedDB / localStorage: hay que activar domStorageEnabled.
//
//  AndroidManifest.xml  → <uses-permission android:name="android.permission.INTERNET"/>
//  y en <application ...> agrega  android:usesCleartextTraffic="true"  (para http de XAMPP).
//  Para TextToSpeech en Android 11+ agrega dentro de <manifest>:
//    <queries><intent><action android:name="android.intent.action.TTS_SERVICE"/></intent></queries>
//
//  activity_main.xml → un solo <WebView android:id="@+id/web" match_parent x match_parent/>
// =====================================================================
package com.ejemplo.pokedex

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.webkit.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import java.util.Locale

class MainActivity : AppCompatActivity() {

    // Emulador → 10.0.2.2 es el "localhost" de tu PC.
    // Celular físico por USB → usa "http://localhost/pokedex/" y corre:  adb reverse tcp:80 tcp:80
    // Celular por WiFi → "http://IP-DE-TU-PC/pokedex/"
    private val URL_APP = "http://10.0.2.2/pokedex/index.html"

    private lateinit var web: WebView
    private lateinit var tts: TextToSpeech
    @Volatile private var idActual = ""
    private var callbackArchivos: ValueCallback<Array<Uri>>? = null

    private val elegirImagenes =
        registerForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
            callbackArchivos?.onReceiveValue(uris.toTypedArray())
            callbackArchivos = null
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        web = findViewById(R.id.web)

        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts.language = Locale("es", "MX")
                tts.setPitch(0.9f)
            }
        }
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(id: String?) {}
            // Solo avisa si terminó la frase ACTUAL (no una que se cortó para leer otra)
            override fun onError(id: String?) { if (id == idActual) avisarFin() }
            override fun onDone(id: String?) { if (id == idActual) avisarFin() }
        })

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true          // IndexedDB/localStorage (imágenes guardadas)
            mediaPlaybackRequiresUserGesture = false
        }
        web.addJavascriptInterface(PuenteVoz(), "AndroidTTS")
        web.webViewClient = WebViewClient()
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                v: WebView?, cb: ValueCallback<Array<Uri>>?, p: FileChooserParams?
            ): Boolean {
                callbackArchivos?.onReceiveValue(null)
                callbackArchivos = cb
                elegirImagenes.launch("image/*")
                return true
            }
        }
        web.loadUrl(URL_APP)
    }

    private fun avisarFin() = runOnUiThread { web.evaluateJavascript("window.onTTSFin && window.onTTSFin()", null) }

    inner class PuenteVoz {
        @JavascriptInterface
        fun speak(texto: String) {
            idActual = "pokedex-" + System.nanoTime()
            tts.speak(texto, TextToSpeech.QUEUE_FLUSH, null, idActual)
        }
        @JavascriptInterface
        fun stop() { idActual = ""; tts.stop() }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        tts.shutdown()
        super.onDestroy()
    }
}
