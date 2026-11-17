package com.qnexus.jarvis

import android.accessibilityservice.AccessibilityService
import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.view.accessibility.AccessibilityEvent
import java.util.Locale

/**
 * Privileged TYPE_ACCESSIBILITY_OVERLAY service so the Dynamic Bar:
 * 1) Renders directly around/over the top Front Camera punch-hole & status bar area (zero system clamping)
 * 2) Stays visible ON the native Android Keyguard Lockscreen above any lockscreen wallpaper
 * 3) Detects Finger vs Face unlock events cleanly and displays distinct unlock animations in the Dynamic Bar
 */
class JarvisAccessibilityOverlayService : AccessibilityService() {

    companion object {
        @Volatile
        var isRunning: Boolean = false
            private set
    }

    private var controller: DynamicIslandOverlayController? = null
    private var keyguardReceiver: BroadcastReceiver? = null

    override fun onServiceConnected() {
        super.onServiceConnected()
        isRunning = true
        DynamicIslandOverlayController.isAccessibilityOverlayActive = true

        // Stop lower-privilege TYPE_APPLICATION_OVERLAY service if it was running so there's only 1 bar
        try {
            stopService(Intent(this, OneUiOverlayService::class.java).apply {
                action = OneUiOverlayService.ACTION_STOP
            })
        } catch (_: Exception) {}

        controller = DynamicIslandOverlayController(applicationContext).also {
            it.attach(useAccessibilityOverlay = true)
        }

        registerScreenLockReceiver()
    }

    private fun registerScreenLockReceiver() {
        if (keyguardReceiver != null) return
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                when (intent?.action) {
                    Intent.ACTION_SCREEN_OFF -> {
                        controller?.onScreenLocked()
                    }
                    Intent.ACTION_SCREEN_ON -> {
                        val km = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
                        if (km?.isKeyguardLocked == true) {
                            controller?.onScreenLocked()
                        }
                    }
                    Intent.ACTION_USER_PRESENT -> {
                        controller?.onUserUnlockedScreen()
                    }
                }
            }
        }
        keyguardReceiver = receiver
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_USER_PRESENT)
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                registerReceiver(receiver, filter)
            }
        } catch (_: Exception) {}
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        val pkg = event.packageName?.toString()?.lowercase(Locale.US) ?: return
        if (!pkg.contains("systemui") && !pkg.contains("biometric") && !pkg.contains("face") && !pkg.contains("keyguard")) {
            return
        }
        val combined = buildString {
            event.className?.let { append(it).append(' ') }
            event.contentDescription?.let { append(it).append(' ') }
            for (t in event.text) {
                append(t).append(' ')
            }
        }.lowercase(Locale.US)

        when {
            combined.contains("face") || combined.contains("iris") -> {
                DynamicIslandOverlayController.lastSystemUiAuthCue = "Face"
            }
            combined.contains("finger") || combined.contains("udfps") || combined.contains("touch sensor") -> {
                DynamicIslandOverlayController.lastSystemUiAuthCue = "Fingerprint"
            }
        }
    }

    override fun onInterrupt() {
        // Keep overlay active smoothly
    }

    override fun onUnbind(intent: Intent?): Boolean {
        cleanup()
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        cleanup()
        super.onDestroy()
    }

    private fun cleanup() {
        isRunning = false
        DynamicIslandOverlayController.isAccessibilityOverlayActive = false
        keyguardReceiver?.let { r ->
            try { unregisterReceiver(r) } catch (_: Exception) {}
        }
        keyguardReceiver = null
        controller?.detach()
        controller = null
    }
}
