package com.qnexus.jarvis

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Handler
import android.os.Looper
import android.os.Process
import android.util.Base64
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.sqrt

/**
 * Suppresses wake-word audio ONLY while Jarvis's own TTS is speaking (+ brief echo tail).
 * Never uses AudioManager.isMusicActive because WebView <video> and UI sound effects can
 * keep isMusicActive true and permanently mute the wake microphone.
 */
object WakeSpeechSuppressor {
    @Volatile
    private var suppressUntilMs: Long = 0L

    @Volatile
    private var ttsSpeaking: Boolean = false

    fun setTtsActive(active: Boolean, tailCooldownMs: Long = 1100L) {
        ttsSpeaking = active
        if (!active && tailCooldownMs > 0L) {
            suppressFor(tailCooldownMs)
        }
    }

    fun suppressFor(durationMs: Long) {
        val until = System.currentTimeMillis() + durationMs
        if (until > suppressUntilMs) {
            suppressUntilMs = until
        }
    }

    fun isSuppressed(@Suppress("UNUSED_PARAMETER") context: Context): Boolean {
        if (ttsSpeaking) return true
        return System.currentTimeMillis() < suppressUntilMs
    }
}

/**
 * Global microphone coordinator shared between foreground UI plugin and background FGS.
 * Ensures ALL SilentWakeVad AudioRecord instances exit their native read loop BEFORE
 * SpeechRecognizer or SilentCommandRecorder acquires the hardware mic.
 */
object MicHardwareCoordinator {
    private val activeVads = CopyOnWriteArraySet<SilentWakeVad>()

    @Volatile
    var isCommandSessionActive: Boolean = false

    fun registerVad(vad: SilentWakeVad) {
        activeVads.add(vad)
    }

    fun unregisterVad(vad: SilentWakeVad) {
        activeVads.remove(vad)
    }

    fun forceReleaseAllWakeAudio(timeoutMs: Long = 450L) {
        for (vad in activeVads) {
            try {
                vad.stopAndAwaitRelease(timeoutMs)
            } catch (_: Exception) {}
        }
    }
}

data class WakeCheckResult(
    val networkOk: Boolean,
    val matched: Boolean,
    val matchedPhrase: String = "hi jarvis",
    val trailingCommand: String = ""
)

data class BgVoiceCommandResult(
    val networkOk: Boolean,
    val silentAudio: Boolean,
    val transcript: String = "",
    val reply: String = "",
    val action: String = "NONE",
    val actionPayloadJson: String = "{}"
)

object WakeAudioUtils {
    const val DEFAULT_CLOUD_API_BASE = "https://ais-pre-k67uumt7pwtt42jjnc7omx-987831856092.asia-southeast1.run.app"

    @Volatile
    private var lastCloudFailedAtMs: Long = 0L

    @Volatile
    private var lastCloudAvailable: Boolean = false

    fun getCloudApiBase(context: Context): String {
        return try {
            val saved = context.getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
                .getString("cloud_api_base", null)
                ?.trim()
                ?.trimEnd('/')
            if (!saved.isNullOrEmpty() && saved.startsWith("http")) saved else DEFAULT_CLOUD_API_BASE
        } catch (_: Exception) {
            DEFAULT_CLOUD_API_BASE
        }
    }

    fun resetCloudHealthCache() {
        lastCloudFailedAtMs = 0L
    }

