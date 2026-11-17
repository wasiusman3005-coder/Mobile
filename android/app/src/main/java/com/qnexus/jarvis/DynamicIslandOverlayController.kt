package com.qnexus.jarvis

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.drawable.GradientDrawable
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.sin

/**
 * Native Canvas Colorful Wave Visualizer rendered inside the Floating Dynamic Island
 * on Home Screen, Inside Apps, and System Lockscreen.
 */
class OverlayWaveView(context: Context) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private var rms: Float = 0.2f
    private var phaseTick: Float = 0f
    private var styleId: String = "rainbow_prism"
    private var colorTheme: String = "aurora_cyan"
    private var active: Boolean = false
    private var overridePrimaryColor: Int? = null

    fun updateWave(
        level: Float,
        style: String,
        theme: String,
        isActive: Boolean,
        customColor: Int? = null
    ) {
        rms = level.coerceIn(0.08f, 1f)
        styleId = style
        colorTheme = theme
        active = isActive
        overridePrimaryColor = customColor
        phaseTick += if (isActive) 0.42f else 0.16f
        invalidate()
    }

    private fun themeColors(): IntArray {
        val ov = overridePrimaryColor
        if (ov != null) {
            return intArrayOf(ov, Color.parseColor("#38bdf8"), Color.WHITE)
        }
        return when (colorTheme) {
            "emerald_mint" -> intArrayOf(Color.parseColor("#10b981"), Color.parseColor("#22d3ee"), Color.parseColor("#a7f3d0"))
            "rainbow_oneui" -> intArrayOf(Color.parseColor("#38bdf8"), Color.parseColor("#a855f7"), Color.parseColor("#f43f5e"))
            "solar_gold" -> intArrayOf(Color.parseColor("#f59e0b"), Color.parseColor("#fb7185"), Color.parseColor("#fde047"))
            "deep_cobalt" -> intArrayOf(Color.parseColor("#2563eb"), Color.parseColor("#00f0ff"), Color.parseColor("#818cf8"))
            "crimson_cyber" -> intArrayOf(Color.parseColor("#f43f5e"), Color.parseColor("#f97316"), Color.parseColor("#c084fc"))
            else -> intArrayOf(Color.parseColor("#22c55e"), Color.parseColor("#00f0ff"), Color.parseColor("#a855f7"))
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0f || h <= 0f) return

        val cols = themeColors()
        paint.shader = LinearGradient(0f, 0f, w, 0f, cols, null, Shader.TileMode.CLAMP)

        val bars = 12
        val gap = (w * 0.045f).coerceIn(2.5f, 4.5f)
        val barW = ((w - gap * (bars - 1)) / bars).coerceAtLeast(2.5f)
        val centerY = h / 2f
        val ampScale = if (active) (0.34f + rms * 0.66f) else 0.24f

        for (i in 0 until bars) {
            val t = i.toFloat() / bars
            val wave = abs(sin((phaseTick + i * 0.62f).toDouble())).toFloat()
            val envelope = sin((t * Math.PI)).toFloat().coerceAtLeast(0.28f)
            val barH = (h * (0.20f + wave * ampScale * envelope)).coerceIn(4f, h - 2f)
            val x = i * (barW + gap)

            when (styleId) {
                "quantum_rings", "liquid_neon" -> {
                    val r = (barW * 0.52f).coerceAtLeast(2.5f)
                    val cy = centerY + sin((phaseTick + i * 0.72f).toDouble()).toFloat() * (h * 0.28f * ampScale)
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
 * Distinct Glyph Badge rendered inside the Dynamic Island:
 * Fingerprint ridges vs Face Scan iris reticle vs Charging bolt vs Jarvis spark.
 */
class DynamicBarGlyphView(context: Context) : View(context) {
    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
    }
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private var mode: String = "jarvis"
    private var accentColor: Int = Color.parseColor("#22c55e")
    private var pulseTick: Float = 0f

    fun updateGlyph(newMode: String, color: Int, tick: Float) {
        mode = newMode
        accentColor = color
        pulseTick = tick
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0f || h <= 0f) return
        val cx = w / 2f
        val cy = h / 2f
        val r = min(w, h) * 0.42f

        when (mode) {
            "fingerprint" -> {
                val glowAlpha = (150 + (sin(pulseTick * 2.4).toFloat() * 75)).toInt().coerceIn(90, 240)
                fillPaint.color = Color.argb(48, Color.red(accentColor), Color.green(accentColor), Color.blue(accentColor))
                canvas.drawCircle(cx, cy, r * 1.05f, fillPaint)
                strokePaint.color = Color.argb(glowAlpha, Color.red(accentColor), Color.green(accentColor), Color.blue(accentColor))
                strokePaint.strokeWidth = 2.3f
                for (ring in 1..3) {
                    val rr = r * (ring * 0.31f)
                    val sweep = 215f + ring * 22f
                    val start = -90f + pulseTick * 42f * (if (ring % 2 == 0) 1f else -1f)
                    canvas.drawArc(RectF(cx - rr, cy - rr, cx + rr, cy + rr), start, sweep, false, strokePaint)
                }
            }
            "face" -> {
                fillPaint.color = Color.argb(48, Color.red(accentColor), Color.green(accentColor), Color.blue(accentColor))
                canvas.drawCircle(cx, cy, r * 1.05f, fillPaint)
                strokePaint.color = accentColor
                strokePaint.strokeWidth = 2.3f
                val b = r * 0.78f
                val corner = r * 0.34f
                val path = Path().apply {
                    moveTo(cx - b, cy - b + corner); lineTo(cx - b, cy - b); lineTo(cx - b + corner, cy - b)
                    moveTo(cx + b - corner, cy - b); lineTo(cx + b, cy - b); lineTo(cx + b, cy - b + corner)
                    moveTo(cx - b, cy + b - corner); lineTo(cx - b, cy + b); lineTo(cx - b + corner, cy + b)
                    moveTo(cx + b - corner, cy + b); lineTo(cx + b, cy + b); lineTo(cx + b, cy + b - corner)
                }
                canvas.drawPath(path, strokePaint)
                val irisR = r * (0.34f + 0.08f * sin(pulseTick * 3f).toFloat())
                canvas.drawCircle(cx, cy, irisR, strokePaint)
            }
            "charging" -> {
                fillPaint.color = accentColor
                val bolt = Path().apply {
                    moveTo(cx + r * 0.12f, cy - r * 0.85f)
                    lineTo(cx - r * 0.52f, cy + r * 0.06f)
                    lineTo(cx - r * 0.02f, cy + r * 0.06f)
                    lineTo(cx - r * 0.16f, cy + r * 0.88f)
                    lineTo(cx + r * 0.55f, cy - r * 0.08f)
                    lineTo(cx + r * 0.05f, cy - r * 0.08f)
                    close()
                }
                canvas.drawPath(bolt, fillPaint)
            }
            "call" -> {
                fillPaint.color = Color.parseColor("#22c55e")
                canvas.drawCircle(cx, cy, r * 0.48f, fillPaint)
                strokePaint.color = Color.parseColor("#86efac")
                strokePaint.strokeWidth = 2f
                val waveR = r * (0.68f + 0.22f * abs(sin(pulseTick * 2f)).toFloat())
                canvas.drawCircle(cx, cy, waveR, strokePaint)
            }
            else -> {
                strokePaint.color = accentColor
                strokePaint.strokeWidth = 2.2f
                val pulseR = r * (0.72f + 0.12f * sin(pulseTick * 1.8f).toFloat())
                canvas.drawCircle(cx, cy, pulseR, strokePaint)
                fillPaint.color = accentColor
                canvas.drawCircle(cx, cy, r * 0.30f, fillPaint)
            }
        }
    }
}

/**
 * Animated Biometric Fingerprint Ring rendered over ANY lockscreen wallpaper when device is locked.
 */
class LockFingerprintView(context: Context) : View(context) {
    private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
    }
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val bmpPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private var tick: Float = 0f
    private var animId: String = "ripple_wave"
    private var customBmp: Bitmap? = null
    private var lastLoadedPathTime: Long = -1L

    fun updateStyle(id: String, nextTick: Float) {
        animId = id
        tick = nextTick
        reloadCustomBitmapIfChanged()
        invalidate()
    }

    private fun reloadCustomBitmapIfChanged() {
        try {
            val f = File(context.filesDir, "custom_biometric.png")
            if (!f.exists()) {
                customBmp = null
                lastLoadedPathTime = -1L
                return
            }
            val lm = f.lastModified()
            if (lm != lastLoadedPathTime) {
                lastLoadedPathTime = lm
                val opts = BitmapFactory.Options().apply { inSampleSize = 2 }
                customBmp = BitmapFactory.decodeFile(f.absolutePath, opts)
            }
        } catch (_: Exception) {}
    }

    private fun animColor(): Int {
        return when (animId) {
            "quantum_iris" -> Color.parseColor("#a855f7")
            "neon_shockwave" -> Color.parseColor("#38bdf8")
            "honeycomb_scan" -> Color.parseColor("#22d3ee")
            "liquid_gold" -> Color.parseColor("#f59e0b")
            "particle_burst" -> Color.parseColor("#f472b6")
            "emerald_pulse" -> Color.parseColor("#10b981")
            "starlight_ring" -> Color.parseColor("#e0f2fe")
            else -> Color.parseColor("#00f0ff")
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0f || h <= 0f) return

        val cx = w / 2f
        val cy = h / 2f
        val maxR = min(w, h) * 0.45f
        val c = animColor()

        val rippleFrac = (tick * 0.45f) % 1f
        val rippleR = maxR * (0.64f + rippleFrac * 0.36f)
        val rippleAlpha = ((1f - rippleFrac) * 190f).toInt().coerceIn(0, 210)
        ringPaint.color = Color.argb(rippleAlpha, Color.red(c), Color.green(c), Color.blue(c))
        ringPaint.strokeWidth = 3.5f
        canvas.drawCircle(cx, cy, rippleR, ringPaint)

        fillPaint.color = Color.argb(185, 4, 10, 24)
        canvas.drawCircle(cx, cy, maxR * 0.66f, fillPaint)

        val bmp = customBmp
        if (bmp != null && !bmp.isRecycled) {
            val save = canvas.save()
            val clip = Path().apply { addCircle(cx, cy, maxR * 0.56f, Path.Direction.CW) }
            canvas.clipPath(clip)
            val dst = RectF(cx - maxR * 0.56f, cy - maxR * 0.56f, cx + maxR * 0.56f, cy + maxR * 0.56f)
            bmpPaint.alpha = 120
            canvas.drawBitmap(bmp, null, dst, bmpPaint)
            canvas.restoreToCount(save)
        }

        ringPaint.color = c
        ringPaint.strokeWidth = 3.2f
        val rotBase = (tick * 45f) % 360f
        for (i in 1..4) {
            val r = maxR * (0.14f + i * 0.115f)
            val startAngle = rotBase * (if (i % 2 == 0) 1f else -1f) + i * 35f
            canvas.drawArc(RectF(cx - r, cy - r, cx + r, cy + r), startAngle, 245f, false, ringPaint)
        }
    }
}

/**
 * Shared Dynamic Island & Lockscreen Biometric Overlay Controller.
 * Position is strictly locked to user's App Settings (no accidental touch-drag movement on Home/Lock screen).
 */
class DynamicIslandOverlayController(private val ctx: Context) {

    companion object {
        private const val PREFS = "WasuJarvisPrefs"

        @Volatile
        var activeController: DynamicIslandOverlayController? = null
            private set

        @Volatile
        var isAccessibilityOverlayActive: Boolean = false
            internal set

        @Volatile
        var lastInteractiveUnlockHint: String? = null

        @Volatile
        var lastSystemUiAuthCue: String? = null

        fun dispatchVoiceState(state: String, text: String, rms: Float) {
            activeController?.handleVoiceState(state, text, rms)
        }

        fun dispatchNotification(title: String, text: String, isVip: Boolean) {
            activeController?.showNotificationBanner(title, text, isVip)
        }

        fun dispatchIncomingCall(caller: String) {
            activeController?.showIncomingCallBanner(caller)
        }

        fun dispatchUnlockEffect(method: String) {
            activeController?.showUnlockEffect(method)
        }

        fun dispatchCharging() {
            activeController?.onChargingConnected()
        }

        fun dispatchRefreshConfig() {
            activeController?.refreshFromPrefs()
        }
    }

    private var wm: WindowManager? = null
    private var usingAccessibilityType: Boolean = false

    private var barView: LinearLayout? = null
    private var glyphView: DynamicBarGlyphView? = null
    private var titleView: TextView? = null
    private var subView: TextView? = null
    private var cameraSpacerView: View? = null
    private var waveView: OverlayWaveView? = null
    private var callActionRow: LinearLayout? = null
    private var barParams: WindowManager.LayoutParams? = null

    private var lockFpView: LockFingerprintView? = null
    private var chargingView: FrameLayout? = null

    private val mainHandler = Handler(Looper.getMainLooper())
    private var animRunning = false
    private var phaseTick = 0f
    private var currentMode = "standby"
    private var currentRms = 0.25f
    private var currentUnlockColor: Int? = null
    private var lastUnlockAnimAtMs = 0L

    private val animRunnable = object : Runnable {
        override fun run() {
            if (!animRunning) return
            phaseTick += 0.14f
            val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val wStyle = prefs.getString("wave_visualizer_style", "rainbow_prism") ?: "rainbow_prism"
            val wTheme = prefs.getString("wave_color_theme", "aurora_cyan") ?: "aurora_cyan"
            val anchor = prefs.getString("dynamic_bar_anchor", "camera-island") ?: "camera-island"

            val activeWave = currentMode == "listening" || currentMode == "speaking" ||
                currentMode == "unlock" || currentMode == "call" || currentMode == "processing"

            if (activeWave || anchor == "camera-island") {
                waveView?.updateWave(currentRms, wStyle, wTheme, activeWave, currentUnlockColor)
            }

            val glyphMode = when (currentMode) {
                "unlock" -> if (currentUnlockColor == Color.parseColor("#a855f7")) "face" else "fingerprint"
                "call" -> "call"
                else -> if (currentMode == "locked") "fingerprint" else "jarvis"
            }
            val accent = parseColorSafe(prefs.getString("oneui_accent_hex", "#22c55e"), Color.parseColor("#22c55e"))
            glyphView?.updateGlyph(glyphMode, currentUnlockColor ?: accent, phaseTick)

            val km = ctx.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
            val lockedNow = km?.isKeyguardLocked == true
            if (lockedNow && prefs.getBoolean("fingerprint_on_any_wallpaper", true) && usingAccessibilityType) {
                ensureLockFingerprintAttached()
                val fpStyle = prefs.getString("fingerprint_anim_id", "ripple_wave") ?: "ripple_wave"
                lockFpView?.updateStyle(fpStyle, phaseTick)
            } else if (!lockedNow && lockFpView != null) {
                removeLockFingerprintOverlay()
            }

            val delay = if (activeWave || lockedNow) 55L else 140L
            mainHandler.postDelayed(this, delay)
        }
    }

    fun attach(useAccessibilityOverlay: Boolean) {
        usingAccessibilityType = useAccessibilityOverlay
        activeController = this
        wm = ctx.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
        refreshFromPrefs()
    }

    fun detach() {
        animRunning = false
        mainHandler.removeCallbacksAndMessages(null)
        removeBar()
        removeLockFingerprintOverlay()
        removeChargingOverlay()
        if (activeController === this) {
            activeController = null
        }
    }

    fun refreshFromPrefs() {
        mainHandler.post {
            val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val barStyle = prefs.getString("dynamic_bar_style", "now_bar_pill") ?: "now_bar_pill"
            val showOutside = prefs.getBoolean("dynamic_bar_outside_app", true)

            if (barStyle == "hidden" || !showOutside) {
                removeBar()
                return@post
            }

            ensureBarAttached()
            applyBarGeometryAndTheme()

            val km = ctx.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
            if (km?.isKeyguardLocked == true && currentMode != "unlock") {
                onScreenLocked()
            } else if (currentMode == "standby") {
                refreshDefaultPill()
            }
            startAnimLoop()
        }
    }

    fun onScreenLocked() {
        mainHandler.post {
            val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            if (prefs.getString("dynamic_bar_style", "now_bar_pill") == "hidden" ||
                !prefs.getBoolean("dynamic_bar_outside_app", true)
            ) return@post

            ensureBarAttached()
            applyBarGeometryAndTheme()
            currentMode = "locked"
            currentUnlockColor = null
            currentRms = 0.20f

            val label = prefs.getString("dynamic_bar_custom_label", "Wasu's Jarvis")?.ifBlank { "Wasu's Jarvis" } ?: "Wasu's Jarvis"
            val timeStr = SimpleDateFormat("hh:mm", Locale.getDefault()).format(Date())
            titleView?.text = label.take(13)
            subView?.text = "$timeStr • Locked"

            if (usingAccessibilityType && prefs.getBoolean("fingerprint_on_any_wallpaper", true)) {
                ensureLockFingerprintAttached()
            }
            startAnimLoop()
        }
    }

    fun onUserUnlockedScreen() {
        mainHandler.post {
            removeLockFingerprintOverlay()
            val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val displayPref = prefs.getString("biometric_unlock_anim_display", "auto") ?: "auto"
            val resolvedMethod = when (displayPref) {
                "face" -> "Face"
                "fingerprint" -> "Fingerprint"
                else -> {
                    when {
                        lastInteractiveUnlockHint == "Fingerprint" -> "Fingerprint"
                        lastSystemUiAuthCue == "Face" -> "Face"
                        lastSystemUiAuthCue == "Fingerprint" -> "Fingerprint"
                        else -> "Fingerprint"
                    }
                }
            }
            lastInteractiveUnlockHint = null
            lastSystemUiAuthCue = null
            showUnlockEffect(resolvedMethod)
        }
    }

    fun onChargingConnected() {
        mainHandler.post {
            val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            if (!prefs.getBoolean("charging_overlay_enabled", true)) return@post
            showChargingPulseBanner()
            showChargingTurboModal()
        }
    }

    private fun parseColorSafe(hex: String?, fallback: Int): Int {
        return try {
            if (hex.isNullOrBlank()) fallback else Color.parseColor(hex)
        } catch (_: Exception) {
            fallback
        }
    }

    private fun dp(v: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            v.toFloat(),
            ctx.resources.displayMetrics
        ).toInt()
    }

    private fun overlayWindowType(): Int {
        if (usingAccessibilityType && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
            return WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY
        }
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }
    }

    private fun configureCutoutAndFullscreenParams(lp: WindowManager.LayoutParams) {
        lp.flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
            lp.fitInsetsTypes = 0
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
    }

    private fun resolveGravity(anchor: String): Int {
        return when (anchor) {
            "top-left" -> Gravity.TOP or Gravity.START
            "top-right" -> Gravity.TOP or Gravity.END
            "bottom-center" -> Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            "custom" -> Gravity.TOP or Gravity.CENTER_HORIZONTAL
            else -> Gravity.TOP or Gravity.CENTER_HORIZONTAL
        }
    }

    private fun applyBarGeometryAndTheme() {
        val bar = barView ?: return
        val params = barParams ?: return
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val anchor = prefs.getString("dynamic_bar_anchor", "camera-island") ?: "camera-island"
        val style = prefs.getString("dynamic_bar_style", "now_bar_pill") ?: "now_bar_pill"
        val offsetX = prefs.getInt("dynamic_bar_offset_x", 0)
        val offsetY = prefs.getInt("dynamic_bar_offset_y", 6)
        val cameraGapDp = prefs.getInt("dynamic_bar_camera_gap_px", 34).coerceIn(0, 72)

        val accentHex = prefs.getString("oneui_accent_hex", "#00f0ff") ?: "#00f0ff"
        val baseAccent = parseColorSafe(accentHex, Color.parseColor("#00f0ff"))
        val strokeCol = currentUnlockColor ?: if (anchor == "camera-island") Color.parseColor("#f59e0b") else baseAccent

        params.gravity = resolveGravity(anchor)
        params.x = dp(offsetX)
        params.y = dp(offsetY.coerceAtLeast(0))

        val isCamIsland = anchor == "camera-island"
        cameraSpacerView?.let { sp ->
            sp.visibility = if (isCamIsland && cameraGapDp > 0) View.VISIBLE else View.GONE
            val lp = sp.layoutParams
            lp.width = dp(cameraGapDp)
            sp.layoutParams = lp
        }
        waveView?.let { wv ->
            val lp = wv.layoutParams as LinearLayout.LayoutParams
            lp.width = dp(if (isCamIsland) 66 else 96)
            lp.height = dp(18)
            lp.leftMargin = dp(if (isCamIsland) 6 else 8)
            wv.layoutParams = lp
            wv.visibility = if (isCamIsland || currentMode != "standby") View.VISIBLE else View.GONE
        }

        val bgColor = if (isCamIsland || style == "minimal_dot") {
            Color.BLACK
        } else {
            Color.argb(242, 4, 8, 22)
        }
        bar.background = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(26).toFloat()
            setColor(bgColor)
            setStroke(dp(1).coerceAtLeast(2), Color.argb(215, Color.red(strokeCol), Color.green(strokeCol), Color.blue(strokeCol)))
        }
        bar.setPadding(
            dp(if (isCamIsland) 12 else 14),
            dp(if (isCamIsland) 6 else 7),
            dp(if (isCamIsland) 12 else 14),
            dp(if (isCamIsland) 6 else 7)
        )
        try {
            wm?.updateViewLayout(bar, params)
        } catch (_: Exception) {}
    }

    private fun ensureBarAttached() {
        if (barView != null) return
        val windowMgr = wm ?: (ctx.getSystemService(Context.WINDOW_SERVICE) as? WindowManager)?.also { wm = it } ?: return

        val root = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
        }

        val row = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }

        val glyph = DynamicBarGlyphView(ctx).apply {
            layoutParams = LinearLayout.LayoutParams(dp(18), dp(18)).apply {
                rightMargin = dp(6)
            }
        }

        val title = TextView(ctx).apply {
            text = "Wasu's Jarvis"
            setTextColor(Color.parseColor("#4ade80"))
            textSize = 11f
            maxLines = 1
            setPadding(0, 0, dp(4), 0)
        }

        val sub = TextView(ctx).apply {
            text = ""
            setTextColor(Color.parseColor("#e2e8f0"))
            textSize = 10.5f
            maxLines = 1
        }

        val cameraSpacer = View(ctx).apply {
            layoutParams = LinearLayout.LayoutParams(dp(34), dp(18))
            setBackgroundColor(Color.TRANSPARENT)
        }

        val wave = OverlayWaveView(ctx).apply {
            layoutParams = LinearLayout.LayoutParams(dp(66), dp(18)).apply {
                leftMargin = dp(6)
            }
        }

        row.addView(glyph)
        row.addView(title)
        row.addView(sub)
        row.addView(cameraSpacer)
        row.addView(wave)
        root.addView(row)

        val actionsRow = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, dp(6), 0, 0)
            visibility = View.GONE
        }

        val answerBtn = TextView(ctx).apply {
            text = "Answer"
            setTextColor(Color.WHITE)
            textSize = 11f
            setPadding(dp(14), dp(5), dp(14), dp(5))
            background = GradientDrawable().apply {
                cornerRadius = dp(16).toFloat()
                setColor(Color.parseColor("#059669"))
            }
            setOnClickListener {
                try {
                    val i = Intent(ctx, JarvisWakeForegroundService::class.java).apply {
                        action = JarvisWakeForegroundService.ACTION_CALL_ANSWER
                    }
                    ctx.startService(i)
                } catch (_: Exception) {}
                actionsRow.visibility = View.GONE
            }
        }

        val rejectBtn = TextView(ctx).apply {
            text = "Cut Call"
            setTextColor(Color.WHITE)
            textSize = 11f
            setPadding(dp(14), dp(5), dp(14), dp(5))
            background = GradientDrawable().apply {
                cornerRadius = dp(16).toFloat()
                setColor(Color.parseColor("#e11d48"))
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { leftMargin = dp(10) }
            setOnClickListener {
                try {
                    val i = Intent(ctx, JarvisWakeForegroundService::class.java).apply {
                        action = JarvisWakeForegroundService.ACTION_CALL_REJECT
                    }
                    ctx.startService(i)
                } catch (_: Exception) {}
                actionsRow.visibility = View.GONE
            }
        }

        actionsRow.addView(answerBtn)
        actionsRow.addView(rejectBtn)
        root.addView(actionsRow)

        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val anchor = prefs.getString("dynamic_bar_anchor", "camera-island") ?: "camera-island"
        val offsetX = prefs.getInt("dynamic_bar_offset_x", 0)
        val offsetY = prefs.getInt("dynamic_bar_offset_y", 6)

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayWindowType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            configureCutoutAndFullscreenParams(this)
            gravity = resolveGravity(anchor)
            x = dp(offsetX)
            y = dp(offsetY.coerceAtLeast(0))
        }

        // Strict position lock: tapping triggers Jarvis voice listening; bar NEVER moves on touch outside app settings
        root.setOnClickListener {
            try {
                val bgListen = Intent(ctx, JarvisWakeForegroundService::class.java).apply {
                    action = JarvisWakeForegroundService.ACTION_BG_LISTEN_AND_ACT
                }
                ctx.startService(bgListen)
            } catch (_: Exception) {}
        }

        try {
            windowMgr.addView(root, params)
            barView = root
            glyphView = glyph
            titleView = title
            subView = sub
            cameraSpacerView = cameraSpacer
            waveView = wave
            callActionRow = actionsRow
            barParams = params
        } catch (_: Exception) {}
    }

    private fun ensureLockFingerprintAttached() {
        if (lockFpView != null || !usingAccessibilityType) return
        val windowMgr = wm ?: return
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean("fingerprint_on_any_wallpaper", true)) return

        val fpView = LockFingerprintView(ctx).apply {
            setOnClickListener {
                lastInteractiveUnlockHint = "Fingerprint"
                phaseTick += 1.2f
                invalidate()
            }
        }

        val size = dp(92)
        val fpParams = WindowManager.LayoutParams(
            size,
            size,
            overlayWindowType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            configureCutoutAndFullscreenParams(this)
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            y = dp(94)
        }

        try {
            windowMgr.addView(fpView, fpParams)
            lockFpView = fpView
        } catch (_: Exception) {}
    }

    private fun removeLockFingerprintOverlay() {
        lockFpView?.let { v ->
            try { wm?.removeView(v) } catch (_: Exception) {}
        }
        lockFpView = null
    }

    private fun startAnimLoop() {
        if (animRunning) return
        animRunning = true
        mainHandler.post(animRunnable)
    }

    private fun stopAnimLoop() {
        animRunning = false
        mainHandler.removeCallbacks(animRunnable)
    }

    fun handleVoiceState(state: String, text: String, rms: Float) {
        mainHandler.post {
            ensureBarAttached()
            currentMode = state
            currentRms = rms.coerceIn(0.15f, 1f)
            currentUnlockColor = null
            when (state) {
                "listening" -> {
                    titleView?.text = "LISTENING"
                    subView?.text = text.take(18).ifBlank { "Bolein..." }
                    callActionRow?.visibility = View.GONE
                    applyBarGeometryAndTheme()
                    startAnimLoop()
                }
                "processing" -> {
                    titleView?.text = "THINKING"
                    subView?.text = text.take(18).ifBlank { "..." }
                    currentRms = 0.48f
                    applyBarGeometryAndTheme()
                    startAnimLoop()
                }
                "speaking" -> {
                    titleView?.text = "JARVIS"
                    subView?.text = text.take(20).ifBlank { "Speaking" }
                    currentRms = 0.70f
                    applyBarGeometryAndTheme()
                    startAnimLoop()
                }
                else -> {
                    refreshDefaultPill()
                }
            }
        }
    }

    private fun refreshDefaultPill() {
        val km = ctx.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
        if (km?.isKeyguardLocked == true) {
            onScreenLocked()
            return
        }
        currentMode = "standby"
        currentUnlockColor = null
        currentRms = 0.22f
        callActionRow?.visibility = View.GONE
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val customLabel = prefs.getString("dynamic_bar_custom_label", "")?.trim().orEmpty()
        val style = prefs.getString("dynamic_bar_style", "now_bar_pill") ?: "now_bar_pill"
        val anchor = prefs.getString("dynamic_bar_anchor", "camera-island") ?: "camera-island"
        val bm = ctx.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        val pct = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1

        val label = if (customLabel.isNotEmpty()) customLabel else when (style) {
            "cyber_strip" -> "CYBER HUD"
            "liquid_island" -> "ONE UI 9"
            "audio_spectrum" -> "JARVIS WAVE"
            else -> "Wasu's Jarvis"
        }

        if (anchor == "camera-island") {
            val timeStr = SimpleDateFormat("h:mm", Locale.getDefault()).format(Date())
            titleView?.text = label.take(13)
            titleView?.setTextColor(Color.parseColor("#4ade80"))
            subView?.text = if (pct in 0..100) "$timeStr • $pct%" else timeStr
        } else {
            titleView?.text = label
            subView?.text = if (pct in 0..100) "$pct% • Say 'Jarvis'" else "Say 'Jarvis'"
        }
        applyBarGeometryAndTheme()
        startAnimLoop()
    }

    fun showNotificationBanner(title: String, text: String, isVip: Boolean) {
        mainHandler.post {
            ensureBarAttached()
            currentMode = "notification"
            currentUnlockColor = if (isVip) Color.parseColor("#f59e0b") else null
            titleView?.text = if (isVip) "VIP" else title.take(12)
            subView?.text = text.take(22).ifBlank { title.take(22) }
            callActionRow?.visibility = View.GONE
            applyBarGeometryAndTheme()
            startAnimLoop()
            mainHandler.postDelayed({
                if (currentMode == "notification") refreshDefaultPill()
            }, 6500L)
        }
    }

    fun showIncomingCallBanner(caller: String) {
        mainHandler.post {
            ensureBarAttached()
            currentMode = "call"
            currentUnlockColor = Color.parseColor("#22c55e")
            titleView?.text = "CALL"
            subView?.text = caller.take(18)
            callActionRow?.visibility = View.VISIBLE
            currentRms = 0.85f
            applyBarGeometryAndTheme()
            startAnimLoop()
            mainHandler.postDelayed({
                if (currentMode == "call") {
                    callActionRow?.visibility = View.GONE
                    refreshDefaultPill()
                }
            }, 24000L)
        }
    }

    fun showUnlockEffect(method: String) {
        mainHandler.post {
            val now = System.currentTimeMillis()
            if (now - lastUnlockAnimAtMs < 1100L && currentMode == "unlock") return@post
            lastUnlockAnimAtMs = now

            ensureBarAttached()
            currentMode = "unlock"
            val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val isFace = method.lowercase(Locale.US).contains("face")
            val isFinger = method.lowercase(Locale.US).contains("finger")

            val fpStyle = prefs.getString("fingerprint_anim_id", "ripple_wave") ?: "ripple_wave"
            val faceStyle = prefs.getString("face_anim_id", "hologram_mesh") ?: "hologram_mesh"

            if (isFace) {
                currentUnlockColor = Color.parseColor("#a855f7")
                titleView?.text = "FACE ID"
                titleView?.setTextColor(Color.parseColor("#e879f9"))
                subView?.text = faceStyle.replace('_', ' ').take(16)
            } else if (isFinger) {
                currentUnlockColor = Color.parseColor("#10b981")
                titleView?.text = "FINGER"
                titleView?.setTextColor(Color.parseColor("#34d399"))
                subView?.text = fpStyle.replace('_', ' ').take(16)
            } else {
                val anim = prefs.getString("unlock_bar_anim_style", "aurora_bloom") ?: "aurora_bloom"
                currentUnlockColor = Color.parseColor("#00f0ff")
                titleView?.text = "UNLOCKED"
                titleView?.setTextColor(Color.parseColor("#38bdf8"))
                subView?.text = anim.replace('_', ' ').take(16)
            }

            currentRms = 0.92f
            applyBarGeometryAndTheme()
            startAnimLoop()
            mainHandler.postDelayed({
                if (currentMode == "unlock") refreshDefaultPill()
            }, 3400L)
        }
    }

    private fun showChargingPulseBanner() {
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val anim = prefs.getString("charging_anim_id", "oneui9_turbo") ?: "oneui9_turbo"
        val bm = ctx.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        val pct = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
        currentUnlockColor = Color.parseColor("#22c55e")
        titleView?.text = "TURBO"
        subView?.text = if (pct in 0..100) "$pct% • ${anim.take(8)}" else "FAST CHG"
        applyBarGeometryAndTheme()
        mainHandler.postDelayed({
            if (currentMode == "standby") refreshDefaultPill()
        }, 5500L)
    }

    private fun showChargingTurboModal() {
        removeChargingOverlay()
        val windowMgr = wm ?: return
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val accentHex = prefs.getString("oneui_accent_hex", "#00f0ff") ?: "#00f0ff"
        val accentColor = parseColorSafe(accentHex, Color.parseColor("#00f0ff"))
        val animId = prefs.getString("charging_anim_id", "oneui9_turbo") ?: "oneui9_turbo"
        val bm = ctx.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        val pct = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: 85

        val container = FrameLayout(ctx).apply {
            setBackgroundColor(Color.argb(190, 2, 6, 18))
            setOnClickListener { removeChargingOverlay() }
        }

        val card = LinearLayout(ctx).apply {
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

        val customBioFile = File(ctx.filesDir, "custom_biometric.png")
        if (customBioFile.exists()) {
            try {
                val opts = BitmapFactory.Options().apply { inSampleSize = 2 }
                val bmp: Bitmap? = BitmapFactory.decodeFile(customBioFile.absolutePath, opts)
                if (bmp != null) {
                    val img = ImageView(ctx).apply {
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

        val pctText = TextView(ctx).apply {
            text = if (pct in 0..100) "$pct%" else "FAST"
            setTextColor(Color.WHITE)
            textSize = 36f
        }
        val modeText = TextView(ctx).apply {
            text = "SUPER FAST • ${animId.replace('_', ' ').uppercase(Locale.US)}"
            setTextColor(accentColor)
            textSize = 12f
            setPadding(0, dp(4), 0, dp(6))
        }
        val hintText = TextView(ctx).apply {
            text = "Tap anywhere to close"
            setTextColor(Color.parseColor("#94a3b8"))
            textSize = 10.5f
        }

        card.addView(pctText)
        card.addView(modeText)
        card.addView(hintText)

        container.addView(
            card,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
            )
        )

        val overlayParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            overlayWindowType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            configureCutoutAndFullscreenParams(this)
        }

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
        stopAnimLoop()
        barView?.let { v ->
            try { wm?.removeView(v) } catch (_: Exception) {}
        }
        barView = null
        glyphView = null
        titleView = null
        subView = null
        cameraSpacerView = null
        waveView = null
        callActionRow = null
        barParams = null
    }
}
