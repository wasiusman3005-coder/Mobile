package com.qnexus.jarvis

import android.app.Notification
import android.app.RemoteInput
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.getcapacitor.JSObject
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

class QNexusNotificationService : NotificationListenerService() {

    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var lastSpokenKey = ""
    private var lastSpokenText = ""
    private var lastSpokenTime = 0L
    private val pendingAnnouncements = CopyOnWriteArrayList<String>()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var audioFocusReq: AudioFocusRequest? = null

    companion object {
        val recentNotifications = CopyOnWriteArrayList<JSObject>()
        private val replyActions = ConcurrentHashMap<String, Notification.Action>()
        private const val PREFS_NAME = "WasuJarvisPrefs"
        private const val KEY_CACHED_NOTIFS = "cached_notifs_json"
        private val pendingVipReminders = ConcurrentHashMap<String, VipReminderEntry>()

        fun clearVipReminders() {
            pendingVipReminders.clear()
        }

        fun loadPersistedIfEmpty(context: Context) {
            if (recentNotifications.isNotEmpty()) return
            try {
                val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .getString(KEY_CACHED_NOTIFS, null) ?: return
                val arr = JSONArray(raw)
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    val js = JSObject()
                    js.put("key", o.optString("key"))
                    js.put("packageName", o.optString("packageName"))
                    js.put("appName", o.optString("appName"))
                    js.put("title", o.optString("title"))
                    js.put("text", o.optString("text"))
                    js.put("timestamp", o.optLong("timestamp"))
                    js.put("canReply", o.optBoolean("canReply"))
                    js.put("isCallNotification", o.optBoolean("isCallNotification"))
                    recentNotifications.add(js)
                }
            } catch (_: Exception) {
            }
        }

        private fun persistNotifications(context: Context) {
            try {
                val arr = JSONArray()
                val snapshot = recentNotifications.take(25)
                for (item in snapshot) {
                    val o = JSONObject()
                    o.put("key", item.getString("key") ?: "")
                    o.put("packageName", item.getString("packageName") ?: "")
                    o.put("appName", item.getString("appName") ?: "")
                    o.put("title", item.getString("title") ?: "")
                    o.put("text", item.getString("text") ?: "")
                    o.put("timestamp", item.optLong("timestamp", System.currentTimeMillis()))
                    o.put("canReply", item.optBoolean("canReply", false))
                    o.put("isCallNotification", item.optBoolean("isCallNotification", false))
                    arr.put(o)
                }
                context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putString(KEY_CACHED_NOTIFS, arr.toString())
                    .apply()
            } catch (_: Exception) {
            }
        }

        fun sendDirectReply(context: Context, key: String, replyText: String): Boolean {
            val action = replyActions[key] ?: return false
            val remoteInputs = action.remoteInputs ?: return false
            if (remoteInputs.isEmpty()) return false

            val intent = Intent()
            val bundle = Bundle()
            for (ri: RemoteInput in remoteInputs) {
                bundle.putCharSequence(ri.resultKey, replyText)
            }
            RemoteInput.addResultsToIntent(remoteInputs, intent, bundle)
            return try {
                action.actionIntent.send(context, 0, intent)
                pendingVipReminders.remove(key)
                true
            } catch (e: Exception) {
                false
            }
        }

