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
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.provider.CallLog
import android.provider.Settings
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
    }

    override fun load() {
        super.load()
        instance = this
    }

    fun emitWakeEvent(phrase: String) {
        val data = JSObject()
        data.put("phrase", phrase)
        notifyListeners("wakeWordTriggered", data)
    }

    fun emitNotificationEvent(item: JSObject) {
        notifyListeners("nativeNotificationReceived", item)
    }

    @PluginMethod
    fun getDeviceTelemetry(call: PluginCall) {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val mi = ActivityManager.MemoryInfo()
        am.getMemoryInfo(mi)

        val stat = StatFs(Environment.getDataDirectory().path)
        val totalStorageGb = (stat.totalBytes / (1024.0 * 1024.0 * 1024.0))
        val availStorageGb = (stat.availableBytes / (1024.0 * 1024.0 * 1024.0))

        val batIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = batIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = batIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
        val status = batIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val tempTenths = batIntent?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 300) ?: 300
        val pct = if (level >= 0 && scale > 0) (level * 100 / scale) else 100
        val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL

        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val netCaps = cm.getNetworkCapabilities(cm.activeNetwork)
        val netType = when {
            netCaps == null -> "OFFLINE"
            netCaps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WIFI"
            netCaps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "CELLULAR"
            else -> "ONLINE"
        }

        val res = JSObject()
        res.put("manufacturer", Build.MANUFACTURER)
        res.put("model", Build.MODEL)
        res.put("androidVersion", Build.VERSION.RELEASE)
        res.put("sdkInt", Build.VERSION.SDK_INT)
        res.put("totalRamMb", (mi.totalMem / (1024 * 1024)).toInt())
        res.put("availRamMb", (mi.availMem / (1024 * 1024)).toInt())
        res.put("totalStorageGb", String.format("%.1f", totalStorageGb).toDouble())
        res.put("availStorageGb", String.format("%.1f", availStorageGb).toDouble())
        res.put("batteryPercent", pct)
        res.put("isCharging", isCharging)
        res.put("batteryTempC", tempTenths / 10.0)
        res.put("networkType", netType)
        call.resolve(res)
    }

    @PluginMethod
    fun verifyBiometric(call: PluginCall) {
        val title = call.getString("title") ?: "Wasu's Jarvis Biometric Lock"
        val subtitle = call.getString("subtitle") ?: "Touch Fingerprint sensor or use Face Unlock"
        val executor = ContextCompat.getMainExecutor(context)

        activity.runOnUiThread {
            val bm = BiometricManager.from(context)
            val allowed = BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL
            val canAuth = bm.canAuthenticate(allowed)
            if (canAuth != BiometricManager.BIOMETRIC_SUCCESS) {
                val res = JSObject()
                res.put("ok", false)
                res.put("message", "No Fingerprint/Face lock enrolled in Android phone settings.")
                call.resolve(res)
                return@runOnUiThread
            }

            val prompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    val res = JSObject()
                    res.put("ok", true)
                    res.put("message", "Android Fingerprint / Face ID verified!")
                    call.resolve(res)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    val res = JSObject()
                    res.put("ok", false)
                    res.put("message", errString.toString())
                    call.resolve(res)
                }

                override fun onAuthenticationFailed() {
                    // User can retry until canceled or succeeded
                }
            })

            val info = BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)
                .setAllowedAuthenticators(allowed)
                .build()
            prompt.authenticate(info)
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
        val enabled = call.getBoolean("enabled") ?: true
        context.getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
            .edit()
            .putBoolean("bg_auto_announce", enabled)
            .apply()
        val res = JSObject()
        res.put("ok", true)
        res.put("enabled", enabled)
        call.resolve(res)
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
            try {
                val fallback = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:${context.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(fallback)
                val res = JSObject()
                res.put("ok", true)
                call.resolve(res)
            } catch (_: Exception) {
                val res = JSObject()
                res.put("ok", false)
                call.resolve(res)
            }
        }
    }

    @PluginMethod
    fun getNotifications(call: PluginCall) {
        val enabled = NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
        val arr = JSArray()
        for (item in QNexusNotificationService.recentNotifications) {
            arr.put(item)
        }
        val res = JSObject()
        res.put("listenerEnabled", enabled)
        res.put("notifications", arr)
        call.resolve(res)
    }

    @PluginMethod
    fun replyToNotification(call: PluginCall) {
        val key = call.getString("key") ?: ""
        val replyText = call.getString("replyText") ?: ""
        val ok = QNexusNotificationService.sendDirectReply(context, key, replyText)
        val res = JSObject()
        res.put("ok", ok)
        res.put("message", if (ok) "Reply sent!" else "Reply action unavailable for this notification.")
        call.resolve(res)
    }

    @PluginMethod
    fun getCallLogs(call: PluginCall) {
        val arr = JSArray()
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
        val res = JSObject()
        res.put("calls", arr)
        call.resolve(res)
    }

    @PluginMethod
    fun getSmsMessages(call: PluginCall) {
        val arr = JSArray()
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
        val res = JSObject()
        res.put("messages", arr)
        call.resolve(res)
    }

    @PluginMethod
    fun sendSms(call: PluginCall) {
        val phone = call.getString("phone") ?: ""
        val message = call.getString("message") ?: ""
        if (phone.isEmpty() || message.isEmpty()) {
            call.reject("Phone and message required")
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
        context.getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
            .edit()
            .putBoolean("wake_enabled", enabled)
            .apply()

        val intent = Intent(context, JarvisWakeForegroundService::class.java)
        if (enabled) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        } else {
            context.stopService(intent)
        }
        val res = JSObject()
        res.put("ok", true)
        res.put("active", enabled)
        res.put(
            "message",
            if (enabled) "Always-On Wasu's Jarvis Background Service Started!"
            else "Background Wake Service Stopped."
        )
        call.resolve(res)
    }

    @PluginMethod
    fun openNotificationAccessSettings(call: PluginCall) {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        val res = JSObject()
        res.put("ok", true)
        call.resolve(res)
    }

    @PluginMethod
    fun requestAllPermissions(call: PluginCall) {
        requestAllPerms(call)
    }

    private fun requestAllPerms(call: PluginCall) {
        val permsList = mutableListOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.READ_SMS,
            Manifest.permission.SEND_SMS,
            Manifest.permission.CAMERA,
            Manifest.permission.ACCESS_FINE_LOCATION
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permsList.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        ActivityCompat.requestPermissions(activity, permsList.toTypedArray(), 9001)
        val res = JSObject()
        res.put("ok", true)
        res.put("mic", ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED)
        res.put("phone", ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED)
        res.put("sms", ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED)
        call.resolve(res)
    }
}