    fun hasDeviceInternet(context: Context): Boolean {
        return try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
            val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } catch (_: Exception) {
            false
        }
    }

    fun isCloudRecentlyUnavailable(): Boolean {
        if (lastCloudAvailable) return false
        return lastCloudFailedAtMs > 0L && (System.currentTimeMillis() - lastCloudFailedAtMs) < 8_000L
    }

    fun markCloudVoiceAudioResult(ok: Boolean) {
        if (ok) {
            lastCloudAvailable = true
            lastCloudFailedAtMs = 0L
        } else {
            lastCloudAvailable = false
            lastCloudFailedAtMs = System.currentTimeMillis()
        }
    }

    fun pcm16ToWavBytes(samples: ShortArray, sampleCount: Int, sampleRate: Int = 16000): ByteArray {
        val pcmBytes = sampleCount * 2
        val totalDataLen = pcmBytes + 36
        val byteRate = sampleRate * 2
        val out = ByteArrayOutputStream(44 + pcmBytes)

        fun writeStr(s: String) {
            for (ch in s) out.write(ch.code)
        }
        fun writeIntLE(v: Int) {
            out.write(v and 0xff)
            out.write((v shr 8) and 0xff)
            out.write((v shr 16) and 0xff)
            out.write((v shr 24) and 0xff)
        }
        fun writeShortLE(v: Int) {
            out.write(v and 0xff)
            out.write((v shr 8) and 0xff)
        }

        writeStr("RIFF")
        writeIntLE(totalDataLen)
        writeStr("WAVE")
        writeStr("fmt ")
        writeIntLE(16)
        writeShortLE(1)
        writeShortLE(1)
        writeIntLE(sampleRate)
        writeIntLE(byteRate)
        writeShortLE(2)
        writeShortLE(16)
        writeStr("data")
        writeIntLE(pcmBytes)

        val buf = ByteArray(pcmBytes)
        var j = 0
        for (i in 0 until sampleCount) {
            val s = samples[i].toInt()
            buf[j++] = (s and 0xff).toByte()
            buf[j++] = ((s shr 8) and 0xff).toByte()
        }
        out.write(buf)
        return out.toByteArray()
    }

    fun checkWakeWordOnline(context: Context, wavBytes: ByteArray, wakeNames: List<String>): WakeCheckResult {
        if (!hasDeviceInternet(context) || isCloudRecentlyUnavailable()) {
            return WakeCheckResult(networkOk = false, matched = false)
        }
        var conn: HttpURLConnection? = null
        return try {
            val base = getCloudApiBase(context)
            val url = URL("$base/api/jarvis/wake-check")
            conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 4500
                readTimeout = 6500
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
            val namesArr = JSONArray()
            for (n in wakeNames) namesArr.put(n)
            val payload = JSONObject().apply {
                put("audioBase64", Base64.encodeToString(wavBytes, Base64.NO_WRAP))
                put("mimeType", "audio/wav")
                put("wakeNames", namesArr)
            }
            conn.outputStream.use { os ->
                os.write(payload.toString().toByteArray(Charsets.UTF_8))
                os.flush()
            }
            val code = conn.responseCode
            if (code !in 200..299) {
                lastCloudAvailable = false
                lastCloudFailedAtMs = System.currentTimeMillis()
                return WakeCheckResult(networkOk = false, matched = false)
            }
            val body = conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            val json = JSONObject(body)
            if (json.optBoolean("needsSpeechApi", false)) {
                lastCloudAvailable = false
                lastCloudFailedAtMs = System.currentTimeMillis()
                return WakeCheckResult(networkOk = false, matched = false)
            }
            lastCloudAvailable = true
            lastCloudFailedAtMs = 0L
            WakeCheckResult(
                networkOk = true,
                matched = json.optBoolean("matched", false),
                matchedPhrase = json.optString("matchedPhrase", "hi jarvis").ifBlank { "hi jarvis" },
                trailingCommand = json.optString("trailingCommand", "").trim()
            )
        } catch (_: Exception) {
            lastCloudAvailable = false
            lastCloudFailedAtMs = System.currentTimeMillis()
            WakeCheckResult(networkOk = false, matched = false)
        } finally {
            try { conn?.disconnect() } catch (_: Exception) {}
        }
    }

    fun executeBackgroundCommandOnline(
        context: Context,
        wavBytes: ByteArray,
        language: String = "ur",
        characterGender: String = "female",
        personalityName: String = "Wasi ki Jan"
    ): BgVoiceCommandResult {
        if (!hasDeviceInternet(context)) {
            return BgVoiceCommandResult(networkOk = false, silentAudio = true)
        }
        val base = getCloudApiBase(context)
        for (attempt in 0 until 2) {
            var conn: HttpURLConnection? = null
            try {
                val url = URL("$base/api/jarvis/voice-audio")
                conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 7000
                    readTimeout = 14000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
                val payload = JSONObject().apply {
                    put("audioBase64", Base64.encodeToString(wavBytes, Base64.NO_WRAP))
                    put("mimeType", "audio/wav")
                    put("language", language)
                    put("characterGender", characterGender)
                    put("personalityName", personalityName)
                    put("fastMode", true)
                }
                conn.outputStream.use { os ->
                    os.write(payload.toString().toByteArray(Charsets.UTF_8))
                    os.flush()
                }
                val code = conn.responseCode
                if (code !in 200..299) {
                    if (attempt == 0) continue
                    markCloudVoiceAudioResult(false)
                    return BgVoiceCommandResult(networkOk = false, silentAudio = true)
                }
                val body = conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                val json = JSONObject(body)
                markCloudVoiceAudioResult(true)
                return BgVoiceCommandResult(
                    networkOk = true,
                    silentAudio = json.optBoolean("silentAudio", false),
                    transcript = json.optString("transcript", "").trim(),
                    reply = json.optString("urduSpeechText", "").ifBlank { json.optString("reply", "") }.trim(),
                    action = json.optString("action", "NONE").trim(),
                    actionPayloadJson = json.optJSONObject("actionPayload")?.toString() ?: "{}"
                )
            } catch (_: Exception) {
                if (attempt == 1) {
                    markCloudVoiceAudioResult(false)
                }
            } finally {
                try { conn?.disconnect() } catch (_: Exception) {}
            }
        }
        return BgVoiceCommandResult(networkOk = false, silentAudio = true)
    }

    fun queryBackgroundTextChatOnline(
        context: Context,
        message: String,
        language: String = "ur",
        characterGender: String = "female",
        personalityName: String = "Wasi ki Jan"
    ): BgVoiceCommandResult {
        if (!hasDeviceInternet(context) || message.isBlank()) {
            return BgVoiceCommandResult(networkOk = false, silentAudio = false, transcript = message)
        }
        var conn: HttpURLConnection? = null
        return try {
            val base = getCloudApiBase(context)
            val url = URL("$base/api/jarvis/chat")
            conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 6500
                readTimeout = 12000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
            val payload = JSONObject().apply {
                put("message", message)
                put("language", language)
                put("characterGender", characterGender)
                put("personalityName", personalityName)
                put("fastMode", true)
            }
            conn.outputStream.use { os ->
                os.write(payload.toString().toByteArray(Charsets.UTF_8))
                os.flush()
            }
            val code = conn.responseCode
            if (code !in 200..299) {
                return BgVoiceCommandResult(networkOk = false, silentAudio = false, transcript = message)
            }
            val body = conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            val json = JSONObject(body)
            BgVoiceCommandResult(
                networkOk = true,
                silentAudio = false,
                transcript = message,
                reply = json.optString("urduSpeechText", "").ifBlank { json.optString("reply", "") }.trim(),
                action = json.optString("action", "NONE").trim(),
                actionPayloadJson = json.optJSONObject("actionPayload")?.toString() ?: "{}"
            )
        } catch (_: Exception) {
            BgVoiceCommandResult(networkOk = false, silentAudio = false, transcript = message)
        } finally {
            try { conn?.disconnect() } catch (_: Exception) {}
        }
    }
}