        fun findReplyKeyByTarget(target: String, appFilter: String = "whatsapp"): Pair<String, String>? {
            val q = target.trim().lowercase(Locale.US)
            if (q.isEmpty()) return null
            for (item in recentNotifications) {
                val canReply = item.optBoolean("canReply", false)
                if (!canReply) continue
                val key = item.getString("key") ?: continue
                if (!replyActions.containsKey(key)) continue
                val app = (item.getString("appName") ?: "").lowercase(Locale.US)
                val pkg = (item.getString("packageName") ?: "").lowercase(Locale.US)
                val title = (item.getString("title") ?: "")
                val titleLower = title.lowercase(Locale.US)
                val matchesApp = appFilter.isEmpty() || app.contains(appFilter) || pkg.contains(appFilter)
                if (matchesApp && titleLower.contains(q)) {
                    return Pair(key, title)
                }
            }
            return null
        }
    }

    private val vipRepeatRunnable = object : Runnable {
        override fun run() {
            try {
                val now = System.currentTimeMillis()
                for ((key, entry) in pendingVipReminders.entries) {
                    if (now - entry.lastRemindedAt >= entry.repeatMinutes * 60_000L) {
                        entry.lastRemindedAt = now
                        val msg = "VIP reminder: ${entry.sender} ka message abhi tak unread hai — ${entry.text.take(60)}"
                        pushDynamicBarNotification(entry.sender, entry.text, true)
                        if (QNexusPlugin.instance?.isForegroundActive != true) {
                            speakRaw(msg, false)
                        } else {
                            QNexusPlugin.instance?.emitVipReminderEvent(entry.sender, entry.text)
                        }
                    }
                }
            } catch (_: Exception) {}
            mainHandler.postDelayed(this, 60_000L)
        }
    }

    override fun onCreate() {
        super.onCreate()
        loadPersistedIfEmpty(applicationContext)
        initBackgroundTts()
        mainHandler.postDelayed(vipRepeatRunnable, 60_000L)
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        loadPersistedIfEmpty(applicationContext)
        try {
            val active = activeNotifications ?: return
            for (sbn in active) {
                ingestStatusBarNotification(sbn, speakAloud = false)
            }
        } catch (_: Exception) {
        }
    }

    private fun initBackgroundTts() {
        if (tts != null) return
        try {
            tts = TextToSpeech(applicationContext) { status ->
                if (status == TextToSpeech.SUCCESS) {
                    try {
                        tts?.setAudioAttributes(
                            AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                .build()
                        )
                    } catch (_: Exception) {}
                    var langCode = tts?.setLanguage(Locale("ur", "PK"))
                    if (langCode == TextToSpeech.LANG_MISSING_DATA || langCode == TextToSpeech.LANG_NOT_SUPPORTED) {
                        langCode = tts?.setLanguage(Locale("hi", "IN"))
                    }
                    if (langCode == TextToSpeech.LANG_MISSING_DATA || langCode == TextToSpeech.LANG_NOT_SUPPORTED) {
                        tts?.setLanguage(Locale.US)
                    }
                    tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                        override fun onStart(utteranceId: String?) {}
                        override fun onDone(utteranceId: String?) {
                            abandonBgAudioFocus()
                        }
                        @Deprecated("Deprecated in Java")
                        override fun onError(utteranceId: String?) {
                            abandonBgAudioFocus()
                        }
                    })
                    ttsReady = true
                    val queued = pendingAnnouncements.toList()
                    pendingAnnouncements.clear()
                    queued.forEachIndexed { idx, msg ->
                        speakRaw(msg, idx == 0)
                    }
                }
            }
        } catch (_: Exception) {
            ttsReady = false
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
                audioFocusReq = req
                am.requestAudioFocus(req)
            }
        } catch (_: Exception) {}
    }

    private fun abandonBgAudioFocus() {
        try {
            val am = getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioFocusReq?.let { am.abandonAudioFocusRequest(it) }
            }
        } catch (_: Exception) {}
    }

    private fun speakRaw(announcement: String, flush: Boolean) {
        mainHandler.post {
            try {
                requestBgAudioFocus()
                tts?.speak(
                    announcement,
                    if (flush) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD,
                    null,
                    "bg_notif_${System.currentTimeMillis()}"
                )
            } catch (_: Exception) {}
        }
    }

    private fun pushDynamicBarNotification(title: String, text: String, isVip: Boolean) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !android.provider.Settings.canDrawOverlays(this)) return
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            if (!prefs.getBoolean("dynamic_bar_outside_app", true)) return
            val i = Intent(this, OneUiOverlayService::class.java).apply {
                action = OneUiOverlayService.ACTION_SHOW_NOTIFICATION
                putExtra("title", title)
                putExtra("text", text)
                putExtra("isVip", isVip)
            }
            startService(i)
        } catch (_: Exception) {}
    }

    private fun checkVipMatch(title: String, text: String): Pair<Boolean, Int> {
        return try {
            val raw = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getString("vip_contacts_json", "[]") ?: "[]"
            val arr = JSONArray(raw)
            val hay = "$title $text".lowercase(Locale.US)
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val name = o.optString("name", "").trim().lowercase(Locale.US)
                val phone = o.optString("phoneOrHandle", "").trim().lowercase(Locale.US)
                if ((name.isNotEmpty() && hay.contains(name)) || (phone.isNotEmpty() && hay.contains(phone))) {
                    return Pair(true, o.optInt("repeatMinutes", 2).coerceIn(1, 30))
                }
            }
            Pair(false, 0)
        } catch (_: Exception) {
            Pair(false, 0)
        }
    }

    private fun checkAppRuleAllowsSpeak(pkg: String, appName: String, isVip: Boolean, activityState: String): Boolean {
        return try {
            val raw = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getString("per_app_rules_json", "[]") ?: "[]"
            val arr = JSONArray(raw)
            val pkgLow = pkg.lowercase(Locale.US)
            val appLow = appName.lowercase(Locale.US)
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val rulePkg = o.optString("packageName", "").lowercase(Locale.US)
                val ruleName = o.optString("appName", "").lowercase(Locale.US)
                if ((rulePkg.isNotEmpty() && pkgLow.contains(rulePkg)) || (ruleName.isNotEmpty() && appLow.contains(ruleName))) {
                    val enabled = o.optBoolean("enabled", true)
                    val speak = o.optBoolean("speakAloud", true)
                    val allowSleep = o.optBoolean("allowInSleepOrQuiet", true)
                    if (!enabled) return false
                    if (activityState == UserActivityMonitor.STATE_LYING_SLEEPING && !allowSleep && !isVip) return false
                    return speak || isVip
                }
            }
            if (activityState == UserActivityMonitor.STATE_LYING_SLEEPING && !isVip) return false
            true
        } catch (_: Exception) {
            true
        }
    }

    private fun speakNotificationInBackground(pkg: String, appName: String, title: String, text: String, key: String) {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val autoAnnounce = prefs.getBoolean("bg_auto_announce", true)
        val vipMatch = checkVipMatch(title, text)
        val isVip = vipMatch.first
        val activityState = UserActivityMonitor.getLastKnownState(applicationContext)

        if (isVip) {
            pendingVipReminders[key] = VipReminderEntry(
                key = key,
                sender = title.ifBlank { appName },
                text = text,
                repeatMinutes = vipMatch.second,
                lastRemindedAt = System.currentTimeMillis()
            )
        }

        pushDynamicBarNotification(if (isVip) "VIP • ${title.ifBlank { appName }}" else title.ifBlank { appName }, text, isVip)

        if (!autoAnnounce && !isVip) return
        if (!checkAppRuleAllowsSpeak(pkg, appName, isVip, activityState)) return

        // Only defer to JS TTS when the Activity WebView is actively in the foreground!
        if (QNexusPlugin.instance?.isForegroundActive == true) return

        val now = System.currentTimeMillis()
        if (key == lastSpokenKey && text == lastSpokenText && now - lastSpokenTime < 7000L) return
        if (now - lastSpokenTime < 1500L && text == lastSpokenText) return

        lastSpokenKey = key
        lastSpokenText = text
        lastSpokenTime = now

        val cleanText = text.take(140)
        val cleanTitle = title.ifBlank { appName }
        val prefix = when {
            isVip -> "Zaroori VIP alert! "
            activityState == UserActivityMonitor.STATE_RIDING_BIKE -> "Bike alert! "
            else -> ""
        }
        val announcement = "$prefix$appName par $cleanTitle ka message: $cleanText"

        if (!ttsReady) {
            if (pendingAnnouncements.size < 4) {
                pendingAnnouncements.add(announcement)
            }
            initBackgroundTts()
            return
        }
        speakRaw(announcement, isVip)
    }

    private fun extractMessageText(extras: Bundle): String {
        val directText = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim().orEmpty()
        val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()?.trim().orEmpty()

        // Android 14/15 WhatsApp MessagingStyle stores messages inside EXTRA_MESSAGES Parcelable array
        var msgStyleText = ""
        try {
            @Suppress("DEPRECATION")
            val msgs = extras.getParcelableArray(Notification.EXTRA_MESSAGES)
            if (msgs != null && msgs.isNotEmpty()) {
                val lastBundle = msgs[msgs.size - 1] as? Bundle
                val body = lastBundle?.getCharSequence("text")?.toString()?.trim().orEmpty()
                val sender = lastBundle?.getCharSequence("sender")?.toString()?.trim().orEmpty()
                if (body.isNotEmpty()) {
                    msgStyleText = if (sender.isNotEmpty() && !directText.contains(sender)) "$sender: $body" else body
                }
            }
        } catch (_: Exception) {}

        var linesText = ""
        try {
            val lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
            if (lines != null && lines.isNotEmpty()) {
                linesText = lines[lines.size - 1]?.toString()?.trim().orEmpty()
            }
        } catch (_: Exception) {}

        return when {
            msgStyleText.isNotEmpty() -> msgStyleText
            bigText.isNotEmpty() -> bigText
            directText.isNotEmpty() -> directText
            linesText.isNotEmpty() -> linesText
            else -> ""
        }
    }

    private fun ingestStatusBarNotification(sbn: StatusBarNotification?, speakAloud: Boolean) {
        try {
            if (sbn == null) return
            if (sbn.packageName == packageName) return
            // Skip Android foreground service ongoing banners except call notifications
            val isOngoing = (sbn.notification.flags and Notification.FLAG_ONGOING_EVENT) != 0
            val isCallPkg = sbn.packageName.contains("dialer") || sbn.packageName.contains("telecom") || sbn.packageName.contains("incallui")
            if (isOngoing && !isCallPkg && !sbn.packageName.contains("whatsapp")) return

            val extras = sbn.notification?.extras ?: return
            val title = extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE)?.toString()?.trim()
                ?.takeIf { it.isNotEmpty() }
                ?: extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim()
                ?: ""
            val text = extractMessageText(extras)
            if (title.isEmpty() && text.isEmpty()) return

            // Skip generic WhatsApp summary banners like "3 messages from 2 chats" when real messages are posted individually
            val isGroupSummary = (sbn.notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0
            if (isGroupSummary && text.matches(Regex("^\\d+\\s+(new\\s+)?messages?.*", RegexOption.IGNORE_CASE))) {
                return
            }

            var canReply = false
            val actions = sbn.notification.actions
            if (actions != null) {
                for (act in actions) {
                    if (act.remoteInputs != null && act.remoteInputs.isNotEmpty()) {
                        replyActions[sbn.key] = act
                        canReply = true
                        break
                    }
                }
            }

            val pkg = sbn.packageName.lowercase(Locale.US)
            val appName = when {
                pkg.contains("whatsapp") -> "WhatsApp"
                pkg.contains("orca") || pkg.contains("facebook.katana") -> "Messenger"
                pkg.contains("instagram") -> "Instagram"
                pkg.contains("telegram") -> "Telegram"
                pkg.contains("gm") || pkg.contains("mail") -> "Gmail"
                isCallPkg -> "Phone Call"
                pkg.contains("messaging") || pkg.contains("mms") -> "SMS"
                else -> sbn.packageName.substringAfterLast('.')
            }

            val obj = JSObject()
            obj.put("key", sbn.key)
            obj.put("packageName", sbn.packageName)
            obj.put("appName", appName)
            obj.put("title", title.ifEmpty { appName })
            obj.put("text", text.ifEmpty { title })
            obj.put("timestamp", sbn.postTime)
            obj.put("canReply", canReply)
            obj.put("isCallNotification", appName == "Phone Call")

            recentNotifications.removeAll { it.getString("key") == sbn.key && it.getString("text") == text }
            recentNotifications.add(0, obj)
            while (recentNotifications.size > 40) {
                recentNotifications.removeAt(recentNotifications.size - 1)
            }
            persistNotifications(applicationContext)

            QNexusPlugin.instance?.emitNotificationEvent(obj)
            if (speakAloud) {
                speakNotificationInBackground(sbn.packageName, appName, title, text.ifEmpty { title }, sbn.key)
            }
        } catch (_: Exception) {
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        super.onNotificationRemoved(sbn)
        if (sbn != null) {
            pendingVipReminders.remove(sbn.key)
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        ingestStatusBarNotification(sbn, speakAloud = true)
    }

    override fun onDestroy() {
        mainHandler.removeCallbacksAndMessages(null)
        try {
            abandonBgAudioFocus()
            tts?.stop()
            tts?.shutdown()
        } catch (_: Exception) {}
        tts = null
        ttsReady = false
        super.onDestroy()
    }
}

data class VipReminderEntry(
    val key: String,
    val sender: String,
    val text: String,
    val repeatMinutes: Int,
    var lastRemindedAt: Long
)
