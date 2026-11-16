package com.qnexus.jarvis

import android.Manifest
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.database.Cursor
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioAttributes
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
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.telephony.SmsManager
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
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean

@CapacitorPlugin(
    name = "QNexusNative",
    permissions = [
        Permission(strings = [Manifest.permission.RECORD_AUDIO], alias = "mic"),
        Permission(strings = [Manifest.permission.READ_CALL_LOG, Manifest.permission.READ_PHONE_STATE], alias = "phone"),
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
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var cmdRecognizer: SpeechRecognizer? = null
    private var wakeRecognizer: SpeechRecognizer? = null
    private var wakeWordEnabled = false
    private var isListeningCommand = false
    private var isSpeakingTts = false
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
    }

    override fun handleOnResume() {
        super.handleOnResume()
        isForegroundActive = true
        if (JarvisWakeForegroundService.isServiceActive) {
            try {
                val intent = Intent(context, JarvisWakeForegroundService::class.java).apply {
                    action = JarvisWakeForegroundService.ACTION_PAUSE_MIC
                }
                context.startService(intent)
            } catch (_: Exception) {}
        }
        if (wakeWordEnabled && !isListeningCommand && !isSpeakingTts) {
            mainHandler.postDelayed({ startWakeRecognizerInternal() }, 300)
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
        try { cmdRecognizer?.destroy() } catch (_: Exception) {}
        try { wakeRecognizer?.destroy() } catch (_: Exception) {}
        try {
            tts?.stop()
            tts?.shutdown()
        } catch (_: Exception) {}
        cmdRecognizer = null
        wakeRecognizer = null
        tts = null
        ttsReady = false
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
                            stopWakeRecognizerInternal()
                            emitSimple("nativeTtsStart", JSObject())
                        }

                        override fun onDone(utteranceId: String?) {
                            isSpeakingTts = false
                            emitSimple("nativeTtsDone", JSObject())
                            if (wakeWordEnabled && !isListeningCommand) {
                                mainHandler.postDelayed({ startWakeRecognizerInternal() }, 350)
                            }
                        }

                        @Deprecated("Deprecated in Java")
                        override fun onError(utteranceId: String?) {
                            isSpeakingTts = false
                            emitSimple("nativeTtsDone", JSObject())
                            if (wakeWordEnabled && !isListeningCommand) {
                                mainHandler.postDelayed({ startWakeRecognizerInternal() }, 350)
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

    fun emitNotificationEvent(item: JSObject) {
        emitSimple("nativeNotificationReceived", item)
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
                REQ_COMMS_PERMS -> {
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
        val sms = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
        val notifications = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        } else true
        val notifListener = try {
            NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
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
        res.put("sms", sms)
        res.put("notifListener", notifListener)
        res.put("sdkInt", Build.VERSION.SDK_INT)
        return res
    }

    @PluginMethod
    fun getPermissionStatus(call: PluginCall) {
        call.resolve(buildPermissionStatusJson())
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
            Manifest.permission.ACCESS_FINE_LOCATION
        )
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
                val engine = tts
                if (engine == null || !ttsReady) {
                    val res = JSObject()
                    res.put("ok", false)
                    call.resolve(res)
                } else {
                    val targetLocale = when (lang) {
                        "en" -> Locale.US
                        "pa" -> Locale("pa", "IN")
                        else -> Locale("ur", "PK")
                    }
                    var activeLangTag = targetLocale.language.lowercase(Locale.US)
                    var langCode = engine.setLanguage(targetLocale)
                    if (langCode == TextToSpeech.LANG_MISSING_DATA || langCode == TextToSpeech.LANG_NOT_SUPPORTED) {
                        langCode = engine.setLanguage(Locale("hi", "IN"))
                        activeLangTag = "hi"
                    }
                    if (langCode == TextToSpeech.LANG_MISSING_DATA || langCode == TextToSpeech.LANG_NOT_SUPPORTED) {
                        engine.setLanguage(Locale.US)
                        activeLangTag = "en"
                    }

                    // Select natural female/male voice matching the active resolved locale
                    try {
                        val isMale = gender == "male"
                        val matching = engine.voices?.firstOrNull { v ->
                            val nm = v.name.lowercase(Locale.US)
                            val lc = v.locale.language.lowercase(Locale.US)
                            val langMatches = lc == activeLangTag || (activeLangTag == "ur" && lc == "hi")
                            val maleVoice = nm.contains("male") || nm.contains("-m-") || nm.endsWith("-m") || nm.contains("asad") || nm.contains("salman") || nm.contains("madhur")
                            val femaleVoice = nm.contains("female") || nm.contains("-f-") || nm.endsWith("-f") || nm.contains("uzma") || nm.contains("gul") || nm.contains("swara") || nm.contains("sfg")
                            langMatches && (if (isMale) maleVoice else femaleVoice || !maleVoice)
                        }
                        if (matching != null) {
                            engine.voice = matching
                        }
                    } catch (_: Exception) {}

                    val isMale = gender == "male"
                    val effectivePitch = (pitchOpt ?: if (isMale) 0.78f else 1.07f).coerceIn(0.6f, 1.5f)
                    val effectiveRate = (rateOpt ?: 1.0f).coerceIn(0.75f, 1.45f)
                    engine.setPitch(effectivePitch)
                    engine.setSpeechRate(effectiveRate)

                    val uttId = "wasu_tts_${System.currentTimeMillis()}"
                    engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, uttId)
                    val res = JSObject()
                    res.put("ok", true)
                    call.resolve(res)
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
            tts?.stop()
        } catch (_: Exception) {}
        isSpeakingTts = false
        val res = JSObject()
        res.put("ok", true)
        call.resolve(res)
    }

    @PluginMethod
    fun startNativeListening(call: PluginCall) {
        val lang = call.getString("lang") ?: "ur"
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            val res = JSObject()
            res.put("ok", false)
            res.put("needsMicPermission", true)
            res.put("message", "Microphone permission required")
            call.resolve(res)
            return
        }

        mainHandler.post {
            try {
                tts?.stop()
                isSpeakingTts = false
                stopWakeRecognizerInternal()

                if (!SpeechRecognizer.isRecognitionAvailable(context)) {
                    val res = JSObject()
                    res.put("ok", false)
                    res.put("message", "Android Speech Recognition engine unavailable on this phone.")
                    call.resolve(res)
                    return@post
                }

                try { cmdRecognizer?.destroy() } catch (_: Exception) {}
                cmdRecognizer = SpeechRecognizer.createSpeechRecognizer(context)
                isListeningCommand = true

                cmdRecognizer?.setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) {
                        emitSimple("nativeSpeechStart", JSObject())
                    }
                    override fun onBeginningOfSpeech() {}
                    override fun onRmsChanged(rmsdB: Float) {
                        val norm = ((rmsdB + 2f) / 12f).coerceIn(0f, 1f)
                        val obj = JSObject()
                        obj.put("level", norm)
                        emitSimple("nativeSpeechRms", obj)
                    }
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() {}
                    override fun onError(error: Int) {
                        isListeningCommand = false
                        val msg = when (error) {
                            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission allow karein."
                            SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Awaaz saaf sunayi nahi di, dobara bolein."
                            SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Voice recognition ke liye internet ya Google offline speech pack zaroori hai."
                            else -> "Voice mic dobara start karein."
                        }
                        val errObj = JSObject()
                        errObj.put("code", error)
                        errObj.put("message", msg)
                        emitSimple("nativeSpeechError", errObj)
                        emitSimple("nativeSpeechEnd", JSObject())
                        if (wakeWordEnabled && !isSpeakingTts) {
                            mainHandler.postDelayed({ startWakeRecognizerInternal() }, 450)
                        }
                    }
                    override fun onResults(results: Bundle?) {
                        isListeningCommand = false
                        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        val text = matches?.firstOrNull()?.trim() ?: ""
                        if (text.isNotEmpty()) {
                            val obj = JSObject()
                            obj.put("text", text)
                            emitSimple("nativeSpeechResult", obj)
                        } else {
                            val errObj = JSObject()
                            errObj.put("message", "Awaaz clear nahi thi, dobara bolein.")
                            emitSimple("nativeSpeechError", errObj)
                        }
                        emitSimple("nativeSpeechEnd", JSObject())
                        if (wakeWordEnabled && !isSpeakingTts) {
                            mainHandler.postDelayed({ startWakeRecognizerInternal() }, 500)
                        }
                    }
                    override fun onPartialResults(partialResults: Bundle?) {
                        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        val text = matches?.firstOrNull()?.trim() ?: ""
                        if (text.isNotEmpty()) {
                            val obj = JSObject()
                            obj.put("text", text)
                            emitSimple("nativeSpeechPartial", obj)
                        }
                    }
                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })

                val recLang = when (lang) {
                    "en" -> "en-US"
                    "pa" -> "pa-IN"
                    else -> "ur-PK"
                }
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, recLang)
                }
                cmdRecognizer?.startListening(intent)
                val res = JSObject()
                res.put("ok", true)
                call.resolve(res)
            } catch (e: Exception) {
                isListeningCommand = false
                val res = JSObject()
                res.put("ok", false)
                res.put("message", e.message ?: "Could not start native microphone")
                call.resolve(res)
            }
        }
    }

    @PluginMethod
    fun stopNativeListening(call: PluginCall) {
        mainHandler.post {
            try { cmdRecognizer?.stopListening() } catch (_: Exception) {}
        }
        val res = JSObject()
        res.put("ok", true)
        call.resolve(res)
    }

    @PluginMethod
    fun cancelNativeListening(call: PluginCall) {
        mainHandler.post {
            isListeningCommand = false
            try { cmdRecognizer?.cancel() } catch (_: Exception) {}
            if (wakeWordEnabled && !isSpeakingTts) {
                mainHandler.postDelayed({ startWakeRecognizerInternal() }, 300)
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
        val micGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        mainHandler.post {
            if (enabled && micGranted && !isListeningCommand && !isSpeakingTts) {
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
            wakeRecognizer?.cancel()
            wakeRecognizer?.destroy()
        } catch (_: Exception) {}
        wakeRecognizer = null
    }

    private fun startWakeRecognizerInternal() {
        if (!wakeWordEnabled || isListeningCommand || isSpeakingTts) return
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return
        if (!SpeechRecognizer.isRecognitionAvailable(context)) return
        try {
            stopWakeRecognizerInternal()
            wakeRecognizer = SpeechRecognizer.createSpeechRecognizer(context)
            wakeRecognizer?.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    val obj = JSObject()
                    obj.put("active", true)
                    obj.put("status", "LISTENING — Say 'Hi Jarvis' anytime")
                    emitSimple("nativeWakeStatus", obj)
                }
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onError(error: Int) {
                    if (wakeWordEnabled && !isListeningCommand && !isSpeakingTts) {
                        val delay = if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) 900L else 550L
                        mainHandler.postDelayed({ startWakeRecognizerInternal() }, delay)
                    }
                }
                override fun onResults(results: Bundle?) {
                    val matched = checkWakeBundle(results)
                    if (!matched && wakeWordEnabled && !isListeningCommand && !isSpeakingTts) {
                        mainHandler.postDelayed({ startWakeRecognizerInternal() }, 320)
                    }
                }
                override fun onPartialResults(partialResults: Bundle?) {
                    checkWakeBundle(partialResults)
                }
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
            }
            wakeRecognizer?.startListening(intent)
        } catch (_: Exception) {
            if (wakeWordEnabled && !isListeningCommand && !isSpeakingTts) {
                mainHandler.postDelayed({ startWakeRecognizerInternal() }, 1200)
            }
        }
    }

    private fun checkWakeBundle(bundle: Bundle?): Boolean {
        val matches = bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: return false
        for (raw in matches) {
            val lower = raw.lowercase(Locale.US).trim()
            if (lower.isEmpty()) continue
            val hit = wakePhrases.firstOrNull { lower.contains(it) }
                ?: if (Regex("\\b(jarvis|jarvish|jervis|javis|wasu|wasi)\\b").containsMatchIn(lower)) "hi jarvis" else null
            if (hit != null) {
                val idx = lower.indexOf(hit)
                val trailing = if (idx >= 0) lower.substring(idx + hit.length).trim() else ""
                stopWakeRecognizerInternal()
                emitWakeEvent(hit, trailing)
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
        val res = JSObject()
        res.put("ok", true)
        res.put("running", JarvisWakeForegroundService.isServiceActive)
        res.put("wakeEnabled", wakeEnabled)
        res.put("batteryUnrestricted", batteryUnrestricted)
        call.resolve(res)
    }

    @PluginMethod
    fun getNotifications(call: PluginCall) {
        val arr = JSArray()
        var enabled = false
        try {
            enabled = NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
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
        val phone = call.getString("phone") ?: ""
        val message = call.getString("message") ?: ""
        if (phone.isEmpty() || message.isEmpty()) {
            val res = JSObject()
            res.put("ok", false)
            res.put("message", "Phone and message required")
            call.resolve(res)
            return
        }
        try {
            val sms = context.getSystemService(SmsManager::class.java) ?: SmsManager.getDefault()
            sms.sendTextMessage(phone, null, message, null, null)
            val res = JSObject()
            res.put("ok", true)
            res.put("message", "SMS sent to $phone!")
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
}
