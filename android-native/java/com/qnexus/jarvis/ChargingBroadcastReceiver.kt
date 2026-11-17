package com.qnexus.jarvis

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings

class ChargingBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        val prefs = context.getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
        val chargingEnabled = prefs.getBoolean("charging_overlay_enabled", true)
        if (!chargingEnabled) return

        // Prefer in-process dispatch to active controller (works cleanly in Android 12-15 background without IllegalStateException)
        if (DynamicIslandOverlayController.activeController != null) {
            if (action == Intent.ACTION_POWER_CONNECTED) {
                DynamicIslandOverlayController.dispatchCharging()
            } else if (action == Intent.ACTION_POWER_DISCONNECTED) {
                DynamicIslandOverlayController.dispatchRefreshConfig()
            }
            return
        }

        val canOverlay = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)
        if (!canOverlay) return

        if (action == Intent.ACTION_POWER_CONNECTED) {
            val svc = Intent(context, OneUiOverlayService::class.java).apply {
                this.action = OneUiOverlayService.ACTION_SHOW_CHARGING
            }
            try {
                context.startService(svc)
            } catch (_: Exception) {}
        } else if (action == Intent.ACTION_POWER_DISCONNECTED) {
            val svc = Intent(context, OneUiOverlayService::class.java).apply {
                this.action = OneUiOverlayService.ACTION_UPDATE
            }
            try {
                context.startService(svc)
            } catch (_: Exception) {}
        }
    }
}
