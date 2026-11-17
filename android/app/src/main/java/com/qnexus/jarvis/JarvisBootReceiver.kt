package com.qnexus.jarvis

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings

class JarvisBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (
            action == Intent.ACTION_BOOT_COMPLETED ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED ||
            action == JarvisWakeForegroundService.ACTION_RESTART_WAKE_SERVICE
        ) {
            val prefs = context.getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
            val wakeEnabled = prefs.getBoolean("wake_enabled", false)
            if (wakeEnabled) {
                val serviceIntent = Intent(context, JarvisWakeForegroundService::class.java)
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent)
                    } else {
                        context.startService(serviceIntent)
                    }
                } catch (_: Exception) {}
            }

            val overlayOutside = prefs.getBoolean("dynamic_bar_outside_app", true)
            val barStyle = prefs.getString("dynamic_bar_style", "now_bar_pill") ?: "now_bar_pill"
            if (overlayOutside && barStyle != "hidden" &&
                (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context))
            ) {
                try {
                    val overlayIntent = Intent(context, OneUiOverlayService::class.java).apply {
                        this.action = OneUiOverlayService.ACTION_UPDATE
                    }
                    context.startService(overlayIntent)
                } catch (_: Exception) {}
            }
        }
    }
}
