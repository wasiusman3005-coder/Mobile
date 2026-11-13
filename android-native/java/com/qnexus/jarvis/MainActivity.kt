package com.qnexus.jarvis

import android.content.Intent
import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(QNexusPlugin::class.java)
        super.onCreate(savedInstanceState)
        handleWakeIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleWakeIntent(intent)
    }

    private fun handleWakeIntent(intent: Intent?) {
        val phrase = intent?.getStringExtra("wake_phrase") ?: return
        QNexusPlugin.instance?.emitWakeEvent(phrase)
    }
}
