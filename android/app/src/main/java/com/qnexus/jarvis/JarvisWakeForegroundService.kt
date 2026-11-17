package com.qnexus.jarvis

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.telecom.TelecomManager
import android.telephony.TelephonyManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

class JarvisWakeForegroundService : Service() {

    companion object {
        @Volatile
        var isServiceActive: Boolean = false
        const val ACTION_PAUSE_MIC = "com.qnexus.jarvis.ACTION_PAUSE_MIC"
        const val ACTION_RESUME_MIC = "com.qnexus.jarvis.ACTION_RESUME_MIC"
        const val ACTION_RESTART_WAKE_SERVICE = "com.qnexus.jarvis.ACTION_RESTART_WAKE_SERVICE"
        const val ACTION_BG_LISTEN_AND_ACT = "com.qnexus.jarvis.ACTION_BG_LISTEN_AND_ACT"
        const val ACTION_CALL_ANSWER = "com.qnexus.jarvis.ACTION_CALL_ANSWER"
        const val ACTION_CALL_REJECT = "com.qnexus.jarvis.ACTION_CALL_REJECT"
        private const val PREFS = "WasuJarvisPrefs"
    }

    private var speechRecognizer: SpeechRecognizer? = null
    private var silentVad: SilentWakeVad? = null
    private var bgCmdRecorder: SilentCommandRecorder? = null
    private var activityMonitor: UserActivityMonitor? = null
    private var bgTts: TextToSpeech? = null
    private var bgTtsReady = false
    private var bgMediaPlayer: MediaPlayer? = null
    private var bgAudioFocusReq: AudioFocusRequest? = null
    @Volatile
    private var bgTtsSeq = 0

    private var chargingReceiver: ChargingBroadcastReceiver? = null
    private var batteryFullReceiver: BroadcastReceiver? = null
    private var notifiedFullChargeThisCycle = false
    private var phoneStateReceiver: BroadcastReceiver? = null
    private var screenLockReceiver: BroadcastReceiver? = null

    private val mainHandler = Handler(Looper.getMainLooper())
    private val wakeExecutor = Executors.newSingleThreadExecutor()
    private var wakeLock: PowerManager.WakeLock? = null
    private var isRunning = false
    private var isMicPausedByForegroundApp = false
    private var isBgCommandRunning = false
    private var lastWakeProbeMs = 0L

    private val defaultWakePhrases = listOf(
        "wake up jarvis",
        "hi jarvis",
        "hey jarvis",
        "hello jarvis",
        "suno jarvis",
        "ok jarvis",
        "jarvis",
        "wasu",
        "wasi ki jan"
    )