/**
 * Zero-Buzzer Silent Voice Activity Detector + Pre-Roll Audio Capture.
 * Supports two callbacks:
 *  - onSpeechOnset: fires as soon as human speech begins (~180ms) when cloud wake is offline
 *    so Android SpeechRecognizer can open immediately while the user is still speaking.
 *  - onSpeechCaptured: captures full pre-roll + speech WAV when cloud wake-check is healthy.
 */
class SilentWakeVad(
    private val context: Context,
    private val onSpeechOnset: (() -> Unit)? = null,
    private val onSpeechCaptured: (wavBytes: ByteArray) -> Unit
) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val running = AtomicBoolean(false)
    @Volatile
    private var workerThread: Thread? = null
    @Volatile
    private var audioRecord: AudioRecord? = null
    @Volatile
    private var loopDoneLatch: CountDownLatch? = null

    fun isRunning(): Boolean = running.get()

    fun start() {
        if (running.get() || MicHardwareCoordinator.isCommandSessionActive) return
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            return
        }
        MicHardwareCoordinator.registerVad(this)
        running.set(true)
        val latch = CountDownLatch(1)
        loopDoneLatch = latch
        workerThread = Thread({
            Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND)
            try {
                monitorLoop()
            } finally {
                latch.countDown()
                MicHardwareCoordinator.unregisterVad(this)
            }
        }, "WasuJarvisSilentVad").apply {
            isDaemon = true
            start()
        }
    }

    fun stopAndAwaitRelease(timeoutMs: Long = 450L) {
        running.set(false)
        val t = workerThread
        try {
            audioRecord?.stop()
        } catch (_: Exception) {}
        try {
            audioRecord?.release()
        } catch (_: Exception) {}
        audioRecord = null
        try {
            loopDoneLatch?.await(timeoutMs, TimeUnit.MILLISECONDS)
        } catch (_: Exception) {}
        try {
            if (t != null && t !== Thread.currentThread() && t.isAlive) {
                t.join(120L)
            }
        } catch (_: Exception) {}
        workerThread = null
    }

    fun stop() {
        running.set(false)
        try {
            audioRecord?.stop()
        } catch (_: Exception) {}
        try {
            audioRecord?.release()
        } catch (_: Exception) {}
        audioRecord = null
        workerThread = null
    }

    private fun openAudioRecordSafe(sampleRate: Int, bufSize: Int): AudioRecord? {
        val sources = listOf(MediaRecorder.AudioSource.VOICE_RECOGNITION, MediaRecorder.AudioSource.MIC)
        for (src in sources) {
            try {
                val rec = AudioRecord(
                    src,
                    sampleRate,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    bufSize
                )
                if (rec.state == AudioRecord.STATE_INITIALIZED) {
                    return rec
                }
                rec.release()
            } catch (_: SecurityException) {
                return null
            } catch (_: Exception) {
            }
        }
        return null
    }

    private fun monitorLoop() {
        val sampleRate = 16000
        val minBuf = AudioRecord.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        if (minBuf <= 0) {
            running.set(false)
            return
        }
        val bufSize = max(minBuf, 4096)

        val rec = openAudioRecordSafe(sampleRate, bufSize)
        if (rec == null) {
            running.set(false)
            return
        }

        audioRecord = rec
        val frameSize = 1024 // 64ms at 16kHz
        val samples = ShortArray(frameSize)
        val preRollMax = 12 * frameSize // ~768ms pre-roll ring buffer
        val preRoll = ShortArray(preRollMax)
        var preRollWritePos = 0
        var preRollFilled = 0

        var noiseFloor = 135.0
        var warmupFrames = 0
        var consecutiveVoiceFrames = 0

        var capturingPostRoll = false
        val postBuffer = ShortArray(22 * frameSize)
        var postSamples = 0
        var quietTailFrames = 0

        try {
            rec.startRecording()
            while (running.get() && !MicHardwareCoordinator.isCommandSessionActive) {
                val read = rec.read(samples, 0, samples.size)
                if (read <= 0) {
                    Thread.sleep(30)
                    continue
                }

                if (WakeSpeechSuppressor.isSuppressed(context)) {
                    consecutiveVoiceFrames = 0
                    capturingPostRoll = false
                    postSamples = 0
                    continue
                }

                var sumSq = 0.0
                var maxAbs = 0
                var zcr = 0
                for (i in 0 until read) {
                    val s = samples[i].toInt()
                    val a = abs(s)
                    if (a > maxAbs) maxAbs = a
                    sumSq += s.toDouble() * s.toDouble()
                    if (i > 0 && ((samples[i - 1] >= 0 && samples[i] < 0) || (samples[i - 1] < 0 && samples[i] >= 0))) {
                        zcr++
                    }
                }
                val rms = sqrt(sumSq / read)
                val isHumanSpeechBand = zcr in 3..320 && maxAbs > 310

                if (!capturingPostRoll) {
                    for (i in 0 until read) {
                        preRoll[preRollWritePos] = samples[i]
                        preRollWritePos = (preRollWritePos + 1) % preRollMax
                        if (preRollFilled < preRollMax) preRollFilled++
                    }

                    if (warmupFrames < 8) {
                        warmupFrames++
                        noiseFloor = (noiseFloor * 0.72 + rms * 0.28).coerceIn(65.0, 1800.0)
                        continue
                    }

                    val speechThreshold = max(165.0, noiseFloor * 1.42)
                    if (rms > speechThreshold && isHumanSpeechBand) {
                        consecutiveVoiceFrames++
                        if (consecutiveVoiceFrames >= 2) {
                            // Fast onset handoff when cloud is offline or unavailable so SpeechRecognizer catches "Jarvis" immediately
                            if (onSpeechOnset != null && (WakeAudioUtils.isCloudRecentlyUnavailable() || !WakeAudioUtils.hasDeviceInternet(context))) {
                                running.set(false)
                                try { rec.stop() } catch (_: Exception) {}
                                try { rec.release() } catch (_: Exception) {}
                                audioRecord = null
                                mainHandler.post { onSpeechOnset.invoke() }
                                return
                            }
                            capturingPostRoll = true
                            postSamples = 0
                            quietTailFrames = 0
                        }
                    } else {
                        consecutiveVoiceFrames = 0
                        noiseFloor = (noiseFloor * 0.94 + rms * 0.06).coerceIn(65.0, 1800.0)
                    }
                } else {
                    val toCopy = minOf(read, postBuffer.size - postSamples)
                    if (toCopy > 0) {
                        System.arraycopy(samples, 0, postBuffer, postSamples, toCopy)
                        postSamples += toCopy
                    }

                    val tailThreshold = max(185.0, noiseFloor * 1.25)
                    if (rms < tailThreshold) {
                        quietTailFrames++
                    } else {
                        quietTailFrames = 0
                    }

                    if (postSamples >= 15 * frameSize || (postSamples >= 7 * frameSize && quietTailFrames >= 5)) {
                        val totalSamples = preRollFilled + postSamples
                        val combined = ShortArray(totalSamples)
                        if (preRollFilled > 0) {
                            val startPos = if (preRollFilled < preRollMax) 0 else preRollWritePos
                            val firstChunk = minOf(preRollFilled, preRollMax - startPos)
                            System.arraycopy(preRoll, startPos, combined, 0, firstChunk)
                            if (firstChunk < preRollFilled) {
                                System.arraycopy(preRoll, 0, combined, firstChunk, preRollFilled - firstChunk)
                            }
                        }
                        if (postSamples > 0) {
                            System.arraycopy(postBuffer, 0, combined, preRollFilled, postSamples)
                        }
                        val wav = WakeAudioUtils.pcm16ToWavBytes(combined, totalSamples, sampleRate)
                        running.set(false)
                        try { rec.stop() } catch (_: Exception) {}
                        try { rec.release() } catch (_: Exception) {}
                        audioRecord = null
                        mainHandler.post { onSpeechCaptured(wav) }
                        return
                    }
                }
            }
        } catch (_: Exception) {
        } finally {
            running.set(false)
            try { rec.stop() } catch (_: Exception) {}
            try { rec.release() } catch (_: Exception) {}
            if (audioRecord === rec) audioRecord = null
        }
    }
}

