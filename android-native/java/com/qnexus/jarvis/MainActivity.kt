package com.qnexus.jarvis

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.speech.RecognizerIntent
import android.view.View
import android.view.WindowManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.WindowCompat
import com.getcapacitor.BridgeActivity
import com.getcapacitor.BridgeWebViewClient

class MainActivity : BridgeActivity() {

    private var speechDialogLauncher: ActivityResultLauncher<Intent>? = null
    @Volatile
    private var pendingDialogSessionId: Int = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(QNexusPlugin::class.java)
        speechDialogLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            val ok = result.resultCode == Activity.RESULT_OK
            val matches = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            val text = matches?.firstOrNull()?.trim() ?: ""
            QNexusPlugin.instance?.onSystemSpeechDialogResult(pendingDialogSessionId, ok, text)
        }
        super.onCreate(savedInstanceState)

        configureEdgeToEdgeCutoutWindow()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
        configureWebViewAudioAndSpeed()
        handleLaunchExtras(intent)
    }

    private fun configureEdgeToEdgeCutoutWindow() {
        try {
            WindowCompat.setDecorFitsSystemWindows(window, false)
            window.statusBarColor = Color.TRANSPARENT
            window.navigationBarColor = Color.TRANSPARENT
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val lp = window.attributes
                lp.layoutInDisplayCutoutMode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                } else {
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                }
                window.attributes = lp
            }
        } catch (_: Exception) {}
    }

    fun launchSystemSpeechDialog(sessionId: Int, lang: String): Boolean {
        val launcher = speechDialogLauncher ?: return false
        return try {
            pendingDialogSessionId = sessionId
            val recLang = when (lang) {
                "en" -> "en-US"
                "pa" -> "pa-IN"
                else -> "ur-PK"
            }
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, recLang)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, recLang)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
                putExtra(RecognizerIntent.EXTRA_PROMPT, "Wasu's Jarvis Sun Rahi Hai — Apna Hukum Bolein")
            }
            launcher.launch(intent)
            true
        } catch (_: Exception) {
            false
        }
    }

    override fun onStart() {
        super.onStart()
        configureEdgeToEdgeCutoutWindow()
        configureWebViewAudioAndSpeed()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleLaunchExtras(intent)
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

            val curBridge = bridge
            if (curBridge != null) {
                webView.webViewClient = object : BridgeWebViewClient(curBridge) {
                    override fun onRenderProcessGone(view: WebView?, detail: RenderProcessGoneDetail?): Boolean {
                        try {
                            view?.post {
                                try { view.reload() } catch (_: Exception) {}
                            }
                            return true
                        } catch (_: Exception) {}
                        return false
                    }
                }
            }
        } catch (_: Exception) {
        }
    }

    private fun handleLaunchExtras(intent: Intent?) {
        try {
            val compName = intent?.component?.className ?: ""
            val studioExtra = intent?.getStringExtra("open_studio") ?: ""
            if (compName.contains("OneUiStudioAlias") || studioExtra == "oneui9") {
                intent?.removeExtra("open_studio")
                QNexusPlugin.setPendingStudioTarget("oneui9")
                QNexusPlugin.instance?.emitStudioLaunchEvent("oneui9")
            }

            val phrase = intent?.getStringExtra("wake_phrase") ?: return
            val trailing = intent.getStringExtra("wake_trailing_cmd") ?: ""
            intent.removeExtra("wake_phrase")
            intent.removeExtra("wake_trailing_cmd")
            QNexusPlugin.setPendingWakePayload(phrase, trailing)
            QNexusPlugin.instance?.emitWakeEvent(phrase, trailing)
        } catch (_: Exception) {
        }
    }
}
