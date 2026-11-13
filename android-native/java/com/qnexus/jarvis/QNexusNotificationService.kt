package com.qnexus.jarvis

import android.app.Notification
import android.app.RemoteInput
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.getcapacitor.JSObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

class QNexusNotificationService : NotificationListenerService() {

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

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
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
    }
}
