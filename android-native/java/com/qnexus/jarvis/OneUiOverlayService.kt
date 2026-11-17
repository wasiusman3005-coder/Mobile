package com.qnexus.jarvis

import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.drawable.GradientDrawable
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import java.io.File
import java.util.Locale
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

/**
 * Native Canvas Colorful Wave Visualizer rendered inside the Floating Dynamic Bar
 * when Jarvis is listening, processing, or speaking outside the app.
 */
class OverlayWaveView(context: Context) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private var rms: Float = 0.15f
    private var phaseTick: Float = 0f
    private var styleId: String = "rainbow_prism"
    private var colorTheme: String = "aurora_cyan"
    private var active: Boolean = false

    fun updateWave(level: Float, style: String, theme: String, isActive: Boolean) {
        rms = level.coerceIn(0.05f, 1f)
        styleId = style
        colorTheme = theme
        active = isActive
        phaseTick += 0.36f
        invalidate()
    }

    private fun themeColors(): IntArray {
        return when (colorTheme) {
            "emerald_mint" -> intArrayOf(Color.parseColor("#10b981"), Color.parseColor("#22d3ee"), Color.parseColor("#a7f3d0"))
            "rainbow_oneui" -> intArrayOf(Color.parseColor("#38bdf8"), Color.parseColor("#a855f7"), Color.parseColor("#f43f5e"))
            "solar_gold" -> intArrayOf(Color.parseColor("#f59e0b"), Color.parseColor("#fb7185"), Color.parseColor("#fde047"))
            "deep_cobalt" -> intArrayOf(Color.parseColor("#2563eb"), Color.parseColor("#00f0ff"), Color.parseColor("#818cf8"))
            "crimson_cyber" -> intArrayOf(Color.parseColor("#f43f5e"), Color.parseColor("#f97316"), Color.parseColor("#c084fc"))
            else -> intArrayOf(Color.parseColor("#00f0ff"), Color.parseColor("#8b5cf6"), Color.parseColor("#ec4899"))
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0f || h <= 0f) return

        val cols = themeColors()
        paint.shader = LinearGradient(0f, 0f, w, 0f, cols, null, Shader.TileMode.CLAMP)

        val bars = 14
        val gap = 4f
        val barW = ((w - gap * (bars - 1)) / bars).coerceAtLeast(3f)
        val centerY = h / 2f
        val ampScale = if (active) (0.28f + rms * 0.72f) else 0.16f

        for (i in 0 until bars) {
            val t = i.toFloat() / bars
            val wave = abs(sin((phaseTick + i * 0.55f).toDouble())).toFloat()
            val envelope = sin((t * Math.PI)).toFloat().coerceAtLeast(0.25f)
            val barH = (h * (0.18f + wave * ampScale * envelope)).coerceIn(4f, h - 2f)
            val x = i * (barW + gap)

            when (styleId) {
                "quantum_rings", "liquid_neon" -> {
                    val r = (barW * 0.52f).coerceAtLeast(3f)
                    val cy = centerY + sin((phaseTick + i * 0.7f).toDouble()).toFloat() * (h * 0.28f * ampScale)
                    canvas.drawCircle(x + barW / 2f, cy, r, paint)
                }
                else -> {
                    val rect = RectF(x, centerY - barH / 2f, x + barW, centerY + barH / 2f)
                    canvas.drawRoundRect(rect, barW / 2f, barW / 2f, paint)
                }
            }
        }
    }
}

/**
 * Always-On Outside-App Floating Dynamic Bar + Call/Notification Controls + Charging Turbo Overlay.
 * Stays alive across app close/recents swipe, lockscreen, and full-screen games.
 */
class OneUiOverlayService : Service() {

    companion object {
        const val ACTION_UPDATE = "com.qnexus.jarvis.ONEUI_OVERLAY_UPDATE"
        const val ACTION_SHOW_CHARGING = "com.qnexus.jarvis.ONEUI_OVERLAY_CHARGING"
        const val ACTION_VOICE_STATE = "com.qnexus.jarvis.ONEUI_OVERLAY_VOICE"
        const val ACTION_SHOW_NOTIFICATION = "com.qnexus.jarvis.ONEUI_OVERLAY_NOTIF"
        const val ACTION_SHOW_INCOMING_CALL = "com.qnexus.jarvis.ONEUI_OVERLAY_CALL"
        const val ACTION_SHOW_UNLOCK_EFFECT = "com.qnexus.jarvis.ONEUI_OVERLAY_UNLOCK"
        const val ACTION_STOP = "com.qnexus.jarvis.ONEUI_OVERLAY_STOP"
        private const val PREFS = "WasuJarvisPrefs"
    }

