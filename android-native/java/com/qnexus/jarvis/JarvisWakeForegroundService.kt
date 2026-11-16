package com.qnexus.jarvis

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.util.Locale

class JarvisWakeForegroundService : Service() {

    companion object {
        @Volatile
        var isServiceActive: Boolean = false
        const val ACTION_PAUSE_MIC = "com.qnexus.jarvis.ACTION_PAUSE_MIC"
        const val ACTION_RESUME_MIC = "com.qnexus.jarvis.ACTION_RESUME_MIC"
    }

    private var speechRecognizer: SpeechRecognizer? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var wakeLock: PowerManager.WakeLock? = null
    private var isRunning = false
    private var isMicPausedByForegroundApp = false

    private val defaultWakePhrases = listOf(
        "wake up jarvis",
        "hi jarvis",
        "hey jarvis",
        "hello jarvis",
        "suno jarvis",
        "ok jarvis",
        "wasu",
        "wasi ki jan"
    )

    private fun getActiveWakePhrases(): List<String> {
        return try {
            val csv = getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
                .getString("wake_phrases_csv", null)
            if (csv.isNullOrBlank()) defaultWakePhrases
            else csv.split("|").map { it.trim().lowercase(Locale.US) }.filter { it.isNotEmpty() }.ifEmpty { defaultWakePhrases }
        } catch (_: Exception) {
            defaultWakePhrases
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action

        if (intent?.getBooleanExtra("stop_service", false) == true) {
            getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
                .edit()
                .putBoolean("wake_enabled", false)
                .apply()
            isRunning = false
            isServiceActive = false
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        // Android 14+ / 15 throws SecurityException if a microphone FGS starts without RECORD_AUDIO
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
                .edit()
                .putBoolean("wake_enabled", false)
                .apply()
            isRunning = false
            isServiceActive = false
            stopSelf()
            return START_NOT_STICKY
        }

        if (!isRunning) {
            val started = startForegroundNotification()
            if (!started) {
                isServiceActive = false
                stopSelf()
                return START_NOT_STICKY
            }
            isRunning = true
            isServiceActive = true
            acquirePartialWakeLock()
        }

        getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
            .edit()
            .putBoolean("wake_enabled", true)
            .apply()

        when (action) {
            ACTION_PAUSE_MIC -> {
                isMicPausedByForegroundApp = true
                mainHandler.post { stopBgRecognizerInternal() }
                return START_STICKY
            }
            ACTION_RESUME_MIC -> {
                isMicPausedByForegroundApp = false
                mainHandler.postDelayed({ startListeningLoop() }, 350)
                return START_STICKY
            }
        }

        // Check whether MainActivity is currently active; if so, let foreground plugin hold mic
        val appInFg = QNexusPlugin.instance?.isForegroundActive == true
        isMicPausedByForegroundApp = appInFg
        if (!isMicPausedByForegroundApp) {
            mainHandler.post { startListeningLoop() }
        }
        return START_STICKY
    }

    private fun acquirePartialWakeLock() {
        try {
            if (wakeLock?.isHeld == true) return
            val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "WasuJarvis::BackgroundWakeLock")
            wakeLock?.setReferenceCounted(false)
            wakeLock?.acquire(4 * 60 * 60 * 1000L)
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

    private fun startForegroundNotification(): Boolean {
        return try {
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
            val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
            val contentPending = if (launchIntent != null) {
                PendingIntent.getActivity(
                    this,
                    4042,
                    launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
            } else null

            val builder = NotificationCompat.Builder(this, channelId)
                .setContentTitle("Wasu's Jarvis Always-On")
                .setContentText("Running in background — Say 'Hi Jarvis' anytime")
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
            if (contentPending != null) {
                builder.setContentIntent(contentPending)
            }

            val notification = builder.build()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                startForeground(4041, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
            } else {
                startForeground(4041, notification)
            }
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun stopBgRecognizerInternal() {
        try {
            speechRecognizer?.cancel()
            speechRecognizer?.destroy()
        } catch (_: Exception) {}
        speechRecognizer = null
    }

    private fun startListeningLoop() {
        if (!isRunning || isMicPausedByForegroundApp) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return
        try {
            if (!SpeechRecognizer.isRecognitionAvailable(this)) return
            stopBgRecognizerInternal()
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this)
            speechRecognizer?.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {}
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onError(error: Int) {
                    if (isRunning && !isMicPausedByForegroundApp) {
                        val delay = if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) 1000L else 700L
                        mainHandler.postDelayed({ startListeningLoop() }, delay)
                    }
                }
                override fun onResults(results: Bundle?) {
                    val matched = handleSpeechResults(results)
                    if (!matched && isRunning && !isMicPausedByForegroundApp) {
                        mainHandler.postDelayed({ startListeningLoop() }, 450)
                    }
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
            if (isRunning && !isMicPausedByForegroundApp) mainHandler.postDelayed({ startListeningLoop() }, 1300)
        }
    }

    private fun handleSpeechResults(bundle: Bundle?): Boolean {
        try {
            val matches = bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: return false
            val phrases = getActiveWakePhrases()
            for (text in matches) {
                val lower = text.lowercase(Locale.US).trim()
                if (lower.isEmpty()) continue
                val matched = phrases.firstOrNull { lower.contains(it) }
                    ?: if (Regex("\\b(jarvis|jarvish|jervis|javis|wasu|wasi)\\b").containsMatchIn(lower)) "hi jarvis" else null
                if (matched != null) {
                    isMicPausedByForegroundApp = true
                    stopBgRecognizerInternal()
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
                    return true
                }
            }
        } catch (_: Exception) {
        }
        return false
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        try {
            val wakeEnabled = getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
                .getBoolean("wake_enabled", false)
            if (wakeEnabled && Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                val restartIntent = Intent(applicationContext, JarvisWakeForegroundService::class.java).apply {
                    action = ACTION_RESUME_MIC
                }
                val pi = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    PendingIntent.getForegroundService(
                        applicationContext,
                        4043,
                        restartIntent,
                        PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
                    )
                } else {
                    PendingIntent.getService(
                        applicationContext,
                        4043,
                        restartIntent,
                        PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
                    )
                }
                val am = getSystemService(Context.ALARM_SERVICE) as? AlarmManager
                am?.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, SystemClock.elapsedRealtime() + 800, pi)
            } else if (wakeEnabled) {
                isMicPausedByForegroundApp = false
                mainHandler.postDelayed({ startListeningLoop() }, 350)
            }
        } catch (_: Exception) {
        }
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        isRunning = false
        isServiceActive = false
        mainHandler.removeCallbacksAndMessages(null)
        stopBgRecognizerInternal()
        releasePartialWakeLock()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
