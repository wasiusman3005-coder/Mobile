package com.qnexus.jarvis

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class JarvisBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action == Intent.ACTION_BOOT_COMPLETED || action == Intent.ACTION_MY_PACKAGE_REPLACED) {
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
                } catch (_: Exception) {
                }
            }
        }
    }
}
