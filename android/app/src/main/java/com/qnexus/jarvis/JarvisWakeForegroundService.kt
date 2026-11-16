package com.qnexus.jarvis

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.core.app.NotificationCompat

class JarvisWakeForegroundService : Service() {

    private var speechRecognizer: SpeechRecognizer? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var wakeLock: PowerManager.WakeLock? = null
    private var isRunning = false
    private val wakePhrases = listOf(
        "wake up jarvis",
        "hi jarvis",
        "hey jarvis",
        "wasu",
        "wasi ki jan",
        "hello jarvis"
    )

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.getBooleanExtra("stop_service", false) == true) {
            getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
                .edit()
                .putBoolean("wake_enabled", false)
                .apply()
            stopSelf()
            return START_NOT_STICKY
        }

        getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
            .edit()
            .putBoolean("wake_enabled", true)
            .apply()

        acquirePartialWakeLock()
        startForegroundNotification()
        isRunning = true
        mainHandler.post { startListeningLoop() }
        return START_STICKY
    }

    private fun acquirePartialWakeLock() {
        try {
            if (wakeLock?.isHeld == true) return
            val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "WasuJarvis::BackgroundWakeLock")
            wakeLock?.setReferenceCounted(false)
            wakeLock?.acquire(60 * 60 * 1000L)
        } catch (_: Exception) {
        }
    }

    private fun releasePartialWakeLock() {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        } catch (_: Exception) {
        }
        wakeLock = null
    }

    private fun startForegroundNotification() {
        val channelId = "wasu_jarvis_wake_channel"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Wasu's Jarvis Always-On Background Engine",
                NotificationManager.IMPORTANCE_LOW
            )
            val nm = getSystemService(NotificationManager::class.java)
            nm?.createNotificationChannel(channel)
        }
        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("Wasu's Jarvis Active")
            .setContentText("Monitoring wake word & phone alerts in background...")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .build()
        startForeground(4041, notification)
    }

    private fun startListeningLoop() {
        if (!isRunning || !SpeechRecognizer.isRecognitionAvailable(this)) return
        try {
            speechRecognizer?.destroy()
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this)
            speechRecognizer?.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {}
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onError(error: Int) {
                    if (isRunning) mainHandler.postDelayed({ startListeningLoop() }, 700)
                }
                override fun onResults(results: Bundle?) {
                    handleSpeechResults(results)
                    if (isRunning) mainHandler.postDelayed({ startListeningLoop() }, 450)
                }
                override fun onPartialResults(partialResults: Bundle?) {
                    handleSpeechResults(partialResults)
                }
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })

            val recIntent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
            }
            speechRecognizer?.startListening(recIntent)
        } catch (_: Exception) {
            if (isRunning) mainHandler.postDelayed({ startListeningLoop() }, 1200)
        }
    }

    private fun handleSpeechResults(bundle: Bundle?) {
        val matches = bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: return
        for (text in matches) {
            val lower = text.lowercase()
            val matched = wakePhrases.firstOrNull { lower.contains(it) }
            if (matched != null) {
                val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                    addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                            Intent.FLAG_ACTIVITY_SINGLE_TOP or
                            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                    )
                    putExtra("wake_phrase", matched)
                }
                if (launch != null) {
                    startActivity(launch)
                }
                QNexusPlugin.instance?.emitWakeEvent(matched)
                break
            }
        }
    }

    override fun onDestroy() {
        isRunning = false
        mainHandler.removeCallbacksAndMessages(null)
        try {
            speechRecognizer?.destroy()
        } catch (_: Exception) {}
        releasePartialWakeLock()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