/**
 * Silent AudioRecord Command Recorder with hardware retry, live RMS levels,
 * and minimum 2.2s capture protection so it never snaps off prematurely.
 */
class SilentCommandRecorder(
    private val context: Context,
    private val onReady: () -> Unit,
    private val onRmsLevel: (Float) -> Unit,
    private val onFinished: (wavBytes: ByteArray?) -> Unit
) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val recording = AtomicBoolean(false)
    @Volatile
    private var audioRecord: AudioRecord? = null
    @Volatile
    private var workerThread: Thread? = null

    fun isRecording(): Boolean = recording.get()

    fun start() {
        if (recording.get()) return
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            mainHandler.post { onFinished(null) }
            return
        }
        recording.set(true)
        workerThread = Thread({
            Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO)
            recordLoop()
        }, "WasuJarvisCmdAudio").apply {
            isDaemon = true
            start()
        }
    }

    fun stopAndEmit() {
        recording.set(false)
    }

    fun cancel() {
        recording.set(false)
        try { audioRecord?.stop() } catch (_: Exception) {}
        try { audioRecord?.release() } catch (_: Exception) {}
        audioRecord = null
    }

    private fun openWithRetry(sampleRate: Int, bufSize: Int): AudioRecord? {
        val sources = listOf(MediaRecorder.AudioSource.VOICE_RECOGNITION, MediaRecorder.AudioSource.MIC)
        for (attempt in 0 until 3) {
            if (!recording.get()) return null
            for (src in sources) {
                try {
                    val rec = AudioRecord(
                        src,
                        sampleRate,
                        AudioFormat.CHANNEL_IN_MONO,
                        AudioFormat.ENCODING_PCM_16BIT,
                        bufSize
                    )
                    if (rec.state == AudioRecord.STATE_INITIALIZED) {
                        return rec
                    }
                    rec.release()
                } catch (_: Exception) {}
            }
            try { Thread.sleep(140L) } catch (_: Exception) {}
        }
        return null
    }

    private fun recordLoop() {
        val sampleRate = 16000
        val minBuf = AudioRecord.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        val bufSize = max(minBuf, 4096)
        val rec = openWithRetry(sampleRate, bufSize)
        if (rec == null) {
            recording.set(false)
            mainHandler.post { onFinished(null) }
            return
        }

        audioRecord = rec
        val frame = ShortArray(1024)
        val maxSamples = sampleRate * 12 // 12 seconds max
        val collected = ShortArray(maxSamples)
        var totalSamples = 0
        var heardSpeech = false
        var silenceMs = 0L
        val startedAt = System.currentTimeMillis()
        var lastTick = startedAt

        try {
            rec.startRecording()
            mainHandler.post { onReady() }
            while (recording.get() && totalSamples < maxSamples) {
                val read = rec.read(frame, 0, frame.size)
                if (read <= 0) {
                    Thread.sleep(30)
                    continue
                }
                val copyCount = minOf(read, maxSamples - totalSamples)
                System.arraycopy(frame, 0, collected, totalSamples, copyCount)
                totalSamples += copyCount

                var sumSq = 0.0
                for (i in 0 until read) {
                    val v = frame[i].toDouble()
                    sumSq += v * v
                }
                val rms = sqrt(sumSq / read)
                val norm = ((rms - 70.0) / 1800.0).toFloat().coerceIn(0f, 1f)
                mainHandler.post { onRmsLevel(norm) }

                val now = System.currentTimeMillis()
                val dt = now - lastTick
                lastTick = now

                if (rms > 165.0) {
                    heardSpeech = true
                    silenceMs = 0L
                } else {
                    silenceMs += dt
                }

                // Snappy 900ms post-speech cutoff after minimum 1.05s capture
                if (heardSpeech && silenceMs > 900L && (now - startedAt) > 1050L) {
                    break
                }
                if (!heardSpeech && (now - startedAt) > 6500L) {
                    break
                }
            }
        } catch (_: Exception) {
        } finally {
            recording.set(false)
            try { rec.stop() } catch (_: Exception) {}
            try { rec.release() } catch (_: Exception) {}
            if (audioRecord === rec) audioRecord = null
        }

        val wav = if (totalSamples >= 3200) {
            WakeAudioUtils.pcm16ToWavBytes(collected, totalSamples, sampleRate)
        } else {
            null
        }
        mainHandler.post { onFinished(wav) }
    }
}