    override fun onCreate() {
        super.onCreate()
        initBackgroundTts()
        try {
            activityMonitor = UserActivityMonitor(applicationContext).also { it.start() }
        } catch (_: Exception) {}

        // Dynamic receiver so charging turbo overlay triggers even when Android ignores manifest implicit broadcasts
        try {
            chargingReceiver = ChargingBroadcastReceiver()
            val cFilter = IntentFilter().apply {
                addAction(Intent.ACTION_POWER_CONNECTED)
                addAction(Intent.ACTION_POWER_DISCONNECTED)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(chargingReceiver, cFilter, Context.RECEIVER_EXPORTED)
            } else {
                registerReceiver(chargingReceiver, cFilter)
            }
        } catch (_: Exception) {}

        // Dynamic phone state receiver so incoming calls appear on floating Dynamic Bar immediately
        try {
            phoneStateReceiver = object : BroadcastReceiver() {
                override fun onReceive(ctx: Context?, intent: Intent?) {
                    val state = intent?.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
                    if (state == TelephonyManager.EXTRA_STATE_RINGING) {
                        val number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER) ?: "Incoming Call"
                        pushOverlayIncomingCall(number)
                        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                        if (prefs.getBoolean("bg_auto_announce", true)) {
                            speakBgLine("Wasu, $number se call aa rahi hai. Bolein 'call uthao' ya 'call kato'.")
                        }
                    } else if (state == TelephonyManager.EXTRA_STATE_IDLE) {
                        pushOverlayVoiceState("standby", "", 0f)
                    }
                }
            }
            val pFilter = IntentFilter(TelephonyManager.ACTION_PHONE_STATE_CHANGED)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(phoneStateReceiver, pFilter, Context.RECEIVER_EXPORTED)
            } else {
                registerReceiver(phoneStateReceiver, pFilter)
            }
        } catch (_: Exception) {}

        // Battery 100% Full Alert watcher
        try {
            batteryFullReceiver = object : BroadcastReceiver() {
                override fun onReceive(ctx: Context?, intent: Intent?) {
                    val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
                    val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
                    val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
                    val plugged = intent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
                    val pct = if (level >= 0 && scale > 0) (level * 100 / scale) else -1
                    if (plugged == 0) {
                        notifiedFullChargeThisCycle = false
                        return
                    }
                    if (!notifiedFullChargeThisCycle && (pct >= 100 || status == BatteryManager.BATTERY_STATUS_FULL)) {
                        notifiedFullChargeThisCycle = true
                        DynamicIslandOverlayController.dispatchBatteryFull100()
                        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                        if (prefs.getBoolean("charging_full_battery_alert", true) && prefs.getBoolean("bg_auto_announce", true)) {
                            speakBgLine("Wasu, phone battery 100 percent full charge ho gayi hai. Charger hata sakte hain.")
                        }
                    }
                }
            }
            registerReceiver(batteryFullReceiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        } catch (_: Exception) {}

        // Screen lock/unlock receiver so lock/unlock animations fire even if Accessibility is off
        try {
            screenLockReceiver = object : BroadcastReceiver() {
                override fun onReceive(ctx: Context?, intent: Intent?) {
                    when (intent?.action) {
                        Intent.ACTION_SCREEN_OFF -> {
                            DynamicIslandOverlayController.activeController?.onScreenLocked()
                        }
                        Intent.ACTION_USER_PRESENT -> {
                            DynamicIslandOverlayController.activeController?.onUserUnlockedScreen()
                        }
                    }
                }
            }
            val sFilter = IntentFilter().apply {
                addAction(Intent.ACTION_SCREEN_OFF)
                addAction(Intent.ACTION_USER_PRESENT)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(screenLockReceiver, sFilter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                registerReceiver(screenLockReceiver, sFilter)
            }
        } catch (_: Exception) {}
    }

    private fun initBackgroundTts() {
        if (bgTts != null) return
        try {
            bgTts = TextToSpeech(applicationContext) { status ->
                if (status == TextToSpeech.SUCCESS) {
                    try {
                        bgTts?.setAudioAttributes(
                            AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                .build()
                        )
                    } catch (_: Exception) {}
                    var res = bgTts?.setLanguage(Locale("ur", "PK"))
                    if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                        res = bgTts?.setLanguage(Locale("hi", "IN"))
                    }
                    if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                        bgTts?.setLanguage(Locale.US)
                    }
                    bgTts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                        override fun onStart(utteranceId: String?) {
                            WakeSpeechSuppressor.setTtsActive(true)
                        }
                        override fun onDone(utteranceId: String?) {
                            WakeSpeechSuppressor.setTtsActive(false, 950L)
                            abandonBgAudioFocus()
                        }
                        @Deprecated("Deprecated in Java")
                        override fun onError(utteranceId: String?) {
                            WakeSpeechSuppressor.setTtsActive(false, 500L)
                            abandonBgAudioFocus()
                        }
                    })
                    bgTtsReady = true
                }
            }
        } catch (_: Exception) {
            bgTtsReady = false
        }
    }

    private fun requestBgAudioFocus() {
        try {
            val am = getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build()
                    )
                    .build()
                bgAudioFocusReq = req
                am.requestAudioFocus(req)
            }
        } catch (_: Exception) {}
    }

    private fun abandonBgAudioFocus() {
        try {
            val am = getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                bgAudioFocusReq?.let { am.abandonAudioFocusRequest(it) }
            }
        } catch (_: Exception) {}
    }

    private fun stopBgMediaPlayer() {
        bgTtsSeq++
        try { bgMediaPlayer?.stop() } catch (_: Exception) {}
        try { bgMediaPlayer?.release() } catch (_: Exception) {}
        bgMediaPlayer = null
    }

    private fun playBgOnlineUrduTts(text: String, onComplete: () -> Unit, onFallbackLocal: () -> Unit) {
        val mySeq = ++bgTtsSeq
        wakeExecutor.execute {
            try {
                val clean = text.replace(Regex("\\s+"), " ").trim()
                val chunks = mutableListOf<String>()
                var remaining = clean
                while (remaining.isNotEmpty() && chunks.size < 4) {
                    if (remaining.length <= 165) {
                        chunks.add(remaining)
                        break
                    }
                    var splitAt = remaining.lastIndexOf(' ', 165)
                    if (splitAt <= 20) splitAt = 165
                    chunks.add(remaining.substring(0, splitAt).trim())
                    remaining = remaining.substring(splitAt).trim()
                }
                if (chunks.isEmpty()) {
                    mainHandler.post { onFallbackLocal() }
                    return@execute
                }
                val audioOut = ByteArrayOutputStream()
                for (chunk in chunks) {
                    if (bgTtsSeq != mySeq) return@execute
                    val encoded = URLEncoder.encode(chunk, "UTF-8")
                    val url = URL("https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ur&q=$encoded")
                    val conn = (url.openConnection() as HttpURLConnection).apply {
                        requestMethod = "GET"
                        connectTimeout = 3500
                        readTimeout = 4500
                        setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 15) Chrome/126.0.0.0 Mobile Safari/537.36")
                        setRequestProperty("Referer", "https://translate.google.com/")
                    }
                    try {
                        if (conn.responseCode !in 200..299) {
                            mainHandler.post { onFallbackLocal() }
                            return@execute
                        }
                        conn.inputStream.use { ins ->
                            val buf = ByteArray(4096)
                            var r: Int
                            while (ins.read(buf).also { r = it } != -1) {
                                audioOut.write(buf, 0, r)
                            }
                        }
                    } finally {
                        conn.disconnect()
                    }
                }
                val mp3Bytes = audioOut.toByteArray()
                if (mp3Bytes.size < 400 || bgTtsSeq != mySeq) {
                    mainHandler.post { onFallbackLocal() }
                    return@execute
                }
                val cacheFile = File(cacheDir, "jarvis_bg_tts.mp3")
                FileOutputStream(cacheFile).use { fos ->
                    fos.write(mp3Bytes)
                    fos.flush()
                }
                mainHandler.post {
                    if (bgTtsSeq != mySeq) return@post
                    try {
                        bgMediaPlayer?.release()
                    } catch (_: Exception) {}
                    try {
                        requestBgAudioFocus()
                        val player = MediaPlayer().apply {
                            setAudioAttributes(
                                AudioAttributes.Builder()
                                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                    .build()
                            )
                            setDataSource(cacheFile.absolutePath)
                            setOnPreparedListener { mp ->
                                if (bgTtsSeq != mySeq) {
                                    try { mp.release() } catch (_: Exception) {}
                                    return@setOnPreparedListener
                                }
                                WakeSpeechSuppressor.setTtsActive(true)
                                mp.start()
                            }
                            setOnCompletionListener { mp ->
                                WakeSpeechSuppressor.setTtsActive(false, 750L)
                                abandonBgAudioFocus()
                                try { mp.release() } catch (_: Exception) {}
                                if (bgMediaPlayer === mp) bgMediaPlayer = null
                                onComplete()
                            }
                            setOnErrorListener { mp, _, _ ->
                                WakeSpeechSuppressor.setTtsActive(false, 400L)
                                abandonBgAudioFocus()
                                try { mp.release() } catch (_: Exception) {}
                                if (bgMediaPlayer === mp) bgMediaPlayer = null
                                onFallbackLocal()
                                true
                            }
                            prepareAsync()
                        }
                        bgMediaPlayer = player
                    } catch (_: Exception) {
                        onFallbackLocal()
                    }
                }
            } catch (_: Exception) {
                mainHandler.post { onFallbackLocal() }
            }
        }
    }

    private fun speakBgLine(text: String, onDone: (() -> Unit)? = null) {
        if (text.isBlank()) {
            onDone?.invoke()
            return
        }
        pushOverlayVoiceState("speaking", text, 0.7f)
        WakeSpeechSuppressor.setTtsActive(true)
        stopBgMediaPlayer()

        val fallbackLocal: () -> Unit = {
            if (!bgTtsReady || bgTts == null) {
                initBackgroundTts()
                val estMs = (1200L + text.length * 45L).coerceIn(1300L, 4500L)
                mainHandler.postDelayed({
                    WakeSpeechSuppressor.setTtsActive(false, 500L)
                    pushOverlayVoiceState("standby", "", 0f)
                    onDone?.invoke()
                }, estMs)
            } else {
                val uttId = "bg_jarvis_${System.currentTimeMillis()}"
                requestBgAudioFocus()
                mainHandler.post {
                    try {
                        bgTts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, uttId)
                    } catch (_: Exception) {
                        WakeSpeechSuppressor.setTtsActive(false, 400L)
                    }
                    val estMs = (1100L + text.length * 52L).coerceIn(1300L, 6500L)
                    mainHandler.postDelayed({
                        WakeSpeechSuppressor.setTtsActive(false, 750L)
                        abandonBgAudioFocus()
                        onDone?.invoke()
                    }, estMs)
                }
            }
        }

        if (WakeAudioUtils.hasDeviceInternet(applicationContext)) {
            playBgOnlineUrduTts(
                text = text,
                onComplete = { onDone?.invoke() },
                onFallbackLocal = fallbackLocal
            )
        } else {
            fallbackLocal()
        }
    }

    private fun ensureOneUiOverlaySynced() {
        try {
            if (DynamicIslandOverlayController.activeController != null) {
                DynamicIslandOverlayController.dispatchRefreshConfig()
                return
            }
            val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val showOutside = prefs.getBoolean("dynamic_bar_outside_app", true)
            val barStyle = prefs.getString("dynamic_bar_style", "now_bar_pill") ?: "now_bar_pill"
            if (showOutside && barStyle != "hidden" &&
                (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this))
            ) {
                startService(Intent(this, OneUiOverlayService::class.java).apply {
                    action = OneUiOverlayService.ACTION_UPDATE
                })
            }
        } catch (_: Exception) {}
    }

    private fun pushOverlayVoiceState(state: String, text: String, rms: Float) {
        try {
            if (DynamicIslandOverlayController.activeController != null) {
                DynamicIslandOverlayController.dispatchVoiceState(state, text, rms)
                return
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) return
            val i = Intent(this, OneUiOverlayService::class.java).apply {
                action = OneUiOverlayService.ACTION_VOICE_STATE
                putExtra("state", state)
                putExtra("text", text)
                putExtra("rms", rms)
            }
            startService(i)
        } catch (_: Exception) {}
    }

    private fun pushOverlayIncomingCall(caller: String) {
        try {
            if (DynamicIslandOverlayController.activeController != null) {
                DynamicIslandOverlayController.dispatchIncomingCall(caller)
                return
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) return
            val i = Intent(this, OneUiOverlayService::class.java).apply {
                action = OneUiOverlayService.ACTION_SHOW_INCOMING_CALL
                putExtra("caller", caller)
            }
            startService(i)
        } catch (_: Exception) {}
    }

    private fun getActiveWakePhrases(): List<String> {
        return try {
            val csv = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
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
            getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putBoolean("wake_enabled", false)
                .apply()
            isRunning = false
            isServiceActive = false
            stopBgRecognizerInternal()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        if (action == ACTION_CALL_ANSWER) {
            val ok = handleTelecomCallAction(accept = true)
            speakBgLine(if (ok) "Call receive kar li hai." else "Call receive karne ke liye Answer Phone permission on karein.") {
                pushOverlayVoiceState("standby", "", 0f)
            }
            return START_STICKY
        }

        if (action == ACTION_CALL_REJECT) {
            val ok = handleTelecomCallAction(accept = false)
            speakBgLine(if (ok) "Call cut kar di hai." else "Call cut nahi ho saki.") {
                pushOverlayVoiceState("standby", "", 0f)
            }
            return START_STICKY
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            getSharedPreferences(PREFS, Context.MODE_PRIVATE)
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

        getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean("wake_enabled", true)
            .apply()

        ensureOneUiOverlaySynced()

        when (action) {
            ACTION_PAUSE_MIC -> {
                isMicPausedByForegroundApp = true
                mainHandler.post { stopBgRecognizerInternal() }
                return START_STICKY
            }
            ACTION_RESUME_MIC -> {
                isMicPausedByForegroundApp = false
                mainHandler.postDelayed({ startListeningLoop() }, 550)
                return START_STICKY
            }
            ACTION_BG_LISTEN_AND_ACT -> {
                val replyKey = intent.getStringExtra("reply_key").orEmpty()
                val replySender = intent.getStringExtra("reply_sender").orEmpty()
                if (replyKey.isNotEmpty()) {
                    triggerBgDynamicBarSession("", isFollowUp = false, directReplyKey = replyKey, directReplySender = replySender)
                } else if (QNexusPlugin.instance?.isForegroundActive == true) {
                    QNexusPlugin.instance?.emitWakeEvent("hi jarvis", "")
                } else {
                    triggerBgDynamicBarSession("")
                }
                return START_STICKY
            }
        }

        val appInFg = QNexusPlugin.instance?.isForegroundActive == true
        isMicPausedByForegroundApp = appInFg
        if (!isMicPausedByForegroundApp && !MicHardwareCoordinator.isCommandSessionActive && !isBgCommandRunning) {
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
        } catch (_: Exception) {}
    }

    private fun releasePartialWakeLock() {
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
        } catch (_: Exception) {}
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
                .setContentText("Dynamic Bar & Voice Standby Active — Say 'Jarvis'")
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setOngoing(true)
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
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
        try { silentVad?.stopAndAwaitRelease(450L) } catch (_: Exception) {}
        try { bgCmdRecorder?.cancel() } catch (_: Exception) {}
        bgCmdRecorder = null
        try {
            speechRecognizer?.cancel()
            speechRecognizer?.destroy()
        } catch (_: Exception) {}
        speechRecognizer = null
    }

    private fun startListeningLoop() {
        if (!isRunning || isMicPausedByForegroundApp || MicHardwareCoordinator.isCommandSessionActive || isBgCommandRunning) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return

        try {
            speechRecognizer?.cancel()
            speechRecognizer?.destroy()
        } catch (_: Exception) {}
        speechRecognizer = null

        if (silentVad == null) {
            silentVad = SilentWakeVad(
                context = this,
                onSpeechOnset = {
                    if (!isRunning || isMicPausedByForegroundApp || MicHardwareCoordinator.isCommandSessionActive || isBgCommandRunning) {
                        return@SilentWakeVad
                    }
                    val now = System.currentTimeMillis()
                    if (now - lastWakeProbeMs < 2100L) {
                        mainHandler.postDelayed({ startListeningLoop() }, 700L)
                        return@SilentWakeVad
                    }
                    lastWakeProbeMs = now
                    mainHandler.postDelayed({ runSingleWakeRecognitionPass() }, 150L)
                },
                onSpeechCaptured = { wavBytes ->
                    if (!isRunning || isMicPausedByForegroundApp || MicHardwareCoordinator.isCommandSessionActive || isBgCommandRunning) {
                        return@SilentWakeVad
                    }
                    val now = System.currentTimeMillis()
                    if (now - lastWakeProbeMs < 1900L) {
                        mainHandler.postDelayed({ startListeningLoop() }, 650L)
                        return@SilentWakeVad
                    }
                    lastWakeProbeMs = now
                    verifyWakeClipInBackground(wavBytes)
                }
            )
        }
        silentVad?.start()
    }

    private fun verifyWakeClipInBackground(wavBytes: ByteArray) {
        val wakeNames = listOf("jarvis", "wasu", "wasi ki jan", "wasi")
        wakeExecutor.execute {
            val res = WakeAudioUtils.checkWakeWordOnline(applicationContext, wavBytes, wakeNames)
            mainHandler.post {
                if (!isRunning || isMicPausedByForegroundApp || MicHardwareCoordinator.isCommandSessionActive || isBgCommandRunning) return@post
                if (res.matched) {
                    triggerAppWakeLaunch(res.matchedPhrase, res.trailingCommand)
                    return@post
                }
                if (res.networkOk) {
                    mainHandler.postDelayed({ startListeningLoop() }, 280L)
                } else {
                    runSingleWakeRecognitionPass()
                }
            }
        }
    }

    private fun createBgSpeechRecognizer(): SpeechRecognizer? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                if (SpeechRecognizer.isOnDeviceRecognitionAvailable(this)) {
                    return SpeechRecognizer.createOnDeviceSpeechRecognizer(this)
                }
            } catch (_: Exception) {}
        }
        return if (SpeechRecognizer.isRecognitionAvailable(this)) {
            SpeechRecognizer.createSpeechRecognizer(this)
        } else null
    }

    private fun runSingleWakeRecognitionPass() {
        if (!isRunning || isMicPausedByForegroundApp || MicHardwareCoordinator.isCommandSessionActive || isBgCommandRunning) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return
        try {
            val rec = createBgSpeechRecognizer()
            if (rec == null) {
                mainHandler.postDelayed({ startListeningLoop() }, 2200L)
                return
            }
            speechRecognizer?.cancel()
            speechRecognizer?.destroy()
            speechRecognizer = rec
            speechRecognizer?.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {}
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onError(error: Int) {
                    try { speechRecognizer?.destroy() } catch (_: Exception) {}
                    speechRecognizer = null
                    if (isRunning && !isMicPausedByForegroundApp && !MicHardwareCoordinator.isCommandSessionActive && !isBgCommandRunning) {
                        mainHandler.postDelayed({ startListeningLoop() }, 1200L)
                    }
                }
                override fun onResults(results: Bundle?) {
                    val matched = handleSpeechResults(results)
                    try { speechRecognizer?.destroy() } catch (_: Exception) {}
                    speechRecognizer = null
                    if (!matched && isRunning && !isMicPausedByForegroundApp && !MicHardwareCoordinator.isCommandSessionActive && !isBgCommandRunning) {
                        mainHandler.postDelayed({ startListeningLoop() }, 650L)
                    }
                }
                override fun onPartialResults(partialResults: Bundle?) {
                    handleSpeechResults(partialResults)
                }
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })

            val recIntent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 3800L)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 3000L)
            }
            speechRecognizer?.startListening(recIntent)
        } catch (_: Exception) {
            if (isRunning && !isMicPausedByForegroundApp && !MicHardwareCoordinator.isCommandSessionActive && !isBgCommandRunning) {
                mainHandler.postDelayed({ startListeningLoop() }, 1800L)
            }
        }
    }

    private fun wakeScreenBriefly() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
            @Suppress("DEPRECATION")
            val screenLock = pm?.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "WasuJarvis::WakeScreenLock"
            )
            screenLock?.acquire(5500L)
        } catch (_: Exception) {}
    }

    /**
     * When app UI is closed or user is playing a game / on lockscreen, Jarvis stays on the floating Dynamic Bar
     * instead of interrupting full-screen apps, unless the user explicitly says "open jarvis".
     */
    private fun triggerAppWakeLaunch(matched: String, trailingCommand: String = "") {
        wakeScreenBriefly()
        val hasOverlay = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this)
        val fgActive = QNexusPlugin.instance?.isForegroundActive == true

        if (fgActive) {
            isMicPausedByForegroundApp = true
            stopBgRecognizerInternal()
            QNexusPlugin.setPendingWakePayload(matched, trailingCommand)
            QNexusPlugin.instance?.emitWakeEvent(matched, trailingCommand)
            return
        }

        if (hasOverlay) {
            triggerBgDynamicBarSession(trailingCommand)
            return
        }

        // Fallback when overlay permission wasn't granted: bring MainActivity forward
        isMicPausedByForegroundApp = true
        stopBgRecognizerInternal()
        QNexusPlugin.setPendingWakePayload(matched, trailingCommand)
        val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP
            )
            putExtra("wake_phrase", matched)
            putExtra("wake_trailing_cmd", trailingCommand)
        }
        if (launch != null) {
            try { startActivity(launch) } catch (_: Exception) {}
        }
        QNexusPlugin.instance?.emitWakeEvent(matched, trailingCommand)
    }

    private fun triggerBgDynamicBarSession(
        trailingCommand: String,
        isFollowUp: Boolean = false,
        directReplyKey: String = "",
        directReplySender: String = ""
    ) {
        if (isBgCommandRunning) return
        isBgCommandRunning = true
        MicHardwareCoordinator.isCommandSessionActive = true
        stopBgRecognizerInternal()
        MicHardwareCoordinator.forceReleaseAllWakeAudio(450L)

        if (trailingCommand.isNotBlank() && !isFollowUp) {
            pushOverlayVoiceState("processing", trailingCommand, 0.5f)
            executeBgTranscriptOrAudio(trailingCommand, null, allowFollowUp = true, directReplyKey = directReplyKey, directReplySender = directReplySender)
            return
        }

        val prompt = when {
            directReplyKey.isNotEmpty() -> "${directReplySender.ifBlank { "Contact" }} ke liye jawab bolein"
            isFollowUp -> "Kuch aur kehna hai?"
            else -> "Sun rahi hoon, bolein aap"
        }
        speakBgLine(prompt) {
            pushOverlayVoiceState("listening", prompt, 0.2f)
            val recorder = SilentCommandRecorder(
                context = this,
                onReady = {
                    pushOverlayVoiceState("listening", prompt, 0.22f)
                },
                onRmsLevel = { norm ->
                    pushOverlayVoiceState("listening", prompt, norm)
                },
                onFinished = { wav ->
                    bgCmdRecorder = null
                    if (wav == null) {
                        if (isFollowUp || directReplyKey.isNotEmpty()) {
                            finishBgSession(rearm = true)
                        } else {
                            speakBgLine("Awaaz clear nahi aayi, dobara bolein.") {
                                finishBgSession(rearm = true)
                            }
                        }
                        return@SilentCommandRecorder
                    }
                    pushOverlayVoiceState("processing", "Samajh rahi hoon...", 0.4f)
                    executeBgTranscriptOrAudio("", wav, allowFollowUp = !isFollowUp && directReplyKey.isEmpty(), directReplyKey = directReplyKey, directReplySender = directReplySender)
                }
            )
            bgCmdRecorder = recorder
            recorder.start()
        }
    }

    private fun executeBgTranscriptOrAudio(
        directText: String,
        wavBytes: ByteArray?,
        allowFollowUp: Boolean,
        directReplyKey: String = "",
        directReplySender: String = ""
    ) {
        wakeExecutor.execute {
            var cmdText = directText.trim()
            var cloudReply = ""
            var cloudAction = "NONE"
            var cloudPayload = "{}"
            var silentDrop = false

            if (cmdText.isEmpty() && wavBytes != null) {
                val res = WakeAudioUtils.executeBackgroundCommandOnline(
                    applicationContext,
                    wavBytes,
                    language = "ur",
                    characterGender = "female",
                    personalityName = "Wasi ki Jan"
                )
                silentDrop = res.silentAudio
                if (!res.silentAudio) {
                    cmdText = res.transcript
                    cloudReply = res.reply
                    cloudAction = res.action
                    cloudPayload = res.actionPayloadJson
                }
            } else if (cmdText.isNotEmpty() && cloudReply.isEmpty() && directReplyKey.isEmpty()) {
                val textRes = WakeAudioUtils.queryBackgroundTextChatOnline(
                    applicationContext,
                    cmdText,
                    language = "ur",
                    characterGender = "female",
                    personalityName = "Wasi ki Jan"
                )
                if (textRes.reply.isNotBlank()) {
                    cloudReply = textRes.reply
                    cloudAction = textRes.action
                    cloudPayload = textRes.actionPayloadJson
                }
            }

            mainHandler.post {
                if (directReplyKey.isNotEmpty()) {
                    val replyBody = cmdText.trim()
                    if (replyBody.isNotEmpty()) {
                        val sent = QNexusNotificationService.sendDirectReply(this@JarvisWakeForegroundService, directReplyKey, replyBody)
                        val confirmLine = if (sent) "${directReplySender.ifBlank { "Contact" }} ko reply bhej diya hai." else "Reply send nahi ho saka."
                        speakBgLine(confirmLine) { finishBgSession(rearm = true) }
                    } else {
                        speakBgLine("Jawab clear sunayi nahi diya.") { finishBgSession(rearm = true) }
                    }
                    return@post
                }

                if (cmdText.isEmpty() && cloudReply.isEmpty()) {
                    if (silentDrop) {
                        finishBgSession(rearm = true)
                    } else {
                        speakBgLine("Awaaz saaf nahi aayi ya internet slow hai, dobara bolein.") {
                            finishBgSession(rearm = true)
                        }
                    }
                    return@post
                }

                val handledLocally = handleLocalBgCommand(cmdText, cloudAction, cloudPayload)
                if (handledLocally != null) {
                    speakBgLine(handledLocally) {
                        maybeRunFollowUp(allowFollowUp)
                    }
                    return@post
                }

                val finalReply = cloudReply.ifBlank { "Ji, main Wasu's Jarvis hazir hoon." }
                speakBgLine(finalReply) {
                    maybeRunFollowUp(allowFollowUp)
                }
            }
        }
    }

    private fun maybeRunFollowUp(allowFollowUp: Boolean) {
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val followEnabled = prefs.getBoolean("follow_up_listening", true)
        if (!allowFollowUp || !followEnabled || !isRunning) {
            finishBgSession(rearm = true)
            return
        }
        isBgCommandRunning = false
        triggerBgDynamicBarSession("", isFollowUp = true)
    }

    private fun finishBgSession(rearm: Boolean) {
        isBgCommandRunning = false
        MicHardwareCoordinator.isCommandSessionActive = false
        pushOverlayVoiceState("standby", "", 0f)
        if (rearm && isRunning && !isMicPausedByForegroundApp) {
            mainHandler.postDelayed({ startListeningLoop() }, 550L)
        }
    }

    private fun handleLocalBgCommand(text: String, cloudAction: String, cloudPayloadJson: String): String? {
        val lower = text.lowercase(Locale.US)
        if (lower.contains("bas karo") || lower.contains("shukriya") || lower.contains("kuch nahi") || lower == "no" || lower == "nahi") {
            return "Theek hai, main standby par hoon."
        }
        if (lower.contains("time") || lower.contains("waqt") || lower.contains("kitne baje") || lower.contains("kya baja")) {
            val t = SimpleDateFormat("h:mm a", Locale.US).format(Date())
            return "Is waqt $t baje hain."
        }
        if (lower.contains("date") || lower.contains("tareekh") || lower.contains("aaj kya din")) {
            val d = SimpleDateFormat("EEEE, d MMMM", Locale.US).format(Date())
            return "Aaj $d hai."
        }
        if (lower.contains("battery") || lower.contains("charge kitni") || lower.contains("kitni charging")) {
            val bm = getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
            val pct = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
            return if (pct in 0..100) "Phone ki battery is waqt $pct percent hai." else "Battery status read nahi ho saka."
        }
        if (lower.contains("notification") || lower.contains("whatsapp") || lower.contains("msg") || lower.contains("message")) {
            QNexusNotificationService.loadPersistedIfEmpty(applicationContext)
            val list = QNexusNotificationService.recentNotifications
            if (list.isEmpty()) {
                return "Abhi koi naya notification ya message nahi hai."
            }
            val latest = list[0]
            val app = latest.optString("appName", "App")
            val sender = latest.optString("title", "")
            val body = latest.optString("text", "")
            return "$app par $sender ka message hai: ${body.take(90)}"
        }
        if (lower.contains("open jarvis") || lower.contains("jarvis kholo") || lower.contains("app kholo")) {
            val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            }
            if (launch != null) {
                try { startActivity(launch) } catch (_: Exception) {}
            }
            return "Jarvis app khol rahi hoon."
        }
        if (lower.contains("call uthao") || lower.contains("answer call") || lower.contains("receive call") || lower.contains("call receive")) {
            val ok = handleTelecomCallAction(accept = true)
            return if (ok) "Call receive kar li hai." else "Call receive karne ke liye Answer Phone permission on karein."
        }
        if (lower.contains("call kato") || lower.contains("reject call") || lower.contains("end call") || lower.contains("call band")) {
            val ok = handleTelecomCallAction(accept = false)
            return if (ok) "Call band kar di hai." else "Active call band nahi ho saki."
        }
        if (lower.contains("reminder band") || lower.contains("ok samajh") || lower.contains("acknowledge")) {
            QNexusNotificationService.clearVipReminders()
            return "VIP reminders band kar diye hain."
        }
        if (lower.contains("torch on") || lower.contains("flash on") || lower.contains("light on")) {
            setTorch(true)
            return "Torch on kar di hai."
        }
        if (lower.contains("torch off") || lower.contains("flash off") || lower.contains("light off")) {
            setTorch(false)
            return "Torch off kar di hai."
        }
        if (cloudAction.equals("WHATSAPP_DIRECT_REPLY", ignoreCase = true) || cloudAction.equals("SEND_WHATSAPP", ignoreCase = true)) {
            try {
                val p = JSONObject(cloudPayloadJson)
                val target = p.optString("recipient", p.optString("name", ""))
                val msg = p.optString("message", p.optString("text", ""))
                if (target.isNotBlank() && msg.isNotBlank()) {
                    val match = QNexusNotificationService.findReplyKeyByTarget(target, "")
                    if (match != null && QNexusNotificationService.sendDirectReply(this, match.first, msg)) {
                        return "${match.second} ko reply bhej diya hai."
                    }
                }
            } catch (_: Exception) {}
        }
        if (cloudAction.equals("OPEN_APP", ignoreCase = true)) {
            try {
                val p = JSONObject(cloudPayloadJson)
                val appQ = p.optString("appName", "").lowercase(Locale.US)
                if (appQ.isNotEmpty() && launchAppByName(appQ)) {
                    return "$appQ khol rahi hoon."
                }
            } catch (_: Exception) {}
        }
        return null
    }

    private fun handleTelecomCallAction(accept: Boolean): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ANSWER_PHONE_CALLS) != PackageManager.PERMISSION_GRANTED) {
            return false
        }
        return try {
            val tm = getSystemService(Context.TELECOM_SERVICE) as? TelecomManager ?: return false
            if (accept) {
                @Suppress("DEPRECATION")
                tm.acceptRingingCall()
                true
            } else {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    @Suppress("DEPRECATION")
                    tm.endCall()
                } else {
                    false
                }
            }
        } catch (_: Exception) {
            false
        }
    }

    private fun setTorch(enable: Boolean) {
        try {
            val cm = getSystemService(Context.CAMERA_SERVICE) as? CameraManager ?: return
            for (id in cm.cameraIdList) {
                val hasFlash = cm.getCameraCharacteristics(id).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
                if (hasFlash) {
                    cm.setTorchMode(id, enable)
                    break
                }
            }
        } catch (_: Exception) {}
    }

    private fun launchAppByName(query: String): Boolean {
        return try {
            val pm = packageManager
            val main = Intent(Intent.ACTION_MAIN, null).apply { addCategory(Intent.CATEGORY_LAUNCHER) }
            val list = pm.queryIntentActivities(main, 0)
            for (ri in list) {
                val label = ri.loadLabel(pm)?.toString()?.lowercase(Locale.US) ?: continue
                if (label.contains(query)) {
                    val launch = pm.getLaunchIntentForPackage(ri.activityInfo.packageName)?.apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    if (launch != null) {
                        startActivity(launch)
                        return true
                    }
                }
            }
            false
        } catch (_: Exception) {
            false
        }
    }

    private fun handleSpeechResults(bundle: Bundle?): Boolean {
        try {
            val matches = bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: return false
            val phrases = getActiveWakePhrases()
            for (raw in matches) {
                val lower = raw.lowercase(Locale.US).trim()
                if (lower.isEmpty()) continue
                val matched = phrases.firstOrNull { lower.contains(it) }
                    ?: if (Regex("\\b(jarvis|jarvish|jarvice|jervis|javis|jarvas|service|wasu|wasi)\\b").containsMatchIn(lower)) "hi jarvis" else null
                if (matched != null) {
                    val idx = lower.indexOf(matched)
                    val trailing = if (idx >= 0) lower.substring(idx + matched.length).trim() else ""
                    triggerAppWakeLaunch(matched, trailing)
                    return true
                }
            }
        } catch (_: Exception) {}
        return false
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        try {
            val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val wakeEnabled = prefs.getBoolean("wake_enabled", false)
            if (wakeEnabled) {
                isMicPausedByForegroundApp = false
                val restartBroadcast = Intent(applicationContext, JarvisBootReceiver::class.java).apply {
                    action = ACTION_RESTART_WAKE_SERVICE
                }
                val pi = PendingIntent.getBroadcast(
                    applicationContext,
                    4043,
                    restartBroadcast,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                val am = getSystemService(Context.ALARM_SERVICE) as? AlarmManager
                am?.setAndAllowWhileIdle(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    SystemClock.elapsedRealtime() + 750L,
                    pi
                )
                ensureOneUiOverlaySynced()
                mainHandler.postDelayed({ startListeningLoop() }, 400L)
            }
        } catch (_: Exception) {}
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        val shouldHeal = try {
            getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("wake_enabled", false)
        } catch (_: Exception) {
            false
        }
        isRunning = false
        isServiceActive = false
        mainHandler.removeCallbacksAndMessages(null)
        stopBgRecognizerInternal()
        try { activityMonitor?.stop() } catch (_: Exception) {}
        try { chargingReceiver?.let { unregisterReceiver(it) } } catch (_: Exception) {}
        try { batteryFullReceiver?.let { unregisterReceiver(it) } } catch (_: Exception) {}
        try { phoneStateReceiver?.let { unregisterReceiver(it) } } catch (_: Exception) {}
        try { screenLockReceiver?.let { unregisterReceiver(it) } } catch (_: Exception) {}
        try { stopBgMediaPlayer() } catch (_: Exception) {}
        try { abandonBgAudioFocus() } catch (_: Exception) {}
        try { bgTts?.stop(); bgTts?.shutdown() } catch (_: Exception) {}
        releasePartialWakeLock()
        try { wakeExecutor.shutdownNow() } catch (_: Exception) {}
        if (shouldHeal) {
            try {
                val restartBroadcast = Intent(applicationContext, JarvisBootReceiver::class.java).apply {
                    action = ACTION_RESTART_WAKE_SERVICE
                }
                val pi = PendingIntent.getBroadcast(
                    applicationContext,
                    4044,
                    restartBroadcast,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                val am = getSystemService(Context.ALARM_SERVICE) as? AlarmManager
                am?.setAndAllowWhileIdle(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    SystemClock.elapsedRealtime() + 1200L,
                    pi
                )
            } catch (_: Exception) {}
        }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
