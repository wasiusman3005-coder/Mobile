package com.qnexus.jarvis

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.service.wallpaper.WallpaperService
import android.view.SurfaceHolder
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.random.Random

private data class Drop(var x: Float, var y: Float, var speed: Float, var len: Float, var alpha: Int)

/**
 * Pure 3D & Depth Live Wallpaper Engine for Mobile Home & Lock Screen.
 * Renders clean aesthetic wallpapers & Depth Tall Clocks without sticking battery circles or unwanted rings over the screen.
 */
class JarvisLiveWallpaperService : WallpaperService() {

    override fun onCreateEngine(): Engine {
        return JarvisWallpaperEngine()
    }

    inner class JarvisWallpaperEngine : Engine() {
        private val handler = Handler(Looper.getMainLooper())
        private var visible = false
        private var startTimeMs = System.currentTimeMillis()
        private var width = 1080
        private var height = 2400

        private var cachedBgBitmap: Bitmap? = null
        private var cachedBgModTime: Long = -1L

        private val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        private val bmpPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        private val glowPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeCap = Paint.Cap.ROUND
        }
        private val particlePaint = Paint(Paint.ANTI_ALIAS_FLAG)
        private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textAlign = Paint.Align.CENTER
            typeface = Typeface.create("sans-serif-black", Typeface.BOLD)
        }
        private val subTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textAlign = Paint.Align.CENTER
            typeface = Typeface.MONOSPACE
        }

        private val drops = List(58) {
            Drop(
                Random.nextFloat(),
                Random.nextFloat(),
                0.22f + Random.nextFloat() * 0.55f,
                26f + Random.nextFloat() * 82f,
                65 + Random.nextInt(145)
            )
        }

        private val drawRunner = object : Runnable {
            override fun run() {
                drawFrame()
                if (visible) {
                    handler.postDelayed(this, 38L)
                }
            }
        }

        override fun onVisibilityChanged(visible: Boolean) {
            this.visible = visible
            if (visible) {
                reloadBitmapsIfNeeded()
                handler.removeCallbacks(drawRunner)
                handler.post(drawRunner)
            } else {
                handler.removeCallbacks(drawRunner)
            }
        }

        override fun onSurfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
            super.onSurfaceChanged(holder, format, width, height)
            this.width = width.coerceAtLeast(1)
            this.height = height.coerceAtLeast(1)
        }

        override fun onSurfaceDestroyed(holder: SurfaceHolder) {
            super.onSurfaceDestroyed(holder)
            visible = false
            handler.removeCallbacks(drawRunner)
            try { cachedBgBitmap?.recycle() } catch (_: Exception) {}
            cachedBgBitmap = null
        }

        private fun reloadBitmapsIfNeeded() {
            try {
                val wpFile = File(filesDir, "custom_lock_wallpaper.png")
                if (wpFile.exists()) {
                    val mod = wpFile.lastModified()
                    if (mod != cachedBgModTime) {
                        cachedBgModTime = mod
                        val opts = BitmapFactory.Options().apply { inSampleSize = 2 }
                        val decoded = BitmapFactory.decodeFile(wpFile.absolutePath, opts)
                        val prev = cachedBgBitmap
                        cachedBgBitmap = decoded
                        if (prev != null && prev !== decoded) {
                            try { prev.recycle() } catch (_: Exception) {}
                        }
                    }
                } else {
                    cachedBgModTime = -1L
                    cachedBgBitmap?.let { try { it.recycle() } catch (_: Exception) {} }
                    cachedBgBitmap = null
                }
            } catch (_: Exception) {}
        }

        private fun parseColorSafe(hex: String?, fallback: Int): Int {
            return try {
                if (hex.isNullOrBlank()) fallback else Color.parseColor(hex)
            } catch (_: Exception) {
                fallback
            }
        }

        private fun drawClockLayer(
            canvas: Canvas,
            w: Float,
            h: Float,
            cx: Float,
            clockStyle: String,
            clockColor: Int,
            accentColor: Int,
            clockPosYFrac: Float
        ) {
            val timeStr = SimpleDateFormat("hh:mm", Locale.getDefault()).format(Date())
            val dateStr = SimpleDateFormat("EEE, d MMM", Locale.getDefault()).format(Date()).uppercase(Locale.US)
            val baseY = h * clockPosYFrac.coerceIn(0.14f, 0.45f)

            if (clockStyle == "depth_editorial") {
                textPaint.typeface = Typeface.create("sans-serif-condensed", Typeface.BOLD)
                textPaint.textSize = min(w, h) * 0.25f
                textPaint.color = clockColor
                canvas.save()
                canvas.scale(0.84f, 1.32f, cx, baseY)
                canvas.drawText(timeStr.replace(":", ""), cx, baseY, textPaint)
                canvas.restore()

                subTextPaint.textSize = min(w, h) * 0.032f
                subTextPaint.color = Color.argb(220, Color.red(clockColor), Color.green(clockColor), Color.blue(clockColor))
                canvas.drawText(dateStr, cx, baseY - min(w, h) * 0.24f, subTextPaint)
            } else {
                textPaint.typeface = Typeface.create("sans-serif-light", Typeface.BOLD)
                textPaint.textSize = min(w, h) * 0.165f
                textPaint.color = clockColor
                canvas.drawText(timeStr, cx, baseY, textPaint)

                subTextPaint.textSize = min(w, h) * 0.032f
                subTextPaint.color = Color.argb(215, Color.red(accentColor), Color.green(accentColor), Color.blue(accentColor))
                canvas.drawText(dateStr, cx, baseY + h * 0.048f, subTextPaint)
            }
        }

        private fun drawForegroundDepthSubject(
            canvas: Canvas,
            style: String,
            w: Float,
            h: Float,
            cx: Float,
            t: Float,
            accentColor: Int
        ) {
            when (style) {
                "depth_moon_eclipse" -> {
                    val moonR = min(w, h) * 0.28f
                    val moonY = h * 0.37f + sin(t * 0.4f) * (h * 0.008f)
                    glowPaint.shader = RadialGradient(
                        cx - moonR * 0.25f, moonY - moonR * 0.25f, moonR * 1.18f,
                        Color.parseColor("#f1f5f9"),
                        Color.parseColor("#334155"),
                        Shader.TileMode.CLAMP
                    )
                    canvas.drawCircle(cx, moonY, moonR, glowPaint)
                    fillPaint.color = Color.argb(145, 2, 4, 12)
                    canvas.drawCircle(cx + moonR * 0.28f, moonY + moonR * 0.20f, moonR * 0.92f, fillPaint)
                }
                "depth_emerald_ridge" -> {
                    val path = Path().apply {
                        moveTo(0f, h * 0.56f)
                        cubicTo(w * 0.28f, h * 0.34f, w * 0.62f, h * 0.48f, w, h * 0.39f)
                        lineTo(w, h)
                        lineTo(0f, h)
                        close()
                    }
                    fillPaint.shader = LinearGradient(0f, h * 0.34f, 0f, h, Color.parseColor("#22c55e"), Color.parseColor("#052e16"), Shader.TileMode.CLAMP)
                    canvas.drawPath(path, fillPaint)
                    fillPaint.shader = null
                }
                "depth_alpine_peak" -> {
                    val peak = Path().apply {
                        moveTo(0f, h * 0.64f)
                        lineTo(w * 0.48f, h * 0.32f)
                        lineTo(w, h * 0.58f)
                        lineTo(w, h)
                        lineTo(0f, h)
                        close()
                    }
                    fillPaint.shader = LinearGradient(0f, h * 0.32f, 0f, h * 0.85f, Color.parseColor("#94a3b8"), Color.parseColor("#0f172a"), Shader.TileMode.CLAMP)
                    canvas.drawPath(peak, fillPaint)
                    fillPaint.shader = null
                }
                "depth_abyssal_ocean" -> {
                    val crest = Path().apply {
                        moveTo(0f, h * 0.43f)
                        for (xStep in 0..20) {
                            val x = (xStep / 20f) * w
                            val y = h * 0.43f + sin(x * 0.006f + t * 1.1f) * (h * 0.025f)
                            lineTo(x, y)
                        }
                        lineTo(w, h)
                        lineTo(0f, h)
                        close()
                    }
                    fillPaint.shader = LinearGradient(0f, h * 0.42f, 0f, h, Color.parseColor("#0891b2"), Color.parseColor("#020814"), Shader.TileMode.CLAMP)
                    canvas.drawPath(crest, fillPaint)
                    fillPaint.shader = null
                }
                "depth_obsidian_panther" -> {
                    val silR = min(w, h) * 0.29f
                    fillPaint.color = Color.parseColor("#030306")
                    canvas.drawCircle(cx, h * 0.44f, silR, fillPaint)
                    glowPaint.shader = RadialGradient(
                        cx, h * 0.42f, silR * 0.9f,
                        Color.argb(65, Color.red(accentColor), Color.green(accentColor), Color.blue(accentColor)),
                        Color.TRANSPARENT,
                        Shader.TileMode.CLAMP
                    )
                    canvas.drawCircle(cx, h * 0.42f, silR * 0.9f, glowPaint)
                }
                "depth_supercar_neon" -> {
                    val hood = Path().apply {
                        moveTo(0f, h * 0.58f)
                        quadraticTo(cx, h * 0.36f, w, h * 0.58f)
                        lineTo(w, h)
                        lineTo(0f, h)
                        close()
                    }
                    fillPaint.shader = LinearGradient(0f, h * 0.36f, 0f, h, Color.parseColor("#1e1b4b"), Color.parseColor("#020617"), Shader.TileMode.CLAMP)
                    canvas.drawPath(hood, fillPaint)
                    fillPaint.shader = null
                }
            }
        }

        private fun drawFrame() {
            val holder = surfaceHolder
            var canvas: Canvas? = null
            try {
                canvas = holder.lockCanvas() ?: return
                val prefs = getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
                val style = prefs.getString("live_wallpaper_style", "depth_moon_eclipse") ?: "depth_moon_eclipse"
                val accentColor = parseColorSafe(prefs.getString("oneui_accent_hex", "#00f0ff"), Color.parseColor("#00f0ff"))
                val clockColor = parseColorSafe(prefs.getString("oneui_clock_hex", "#e0f2fe"), Color.parseColor("#e0f2fe"))
                val clockStyle = prefs.getString("oneui_clock_style_id", "depth_editorial") ?: "depth_editorial"
                val showClock = prefs.getBoolean("wallpaper_show_clock", true)
                val depthEnabled = prefs.getBoolean("wallpaper_depth_enabled", true)
                val dimPct = prefs.getInt("wallpaper_dim_percent", 18).coerceIn(0, 75)
                val clockPosYFrac = (prefs.getInt("wallpaper_clock_pos_y", 24).coerceIn(14, 45)) / 100f

                val t = (System.currentTimeMillis() - startTimeMs) / 1000f
                val w = canvas.width.toFloat()
                val h = canvas.height.toFloat()
                val cx = w / 2f
                val cy = h / 2f

                // 1. Custom Gallery Wallpaper Backdrop OR Theme Base Gradient
                val customBg = cachedBgBitmap
                if (customBg != null && !customBg.isRecycled) {
                    val scale = maxOf(w / customBg.width.coerceAtLeast(1), h / customBg.height.coerceAtLeast(1))
                    val dw = customBg.width * scale
                    val dh = customBg.height * scale
                    val dst = RectF((w - dw) / 2f, (h - dh) / 2f, (w + dw) / 2f, (h + dh) / 2f)
                    bmpPaint.alpha = 255
                    canvas.drawBitmap(customBg, null, dst, bmpPaint)
                    if (dimPct > 0) {
                        bgPaint.shader = null
                        bgPaint.color = Color.argb((dimPct * 255 / 100).coerceIn(0, 200), 2, 6, 18)
                        canvas.drawRect(0f, 0f, w, h, bgPaint)
                    }
                } else {
                    val (cTop, cBot) = when (style) {
                        "depth_moon_eclipse" -> Color.parseColor("#010207") to Color.parseColor("#090d1a")
                        "depth_supercar_neon" -> Color.parseColor("#1a0b2e") to Color.parseColor("#070412")
                        "depth_abyssal_ocean" -> Color.parseColor("#052a45") to Color.parseColor("#020c18")
                        "depth_emerald_ridge" -> Color.parseColor("#0c2917") to Color.parseColor("#031109")
                        "depth_obsidian_panther" -> Color.BLACK to Color.parseColor("#030712")
                        "depth_alpine_peak" -> Color.parseColor("#1e293b") to Color.parseColor("#090d16")
                        "emerald_matrix" -> Color.parseColor("#02110b") to Color.parseColor("#041c13")
                        "solar_plasma" -> Color.parseColor("#18060d") to Color.parseColor("#250e04")
                        "deep_ocean" -> Color.parseColor("#020c1b") to Color.parseColor("#051e34")
                        "velvet_ripples" -> Color.parseColor("#140622") to Color.parseColor("#060b1e")
                        else -> Color.parseColor("#030714") to Color.parseColor("#0b112a")
                    }
                    bgPaint.shader = LinearGradient(0f, 0f, w, h, cTop, cBot, Shader.TileMode.CLAMP)
                    canvas.drawRect(0f, 0f, w, h, bgPaint)
                }

                // 2. Clean ambient nebula aura (no hard circle lines!)
                if (customBg == null && !style.startsWith("depth_")) {
                    val orb1X = cx + cos(t * 0.45f) * (w * 0.28f)
                    val orb1Y = cy * 0.65f + sin(t * 0.38f) * (h * 0.14f)
                    glowPaint.shader = RadialGradient(
                        orb1X, orb1Y, min(w, h) * 0.68f,
                        Color.argb(95, Color.red(accentColor), Color.green(accentColor), Color.blue(accentColor)),
                        Color.TRANSPARENT,
                        Shader.TileMode.CLAMP
                    )
                    canvas.drawCircle(orb1X, orb1Y, min(w, h) * 0.68f, glowPaint)
                }

                // 3. Motion styles when not custom photo
                if (customBg == null) {
                    when (style) {
                        "cosmic_rain", "emerald_matrix" -> {
                            val dropColor = if (style == "emerald_matrix") Color.parseColor("#34d399") else accentColor
                            strokePaint.strokeWidth = 3.2f
                            for (d in drops) {
                                d.y = (d.y + d.speed * 0.016f) % 1.05f
                                val px = d.x * w
                                val py = d.y * h
                                strokePaint.color = Color.argb(d.alpha, Color.red(dropColor), Color.green(dropColor), Color.blue(dropColor))
                                canvas.drawLine(px, py, px, py + d.len, strokePaint)
                            }
                        }
                        "cyber_grid_3d" -> {
                            strokePaint.strokeWidth = 2f
                            strokePaint.color = Color.argb(72, Color.red(accentColor), Color.green(accentColor), Color.blue(accentColor))
                            val horizon = h * 0.56f
                            for (i in -6..6) {
                                canvas.drawLine(cx + i * 24f, horizon, cx + i * 190f, h, strokePaint)
                            }
                            val offset = (t * 45f) % 70f
                            var y = horizon + offset
                            var step = 28f
                            while (y < h) {
                                canvas.drawLine(0f, y, w, y, strokePaint)
                                y += step
                                step *= 1.18f
                            }
                        }
                    }
                }

                // 4. Depth Wallpaper Clock Layering:
                // When depthEnabled is true & using a depth preset, clock renders BEHIND foreground depth subject!
                val isDepthPreset = style.startsWith("depth_")
                if (showClock && depthEnabled && isDepthPreset && customBg == null) {
                    drawClockLayer(canvas, w, h, cx, clockStyle, clockColor, accentColor, clockPosYFrac)
                    drawForegroundDepthSubject(canvas, style, w, h, cx, t, accentColor)
                } else {
                    if (isDepthPreset && customBg == null) {
                        drawForegroundDepthSubject(canvas, style, w, h, cx, t, accentColor)
                    }
                    if (showClock) {
                        drawClockLayer(canvas, w, h, cx, clockStyle, clockColor, accentColor, clockPosYFrac)
                    }
                }
            } catch (_: Exception) {
            } finally {
                if (canvas != null) {
                    try {
                        holder.unlockCanvasAndPost(canvas)
                    } catch (_: Exception) {}
                }
            }
        }
    }
}