    private var wm: WindowManager? = null
    private var barView: LinearLayout? = null
    private var titleView: TextView? = null
    private var subView: TextView? = null
    private var waveView: OverlayWaveView? = null
    private var callActionRow: LinearLayout? = null
    private var barParams: WindowManager.LayoutParams? = null
    private var chargingView: FrameLayout? = null

    private val mainHandler = Handler(Looper.getMainLooper())
    private var waveAnimRunning = false
    private var currentMode = "standby" // standby | listening | processing | speaking | notification | call | unlock
    private var currentRms = 0.25f

    private val waveRunnable = object : Runnable {
        override fun run() {
            if (!waveAnimRunning) return
            val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val wStyle = prefs.getString("wave_visualizer_style", "rainbow_prism") ?: "rainbow_prism"
            val wTheme = prefs.getString("wave_color_theme", "aurora_cyan") ?: "aurora_cyan"
            waveView?.updateWave(currentRms, wStyle, wTheme, currentMode == "listening" || currentMode == "speaking")
            mainHandler.postDelayed(this, 65L)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_UPDATE

        if (action == ACTION_STOP) {
            removeBar()
            removeChargingOverlay()
            stopSelf()
            return START_NOT_STICKY
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            stopSelf()
            return START_NOT_STICKY
        }

        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val barStyle = prefs.getString("dynamic_bar_style", "now_bar_pill") ?: "now_bar_pill"
        val showOutside = prefs.getBoolean("dynamic_bar_outside_app", true)
        val chargingEnabled = prefs.getBoolean("charging_overlay_enabled", true)

        if ((barStyle == "hidden" || !showOutside) && action == ACTION_UPDATE) {
            removeBar()
            return START_STICKY
        }

        ensureBarAttached()
        applyBarGeometryAndTheme()

        when (action) {
            ACTION_SHOW_CHARGING -> {
                if (chargingEnabled) {
                    showChargingPulseBanner()
                    showChargingTurboModal()
                }
            }
            ACTION_VOICE_STATE -> {
                val state = intent?.getStringExtra("state") ?: "standby"
                val text = intent?.getStringExtra("text") ?: ""
                val rms = intent?.getFloatExtra("rms", 0.3f) ?: 0.3f
                handleVoiceState(state, text, rms)
            }
            ACTION_SHOW_NOTIFICATION -> {
                val title = intent?.getStringExtra("title") ?: "Notification"
                val text = intent?.getStringExtra("text") ?: ""
                val isVip = intent?.getBooleanExtra("isVip", false) ?: false
                showNotificationBanner(title, text, isVip)
            }
            ACTION_SHOW_INCOMING_CALL -> {
                val caller = intent?.getStringExtra("caller") ?: "Incoming Call"
                showIncomingCallBanner(caller)
            }
            ACTION_SHOW_UNLOCK_EFFECT -> {
                val method = intent?.getStringExtra("method") ?: "Biometric"
                showUnlockEffect(method)
            }
            else -> refreshDefaultPill()
        }
        return START_STICKY
    }

    private fun dp(v: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            v.toFloat(),
            resources.displayMetrics
        ).toInt()
    }

