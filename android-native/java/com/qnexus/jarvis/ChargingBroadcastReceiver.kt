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

        if (DynamicIslandOverlayController.activeController != null) {
            when (action) {
                Intent.ACTION_POWER_CONNECTED -> if (chargingEnabled) DynamicIslandOverlayController.dispatchCharging()
                Intent.ACTION_POWER_DISCONNECTED -> {
                    if (chargingEnabled && prefs.getBoolean("charging_unplugged_alert", true)) {
                        DynamicIslandOverlayController.dispatchChargingDisconnected()
                    } else {
                        DynamicIslandOverlayController.dispatchRefreshConfig()
                    }
                }
            }
            return
        }

        val canOverlay = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)
        if (!canOverlay || !chargingEnabled) return

        when (action) {
            Intent.ACTION_POWER_CONNECTED -> {
                val svc = Intent(context, OneUiOverlayService::class.java).apply {
                    this.action = OneUiOverlayService.ACTION_SHOW_CHARGING
                }
                try { context.startService(svc) } catch (_: Exception) {}
            }
            Intent.ACTION_POWER_DISCONNECTED -> {
                val svc = Intent(context, OneUiOverlayService::class.java).apply {
                    this.action = OneUiOverlayService.ACTION_SHOW_UNPLUGGED
                }
                try { context.startService(svc) } catch (_: Exception) {}
            }
        }
    }
}
