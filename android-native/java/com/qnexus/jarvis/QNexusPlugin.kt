package com.qnexus.jarvis

import android.Manifest
import android.app.ActivityManager
import android.app.WallpaperManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.database.Cursor
import android.graphics.BitmapFactory
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.media.PlaybackParams
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.StatFs
import android.provider.CallLog
import android.provider.ContactsContract
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.telecom.TelecomManager
import android.telephony.SmsManager
import android.util.Base64
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@CapacitorPlugin(
    name = "QNexusNative",
    permissions = [
        Permission(strings = [Manifest.permission.RECORD_AUDIO], alias = "mic"),
        Permission(
            strings = [
                Manifest.permission.READ_CALL_LOG,
                Manifest.permission.READ_PHONE_STATE,
                Manifest.permission.CALL_PHONE,
                Manifest.permission.READ_CONTACTS
            ],
            alias = "phone"
        ),
        Permission(strings = [Manifest.permission.READ_SMS, Manifest.permission.SEND_SMS], alias = "sms"),
        Permission(strings = [Manifest.permission.CAMERA], alias = "camera")
    ]
)
class QNexusPlugin : Plugin() {

    companion object {
        var instance: QNexusPlugin? = null
        private const val REQ_CORE_PERMS = 9001
        private const val REQ_MIC_ONLY = 9002
        private const val REQ_COMMS_PERMS = 9003
        private const val REQ_CONTACTS_CALL = 9004

        @Volatile
        private var pendingWakePhrase: String? = null
        @Volatile
        private var pendingWakeTrailing: String? = null
        @Volatile
        private var pendingStudioTarget: String? = null

        fun setPendingWakePayload(phrase: String, trailing: String = "") {
            pendingWakePhrase = phrase
            pendingWakeTrailing = trailing
        }

        fun setPendingStudioTarget(target: String) {
            pendingStudioTarget = target
        }
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val wakeExecutor = Executors.newSingleThreadExecutor()
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var cmdRecognizer: SpeechRecognizer? = null
    private var wakeRecognizer: SpeechRecognizer? = null
    private var foregroundWakeVad: SilentWakeVad? = null
    private var silentCommandRecorder: SilentCommandRecorder? = null
    private var wakeWordEnabled = false
    private var isListeningCommand = false
    private var isSpeakingTts = false
    private var onlineTtsPlayer: MediaPlayer? = null
    @Volatile
    private var onlineTtsSeq = 0
    private var cmdSessionSeq = 0
    @Volatile
    private var activeJsSessionId = 0
    private var lastFgWakeProbeMs = 0L
    private var fgActivityMonitor: UserActivityMonitor? = null

    private var wakePhrases: List<String> = listOf(
        "hi jarvis", "hey jarvis", "hello jarvis", "wake up jarvis",
        "suno jarvis", "ok jarvis", "jarvis", "wasu", "wasi ki jan"
    )
    private var pendingMicCall: PluginCall? = null
    private var pendingCoreCall: PluginCall? = null
    private var pendingCommsCall: PluginCall? = null
    private var pendingSpeak: (() -> Unit)? = null

    @Volatile
    var isForegroundActive: Boolean = true

    override fun load() {
        super.load()
        instance = this
        isForegroundActive = true
        initNativeTts()
        try {
            fgActivityMonitor = UserActivityMonitor(context.applicationContext).also { it.start() }
        } catch (_: Exception) {}
    }

    override fun handleOnResume() {
        super.handleOnResume()
        isForegroundActive = true
        try {
            val statusJson = buildPermissionStatusJson()
            emitSimple("nativePermissionsChanged", statusJson)
            if (statusJson.optBoolean("notifListener", false) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                NotificationListenerService.requestRebind(
                    ComponentName(context, QNexusNotificationService::class.java)
                )
            }
        } catch (_: Exception) {}
        if (JarvisWakeForegroundService.isServiceActive) {
            try {
                val intent = Intent(context, JarvisWakeForegroundService::class.java).apply {
                    action = JarvisWakeForegroundService.ACTION_PAUSE_MIC
                }
                context.startService(intent)
            } catch (_: Exception) {}
        }
        if (wakeWordEnabled && !isListeningCommand && !isSpeakingTts) {
            mainHandler.postDelayed({ startWakeRecognizerInternal() }, 500)
        }
    }

    override fun handleOnPause() {
        isForegroundActive = false
        mainHandler.post { stopWakeRecognizerInternal() }
        val wakePref = try {
            context.getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
                .getBoolean("wake_enabled", false)
        } catch (_: Exception) {
            false
        }
        if (wakePref && JarvisWakeForegroundService.isServiceActive) {
            try {
                val intent = Intent(context, JarvisWakeForegroundService::class.java).apply {
                    action = JarvisWakeForegroundService.ACTION_RESUME_MIC
                }
                context.startService(intent)
            } catch (_: Exception) {}
        }
        super.handleOnPause()
    }

    override fun handleOnDestroy() {
        isForegroundActive = false
        wakeWordEnabled = false
        mainHandler.removeCallbacksAndMessages(null)
        try { fgActivityMonitor?.stop() } catch (_: Exception) {}
        fgActivityMonitor = null
        try { foregroundWakeVad?.stop() } catch (_: Exception) {}
        try { silentCommandRecorder?.cancel() } catch (_: Exception) {}
        try { cmdRecognizer?.destroy() } catch (_: Exception) {}
        try { wakeRecognizer?.destroy() } catch (_: Exception) {}
        try { stopOnlineTtsPlayer() } catch (_: Exception) {}
        try {
            tts?.stop()
            tts?.shutdown()
        } catch (_: Exception) {}
        try { wakeExecutor.shutdownNow() } catch (_: Exception) {}
        foregroundWakeVad = null
        silentCommandRecorder = null
        cmdRecognizer = null
        wakeRecognizer = null
        tts = null
        ttsReady = false
        if (instance === this) {
            instance = null
        }
        val wakePref = try {
            context.getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
                .getBoolean("wake_enabled", false)
        } catch (_: Exception) {
            false
        }
        if (wakePref && JarvisWakeForegroundService.isServiceActive) {
            try {
                val intent = Intent(context, JarvisWakeForegroundService::class.java).apply {
                    action = JarvisWakeForegroundService.ACTION_RESUME_MIC
                }
                context.startService(intent)
            } catch (_: Exception) {}
        }
        super.handleOnDestroy()
    }

    private fun initNativeTts() {
        if (tts != null) return
        try {
            tts = TextToSpeech(context.applicationContext) { status ->
                if (status == TextToSpeech.SUCCESS) {
                    try {
                        tts?.setAudioAttributes(
                            AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_ASSISTANT)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                .build()
                        )
                    } catch (_: Exception) {}
                    tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                        override fun onStart(utteranceId: String?) {
                            isSpeakingTts = true
                            WakeSpeechSuppressor.setTtsActive(true)
                            stopWakeRecognizerInternal()
                            emitSimple("nativeTtsStart", JSObject())
                        }

                        override fun onDone(utteranceId: String?) {
                            isSpeakingTts = false
                            WakeSpeechSuppressor.setTtsActive(false, 1300L)
                            emitSimple("nativeTtsDone", JSObject())
                            if (wakeWordEnabled && !isListeningCommand && !MicHardwareCoordinator.isCommandSessionActive) {
                                mainHandler.postDelayed({ startWakeRecognizerInternal() }, 1400L)
                            }
                        }

                        @Deprecated("Deprecated in Java")
                        override fun onError(utteranceId: String?) {
                            isSpeakingTts = false
                            WakeSpeechSuppressor.setTtsActive(false, 900L)
                            emitSimple("nativeTtsDone", JSObject())
                            if (wakeWordEnabled && !isListeningCommand && !MicHardwareCoordinator.isCommandSessionActive) {
                                mainHandler.postDelayed({ startWakeRecognizerInternal() }, 1000L)
                            }
                        }
                    })
                    ttsReady = true
                    val queued = pendingSpeak
                    pendingSpeak = null
                    queued?.invoke()
                }
            }
        } catch (_: Exception) {
            ttsReady = false
        }
    }

    private fun emitSimple(eventName: String, data: JSObject) {
        try {
            notifyListeners(eventName, data)
        } catch (_: Exception) {
        }
    }

    fun emitWakeEvent(phrase: String, trailingCommand: String = "") {
        val data = JSObject()
        data.put("phrase", phrase)
        data.put("trailingCommand", trailingCommand)
        emitSimple("wakeWordTriggered", data)
    }

    fun emitStudioLaunchEvent(target: String) {
        val data = JSObject()
        data.put("target", target)
        emitSimple("openStudioRequested", data)
    }

    @PluginMethod
    fun consumePendingStudioLaunch(call: PluginCall) {
        val target = pendingStudioTarget
        pendingStudioTarget = null
        val res = JSObject()
        res.put("hasPending", !target.isNullOrBlank())
        res.put("target", target ?: "")
        call.resolve(res)
    }

    fun emitNotificationEvent(item: JSObject) {
        emitSimple("nativeNotificationReceived", item)
    }

    fun emitUserActivityEvent(state: String, speedMps: Float) {
        val data = JSObject()
        data.put("state", state)
        data.put("speedMps", speedMps.toDouble())
        emitSimple("userActivityChanged", data)
    }

    fun emitVipReminderEvent(sender: String, text: String) {
        val data = JSObject()
        data.put("sender", sender)
        data.put("text", text)
        emitSimple("vipReminderTriggered", data)
    }

    @PluginMethod
    fun consumePendingWakeEvent(call: PluginCall) {
        val phrase = pendingWakePhrase
        val trailing = pendingWakeTrailing ?: ""
        pendingWakePhrase = null
        pendingWakeTrailing = null
        val res = JSObject()
        res.put("hasPending", !phrase.isNullOrBlank())
        res.put("phrase", phrase ?: "")
        res.put("trailingCommand", trailing)
        call.resolve(res)
    }

    @PluginMethod
    fun setCloudApiBaseUrl(call: PluginCall) {
        val url = call.getString("url")?.trim()?.trimEnd('/') ?: ""
        if (url.startsWith("http")) {
            try {
                context.getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
                    .edit()
                    .putString("cloud_api_base", url)
                    .apply()
            } catch (_: Exception) {}
        }
        val res = JSObject()
        res.put("ok", true)
        res.put("url", WakeAudioUtils.getCloudApiBase(context))
        call.resolve(res)
    }

    fun onNativePermissionsUpdated(requestCode: Int) {
        mainHandler.post {
            when (requestCode) {
                REQ_MIC_ONLY -> {
                    val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                    pendingMicCall?.let { c ->
                        val res = JSObject()
                        res.put("ok", granted)
                        res.put("granted", granted)
                        c.resolve(res)
                        pendingMicCall = null
                    }
                    if (granted && wakeWordEnabled && !isListeningCommand && !isSpeakingTts) {
                        startWakeRecognizerInternal()
                    }
                }
                REQ_CORE_PERMS -> {
                    pendingCoreCall?.let { c ->
                        c.resolve(buildPermissionStatusJson())
                        pendingCoreCall = null
                    }
                }
                REQ_COMMS_PERMS, REQ_CONTACTS_CALL -> {
                    pendingCommsCall?.let { c ->
                        c.resolve(buildPermissionStatusJson())
                        pendingCommsCall = null
                    }
                }
            }
            emitSimple("nativePermissionsChanged", buildPermissionStatusJson())
        }
    }

    private fun buildPermissionStatusJson(): JSObject {
        val mic = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        val camera = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        val location = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val phone = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED
        val callPhone = ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED
        val contacts = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
        val sms = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
        val notifications = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        } else true
        val notifListener = try {
            NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
        } catch (_: Exception) {
            false
        }
        val overlay = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) Settings.canDrawOverlays(context) else true
        } catch (_: Exception) {
            false
        }
        val res = JSObject()
        res.put("ok", true)
        res.put("mic", mic)
        res.put("camera", camera)
        res.put("notifications", notifications)
        res.put("location", location)
        res.put("phone", phone)
        res.put("callPhone", callPhone)
        res.put("contacts", contacts)
        res.put("sms", sms)
        res.put("notifListener", notifListener)
        res.put("overlay", overlay)
        res.put("sdkInt", Build.VERSION.SDK_INT)
        return res
    }

    @PluginMethod
    fun getPermissionStatus(call: PluginCall) {
        call.resolve(buildPermissionStatusJson())
    }

    @PluginMethod
    fun getOverlayPermissionStatus(call: PluginCall) {
        val granted = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) Settings.canDrawOverlays(context) else true
        } catch (_: Exception) {
            false
        }
        val res = JSObject()
        res.put("ok", true)
        res.put("granted", granted)
        call.resolve(res)
    }

    @PluginMethod
    fun openOverlayPermissionSettings(call: PluginCall) {
        try {
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}"))
            } else {
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            val res = JSObject()
            res.put("ok", true)
            call.resolve(res)
        } catch (_: Exception) {
            openAppInfoSettings(call)
        }
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        if (JarvisAccessibilityOverlayService.isRunning || DynamicIslandOverlayController.isAccessibilityOverlayActive) {
            return true
        }
        return try {
            val enabledServices = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: ""
            enabledServices.contains("${context.packageName}/.JarvisAccessibilityOverlayService") ||
                enabledServices.contains("JarvisAccessibilityOverlayService")
        } catch (_: Exception) {
            false
        }
    }

    @PluginMethod
    fun getAccessibilityStatus(call: PluginCall) {
        val enabled = isAccessibilityServiceEnabled()
        val res = JSObject()
        res.put("ok", true)
        res.put("enabled", enabled)
        call.resolve(res)
    }

    @PluginMethod
    fun openAccessibilitySettings(call: PluginCall) {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            val res = JSObject()
            res.put("ok", true)
            call.resolve(res)
        } catch (_: Exception) {
            openAppInfoSettings(call)
        }
    }

    @PluginMethod
    fun syncCustomMediaImage(call: PluginCall) {
        val kind = (call.getString("kind") ?: "bio").lowercase(Locale.US)
        val dataUrl = call.getString("dataUrl") ?: ""
        val fileName = if (kind == "wallpaper") "custom_lock_wallpaper.png" else "custom_biometric.png"
        wakeExecutor.execute {
            try {
                val outFile = File(context.filesDir, fileName)
                if (dataUrl.isBlank()) {
                    if (outFile.exists()) outFile.delete()
                } else {
                    val b64 = if (dataUrl.contains(",")) dataUrl.substringAfter(",") else dataUrl
                    val bytes = Base64.decode(b64, Base64.DEFAULT)
                    FileOutputStream(outFile).use { fos ->
                        fos.write(bytes)
                        fos.flush()
                    }
                }
                mainHandler.post {
                    DynamicIslandOverlayController.dispatchRefreshConfig()
                    val res = JSObject()
                    res.put("ok", true)
                    call.resolve(res)
                }
            } catch (e: Exception) {
                mainHandler.post {
                    val res = JSObject()
                    res.put("ok", false)
                    res.put("message", e.message ?: "Media sync error")
                    call.resolve(res)
                }
            }
        }
    }

    @PluginMethod
    fun requestMicPermission(call: PluginCall) {
        val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        if (granted) {
            val res = JSObject()
            res.put("ok", true)
            res.put("granted", true)
            call.resolve(res)
            return
        }
        val act = activity
        if (act == null || act.isFinishing) {
            val res = JSObject()
            res.put("ok", false)
            res.put("granted", false)
            call.resolve(res)
            return
        }
        pendingMicCall = call
        ActivityCompat.requestPermissions(act, arrayOf(Manifest.permission.RECORD_AUDIO), REQ_MIC_ONLY)
    }

    @PluginMethod
    fun requestCorePermissions(call: PluginCall) {
        val act = activity
        if (act == null || act.isFinishing) {
            call.resolve(buildPermissionStatusJson())
            return
        }
        val perms = mutableListOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CAMERA,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.CALL_PHONE,
            Manifest.permission.READ_PHONE_STATE
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            perms.add(Manifest.permission.ANSWER_PHONE_CALLS)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            perms.add(Manifest.permission.ACTIVITY_RECOGNITION)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        val missing = perms.filter {
            ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            call.resolve(buildPermissionStatusJson())
            return
        }
        pendingCoreCall = call
        ActivityCompat.requestPermissions(act, missing.toTypedArray(), REQ_CORE_PERMS)
    }

    @PluginMethod
    fun requestCommsPermissions(call: PluginCall) {
        val act = activity
        if (act == null || act.isFinishing) {
            call.resolve(buildPermissionStatusJson())
            return
        }
        val perms = listOf(
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.CALL_PHONE,
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.READ_SMS,
            Manifest.permission.SEND_SMS
        )
        val missing = perms.filter {
            ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            call.resolve(buildPermissionStatusJson())
            return
        }
        pendingCommsCall = call
        ActivityCompat.requestPermissions(act, missing.toTypedArray(), REQ_COMMS_PERMS)
    }

    @PluginMethod
    fun openAppInfoSettings(call: PluginCall) {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            val res = JSObject()
            res.put("ok", true)
            call.resolve(res)
        } catch (_: Exception) {
            val res = JSObject()
            res.put("ok", false)
            call.resolve(res)
        }
    }

    @PluginMethod
    fun openInstalledApp(call: PluginCall) {
        val rawName = (call.getString("appName") ?: "").trim()
        if (rawName.isEmpty()) {
            val res = JSObject()
            res.put("ok", false)
            res.put("message", "Kis app ko open karna hai? Naam bolein.")
            call.resolve(res)
            return
        }
        val q = rawName.lowercase(Locale.US)
            .replace(Regex("\\b(app|open|kholo|khol|do|karo|kro|launch|start|please)\\b"), "")
            .trim()
            .ifEmpty { rawName.lowercase(Locale.US) }

        val aliases = mapOf(
            "whatsapp" to listOf("com.whatsapp", "com.whatsapp.w4b", "whatsapp"),
            "watsapp" to listOf("com.whatsapp", "com.whatsapp.w4b", "whatsapp"),
            "youtube" to listOf("com.google.android.youtube", "youtube"),
            "chrome" to listOf("com.android.chrome", "chrome"),
            "camera" to listOf("camera", "cam"),
            "settings" to listOf("com.android.settings", "settings"),
            "setting" to listOf("com.android.settings", "settings"),
            "gallery" to listOf("gallery", "photos", "com.google.android.apps.photos"),
            "photos" to listOf("com.google.android.apps.photos", "gallery", "photos"),
            "phone" to listOf("dialer", "phone", "contacts"),
            "dialer" to listOf("dialer", "phone"),
            "contacts" to listOf("contacts", "phone"),
            "messages" to listOf("messaging", "mms", "messages"),
            "sms" to listOf("messaging", "mms", "messages"),
            "maps" to listOf("com.google.android.apps.maps", "maps"),
            "map" to listOf("com.google.android.apps.maps", "maps"),
            "instagram" to listOf("com.instagram.android", "instagram"),
            "insta" to listOf("com.instagram.android", "instagram"),
            "facebook" to listOf("com.facebook.katana", "facebook"),
            "fb" to listOf("com.facebook.katana", "facebook"),
            "messenger" to listOf("com.facebook.orca", "messenger"),
            "tiktok" to listOf("com.zhiliaoapp.musically", "com.ss.android.ugc.trill", "tiktok"),
            "snapchat" to listOf("com.snapchat.android", "snapchat"),
            "gmail" to listOf("com.google.android.gm", "gmail"),
            "play store" to listOf("com.android.vending", "play store"),
            "playstore" to listOf("com.android.vending", "play store"),
            "calculator" to listOf("calculator"),
            "clock" to listOf("deskclock", "clock", "alarm"),
            "alarm" to listOf("deskclock", "clock", "alarm"),
            "spotify" to listOf("com.spotify.music", "spotify"),
            "telegram" to listOf("org.telegram.messenger", "telegram")
        )

        try {
            val pm = context.packageManager
            val aliasTargets = aliases.entries.firstOrNull { q.contains(it.key) }?.value ?: emptyList()

            // Try direct package alias first
            for (pkgCandidate in aliasTargets) {
                if (pkgCandidate.contains(".")) {
                    val directLaunch = pm.getLaunchIntentForPackage(pkgCandidate)
                    if (directLaunch != null) {
                        directLaunch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        context.startActivity(directLaunch)
                        val appLabel = try {
                            val ai = pm.getApplicationInfo(pkgCandidate, 0)
                            pm.getApplicationLabel(ai).toString()
                        } catch (_: Exception) { rawName }
                        val res = JSObject()
                        res.put("ok", true)
                        res.put("appName", appLabel)
                        res.put("message", "$appLabel open kar diya gaya hai!")
                        call.resolve(res)
                        return
                    }
                }
            }

            // Search all installed launcher apps
            val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            val apps = pm.queryIntentActivities(mainIntent, 0)
            var bestPkg: String? = null
            var bestLabel: String = rawName
            var bestScore = 0

            val terms = (listOf(q) + aliasTargets).distinct()
            for (ri in apps) {
                val pkg = ri.activityInfo?.packageName ?: continue
                val label = ri.loadLabel(pm)?.toString() ?: continue
                val labelLower = label.lowercase(Locale.US)
                val pkgLower = pkg.lowercase(Locale.US)

                var score = 0
                for (t in terms) {
                    if (labelLower == t) score = maxOf(score, 100)
                    else if (labelLower.startsWith(t)) score = maxOf(score, 85)
                    else if (labelLower.contains(t)) score = maxOf(score, 70)
                    else if (pkgLower.contains(t)) score = maxOf(score, 60)
                }
                if (score > bestScore) {
                    bestScore = score
                    bestPkg = pkg
                    bestLabel = label
                }
            }

            if (bestPkg != null && bestScore >= 60) {
                val launch = pm.getLaunchIntentForPackage(bestPkg)
                if (launch != null) {
                    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(launch)
                    val res = JSObject()
                    res.put("ok", true)
                    res.put("appName", bestLabel)
                    res.put("message", "$bestLabel open kar diya gaya hai!")
                    call.resolve(res)
                    return
                }
            }

            val res = JSObject()
            res.put("ok", false)
            res.put("message", "Phone mein '$rawName' app nahi mila.")
            call.resolve(res)
        } catch (e: Exception) {
            val res = JSObject()
            res.put("ok", false)
            res.put("message", e.message ?: "App open nahi ho saka.")
            call.resolve(res)
        }
    }

    private fun lookupContactPhone(queryName: String): Pair<String, String>? {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            return null
        }
        val cleanQuery = queryName.trim().lowercase(Locale.US)
        if (cleanQuery.isEmpty()) return null
        val tokens = cleanQuery.split(Regex("\\s+")).filter { it.length >= 2 }

        var bestName: String? = null
        var bestPhone: String? = null
        var bestScore = 0

        try {
            val cursor = context.contentResolver.query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                arrayOf(
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    ContactsContract.CommonDataKinds.Phone.NUMBER
                ),
                null,
                null,
                null
            )
            cursor?.use {
                val nameIdx = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                val numIdx = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                while (it.moveToNext()) {
                    val name = if (nameIdx >= 0) (it.getString(nameIdx) ?: "").trim() else ""
                    val num = if (numIdx >= 0) (it.getString(numIdx) ?: "").trim() else ""
                    if (name.isEmpty() || num.isEmpty()) continue
                    val nl = name.lowercase(Locale.US)
                    var score = 0
                    if (nl == cleanQuery) score = 100
                    else if (nl.startsWith(cleanQuery)) score = 88
                    else if (nl.contains(cleanQuery)) score = 75
                    else if (tokens.isNotEmpty() && tokens.all { t -> nl.contains(t) }) score = 68
                    else if (tokens.any { t -> t.length >= 3 && nl.contains(t) }) score = 50
                    if (score > bestScore) {
                        bestScore = score
                        bestName = name
                        bestPhone = num
                    }
                }
            }
        } catch (_: Exception) {}

        return if (bestPhone != null && bestScore >= 50) {
            Pair(bestName ?: queryName, bestPhone!!)
        } else null
    }

    @PluginMethod
    fun callPhoneContact(call: PluginCall) {
        val rawTarget = (call.getString("target") ?: "").trim()
        if (rawTarget.isEmpty()) {
            val res = JSObject()
            res.put("ok", false)
            res.put("message", "Kis ko call karni hai? Naam ya number bolein.")
            call.resolve(res)
            return
        }

        val digitsOnly = rawTarget.replace(Regex("[^0-9+]"), "")
        val hasDirectPhoneNumber = digitsOnly.replace("+", "").length >= 7

        var resolvedName = rawTarget
        var phoneToCall = if (hasDirectPhoneNumber) digitsOnly else ""

        if (phoneToCall.isEmpty()) {
            val hasContacts = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
            if (!hasContacts) {
                val act = activity
                if (act != null && !act.isFinishing) {
                    ActivityCompat.requestPermissions(
                        act,
                        arrayOf(Manifest.permission.READ_CONTACTS, Manifest.permission.CALL_PHONE),
                        REQ_CONTACTS_CALL
                    )
                }
                val res = JSObject()
                res.put("ok", false)
                res.put("needsPermission", true)
                res.put("message", "Contacts aur Call permission allow karein phir dobara 'Call $rawTarget' bolein.")
                call.resolve(res)
                return
            }
            val match = lookupContactPhone(rawTarget)
            if (match != null) {
                resolvedName = match.first
                phoneToCall = match.second.replace(Regex("[^0-9+]"), "")
            }
        }

        if (phoneToCall.isEmpty()) {
            val res = JSObject()
            res.put("ok", false)
            res.put("message", "Contacts mein '$rawTarget' ka phone number nahi mila.")
            call.resolve(res)
            return
        }

        try {
            val canDirectCall = ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED
            val action = if (canDirectCall) Intent.ACTION_CALL else Intent.ACTION_DIAL
            val callIntent = Intent(action, Uri.parse("tel:$phoneToCall")).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(callIntent)
            val res = JSObject()
            res.put("ok", true)
            res.put("contactName", resolvedName)
            res.put("phone", phoneToCall)
            res.put(
                "message",
                if (canDirectCall) "$resolvedName ($phoneToCall) ko call lagai ja rahi hai!"
                else "$resolvedName ka number dialer mein khol diya hai — Call permission allow karein direct call ke liye."
            )
            call.resolve(res)
        } catch (e: Exception) {
            val res = JSObject()
            res.put("ok", false)
            res.put("message", e.message ?: "Call start nahi ho saki.")
            call.resolve(res)
        }
    }

    @PluginMethod
    fun sendWhatsAppMessage(call: PluginCall) {
        val rawTarget = (call.getString("target") ?: "").trim()
        val message = (call.getString("message") ?: "").trim()
        if (rawTarget.isEmpty() || message.isEmpty()) {
            val res = JSObject()
            res.put("ok", false)
            res.put("message", "Contact ka naam/number aur message dono batayein.")
            call.resolve(res)
            return
        }

        // 1. Instant silent RemoteInput reply if an active WhatsApp notification from target exists
        try {
            val activeNotif = QNexusNotificationService.findReplyKeyByTarget(rawTarget, "whatsapp")
            if (activeNotif != null) {
                val sent = QNexusNotificationService.sendDirectReply(context, activeNotif.first, message)
                if (sent) {
                    val res = JSObject()
                    res.put("ok", true)
                    res.put("mode", "direct_reply")
                    res.put("message", "WhatsApp par ${activeNotif.second} ko direct jawab bhej diya: '$message'")
                    call.resolve(res)
                    return
                }
            }
        } catch (_: Exception) {}

        // 2. Otherwise resolve phone number via Contacts or direct digits and open WhatsApp chat
        val rawDigits = rawTarget.replace(Regex("[^0-9+]"), "")
        var resolvedName = rawTarget
        var rawPhone = if (rawDigits.replace("+", "").length >= 7) rawDigits else ""

        if (rawPhone.isEmpty()) {
            val hasContacts = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
            if (!hasContacts) {
                val act = activity
                if (act != null && !act.isFinishing) {
                    ActivityCompat.requestPermissions(
                        act,
                        arrayOf(Manifest.permission.READ_CONTACTS),
                        REQ_CONTACTS_CALL
                    )
                }
                val res = JSObject()
                res.put("ok", false)
                res.put("message", "Contacts permission allow karein taake $rawTarget ko WhatsApp message bhej sakun.")
                call.resolve(res)
                return
            }
            val match = lookupContactPhone(rawTarget)
            if (match != null) {
                resolvedName = match.first
                rawPhone = match.second.replace(Regex("[^0-9+]"), "")
            }
        }

        if (rawPhone.isEmpty()) {
            val res = JSObject()
            res.put("ok", false)
            res.put("message", "'$rawTarget' ka WhatsApp notification ya contact number nahi mila.")
            call.resolve(res)
            return
        }

        // Normalize into international format for WhatsApp wa.me / api.whatsapp.com (Pakistan 03xx -> 923xx)
        var intlDigits = rawPhone.replace("+", "")
        if (intlDigits.startsWith("00")) {
            intlDigits = intlDigits.substring(2)
        } else if (intlDigits.startsWith("03") && intlDigits.length == 11) {
            intlDigits = "92" + intlDigits.substring(1)
        } else if (intlDigits.startsWith("0") && intlDigits.length >= 10) {
            intlDigits = "92" + intlDigits.substring(1)
        }

        val encodedMsg = Uri.encode(message)
        val waUri = Uri.parse("https://api.whatsapp.com/send?phone=$intlDigits&text=$encodedMsg")

        try {
            val pm = context.packageManager
            val waPkg = listOf("com.whatsapp", "com.whatsapp.w4b").firstOrNull { pkg ->
                pm.getLaunchIntentForPackage(pkg) != null
            }
            val intent = Intent(Intent.ACTION_VIEW, waUri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                if (waPkg != null) setPackage(waPkg)
            }
            context.startActivity(intent)
            val res = JSObject()
            res.put("ok", true)
            res.put("mode", "whatsapp_chat")
            res.put("contactName", resolvedName)
            res.put("message", "$resolvedName ki WhatsApp chat mein message '$message' tayar kar diya hai!")
            call.resolve(res)
        } catch (e: Exception) {
            val res = JSObject()
            res.put("ok", false)
            res.put("message", e.message ?: "WhatsApp open nahi ho saka.")
            call.resolve(res)
        }
    }

    private fun stopOnlineTtsPlayer() {
        onlineTtsSeq++
        try {
            onlineTtsPlayer?.stop()
        } catch (_: Exception) {}
        try {
            onlineTtsPlayer?.release()
        } catch (_: Exception) {}
        onlineTtsPlayer = null
    }

    private fun playOnlineUrduTts(
        text: String,
        tlCode: String,
        gender: String,
        pitchOpt: Float?,
        rateOpt: Float?,
        onFallbackLocal: () -> Unit
    ) {
        val mySeq = ++onlineTtsSeq
        wakeExecutor.execute {
            try {
                val clean = text.replace(Regex("\\s+"), " ").trim()
                val chunks = mutableListOf<String>()
                var remaining = clean
                while (remaining.isNotEmpty() && chunks.size < 5) {
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
                    if (onlineTtsSeq != mySeq) return@execute
                    val encoded = URLEncoder.encode(chunk, "UTF-8")
                    val url = URL("https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=$tlCode&q=$encoded")
                    val conn = (url.openConnection() as HttpURLConnection).apply {
                        requestMethod = "GET"
                        connectTimeout = 3500
                        readTimeout = 4500
                        setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36")
                        setRequestProperty("Referer", "https://translate.google.com/")
                    }
                    try {
                        if (conn.responseCode !in 200..299) {
                            mainHandler.post { onFallbackLocal() }
                            return@execute
                        }
                        conn.inputStream.use { inp ->
                            val buf = ByteArray(4096)
                            while (true) {
                                val r = inp.read(buf)
                                if (r <= 0) break
                                audioOut.write(buf, 0, r)
                            }
                        }
                    } finally {
                        try { conn.disconnect() } catch (_: Exception) {}
                    }
                }
                val mp3Bytes = audioOut.toByteArray()
                if (mp3Bytes.size < 400 || onlineTtsSeq != mySeq) {
                    if (onlineTtsSeq == mySeq) mainHandler.post { onFallbackLocal() }
                    return@execute
                }
                val tmpFile = File(context.cacheDir, "jarvis_urdu_tts_$mySeq.mp3")
                FileOutputStream(tmpFile).use { it.write(mp3Bytes) }

                mainHandler.post {
                    if (onlineTtsSeq != mySeq) {
                        try { tmpFile.delete() } catch (_: Exception) {}
                        return@post
                    }
                    try {
                        val player = MediaPlayer()
                        onlineTtsPlayer = player
                        player.setAudioAttributes(
                            AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_ASSISTANT)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                .build()
                        )
                        player.setDataSource(tmpFile.absolutePath)
                        player.prepare()
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            try {
                                val isMale = gender == "male"
                                val spd = (rateOpt ?: 1.0f).coerceIn(0.82f, 1.32f)
                                val pt = (pitchOpt ?: if (isMale) 0.85f else 1.0f).coerceIn(0.74f, 1.20f)
                                player.playbackParams = PlaybackParams().apply {
                                    speed = spd
                                    pitch = pt
                                }
                            } catch (_: Exception) {}
                        }
                        isSpeakingTts = true
                        WakeSpeechSuppressor.setTtsActive(true)
                        stopWakeRecognizerInternal()
                        emitSimple("nativeTtsStart", JSObject())

                        player.setOnCompletionListener {
                            try { tmpFile.delete() } catch (_: Exception) {}
                            if (onlineTtsPlayer === player) onlineTtsPlayer = null
                            try { player.release() } catch (_: Exception) {}
                            isSpeakingTts = false
                            WakeSpeechSuppressor.setTtsActive(false, 1200L)
                            emitSimple("nativeTtsDone", JSObject())
                            if (wakeWordEnabled && !isListeningCommand && !MicHardwareCoordinator.isCommandSessionActive) {
                                mainHandler.postDelayed({ startWakeRecognizerInternal() }, 1300L)
                            }
                        }
                        player.setOnErrorListener { _, _, _ ->
                            try { tmpFile.delete() } catch (_: Exception) {}
                            if (onlineTtsPlayer === player) onlineTtsPlayer = null
                            try { player.release() } catch (_: Exception) {}
                            onFallbackLocal()
                            true
                        }
                        player.start()
                    } catch (_: Exception) {
                        try { tmpFile.delete() } catch (_: Exception) {}
                        onFallbackLocal()
                    }
                }
            } catch (_: Exception) {
                if (onlineTtsSeq == mySeq) mainHandler.post { onFallbackLocal() }
            }
        }
    }

    @PluginMethod
    fun speakNative(call: PluginCall) {
        val text = call.getString("text")?.trim() ?: ""
        val lang = call.getString("lang") ?: "ur"
        val gender = call.getString("gender") ?: "female"
        val pitchOpt = call.getFloat("pitch")
        val rateOpt = call.getFloat("rate")

        if (text.isEmpty()) {
            val res = JSObject()
            res.put("ok", false)
            call.resolve(res)
            return
        }

        val runSpeak = {
            try {
                stopOnlineTtsPlayer()
                val engine = tts
                if (engine == null || !ttsReady) {
                    if ((lang == "ur" || lang == "pa") && WakeAudioUtils.hasDeviceInternet(context)) {
                        playOnlineUrduTts(text, "ur", gender, pitchOpt, rateOpt) {}
                        val res = JSObject()
                        res.put("ok", true)
                        call.resolve(res)
                    } else {
                        val res = JSObject()
                        res.put("ok", false)
                        call.resolve(res)
                    }
                } else {
                    WakeSpeechSuppressor.setTtsActive(true)
                    stopWakeRecognizerInternal()
                    val isMale = gender == "male"
                    val isUrduReq = lang == "ur" || lang == "pa"
                    val voicesList = try { engine.voices?.toList().orEmpty() } catch (_: Exception) { emptyList() }

                    val strictUrduVoice = if (isUrduReq) {
                        voicesList.firstOrNull { v ->
                            val lc = v.locale.language.lowercase(Locale.US)
                            val cc = v.locale.country.uppercase(Locale.US)
                            val nm = v.name.lowercase(Locale.US)
                            val maleVoice = nm.contains("male") || nm.contains("-m-") || nm.endsWith("-m") || nm.contains("asad") || nm.contains("salman")
                            val femaleVoice = nm.contains("female") || nm.contains("-f-") || nm.endsWith("-f") || nm.contains("uzma") || nm.contains("gul") || nm.contains("urb") || nm.contains("cfn")
                            lc == "ur" && (cc == "PK" || cc.isEmpty()) && (if (isMale) maleVoice else femaleVoice || !maleVoice)
                        } ?: voicesList.firstOrNull { it.locale.language.lowercase(Locale.US) == "ur" }
                    } else null

                    val targetLocale = when (lang) {
                        "en" -> Locale.US
                        "pa" -> Locale("ur", "PK")
                        else -> Locale("ur", "PK")
                    }
                    var langCode = engine.setLanguage(targetLocale)
                    val urduSupportedLocally = isUrduReq && (langCode >= TextToSpeech.LANG_AVAILABLE || strictUrduVoice != null)

                    // If device has NO Pakistani Urdu voice installed, use authentic online Pakistani Urdu TTS BEFORE falling back to Hindi/English
                    if (isUrduReq && !urduSupportedLocally && WakeAudioUtils.hasDeviceInternet(context)) {
                        playOnlineUrduTts(text, "ur", gender, pitchOpt, rateOpt) {
                            try {
                                val fallbackCode = engine.setLanguage(Locale("hi", "IN"))
                                if (fallbackCode < TextToSpeech.LANG_AVAILABLE) {
                                    engine.setLanguage(Locale.US)
                                }
                                engine.setPitch((pitchOpt ?: if (isMale) 0.84f else 1.02f).coerceIn(0.72f, 1.25f))
                                engine.setSpeechRate((rateOpt ?: 0.98f).coerceIn(0.80f, 1.35f))
                                engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "wasu_tts_${System.currentTimeMillis()}")
                            } catch (_: Exception) {}
                        }
                        val res = JSObject()
                        res.put("ok", true)
                        call.resolve(res)
                    } else {
                        var activeLangTag = targetLocale.language.lowercase(Locale.US)
                        if (langCode < TextToSpeech.LANG_AVAILABLE && strictUrduVoice == null) {
                            langCode = engine.setLanguage(Locale("hi", "IN"))
                            activeLangTag = "hi"
                        }
                        if (langCode < TextToSpeech.LANG_AVAILABLE && strictUrduVoice == null) {
                            engine.setLanguage(Locale.US)
                            activeLangTag = "en"
                        }

                        try {
                            val chosenVoice = if (strictUrduVoice != null) {
                                strictUrduVoice
                            } else {
                                voicesList.firstOrNull { v ->
                                    val nm = v.name.lowercase(Locale.US)
                                    val lc = v.locale.language.lowercase(Locale.US)
                                    val maleVoice = nm.contains("male") || nm.contains("-m-") || nm.endsWith("-m") || nm.contains("asad") || nm.contains("salman") || nm.contains("madhur")
                                    val femaleVoice = nm.contains("female") || nm.contains("-f-") || nm.endsWith("-f") || nm.contains("uzma") || nm.contains("gul") || nm.contains("swara") || nm.contains("sfg")
                                    lc == activeLangTag && (if (isMale) maleVoice else femaleVoice || !maleVoice)
                                }
                            }
                            if (chosenVoice != null) {
                                engine.voice = chosenVoice
                            }
                        } catch (_: Exception) {}

                        val effectivePitch = (pitchOpt ?: if (isMale) 0.84f else 1.02f).coerceIn(0.72f, 1.25f)
                        val effectiveRate = (rateOpt ?: 0.98f).coerceIn(0.80f, 1.35f)
                        engine.setPitch(effectivePitch)
                        engine.setSpeechRate(effectiveRate)

                        val uttId = "wasu_tts_${System.currentTimeMillis()}"
                        engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, uttId)
                        val res = JSObject()
                        res.put("ok", true)
                        call.resolve(res)
                    }
                }
            } catch (_: Exception) {
                val res = JSObject()
                res.put("ok", false)
                call.resolve(res)
            }
        }

        if (ttsReady) {
            mainHandler.post(runSpeak)
        } else {
            pendingSpeak = runSpeak
            initNativeTts()
            mainHandler.postDelayed({
                if (pendingSpeak != null) {
                    pendingSpeak = null
                    val res = JSObject()
                    res.put("ok", false)
                    call.resolve(res)
                }
            }, 1800)
        }
    }

    @PluginMethod
    fun stopNativeSpeech(call: PluginCall) {
        try {
            stopOnlineTtsPlayer()
            tts?.stop()
        } catch (_: Exception) {}
        isSpeakingTts = false
        WakeSpeechSuppressor.setTtsActive(false, 700L)
        val res = JSObject()
        res.put("ok", true)
        call.resolve(res)
    }

    private fun buildSessionPayload(jsSessionId: Int): JSObject {
        return JSObject().apply {
            if (jsSessionId > 0) put("sessionId", jsSessionId)
        }
    }

    private fun createBestSpeechRecognizer(preferOnDevice: Boolean): SpeechRecognizer? {
        if (preferOnDevice && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                if (SpeechRecognizer.isOnDeviceRecognitionAvailable(context)) {
                    return SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
                }
            } catch (_: Exception) {}
        }
        return try {
            SpeechRecognizer.createSpeechRecognizer(context)
        } catch (_: Exception) {
            null
        }
    }

    private fun releaseAllWakeAudioBlocking() {
        if (JarvisWakeForegroundService.isServiceActive) {
            try {
                val pauseIntent = Intent(context, JarvisWakeForegroundService::class.java).apply {
                    action = JarvisWakeForegroundService.ACTION_PAUSE_MIC
                }
                context.startService(pauseIntent)
            } catch (_: Exception) {}
        }
        stopWakeRecognizerInternal()
        MicHardwareCoordinator.forceReleaseAllWakeAudio(450L)
    }

    @PluginMethod
    fun startNativeListening(call: PluginCall) {
        val lang = call.getString("lang") ?: "ur"
        val jsSessionId = call.getInt("sessionId") ?: 0
        val preferDialog = call.getBoolean("preferDialog") ?: false

        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            val res = JSObject()
            res.put("ok", false)
            res.put("needsMicPermission", true)
            res.put("message", "Microphone permission required")
            call.resolve(res)
            return
        }

        val mySession = ++cmdSessionSeq
        activeJsSessionId = jsSessionId
        MicHardwareCoordinator.isCommandSessionActive = true
        isListeningCommand = true

        wakeExecutor.execute {
            releaseAllWakeAudioBlocking()
            mainHandler.post {
                if (cmdSessionSeq != mySession || !isListeningCommand) return@post
                try {
                    stopOnlineTtsPlayer()
                    tts?.stop()
                    isSpeakingTts = false
                    WakeSpeechSuppressor.setTtsActive(false, 0L)
                    try { silentCommandRecorder?.cancel() } catch (_: Exception) {}
                    silentCommandRecorder = null

                    mainHandler.postDelayed({
                        if (cmdSessionSeq != mySession || !isListeningCommand) return@postDelayed
                        if (preferDialog) {
                            val opened = (activity as? MainActivity)?.launchSystemSpeechDialog(mySession, lang) ?: false
                            if (!opened) {
                                launchSilentCommandWavFallback(mySession, jsSessionId)
                            }
                            return@postDelayed
                        }
                        if (SpeechRecognizer.isRecognitionAvailable(context)) {
                            launchCmdSpeechRecognizer(
                                sessionId = mySession,
                                jsSessionId = jsSessionId,
                                lang = lang,
                                retriedBusy = false,
                                forceEnglish = false,
                                preferOnDevice = false
                            )
                        } else if (!WakeAudioUtils.isCloudRecentlyUnavailable() && WakeAudioUtils.hasDeviceInternet(context)) {
                            launchSilentCommandWavFallback(mySession, jsSessionId)
                        } else {
                            val opened = (activity as? MainActivity)?.launchSystemSpeechDialog(mySession, lang) ?: false
                            if (!opened) {
                                launchSilentCommandWavFallback(mySession, jsSessionId)
                            }
                        }
                    }, 320L)
                } catch (e: Exception) {
                    isListeningCommand = false
                    MicHardwareCoordinator.isCommandSessionActive = false
                    emitSimple("nativeSpeechError", buildSessionPayload(jsSessionId).apply {
                        put("message", e.message ?: "Could not start native microphone")
                    })
                    emitSimple("nativeSpeechEnd", buildSessionPayload(jsSessionId))
                }
            }
        }

        val res = JSObject()
        res.put("ok", true)
        call.resolve(res)
    }

    @PluginMethod
    fun startSystemVoiceDialog(call: PluginCall) {
        val lang = call.getString("lang") ?: "ur"
        val jsSessionId = call.getInt("sessionId") ?: 0
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            val res = JSObject()
            res.put("ok", false)
            res.put("needsMicPermission", true)
            res.put("message", "Microphone permission required")
            call.resolve(res)
            return
        }

        val mySession = ++cmdSessionSeq
        activeJsSessionId = jsSessionId
        MicHardwareCoordinator.isCommandSessionActive = true
        isListeningCommand = true

        wakeExecutor.execute {
            releaseAllWakeAudioBlocking()
            mainHandler.post {
                if (cmdSessionSeq != mySession || !isListeningCommand) return@post
                try { tts?.stop() } catch (_: Exception) {}
                isSpeakingTts = false
                try { silentCommandRecorder?.cancel() } catch (_: Exception) {}
                silentCommandRecorder = null
                try { cmdRecognizer?.destroy() } catch (_: Exception) {}
                cmdRecognizer = null

                emitSimple("nativeSpeechStart", buildSessionPayload(jsSessionId))
                val opened = (activity as? MainActivity)?.launchSystemSpeechDialog(mySession, lang) ?: false
                if (!opened) {
                    isListeningCommand = false
                    MicHardwareCoordinator.isCommandSessionActive = false
                    emitSimple("nativeSpeechError", buildSessionPayload(jsSessionId).apply {
                        put("message", "System Voice Dialog available nahi hai.")
                    })
                    emitSimple("nativeSpeechEnd", buildSessionPayload(jsSessionId))
                }
            }
        }

        val res = JSObject()
        res.put("ok", true)
        call.resolve(res)
    }

    fun onSystemSpeechDialogResult(sessionId: Int, ok: Boolean, text: String) {
        mainHandler.post {
            if (cmdSessionSeq != sessionId) return@post
            val jsSid = activeJsSessionId
            isListeningCommand = false
            MicHardwareCoordinator.isCommandSessionActive = false
            val clean = text.trim()
            if (ok && clean.isNotEmpty()) {
                emitSimple("nativeSpeechResult", buildSessionPayload(jsSid).apply {
                    put("text", clean)
                })
            } else {
                emitSimple("nativeSpeechError", buildSessionPayload(jsSid).apply {
                    put("message", if (ok) "Awaaz saaf sunayi nahi di, dobara bolein." else "Voice input cancel ho gaya.")
                })
            }
            emitSimple("nativeSpeechEnd", buildSessionPayload(jsSid))
            if (wakeWordEnabled && !isSpeakingTts) {
                mainHandler.postDelayed({ startWakeRecognizerInternal() }, 700L)
            }
        }
    }

    @PluginMethod
    fun testMicrophoneHardware(call: PluginCall) {
        val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        if (!granted) {
            val res = JSObject()
            res.put("ok", false)
            res.put("granted", false)
            res.put("hardwareReady", false)
            res.put("peakLevel", 0)
            res.put("speechEngineAvailable", SpeechRecognizer.isRecognitionAvailable(context))
            res.put("message", "Microphone permission OFF hai — pehle '1. MIC & NOTIFICATIONS' par tap karein.")
            call.resolve(res)
            return
        }

        WakeAudioUtils.resetCloudHealthCache()
        wakeExecutor.execute {
            val wasCommand = MicHardwareCoordinator.isCommandSessionActive
            MicHardwareCoordinator.isCommandSessionActive = true
            releaseAllWakeAudioBlocking()
            try { Thread.sleep(160L) } catch (_: Exception) {}

            var opened = false
            var peak = 0
            val sampleRate = 16000
            val minBuf = AudioRecord.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            )
            if (minBuf > 0) {
                val sources = intArrayOf(MediaRecorder.AudioSource.MIC, MediaRecorder.AudioSource.VOICE_RECOGNITION)
                for (src in sources) {
                    var rec: AudioRecord? = null
                    try {
                        val bufSize = (minBuf * 2).coerceAtLeast(3200)
                        rec = AudioRecord(
                            src,
                            sampleRate,
                            AudioFormat.CHANNEL_IN_MONO,
                            AudioFormat.ENCODING_PCM_16BIT,
                            bufSize
                        )
                        if (rec.state == AudioRecord.STATE_INITIALIZED) {
                            opened = true
                            rec.startRecording()
                            val chunk = ShortArray(640)
                            for (i in 0 until 8) {
                                val read = rec.read(chunk, 0, chunk.size)
                                if (read > 0) {
                                    for (j in 0 until read) {
                                        val v = kotlin.math.abs(chunk[j].toInt())
                                        if (v > peak) peak = v
                                    }
                                }
                            }
                            try { rec.stop() } catch (_: Exception) {}
                            break
                        }
                    } catch (_: Exception) {
                    } finally {
                        try { rec?.release() } catch (_: Exception) {}
                    }
                }
            }

            MicHardwareCoordinator.isCommandSessionActive = wasCommand
            mainHandler.post {
                if (!wasCommand && wakeWordEnabled && !isListeningCommand && !isSpeakingTts) {
                    mainHandler.postDelayed({ startWakeRecognizerInternal() }, 300L)
                }
                val srAvail = SpeechRecognizer.isRecognitionAvailable(context)
                val res = JSObject()
                res.put("ok", opened)
                res.put("granted", true)
                res.put("hardwareReady", opened)
                res.put("peakLevel", peak)
                res.put("speechEngineAvailable", srAvail)
                res.put(
                    "message",
                    if (opened) {
                        "Mic Hardware OK! Live Signal Peak: $peak" + (if (srAvail) " (Android Speech Ready)" else " (Backup Mic Ready)")
                    } else {
                        "Kisi aur app ne Mic lock kiya hua hai — app restart kar ke dobara check karein."
                    }
                )
                call.resolve(res)
            }
        }
    }

    private fun launchCmdSpeechRecognizer(
        sessionId: Int,
        jsSessionId: Int,
        lang: String,
        retriedBusy: Boolean,
        forceEnglish: Boolean,
        preferOnDevice: Boolean
    ) {
        if (cmdSessionSeq != sessionId || !isListeningCommand) return
        try {
            try { cmdRecognizer?.destroy() } catch (_: Exception) {}
            cmdRecognizer = createBestSpeechRecognizer(preferOnDevice)
            if (cmdRecognizer == null) {
                val opened = (activity as? MainActivity)?.launchSystemSpeechDialog(sessionId, lang) ?: false
                if (!opened) launchSilentCommandWavFallback(sessionId, jsSessionId)
                return
            }

            val listenStartMs = System.currentTimeMillis()
            var gotAnySpeech = false

            cmdRecognizer?.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    if (cmdSessionSeq == sessionId) {
                        emitSimple("nativeSpeechStart", buildSessionPayload(jsSessionId))
                    }
                }
                override fun onBeginningOfSpeech() {
                    if (cmdSessionSeq == sessionId) {
                        gotAnySpeech = true
                    }
                }
                override fun onRmsChanged(rmsdB: Float) {
                    if (cmdSessionSeq != sessionId) return
                    val norm = ((rmsdB + 2f) / 12f).coerceIn(0f, 1f)
                    val obj = buildSessionPayload(jsSessionId)
                    obj.put("level", norm)
                    emitSimple("nativeSpeechRms", obj)
                }
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onError(error: Int) {
                    if (cmdSessionSeq != sessionId) return
                    val elapsed = System.currentTimeMillis() - listenStartMs

                    // 1. Hardware mic still releasing -> force release & retry once silently after 420ms
                    if ((error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY || error == SpeechRecognizer.ERROR_AUDIO) && !retriedBusy) {
                        wakeExecutor.execute {
                            MicHardwareCoordinator.forceReleaseAllWakeAudio(450L)
                            mainHandler.postDelayed({
                                launchCmdSpeechRecognizer(sessionId, jsSessionId, lang, retriedBusy = true, forceEnglish = forceEnglish, preferOnDevice = preferOnDevice)
                            }, 420L)
                        }
                        return
                    }

                    // 2. Language pack missing or instant drop (<1.6s) on ur-PK/pa-IN -> silently retry in en-US (plus on-device if Android 12+)
                    val isEarlyDrop = !gotAnySpeech && elapsed < 1600L
                    val isLangOrQuickFail = error == SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED ||
                        error == SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE ||
                        (isEarlyDrop && (error == SpeechRecognizer.ERROR_NO_MATCH ||
                            error == SpeechRecognizer.ERROR_NETWORK ||
                            error == SpeechRecognizer.ERROR_SERVER ||
                            error == 10 || error == 11 || error == 12 || error == 13))
                    if (isLangOrQuickFail && !forceEnglish) {
                        mainHandler.postDelayed({
                            launchCmdSpeechRecognizer(sessionId, jsSessionId, lang, retriedBusy = true, forceEnglish = true, preferOnDevice = true)
                        }, 320L)
                        return
                    }

                    // 3. Headless SpeechRecognizer blocked on OEM/Android 15 -> switch to Cloud WAV (if live) OR guaranteed System Voice Dialog!
                    val shouldFallbackEngine = error == SpeechRecognizer.ERROR_CLIENT ||
                        error == SpeechRecognizer.ERROR_AUDIO ||
                        error == SpeechRecognizer.ERROR_SERVER ||
                        error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY ||
                        error == SpeechRecognizer.ERROR_NETWORK ||
                        error == SpeechRecognizer.ERROR_NETWORK_TIMEOUT ||
                        error == 10 || error == 11 || error == 12 || error == 13 ||
                        isEarlyDrop
                    if (shouldFallbackEngine) {
                        try { cmdRecognizer?.destroy() } catch (_: Exception) {}
                        cmdRecognizer = null
                        if (!WakeAudioUtils.isCloudRecentlyUnavailable() && WakeAudioUtils.hasDeviceInternet(context)) {
                            launchSilentCommandWavFallback(sessionId, jsSessionId)
                            return
                        }
                        val opened = (activity as? MainActivity)?.launchSystemSpeechDialog(sessionId, lang) ?: false
                        if (opened) {
                            return
                        }
                        launchSilentCommandWavFallback(sessionId, jsSessionId)
                        return
                    }

                    isListeningCommand = false
                    MicHardwareCoordinator.isCommandSessionActive = false
                    val msg = when (error) {
                        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission allow karein."
                        SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Awaaz saaf sunayi nahi di, mic ke kareeb bolein."
                        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Internet ya Google speech service check karein."
                        else -> "Awaaz sunayi nahi di (Code $error), dobara bolein."
                    }
                    val errObj = buildSessionPayload(jsSessionId)
                    errObj.put("code", error)
                    errObj.put("message", msg)
                    emitSimple("nativeSpeechError", errObj)
                    emitSimple("nativeSpeechEnd", buildSessionPayload(jsSessionId))
                    if (wakeWordEnabled && !isSpeakingTts) {
                        mainHandler.postDelayed({ startWakeRecognizerInternal() }, 650L)
                    }
                }
                override fun onResults(results: Bundle?) {
                    if (cmdSessionSeq != sessionId) return
                    val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    // Pick best actionable candidate among top alternatives (e.g. "open whatsapp" vs garbled Urdu)
                    val cleanedList = matches?.mapNotNull { it?.trim()?.takeIf { s -> s.isNotEmpty() } } ?: emptyList()
                    val text = cleanedList.firstOrNull { cand ->
                        val lc = cand.lowercase(Locale.US)
                        lc.contains("whatsapp") || lc.contains("call") || lc.contains("open") ||
                            lc.contains("youtube") || lc.contains("torch") || lc.contains("flashlight") ||
                            lc.contains("one ui") || lc.contains("wallpaper")
                    } ?: cleanedList.firstOrNull() ?: ""
                    val elapsed = System.currentTimeMillis() - listenStartMs
                    if (text.isEmpty() && !forceEnglish && elapsed < 1400L) {
                        mainHandler.postDelayed({
                            launchCmdSpeechRecognizer(sessionId, jsSessionId, lang, retriedBusy = true, forceEnglish = true, preferOnDevice = true)
                        }, 240L)
                        return
                    }

                    isListeningCommand = false
                    MicHardwareCoordinator.isCommandSessionActive = false
                    if (text.isNotEmpty()) {
                        val obj = buildSessionPayload(jsSessionId)
                        obj.put("text", text)
                        emitSimple("nativeSpeechResult", obj)
                    } else {
                        val errObj = buildSessionPayload(jsSessionId)
                        errObj.put("message", "Awaaz clear nahi thi, dobara bolein.")
                        emitSimple("nativeSpeechError", errObj)
                    }
                    emitSimple("nativeSpeechEnd", buildSessionPayload(jsSessionId))
                    if (wakeWordEnabled && !isSpeakingTts) {
                        mainHandler.postDelayed({ startWakeRecognizerInternal() }, 450L)
                    }
                }
                override fun onPartialResults(partialResults: Bundle?) {
                    if (cmdSessionSeq != sessionId) return
                    val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    val text = matches?.firstOrNull()?.trim() ?: ""
                    if (text.isNotEmpty()) {
                        gotAnySpeech = true
                        val obj = buildSessionPayload(jsSessionId)
                        obj.put("text", text)
                        emitSimple("nativeSpeechPartial", obj)
                    }
                }
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })

            val recLang = if (forceEnglish) "en-US" else when (lang) {
                "en" -> "en-US"
                "pa" -> "pa-IN"
                else -> "ur-PK"
            }
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, recLang)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, recLang)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1450L)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1050L)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 900L)
            }
            cmdRecognizer?.startListening(intent)
        } catch (_: Exception) {
            val opened = (activity as? MainActivity)?.launchSystemSpeechDialog(sessionId, lang) ?: false
            if (!opened) {
                launchSilentCommandWavFallback(sessionId, jsSessionId)
            }
        }
    }

    private fun launchSilentCommandWavFallback(sessionId: Int, jsSessionId: Int) {
        if (cmdSessionSeq != sessionId || !isListeningCommand) return
        silentCommandRecorder?.cancel()
        silentCommandRecorder = SilentCommandRecorder(
            context = context,
            onReady = {
                if (cmdSessionSeq == sessionId) {
                    emitSimple("nativeSpeechStart", buildSessionPayload(jsSessionId))
                }
            },
            onRmsLevel = { lvl ->
                if (cmdSessionSeq == sessionId) {
                    val obj = buildSessionPayload(jsSessionId)
                    obj.put("level", lvl)
                    emitSimple("nativeSpeechRms", obj)
                }
            },
            onFinished = { wavBytes ->
                if (cmdSessionSeq != sessionId) return@SilentCommandRecorder
                isListeningCommand = false
                MicHardwareCoordinator.isCommandSessionActive = false
                if (wavBytes != null && wavBytes.size > 4000) {
                    val obj = buildSessionPayload(jsSessionId)
                    obj.put("audioBase64", Base64.encodeToString(wavBytes, Base64.NO_WRAP))
                    obj.put("mimeType", "audio/wav")
                    emitSimple("nativeSpeechAudio", obj)
                    emitSimple("nativeSpeechEnd", buildSessionPayload(jsSessionId))
                } else {
                    val errObj = buildSessionPayload(jsSessionId)
                    errObj.put("message", "Awaaz record nahi ho saki, mic ke kareeb bolein.")
                    emitSimple("nativeSpeechError", errObj)
                    emitSimple("nativeSpeechEnd", buildSessionPayload(jsSessionId))
                }
                if (wakeWordEnabled && !isSpeakingTts) {
                    mainHandler.postDelayed({ startWakeRecognizerInternal() }, 650L)
                }
            }
        )
        silentCommandRecorder?.start()
    }

    @PluginMethod
    fun stopNativeListening(call: PluginCall) {
        mainHandler.post {
            try { cmdRecognizer?.stopListening() } catch (_: Exception) {}
            try { silentCommandRecorder?.stopAndEmit() } catch (_: Exception) {}
        }
        val res = JSObject()
        res.put("ok", true)
        call.resolve(res)
    }

    @PluginMethod
    fun cancelNativeListening(call: PluginCall) {
        cmdSessionSeq++
        mainHandler.post {
            isListeningCommand = false
            MicHardwareCoordinator.isCommandSessionActive = false
            try { cmdRecognizer?.cancel() } catch (_: Exception) {}
            try { silentCommandRecorder?.cancel() } catch (_: Exception) {}
            silentCommandRecorder = null
            if (wakeWordEnabled && !isSpeakingTts) {
                mainHandler.postDelayed({ startWakeRecognizerInternal() }, 400L)
            }
        }
        val res = JSObject()
        res.put("ok", true)
        call.resolve(res)
    }

    @PluginMethod
    fun setNativeWakeWordEnabled(call: PluginCall) {
        val enabled = call.getBoolean("enabled") ?: false
        val phrasesArr = call.getArray("phrases")
        if (phrasesArr != null && phrasesArr.length() > 0) {
            val list = mutableListOf<String>()
            for (i in 0 until phrasesArr.length()) {
                val p = phrasesArr.optString(i, "").trim().lowercase(Locale.US)
                if (p.isNotEmpty()) list.add(p)
            }
            if (list.isNotEmpty()) wakePhrases = list
        }
        wakeWordEnabled = enabled
        if (enabled) WakeAudioUtils.resetCloudHealthCache()
        val micGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        mainHandler.post {
            if (enabled && micGranted && !isListeningCommand && !isSpeakingTts && !MicHardwareCoordinator.isCommandSessionActive) {
                startWakeRecognizerInternal()
            } else if (!enabled) {
                stopWakeRecognizerInternal()
            }
        }
        val res = JSObject()
        res.put("ok", true)
        res.put("active", enabled && micGranted)
        call.resolve(res)
    }

    private fun stopWakeRecognizerInternal() {
        try {
            foregroundWakeVad?.stopAndAwaitRelease(300L)
        } catch (_: Exception) {}
        try {
            wakeRecognizer?.cancel()
            wakeRecognizer?.destroy()
        } catch (_: Exception) {}
        wakeRecognizer = null
    }

    private fun startWakeRecognizerInternal() {
        if (!isForegroundActive || !wakeWordEnabled || isListeningCommand || isSpeakingTts || MicHardwareCoordinator.isCommandSessionActive) return
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return

        try {
            wakeRecognizer?.cancel()
            wakeRecognizer?.destroy()
        } catch (_: Exception) {}
        wakeRecognizer = null

        if (foregroundWakeVad == null) {
            foregroundWakeVad = SilentWakeVad(
                context = context,
                onSpeechOnset = {
                    if (!isForegroundActive || !wakeWordEnabled || isListeningCommand || isSpeakingTts || MicHardwareCoordinator.isCommandSessionActive) {
                        return@SilentWakeVad
                    }
                    val now = System.currentTimeMillis()
                    if (now - lastFgWakeProbeMs < 2000L) return@SilentWakeVad
                    lastFgWakeProbeMs = now
                    mainHandler.post {
                        stopWakeRecognizerInternal()
                        runSingleForegroundWakeRecognition()
                    }
                },
                onSpeechCaptured = { wavBytes ->
                    if (!isForegroundActive || !wakeWordEnabled || isListeningCommand || isSpeakingTts || MicHardwareCoordinator.isCommandSessionActive) {
                        return@SilentWakeVad
                    }
                    val now = System.currentTimeMillis()
                    if (now - lastFgWakeProbeMs < 2000L) {
                        mainHandler.postDelayed({ startWakeRecognizerInternal() }, 700L)
                        return@SilentWakeVad
                    }
                    lastFgWakeProbeMs = now
                    verifyForegroundWakeClip(wavBytes)
                }
            )
        }
        foregroundWakeVad?.start()
        val obj = JSObject()
        obj.put("active", true)
        obj.put("status", "SILENT STANDBY — Say 'Jarvis' anytime")
        emitSimple("nativeWakeStatus", obj)
    }

    private fun verifyForegroundWakeClip(wavBytes: ByteArray) {
        val wakeNames = listOf("jarvis", "wasu", "wasi ki jan", "wasi")
        wakeExecutor.execute {
            val res = WakeAudioUtils.checkWakeWordOnline(context, wavBytes, wakeNames)
            mainHandler.post {
                if (!isForegroundActive || !wakeWordEnabled || isListeningCommand || isSpeakingTts || MicHardwareCoordinator.isCommandSessionActive) {
                    return@post
                }
                if (res.matched) {
                    stopWakeRecognizerInternal()
                    emitWakeEvent(res.matchedPhrase, res.trailingCommand)
                    return@post
                }
                if (res.networkOk) {
                    mainHandler.postDelayed({ startWakeRecognizerInternal() }, 300L)
                } else {
                    runSingleForegroundWakeRecognition()
                }
            }
        }
    }

    private fun runSingleForegroundWakeRecognition() {
        if (!isForegroundActive || !wakeWordEnabled || isListeningCommand || isSpeakingTts || MicHardwareCoordinator.isCommandSessionActive) return
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            mainHandler.postDelayed({ startWakeRecognizerInternal() }, 3000L)
            return
        }
        try {
            wakeRecognizer?.cancel()
            wakeRecognizer?.destroy()
            wakeRecognizer = createBestSpeechRecognizer(preferOnDevice = true)
            wakeRecognizer?.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    val obj = JSObject()
                    obj.put("active", true)
                    obj.put("status", "Listening for 'Jarvis'...")
                    emitSimple("nativeWakeStatus", obj)
                }
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onError(error: Int) {
                    if (isForegroundActive && wakeWordEnabled && !isListeningCommand && !isSpeakingTts && !MicHardwareCoordinator.isCommandSessionActive) {
                        mainHandler.postDelayed({ startWakeRecognizerInternal() }, 3200L)
                    }
                }
                override fun onResults(results: Bundle?) {
                    val matched = checkWakeBundle(results)
                    if (!matched && isForegroundActive && wakeWordEnabled && !isListeningCommand && !isSpeakingTts && !MicHardwareCoordinator.isCommandSessionActive) {
                        mainHandler.postDelayed({ startWakeRecognizerInternal() }, 2500L)
                    }
                }
                override fun onPartialResults(partialResults: Bundle?) {
                    checkWakeBundle(partialResults)
                }
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 3200L)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1800L)
            }
            wakeRecognizer?.startListening(intent)
        } catch (_: Exception) {
            if (isForegroundActive && wakeWordEnabled && !isListeningCommand && !isSpeakingTts && !MicHardwareCoordinator.isCommandSessionActive) {
                mainHandler.postDelayed({ startWakeRecognizerInternal() }, 3200L)
            }
        }
    }

    private fun checkWakeBundle(bundle: Bundle?): Boolean {
        val matches = bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: return false
        for (raw in matches) {
            val lower = raw.lowercase(Locale.US).trim()
            if (lower.isEmpty()) continue
            val matched = wakePhrases.firstOrNull { lower.contains(it) }
                ?: if (Regex("\\b(jarvis|jarvish|jervis|javis|jarvice|service|travis|wasu|wasi)\\b").containsMatchIn(lower)) "hi jarvis" else null
            if (matched != null) {
                val idx = lower.indexOf(matched)
                val trailing = if (idx >= 0) lower.substring(idx + matched.length).trim() else ""
                stopWakeRecognizerInternal()
                emitWakeEvent(matched, trailing)
                return true
            }
        }
        return false
    }

    @PluginMethod
    fun getDeviceTelemetry(call: PluginCall) {
        var totalRamMb = 4096
        var availRamMb = 2048
        try {
            val am = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            if (am != null) {
                val mi = ActivityManager.MemoryInfo()
                am.getMemoryInfo(mi)
                totalRamMb = (mi.totalMem / (1024 * 1024)).toInt()
                availRamMb = (mi.availMem / (1024 * 1024)).toInt()
            }
        } catch (_: Exception) {}

        var totalStorageGb = 64.0
        var availStorageGb = 32.0
        try {
            val stat = StatFs(Environment.getDataDirectory().path)
            totalStorageGb = String.format(Locale.US, "%.1f", stat.totalBytes / (1024.0 * 1024.0 * 1024.0)).toDouble()
            availStorageGb = String.format(Locale.US, "%.1f", stat.availableBytes / (1024.0 * 1024.0 * 1024.0)).toDouble()
        } catch (_: Exception) {}

        var pct = 100
        var isCharging = false
        var tempTenths = 300
        try {
            val batIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            val level = batIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
            val scale = batIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
            val status = batIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
            tempTenths = batIntent?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 300) ?: 300
            if (level >= 0 && scale > 0) pct = (level * 100 / scale)
            isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
        } catch (_: Exception) {}

        var netType = "ONLINE"
        try {
            val hasNetPerm = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_NETWORK_STATE
            ) == PackageManager.PERMISSION_GRANTED
            if (hasNetPerm) {
                val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                val netCaps = cm?.getNetworkCapabilities(cm.activeNetwork)
                netType = when {
                    netCaps == null -> "OFFLINE"
                    netCaps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WIFI"
                    netCaps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "CELLULAR"
                    else -> "ONLINE"
                }
            }
        } catch (_: Exception) {
            netType = "ONLINE"
        }

        val res = JSObject()
        res.put("manufacturer", Build.MANUFACTURER ?: "Android")
        res.put("model", Build.MODEL ?: "Phone")
        res.put("androidVersion", Build.VERSION.RELEASE ?: "15")
        res.put("sdkInt", Build.VERSION.SDK_INT)
        res.put("totalRamMb", totalRamMb)
        res.put("availRamMb", availRamMb)
        res.put("totalStorageGb", totalStorageGb)
        res.put("availStorageGb", availStorageGb)
        res.put("batteryPercent", pct)
        res.put("isCharging", isCharging)
        res.put("batteryTempC", tempTenths / 10.0)
        res.put("networkType", netType)
        call.resolve(res)
    }

    @PluginMethod
    fun verifyBiometric(call: PluginCall) {
        val act = activity
        if (act == null || act.isFinishing) {
            val res = JSObject()
            res.put("ok", false)
            res.put("message", "Phone screen is not ready for Biometric prompt.")
            call.resolve(res)
            return
        }

        val title = call.getString("title") ?: "Wasu's Jarvis Biometric Lock"
        val subtitle = call.getString("subtitle") ?: "Touch Fingerprint sensor or use Face Unlock"
        val executor = ContextCompat.getMainExecutor(context)
        val settled = AtomicBoolean(false)

        act.runOnUiThread {
            try {
                val bm = BiometricManager.from(context)
                val authenticators = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL
                } else {
                    BiometricManager.Authenticators.BIOMETRIC_WEAK
                }
                val canAuth = bm.canAuthenticate(authenticators)
                if (canAuth != BiometricManager.BIOMETRIC_SUCCESS) {
                    if (settled.compareAndSet(false, true)) {
                        val res = JSObject()
                        res.put("ok", false)
                        res.put("message", "No Fingerprint/Face lock enrolled in Android phone settings.")
                        call.resolve(res)
                    }
                    return@runOnUiThread
                }

                val prompt = BiometricPrompt(act, executor, object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        if (settled.compareAndSet(false, true)) {
                            val res = JSObject()
                            res.put("ok", true)
                            res.put("message", "Android Fingerprint / Face ID verified!")
                            call.resolve(res)
                        }
                    }

                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        if (settled.compareAndSet(false, true)) {
                            val res = JSObject()
                            res.put("ok", false)
                            res.put("message", errString.toString())
                            call.resolve(res)
                        }
                    }

                    override fun onAuthenticationFailed() {}
                })

                val builder = BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setSubtitle(subtitle)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    builder.setAllowedAuthenticators(authenticators)
                } else {
                    builder.setNegativeButtonText("Use Passkey")
                }
                prompt.authenticate(builder.build())
            } catch (e: Exception) {
                if (settled.compareAndSet(false, true)) {
                    val res = JSObject()
                    res.put("ok", false)
                    res.put("message", e.message ?: "Biometric sensor unavailable on this device.")
                    call.resolve(res)
                }
            }
        }
    }

    @PluginMethod
    fun toggleFlashlight(call: PluginCall) {
        val enable = call.getBoolean("enable") ?: false
        try {
            val camManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            var targetId: String? = null
            for (id in camManager.cameraIdList) {
                val chars = camManager.getCameraCharacteristics(id)
                val hasFlash = chars.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
                val facing = chars.get(CameraCharacteristics.LENS_FACING)
                if (hasFlash && facing == CameraCharacteristics.LENS_FACING_BACK) {
                    targetId = id
                    break
                } else if (hasFlash && targetId == null) {
                    targetId = id
                }
            }
            if (targetId == null) {
                val res = JSObject()
                res.put("ok", false)
                res.put("active", false)
                res.put("message", "No camera flashlight found on this phone.")
                call.resolve(res)
                return
            }
            camManager.setTorchMode(targetId, enable)
            val res = JSObject()
            res.put("ok", true)
            res.put("active", enable)
            res.put("message", if (enable) "Phone Flashlight turned ON!" else "Phone Flashlight turned OFF.")
            call.resolve(res)
        } catch (e: Exception) {
            val res = JSObject()
            res.put("ok", false)
            res.put("active", false)
            res.put("message", e.message ?: "Could not control phone flashlight.")
            call.resolve(res)
        }
    }

    @PluginMethod
    fun setAutoAnnounce(call: PluginCall) {
        try {
            val enabled = call.getBoolean("enabled") ?: true
            context.getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
                .edit()
                .putBoolean("bg_auto_announce", enabled)
                .apply()
            val res = JSObject()
            res.put("ok", true)
            res.put("enabled", enabled)
            call.resolve(res)
        } catch (_: Exception) {
            val res = JSObject()
            res.put("ok", false)
            res.put("enabled", false)
            call.resolve(res)
        }
    }

    @PluginMethod
    fun openBatteryOptimizationSettings(call: PluginCall) {
        try {
            val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            val res = JSObject()
            res.put("ok", true)
            call.resolve(res)
        } catch (_: Exception) {
            openAppInfoSettings(call)
        }
    }

    @PluginMethod
    fun requestIgnoreBatteryOptimization(call: PluginCall) {
        try {
            val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
            val alreadyIgnored = pm?.isIgnoringBatteryOptimizations(context.packageName) == true
            if (alreadyIgnored) {
                val res = JSObject()
                res.put("ok", true)
                res.put("unrestricted", true)
                call.resolve(res)
                return
            }
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            val res = JSObject()
            res.put("ok", true)
            res.put("unrestricted", false)
            call.resolve(res)
        } catch (_: Exception) {
            openBatteryOptimizationSettings(call)
        }
    }

    @PluginMethod
    fun getBackgroundStatus(call: PluginCall) {
        val prefs = context.getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
        val wakeEnabled = prefs.getBoolean("wake_enabled", false)
        val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val batteryUnrestricted = try {
            pm?.isIgnoringBatteryOptimizations(context.packageName) == true
        } catch (_: Exception) {
            false
        }
        val overlayGranted = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) Settings.canDrawOverlays(context) else true
        } catch (_: Exception) {
            false
        }
        val accessibilityEnabled = isAccessibilityServiceEnabled()
        val res = JSObject()
        res.put("ok", true)
        res.put("running", JarvisWakeForegroundService.isServiceActive)
        res.put("wakeEnabled", wakeEnabled)
        res.put("batteryUnrestricted", batteryUnrestricted)
        res.put("overlayGranted", overlayGranted)
        res.put("accessibilityEnabled", accessibilityEnabled)
        call.resolve(res)
    }

    @PluginMethod
    fun getNotifications(call: PluginCall) {
        val arr = JSArray()
        var enabled = false
        try {
            QNexusNotificationService.loadPersistedIfEmpty(context)
            enabled = NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
            if (enabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                try {
                    NotificationListenerService.requestRebind(
                        ComponentName(context, QNexusNotificationService::class.java)
                    )
                } catch (_: Exception) {}
            }
            for (item in QNexusNotificationService.recentNotifications) {
                arr.put(item)
            }
        } catch (_: Exception) {}
        val res = JSObject()
        res.put("listenerEnabled", enabled)
        res.put("notifications", arr)
        call.resolve(res)
    }

    @PluginMethod
    fun replyToNotification(call: PluginCall) {
        val key = call.getString("key") ?: ""
        val replyText = call.getString("replyText") ?: ""
        val ok = try {
            QNexusNotificationService.sendDirectReply(context, key, replyText)
        } catch (_: Exception) {
            false
        }
        val res = JSObject()
        res.put("ok", ok)
        res.put("message", if (ok) "Reply sent!" else "Reply action unavailable for this notification.")
        call.resolve(res)
    }

    @PluginMethod
    fun getCallLogs(call: PluginCall) {
        val arr = JSArray()
        try {
            if (ActivityCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED) {
                val cursor: Cursor? = context.contentResolver.query(
                    CallLog.Calls.CONTENT_URI,
                    null,
                    null,
                    null,
                    CallLog.Calls.DATE + " DESC"
                )
                cursor?.use {
                    var count = 0
                    val nameIdx = it.getColumnIndex(CallLog.Calls.CACHED_NAME)
                    val numIdx = it.getColumnIndex(CallLog.Calls.NUMBER)
                    val typeIdx = it.getColumnIndex(CallLog.Calls.TYPE)
                    val dateIdx = it.getColumnIndex(CallLog.Calls.DATE)
                    val durIdx = it.getColumnIndex(CallLog.Calls.DURATION)
                    while (it.moveToNext() && count < 25) {
                        val obj = JSObject()
                        obj.put("name", if (nameIdx >= 0) (it.getString(nameIdx) ?: "") else "")
                        obj.put("number", if (numIdx >= 0) (it.getString(numIdx) ?: "") else "")
                        val t = if (typeIdx >= 0) it.getInt(typeIdx) else CallLog.Calls.INCOMING_TYPE
                        obj.put(
                            "type",
                            when (t) {
                                CallLog.Calls.MISSED_TYPE -> "MISSED"
                                CallLog.Calls.OUTGOING_TYPE -> "OUTGOING"
                                CallLog.Calls.REJECTED_TYPE -> "REJECTED"
                                else -> "INCOMING"
                            }
                        )
                        obj.put("date", if (dateIdx >= 0) it.getLong(dateIdx) else 0L)
                        obj.put("durationSec", if (durIdx >= 0) it.getInt(durIdx) else 0)
                        arr.put(obj)
                        count++
                    }
                }
            }
        } catch (_: Exception) {}
        val res = JSObject()
        res.put("calls", arr)
        call.resolve(res)
    }

    @PluginMethod
    fun getSmsMessages(call: PluginCall) {
        val arr = JSArray()
        try {
            if (ActivityCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED) {
                val cursor = context.contentResolver.query(
                    Uri.parse("content://sms"),
                    null,
                    null,
                    null,
                    "date DESC"
                )
                cursor?.use {
                    var count = 0
                    val idIdx = it.getColumnIndex("_id")
                    val addrIdx = it.getColumnIndex("address")
                    val bodyIdx = it.getColumnIndex("body")
                    val dateIdx = it.getColumnIndex("date")
                    val typeIdx = it.getColumnIndex("type")
                    while (it.moveToNext() && count < 25) {
                        val obj = JSObject()
                        obj.put("id", if (idIdx >= 0) it.getString(idIdx) else count.toString())
                        obj.put("address", if (addrIdx >= 0) (it.getString(addrIdx) ?: "Unknown") else "Unknown")
                        obj.put("body", if (bodyIdx >= 0) (it.getString(bodyIdx) ?: "") else "")
                        obj.put("date", if (dateIdx >= 0) it.getLong(dateIdx) else 0L)
                        val t = if (typeIdx >= 0) it.getInt(typeIdx) else 1
                        obj.put("type", if (t == 2) "SENT" else "INBOX")
                        arr.put(obj)
                        count++
                    }
                }
            }
        } catch (_: Exception) {}
        val res = JSObject()
        res.put("messages", arr)
        call.resolve(res)
    }

    @PluginMethod
    fun sendSms(call: PluginCall) {
        val rawTarget = (call.getString("phone") ?: "").trim()
        val message = (call.getString("message") ?: "").trim()
        if (rawTarget.isEmpty() || message.isEmpty()) {
            val res = JSObject()
            res.put("ok", false)
            res.put("message", "Phone and message required")
            call.resolve(res)
            return
        }
        val digitsOnly = rawTarget.replace(Regex("[^0-9+]"), "")
        val phone = if (digitsOnly.replace("+", "").length >= 7) {
            digitsOnly
        } else {
            lookupContactPhone(rawTarget)?.second?.replace(Regex("[^0-9+]"), "") ?: ""
        }
        if (phone.isEmpty()) {
            val res = JSObject()
            res.put("ok", false)
            res.put("message", "'$rawTarget' ka phone number nahi mila.")
            call.resolve(res)
            return
        }
        try {
            val sms = context.getSystemService(SmsManager::class.java) ?: SmsManager.getDefault()
            sms.sendTextMessage(phone, null, message, null, null)
            val res = JSObject()
            res.put("ok", true)
            res.put("message", "SMS sent to $rawTarget ($phone)!")
            call.resolve(res)
        } catch (e: Exception) {
            val res = JSObject()
            res.put("ok", false)
            res.put("message", e.message ?: "Failed to send SMS")
            call.resolve(res)
        }
    }

    @PluginMethod
    fun setBackgroundWakeService(call: PluginCall) {
        val enabled = call.getBoolean("enabled") ?: false
        val phrasesArr = call.getArray("phrases")
        try {
            if (enabled && ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                val res = JSObject()
                res.put("ok", false)
                res.put("active", false)
                res.put("message", "Please allow Microphone permission first before starting Always-On Background Engine.")
                call.resolve(res)
                return
            }

            val prefsEditor = context.getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
                .edit()
                .putBoolean("wake_enabled", enabled)
            if (phrasesArr != null && phrasesArr.length() > 0) {
                val list = mutableListOf<String>()
                for (i in 0 until phrasesArr.length()) {
                    val p = phrasesArr.optString(i, "").trim().lowercase(Locale.US)
                    if (p.isNotEmpty()) list.add(p)
                }
                if (list.isNotEmpty()) {
                    prefsEditor.putString("wake_phrases_csv", list.joinToString("|"))
                }
            }
            prefsEditor.apply()

            val intent = Intent(context, JarvisWakeForegroundService::class.java)
            if (enabled) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } else {
                intent.putExtra("stop_service", true)
                context.stopService(intent)
            }
            val res = JSObject()
            res.put("ok", true)
            res.put("active", enabled)
            res.put(
                "message",
                if (enabled) "Always-On Background Engine active! App close hone par bhi background mein chalega."
                else "Background Wake Service Stopped."
            )
            call.resolve(res)
        } catch (e: Exception) {
            val res = JSObject()
            res.put("ok", false)
            res.put("active", false)
            res.put("message", e.message ?: "Could not update Background Wake Service.")
            call.resolve(res)
        }
    }

    @PluginMethod
    fun openNotificationAccessSettings(call: PluginCall) {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            val res = JSObject()
            res.put("ok", true)
            call.resolve(res)
        } catch (_: Exception) {
            val res = JSObject()
            res.put("ok", false)
            call.resolve(res)
        }
    }

    @PluginMethod
    fun requestAllPermissions(call: PluginCall) {
        requestCorePermissions(call)
    }

    @PluginMethod
    fun applyLiveWallpaperOnPhone(call: PluginCall) {
        val style = call.getString("style") ?: "oneui9_aurora"
        val accentHex = call.getString("accentHex") ?: "#00f0ff"
        val clockHex = call.getString("clockHex") ?: "#e0f2fe"
        val showClock = call.getBoolean("showClock") ?: true
        try {
            context.getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
                .edit()
                .putString("live_wallpaper_style", style)
                .putString("oneui_accent_hex", accentHex)
                .putString("oneui_clock_hex", clockHex)
                .putBoolean("wallpaper_show_clock", showClock)
                .apply()

            val wpIntent = Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER).apply {
                putExtra(
                    WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT,
                    ComponentName(context, JarvisLiveWallpaperService::class.java)
                )
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(wpIntent)
            val res = JSObject()
            res.put("ok", true)
            res.put("message", "Live Wallpaper chooser khul gaya hai — 'Set Wallpaper' par tap karein.")
            call.resolve(res)
        } catch (e: Exception) {
            try {
                val fallback = Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(fallback)
                val res = JSObject()
                res.put("ok", true)
                res.put("message", "Live Wallpaper menu khul gaya hai — Wasu's Jarvis select karein.")
                call.resolve(res)
            } catch (_: Exception) {
                val res = JSObject()
                res.put("ok", false)
                res.put("message", e.message ?: "Could not open Live Wallpaper picker.")
                call.resolve(res)
            }
        }
    }

    @PluginMethod
    fun applyBitmapWallpaperOnPhone(call: PluginCall) {
        val dataUrl = call.getString("dataUrl") ?: ""
        val target = call.getString("target") ?: "both"
        if (dataUrl.isEmpty()) {
            val res = JSObject()
            res.put("ok", false)
            res.put("message", "Wallpaper image missing.")
            call.resolve(res)
            return
        }
        wakeExecutor.execute {
            try {
                val cleanB64 = if (dataUrl.contains(",")) dataUrl.substringAfter(",") else dataUrl
                val bytes = Base64.decode(cleanB64, Base64.DEFAULT)

                // Safe memory decode for high-res photos
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
                var sample = 1
                while (bounds.outWidth / sample > 1440 || bounds.outHeight / sample > 3000) {
                    sample *= 2
                }
                val opts = BitmapFactory.Options().apply { inSampleSize = sample }
                val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
                if (bmp == null) {
                    mainHandler.post {
                        val res = JSObject()
                        res.put("ok", false)
                        res.put("message", "Could not decode wallpaper bitmap.")
                        call.resolve(res)
                    }
                    return@execute
                }
                try {
                    val customWpFile = File(context.filesDir, "custom_lock_wallpaper.png")
                    FileOutputStream(customWpFile).use { fos ->
                        fos.write(bytes)
                        fos.flush()
                    }
                } catch (_: Exception) {}

                val wm = WallpaperManager.getInstance(context)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    val flags = when (target) {
                        "home" -> WallpaperManager.FLAG_SYSTEM
                        "lock" -> WallpaperManager.FLAG_LOCK
                        else -> WallpaperManager.FLAG_SYSTEM or WallpaperManager.FLAG_LOCK
                    }
                    wm.setBitmap(bmp, null, true, flags)
                } else {
                    wm.setBitmap(bmp)
                }
                try { bmp.recycle() } catch (_: Exception) {}
                mainHandler.post {
                    val res = JSObject()
                    res.put("ok", true)
                    res.put(
                        "message",
                        when (target) {
                            "lock" -> "Custom Lock Screen & Clock Design aapke phone par set ho gaya!"
                            "home" -> "Custom Home Wallpaper aapke phone par set ho gaya!"
                            else -> "Home & Lock Wallpaper dono phone par set ho gaye!"
                        }
                    )
                    call.resolve(res)
                }
            } catch (e: Exception) {
                mainHandler.post {
                    val res = JSObject()
                    res.put("ok", false)
                    res.put("message", e.message ?: "Phone wallpaper update fail hua.")
                    call.resolve(res)
                }
            }
        }
    }

    @PluginMethod
    fun syncOneUiOverlayConfig(call: PluginCall) {
        try {
            val dynamicBarStyle = call.getString("dynamicBarStyle") ?: "now_bar_pill"
            val dynamicBarAnchor = call.getString("dynamicBarAnchor") ?: "camera-island"
            val dynamicBarOffsetX = call.getInt("dynamicBarOffsetX") ?: 0
            val dynamicBarOffsetY = call.getInt("dynamicBarOffsetY") ?: 6
            val dynamicBarCameraGapPx = call.getInt("dynamicBarCameraGapPx") ?: 34
            val dynamicBarCustomLabel = call.getString("dynamicBarCustomLabel") ?: "Wasu's Jarvis"
            val dynamicBarOutside = call.getBoolean("dynamicBarShowOutsideApp") ?: true
            val unlockBarAnim = call.getString("unlockBarAnimStyle") ?: "aurora_bloom"
            val fingerprintAnimId = call.getString("fingerprintAnimId") ?: "ripple_wave"
            val faceAnimId = call.getString("faceAnimId") ?: "hologram_mesh"
            val fingerprintOnAnyWallpaper = call.getBoolean("fingerprintOnAnyWallpaper") ?: true
            val biometricUnlockAnimDisplay = call.getString("biometricUnlockAnimDisplay") ?: "auto"
            val chargingAnim = call.getString("chargingAnim") ?: "oneui9_turbo"
            val chargingEnabled = call.getBoolean("chargingOverlayEnabled") ?: true
            val accentHex = call.getString("accentHex") ?: "#00f0ff"
            val liveWallpaperStyle = call.getString("liveWallpaperStyle") ?: "oneui9_aurora"
            val clockHex = call.getString("clockHex") ?: "#e0f2fe"
            val waveStyle = call.getString("waveVisualizerStyle") ?: "rainbow_prism"
            val waveTheme = call.getString("waveColorTheme") ?: "aurora_cyan"
            val followUpEnabled = call.getBoolean("followUpListeningEnabled") ?: true
            val vipContactsJson = call.getString("vipContactsJson")
            val perAppRulesJson = call.getString("perAppRulesJson")

            val editor = context.getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE).edit()
                .putString("dynamic_bar_style", dynamicBarStyle)
                .putString("dynamic_bar_anchor", dynamicBarAnchor)
                .putInt("dynamic_bar_offset_x", dynamicBarOffsetX)
                .putInt("dynamic_bar_offset_y", dynamicBarOffsetY)
                .putInt("dynamic_bar_camera_gap_px", dynamicBarCameraGapPx)
                .putString("dynamic_bar_custom_label", dynamicBarCustomLabel)
                .putBoolean("dynamic_bar_outside_app", dynamicBarOutside)
                .putString("unlock_bar_anim_style", unlockBarAnim)
                .putString("fingerprint_anim_id", fingerprintAnimId)
                .putString("face_anim_id", faceAnimId)
                .putBoolean("fingerprint_on_any_wallpaper", fingerprintOnAnyWallpaper)
                .putString("biometric_unlock_anim_display", biometricUnlockAnimDisplay)
                .putString("charging_anim_id", chargingAnim)
                .putBoolean("charging_overlay_enabled", chargingEnabled)
                .putString("oneui_accent_hex", accentHex)
                .putString("live_wallpaper_style", liveWallpaperStyle)
                .putString("oneui_clock_hex", clockHex)
                .putString("wave_visualizer_style", waveStyle)
                .putString("wave_color_theme", waveTheme)
                .putBoolean("follow_up_listening", followUpEnabled)

            if (vipContactsJson != null) editor.putString("vip_contacts_json", vipContactsJson)
            if (perAppRulesJson != null) editor.putString("per_app_rules_json", perAppRulesJson)
            editor.apply()

            val accessibilityEnabled = isAccessibilityServiceEnabled()
            val overlayGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)

            if (DynamicIslandOverlayController.activeController != null) {
                DynamicIslandOverlayController.dispatchRefreshConfig()
            } else if (overlayGranted && !accessibilityEnabled && isForegroundActive) {
                val svc = Intent(context, OneUiOverlayService::class.java).apply {
                    action = if (dynamicBarStyle == "hidden" || !dynamicBarOutside) {
                        OneUiOverlayService.ACTION_STOP
                    } else {
                        OneUiOverlayService.ACTION_UPDATE
                    }
                }
                try { context.startService(svc) } catch (_: Exception) {}
            }

            val res = JSObject()
            res.put("ok", true)
            res.put("overlayGranted", overlayGranted)
            res.put("accessibilityEnabled", accessibilityEnabled)
            call.resolve(res)
        } catch (e: Exception) {
            val res = JSObject()
            res.put("ok", false)
            res.put("message", e.message ?: "Overlay sync failed")
            call.resolve(res)
        }
    }

    @PluginMethod
    fun answerOrRejectCall(call: PluginCall) {
        val action = (call.getString("action") ?: "answer").lowercase(Locale.US)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            val res = JSObject()
            res.put("ok", false)
            res.put("message", "Android 8+ required for programmatic call control.")
            call.resolve(res)
            return
        }
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ANSWER_PHONE_CALLS) != PackageManager.PERMISSION_GRANTED) {
            val res = JSObject()
            res.put("ok", false)
            res.put("message", "ANSWER_PHONE_CALLS permission required.")
            call.resolve(res)
            return
        }
        try {
            val tm = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
            if (tm == null) {
                val res = JSObject()
                res.put("ok", false)
                res.put("message", "TelecomManager unavailable.")
                call.resolve(res)
                return
            }
            val ok = if (action == "answer" || action == "accept") {
                @Suppress("DEPRECATION")
                tm.acceptRingingCall()
                true
            } else {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    @Suppress("DEPRECATION")
                    tm.endCall()
                } else false
            }
            val res = JSObject()
            res.put("ok", ok)
            res.put("message", if (ok) "Call $action executed." else "Could not $action call.")
            call.resolve(res)
        } catch (e: Exception) {
            val res = JSObject()
            res.put("ok", false)
            res.put("message", e.message ?: "Call control error.")
            call.resolve(res)
        }
    }

    @PluginMethod
    fun getUserActivityState(call: PluginCall) {
        val state = UserActivityMonitor.getLastKnownState(context)
        val res = JSObject()
        res.put("ok", true)
        res.put("state", state)
        call.resolve(res)
    }

    @PluginMethod
    fun acknowledgeVipReminders(call: PluginCall) {
        QNexusNotificationService.clearVipReminders()
        val res = JSObject()
        res.put("ok", true)
        call.resolve(res)
    }

    @PluginMethod
    fun triggerDynamicBarUnlockEffect(call: PluginCall) {
        val method = call.getString("method") ?: "Fingerprint"
        DynamicIslandOverlayController.lastInteractiveUnlockHint = method
        val overlayGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)
        if (DynamicIslandOverlayController.activeController != null) {
            DynamicIslandOverlayController.dispatchUnlockEffect(method)
        } else if (overlayGranted) {
            try {
                context.startService(Intent(context, OneUiOverlayService::class.java).apply {
                    action = OneUiOverlayService.ACTION_SHOW_UNLOCK_EFFECT
                    putExtra("method", method)
                })
            } catch (_: Exception) {}
        }
        val res = JSObject()
        res.put("ok", true)
        res.put("overlayGranted", overlayGranted)
        call.resolve(res)
    }

    @PluginMethod
    fun triggerChargingOverlayTest(call: PluginCall) {
        val overlayGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)
        if (DynamicIslandOverlayController.activeController != null) {
            DynamicIslandOverlayController.dispatchCharging()
        } else if (overlayGranted) {
            try {
                context.startService(Intent(context, OneUiOverlayService::class.java).apply {
                    action = OneUiOverlayService.ACTION_SHOW_CHARGING
                })
            } catch (_: Exception) {}
        }
        val res = JSObject()
        res.put("ok", overlayGranted || DynamicIslandOverlayController.activeController != null)
        res.put("overlayGranted", overlayGranted)
        call.resolve(res)
    }

    @PluginMethod
    fun openAndroidQuickPanel(call: PluginCall) {
        val panel = (call.getString("panel") ?: "wifi").lowercase(Locale.US)
        try {
            val intent = when (panel) {
                "wifi" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    Intent(Settings.Panel.ACTION_WIFI)
                } else Intent(Settings.ACTION_WIFI_SETTINGS)
                "data", "internet" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    Intent(Settings.Panel.ACTION_INTERNET_CONNECTIVITY)
                } else Intent(Settings.ACTION_WIRELESS_SETTINGS)
                "sound", "volume" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    Intent(Settings.Panel.ACTION_VOLUME)
                } else Intent(Settings.ACTION_SOUND_SETTINGS)
                "bluetooth" -> Intent(Settings.ACTION_BLUETOOTH_SETTINGS)
                "display", "brightness" -> Intent(Settings.ACTION_DISPLAY_SETTINGS)
                "location", "gps" -> Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
                "battery" -> Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS)
                "airplane" -> Intent(Settings.ACTION_AIRPLANE_MODE_SETTINGS)
                "nfc" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    Intent(Settings.Panel.ACTION_NFC)
                } else Intent(Settings.ACTION_NFC_SETTINGS)
                else -> Intent(Settings.ACTION_SETTINGS)
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            val res = JSObject()
            res.put("ok", true)
            call.resolve(res)
        } catch (e: Exception) {
            val res = JSObject()
            res.put("ok", false)
            res.put("message", e.message ?: "Could not open system panel.")
            call.resolve(res)
        }
    }

    @PluginMethod
    fun getInstalledLauncherApps(call: PluginCall) {
        val arr = JSArray()
        try {
            val pm = context.packageManager
            val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            val apps = pm.queryIntentActivities(mainIntent, 0)
            val seen = HashSet<String>()
            for (ri in apps) {
                val pkg = ri.activityInfo?.packageName ?: continue
                if (!seen.add(pkg)) continue
                val label = ri.loadLabel(pm)?.toString() ?: continue
                val item = JSObject()
                item.put("name", label)
                item.put("packageName", pkg)
                arr.put(item)
                if (arr.length() >= 36) break
            }
        } catch (_: Exception) {}
        val res = JSObject()
        res.put("ok", true)
        res.put("apps", arr)
        call.resolve(res)
    }
}