    private fun overlayWindowType(): Int {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }
    }

    private fun resolveGravity(anchor: String): Int {
        return when (anchor) {
            "top-left" -> Gravity.TOP or Gravity.START
            "top-right" -> Gravity.TOP or Gravity.END
            "bottom-center" -> Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            "custom" -> Gravity.TOP or Gravity.START
            else -> Gravity.TOP or Gravity.CENTER_HORIZONTAL
        }
    }

    private fun applyBarGeometryAndTheme() {
        val bar = barView ?: return
        val params = barParams ?: return
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val anchor = prefs.getString("dynamic_bar_anchor", "top-center") ?: "top-center"
        val offsetX = prefs.getInt("dynamic_bar_offset_x", 0)
        val offsetY = prefs.getInt("dynamic_bar_offset_y", 10)
        val accentHex = prefs.getString("oneui_accent_hex", "#00f0ff") ?: "#00f0ff"
        val accentColor = try { Color.parseColor(accentHex) } catch (_: Exception) { Color.parseColor("#00f0ff") }

        params.gravity = resolveGravity(anchor)
        params.x = dp(offsetX)
        params.y = dp(offsetY.coerceAtLeast(4))

        bar.background = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(26).toFloat()
            setColor(Color.argb(236, 6, 12, 28))
            setStroke(dp(1), accentColor)
        }
        try {
            wm?.updateViewLayout(bar, params)
        } catch (_: Exception) {}
    }

    private fun ensureBarAttached() {
        if (barView != null) return
        wm = getSystemService(Context.WINDOW_SERVICE) as? WindowManager ?: return

        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val accentHex = prefs.getString("oneui_accent_hex", "#00f0ff") ?: "#00f0ff"
        val accentColor = try { Color.parseColor(accentHex) } catch (_: Exception) { Color.parseColor("#00f0ff") }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(14), dp(8), dp(14), dp(8))
        }

        val topRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }

        val title = TextView(this).apply {
            text = prefs.getString("dynamic_bar_custom_label", "Wasu's Jarvis")?.ifBlank { "Wasu's Jarvis" } ?: "Wasu's Jarvis"
            setTextColor(accentColor)
            textSize = 11.5f
            setPadding(0, 0, dp(8), 0)
        }

        val sub = TextView(this).apply {
            text = "Say 'Jarvis'"
            setTextColor(Color.parseColor("#e2e8f0"))
            textSize = 10.5f
            maxLines = 1
        }

        val wave = OverlayWaveView(this).apply {
            layoutParams = LinearLayout.LayoutParams(dp(116), dp(22)).apply {
                leftMargin = dp(8)
            }
            visibility = View.GONE
        }

        topRow.addView(title)
        topRow.addView(sub)
        topRow.addView(wave)
        root.addView(topRow)

        val actionsRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, dp(6), 0, 0)
            visibility = View.GONE
        }

        val answerBtn = TextView(this).apply {
            text = "Answer"
            setTextColor(Color.WHITE)
            textSize = 11f
            setPadding(dp(14), dp(5), dp(14), dp(5))
            background = GradientDrawable().apply {
                cornerRadius = dp(16).toFloat()
                setColor(Color.parseColor("#059669"))
            }
            setOnClickListener {
                val i = Intent(this@OneUiOverlayService, JarvisWakeForegroundService::class.java).apply {
                    action = JarvisWakeForegroundService.ACTION_CALL_ANSWER
                }
                startService(i)
                actionsRow.visibility = View.GONE
            }
        }

        val rejectBtn = TextView(this).apply {
            text = "Cut Call"
            setTextColor(Color.WHITE)
            textSize = 11f
            setPadding(dp(14), dp(5), dp(14), dp(5))
            background = GradientDrawable().apply {
                cornerRadius = dp(16).toFloat()
                setColor(Color.parseColor("#e11d48"))
            }
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.leftMargin = dp(10)
            layoutParams = lp
            setOnClickListener {
                val i = Intent(this@OneUiOverlayService, JarvisWakeForegroundService::class.java).apply {
                    action = JarvisWakeForegroundService.ACTION_CALL_REJECT
                }
                startService(i)
                actionsRow.visibility = View.GONE
            }
        }

        actionsRow.addView(answerBtn)
        actionsRow.addView(rejectBtn)
        root.addView(actionsRow)

        val anchor = prefs.getString("dynamic_bar_anchor", "top-center") ?: "top-center"
        val offsetX = prefs.getInt("dynamic_bar_offset_x", 0)
        val offsetY = prefs.getInt("dynamic_bar_offset_y", 10)

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayWindowType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = resolveGravity(anchor)
            x = dp(offsetX)
            y = dp(offsetY.coerceAtLeast(4))
        }

        var downRawX = 0f
        var downRawY = 0f
        var startX = 0
        var startY = 0
        var moved = false

        root.setOnTouchListener { _, ev ->
            when (ev.action) {
                MotionEvent.ACTION_DOWN -> {
                    downRawX = ev.rawX
                    downRawY = ev.rawY
                    startX = params.x
                    startY = params.y
                    moved = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (ev.rawX - downRawX).toInt()
                    val dy = (ev.rawY - downRawY).toInt()
                    if (abs(dx) > 10 || abs(dy) > 10) {
                        moved = true
                        params.gravity = Gravity.TOP or Gravity.START
                        val stepX = if ((resolveGravity(anchor) and Gravity.END) == Gravity.END) -dx else dx
                        params.x = (startX + stepX).coerceIn(0, 900)
                        params.y = (startY + dy).coerceIn(4, 2100)
                        try { wm?.updateViewLayout(root, params) } catch (_: Exception) {}
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (moved) {
                        val density = resources.displayMetrics.density.coerceAtLeast(1f)
                        prefs.edit()
                            .putString("dynamic_bar_anchor", "custom")
                            .putInt("dynamic_bar_offset_x", (params.x / density).toInt())
                            .putInt("dynamic_bar_offset_y", (params.y / density).toInt())
                            .apply()
                    } else {
                        // Clean tap on Dynamic Bar triggers background Jarvis listening immediately
                        val bgListen = Intent(this@OneUiOverlayService, JarvisWakeForegroundService::class.java).apply {
                            action = JarvisWakeForegroundService.ACTION_BG_LISTEN_AND_ACT
                        }
                        try { startService(bgListen) } catch (_: Exception) {}
                    }
                    true
                }
                else -> false
            }
        }

        try {
            wm?.addView(root, params)
            barView = root
            titleView = title
            subView = sub
            waveView = wave
            callActionRow = actionsRow
            barParams = params
        } catch (_: Exception) {}
    }

    private fun startWaveAnim() {
        if (waveAnimRunning) return
        waveAnimRunning = true
        waveView?.visibility = View.VISIBLE
        mainHandler.post(waveRunnable)
    }

    private fun stopWaveAnim() {
        waveAnimRunning = false
        waveView?.visibility = View.GONE
        mainHandler.removeCallbacks(waveRunnable)
    }

    private fun handleVoiceState(state: String, text: String, rms: Float) {
        currentMode = state
        currentRms = rms
        when (state) {
            "listening" -> {
                titleView?.text = "JARVIS LISTENING"
                subView?.text = text.ifBlank { "Sun rahi hoon, bolein aap" }
                callActionRow?.visibility = View.GONE
                startWaveAnim()
            }
            "processing" -> {
                titleView?.text = "PROCESSING"
                subView?.text = text.ifBlank { "Samajh rahi hoon..." }
                currentRms = 0.45f
                startWaveAnim()
            }
            "speaking" -> {
                titleView?.text = "JARVIS"
                subView?.text = text.take(42).ifBlank { "Speaking..." }
                currentRms = 0.65f
                startWaveAnim()
            }
            else -> {
                stopWaveAnim()
                refreshDefaultPill()
            }
        }
    }

    private fun refreshDefaultPill() {
        currentMode = "standby"
        stopWaveAnim()
        callActionRow?.visibility = View.GONE
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val customLabel = prefs.getString("dynamic_bar_custom_label", "")?.trim().orEmpty()
        val style = prefs.getString("dynamic_bar_style", "now_bar_pill") ?: "now_bar_pill"
        val bm = getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        val pct = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1

        titleView?.text = if (customLabel.isNotEmpty()) customLabel else when (style) {
            "cyber_strip" -> "CYBER HUD"
            "liquid_island" -> "ONE UI 9"
            "audio_spectrum" -> "VOICE WAVE"
            else -> "Wasu's Jarvis"
        }
        subView?.text = if (pct in 0..100) "$pct% • Say 'Jarvis'" else "Say 'Jarvis'"
    }

    private fun showNotificationBanner(title: String, text: String, isVip: Boolean) {
        currentMode = "notification"
        titleView?.text = if (isVip) "VIP ALERT" else title.take(18)
        subView?.text = text.take(48).ifBlank { title }
        callActionRow?.visibility = View.GONE
        mainHandler.postDelayed({
            if (currentMode == "notification") refreshDefaultPill()
        }, 7000L)
    }

    private fun showIncomingCallBanner(caller: String) {
        currentMode = "call"
        titleView?.text = "CALL"
        subView?.text = caller.take(28)
        callActionRow?.visibility = View.VISIBLE
        startWaveAnim()
        mainHandler.postDelayed({
            if (currentMode == "call") {
                callActionRow?.visibility = View.GONE
                refreshDefaultPill()
            }
        }, 24000L)
    }

    private fun showUnlockEffect(method: String) {
        currentMode = "unlock"
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val anim = prefs.getString("unlock_bar_anim_style", "aurora_bloom") ?: "aurora_bloom"
        titleView?.text = "$method UNLOCKED"
        subView?.text = anim.replace('_', ' ').uppercase(Locale.US)
        currentRms = 0.85f
        startWaveAnim()
        mainHandler.postDelayed({
            if (currentMode == "unlock") refreshDefaultPill()
        }, 3200L)
    }

    private fun showChargingPulseBanner() {
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val anim = prefs.getString("charging_anim_id", "oneui9_turbo") ?: "oneui9_turbo"
        val bm = getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        val pct = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
        titleView?.text = "TURBO CHARGING"
        subView?.text = "${if (pct in 0..100) "$pct% • " else ""}${anim.uppercase(Locale.US)}"
        mainHandler.postDelayed({
            if (currentMode == "standby") refreshDefaultPill()
        }, 5500L)
    }

    private fun showChargingTurboModal() {
        removeChargingOverlay()
        val windowMgr = wm ?: return
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val accentHex = prefs.getString("oneui_accent_hex", "#00f0ff") ?: "#00f0ff"
        val accentColor = try { Color.parseColor(accentHex) } catch (_: Exception) { Color.parseColor("#00f0ff") }
        val animId = prefs.getString("charging_anim_id", "oneui9_turbo") ?: "oneui9_turbo"
        val bm = getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        val pct = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: 85

        val container = FrameLayout(this).apply {
            setBackgroundColor(Color.argb(190, 2, 6, 18))
            setOnClickListener { removeChargingOverlay() }
        }

        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(26), dp(26), dp(26), dp(24))
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dp(28).toFloat()
                setColor(Color.argb(242, 8, 16, 36))
                setStroke(dp(2), accentColor)
            }
        }

        val customBioFile = File(filesDir, "custom_biometric.png")
        if (customBioFile.exists()) {
            try {
                val bmp: Bitmap? = BitmapFactory.decodeFile(customBioFile.absolutePath)
                if (bmp != null) {
                    val img = ImageView(this).apply {
                        setImageBitmap(bmp)
                        scaleType = ImageView.ScaleType.CENTER_CROP
                        layoutParams = LinearLayout.LayoutParams(dp(92), dp(92)).apply {
                            bottomMargin = dp(12)
                        }
                    }
                    card.addView(img)
                }
            } catch (_: Exception) {}
        }

        val pctText = TextView(this).apply {
            text = if (pct in 0..100) "$pct%" else "FAST"
            setTextColor(Color.WHITE)
            textSize = 36f
        }
        val modeText = TextView(this).apply {
            text = "SUPER FAST • ${animId.replace('_', ' ').uppercase(Locale.US)}"
            setTextColor(accentColor)
            textSize = 12f
            setPadding(0, dp(4), 0, dp(6))
        }
        val hintText = TextView(this).apply {
            text = "Tap anywhere to close"
            setTextColor(Color.parseColor("#94a3b8"))
            textSize = 10.5f
        }

        card.addView(pctText)
        card.addView(modeText)
        card.addView(hintText)

        val cardLp = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.CENTER
        )
        container.addView(card, cardLp)

        val overlayParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            overlayWindowType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        )

        try {
            windowMgr.addView(container, overlayParams)
            chargingView = container
            mainHandler.postDelayed({ removeChargingOverlay() }, 5500L)
        } catch (_: Exception) {}
    }

    private fun removeChargingOverlay() {
        chargingView?.let { v ->
            try { wm?.removeView(v) } catch (_: Exception) {}
        }
        chargingView = null
    }

    private fun removeBar() {
        stopWaveAnim()
        barView?.let { v ->
            try { wm?.removeView(v) } catch (_: Exception) {}
        }
        barView = null
        titleView = null
        subView = null
        waveView = null
        callActionRow = null
        barParams = null
    }

    override fun onDestroy() {
        mainHandler.removeCallbacksAndMessages(null)
        removeBar()
        removeChargingOverlay()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
