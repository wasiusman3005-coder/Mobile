package com.qnexus.jarvis

import android.app.Notification
import android.app.RemoteInput
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.speech.tts.TextToSpeech
import com.getcapacitor.JSObject
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

class QNexusNotificationService : NotificationListenerService() {

    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var lastSpokenKey = ""
    private var lastSpokenTime = 0L

    companion object {
        val recentNotifications = CopyOnWriteArrayList<JSObject>()
        private val replyActions = ConcurrentHashMap<String, Notification.Action>()

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
                true
            } catch (e: Exception) {
                false
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        initBackgroundTts()
    }

    private fun initBackgroundTts() {
        if (tts != null) return
        try {
            tts = TextToSpeech(applicationContext) { status ->
                if (status == TextToSpeech.SUCCESS) {
                    val urResult = tts?.setLanguage(Locale("ur", "PK"))
                    if (urResult == TextToSpeech.LANG_MISSING_DATA || urResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                        tts?.setLanguage(Locale.US)
                    }
                    ttsReady = true
                }
            }
        } catch (_: Exception) {
            ttsReady = false
        }
    }

    private fun speakNotificationInBackground(appName: String, title: String, text: String, key: String) {
        val prefs = getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
        val autoAnnounce = prefs.getBoolean("bg_auto_announce", true)
        if (!autoAnnounce) return

        // If main UI is active & subscribed, JS layer already handles multilingual TTS cleanly
        if (QNexusPlugin.instance != null) return

        val now = System.currentTimeMillis()
        if (key == lastSpokenKey && now - lastSpokenTime < 8000L) return
        if (now - lastSpokenTime < 2200L) return

        lastSpokenKey = key
        lastSpokenTime = now

        if (tts == null) initBackgroundTts()
        if (!ttsReady) return

        val cleanText = text.take(120)
        val announcement = "$appName alert from $title: $cleanText"
        try {
            tts?.speak(announcement, TextToSpeech.QUEUE_ADD, null, "bg_notif_${now}")
        } catch (_: Exception) {
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        try {
            if (sbn == null) return
            if (sbn.packageName == packageName) return

            val extras = sbn.notification?.extras ?: return
            val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
            val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
                ?: extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
                ?: ""
            if (title.isEmpty() && text.isEmpty()) return

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

            val appName = when {
                sbn.packageName.contains("whatsapp") -> "WhatsApp"
                sbn.packageName.contains("orca") || sbn.packageName.contains("facebook.katana") -> "Messenger"
                sbn.packageName.contains("instagram") -> "Instagram"
                sbn.packageName.contains("telegram") -> "Telegram"
                sbn.packageName.contains("gm") -> "Gmail"
                sbn.packageName.contains("dialer") || sbn.packageName.contains("telecom") -> "Phone Call"
                sbn.packageName.contains("messaging") -> "SMS"
                else -> sbn.packageName.substringAfterLast('.')
            }

            val obj = JSObject()
            obj.put("key", sbn.key)
            obj.put("packageName", sbn.packageName)
            obj.put("appName", appName)
            obj.put("title", title)
            obj.put("text", text)
            obj.put("timestamp", sbn.postTime)
            obj.put("canReply", canReply)
            obj.put("isCallNotification", appName == "Phone Call")

            recentNotifications.removeAll { it.getString("key") == sbn.key }
            recentNotifications.add(0, obj)
            if (recentNotifications.size > 40) {
                recentNotifications.removeAt(recentNotifications.size - 1)
            }

            QNexusPlugin.instance?.emitNotificationEvent(obj)
            speakNotificationInBackground(appName, title, text, sbn.key)
        } catch (_: Exception) {
        }
    }

    override fun onDestroy() {
        try {
            tts?.stop()
            tts?.shutdown()
        } catch (_: Exception) {}
        tts = null
        ttsReady = false
        super.onDestroy()
    }
}
