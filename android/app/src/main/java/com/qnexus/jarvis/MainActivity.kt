package com.qnexus.jarvis

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.webkit.WebSettings
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(QNexusPlugin::class.java)
        super.onCreate(savedInstanceState)
        configureWebViewAudioAndSpeed()
        handleWakeIntent(intent)
    }

    override fun onStart() {
        super.onStart()
        configureWebViewAudioAndSpeed()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleWakeIntent(intent)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        QNexusPlugin.instance?.onNativePermissionsUpdated(requestCode)
    }

    private fun configureWebViewAudioAndSpeed() {
        try {
            val webView = bridge?.webView ?: return
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
            val settings = webView.settings
            settings.mediaPlaybackRequiresUserGesture = false
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.cacheMode = WebSettings.LOAD_DEFAULT
        } catch (_: Exception) {
        }
    }

    private fun handleWakeIntent(intent: Intent?) {
        try {
            val phrase = intent?.getStringExtra("wake_phrase") ?: return
            QNexusPlugin.instance?.emitWakeEvent(phrase)
        } catch (_: Exception) {
        }
    }
}
