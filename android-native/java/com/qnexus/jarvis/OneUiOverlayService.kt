package com.qnexus.jarvis

import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.provider.Settings

/**
 * Standard TYPE_APPLICATION_OVERLAY fallback service for Dynamic Bar & Charging Modal
 * when Accessibility Service overlay is not enabled.
 * Delegates all rendering and strict settings-locked positioning to DynamicIslandOverlayController.
 */
class OneUiOverlayService : Service() {

    companion object {
        const val ACTION_UPDATE = "com.qnexus.jarvis.ONEUI_OVERLAY_UPDATE"
        const val ACTION_SHOW_CHARGING = "com.qnexus.jarvis.ONEUI_OVERLAY_CHARGING"
        const val ACTION_VOICE_STATE = "com.qnexus.jarvis.ONEUI_OVERLAY_VOICE"
        const val ACTION_SHOW_NOTIFICATION = "com.qnexus.jarvis.ONEUI_OVERLAY_NOTIF"
        const val ACTION_SHOW_INCOMING_CALL = "com.qnexus.jarvis.ONEUI_OVERLAY_CALL"
        const val ACTION_SHOW_UNLOCK_EFFECT = "com.qnexus.jarvis.ONEUI_OVERLAY_UNLOCK"
        const val ACTION_STOP = "com.qnexus.jarvis.ONEUI_OVERLAY_STOP"
    }

    private var controller: DynamicIslandOverlayController? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_UPDATE

        if (action == ACTION_STOP) {
            controller?.detach()
            controller = null
            stopSelf()
            return START_NOT_STICKY
        }

        // If Accessibility Overlay is active, route commands to it and avoid duplicate bar windows
        if (JarvisAccessibilityOverlayService.isRunning || DynamicIslandOverlayController.isAccessibilityOverlayActive) {
            dispatchActionToActiveController(intent, action)
            stopSelf()
            return START_NOT_STICKY
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            stopSelf()
            return START_NOT_STICKY
        }

        if (controller == null) {
            controller = DynamicIslandOverlayController(applicationContext).also {
                it.attach(useAccessibilityOverlay = false)
            }
        }

        dispatchActionToActiveController(intent, action)
        return START_STICKY
    }

    private fun dispatchActionToActiveController(intent: Intent?, action: String) {
        when (action) {
            ACTION_SHOW_CHARGING -> DynamicIslandOverlayController.dispatchCharging()
            ACTION_VOICE_STATE -> {
                val state = intent?.getStringExtra("state") ?: "standby"
                val text = intent?.getStringExtra("text") ?: ""
                val rms = intent?.getFloatExtra("rms", 0.3f) ?: 0.3f
                DynamicIslandOverlayController.dispatchVoiceState(state, text, rms)
            }
            ACTION_SHOW_NOTIFICATION -> {
                val title = intent?.getStringExtra("title") ?: "Notification"
                val text = intent?.getStringExtra("text") ?: ""
                val isVip = intent?.getBooleanExtra("isVip", false) ?: false
                DynamicIslandOverlayController.dispatchNotification(title, text, isVip)
            }
            ACTION_SHOW_INCOMING_CALL -> {
                val caller = intent?.getStringExtra("caller") ?: "Incoming Call"
                DynamicIslandOverlayController.dispatchIncomingCall(caller)
            }
            ACTION_SHOW_UNLOCK_EFFECT -> {
                val method = intent?.getStringExtra("method") ?: "Fingerprint"
                DynamicIslandOverlayController.dispatchUnlockEffect(method)
            }
            else -> DynamicIslandOverlayController.dispatchRefreshConfig()
        }
    }

    override fun onDestroy() {
        controller?.detach()
        controller = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
