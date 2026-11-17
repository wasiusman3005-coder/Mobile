package com.qnexus.jarvis

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.service.wallpaper.WallpaperService
import android.view.SurfaceHolder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.random.Random

private data class Drop(var x: Float, var y: Float, var speed: Float, var len: Float, var alpha: Int)

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

        private val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        private val glowPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
        }
        private val particlePaint = Paint(Paint.ANTI_ALIAS_FLAG)
        private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textAlign = Paint.Align.CENTER
            typeface = Typeface.create("sans-serif-light", Typeface.BOLD)
        }
        private val subTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textAlign = Paint.Align.CENTER
            typeface = Typeface.MONOSPACE
        }

        private val drops = List(68) {
            Drop(
                Random.nextFloat(),
                Random.nextFloat(),
                0.28f + Random.nextFloat() * 0.65f,
                28f + Random.nextFloat() * 90f,
                70 + Random.nextInt(160)
            )
        }

        private val drawRunner = object : Runnable {
            override fun run() {
                drawFrame()
                if (visible) {
                    handler.postDelayed(this, 33L) // Smooth ~30fps battery-friendly live wallpaper
                }
            }
        }

        override fun onVisibilityChanged(visible: Boolean) {
            this.visible = visible
            if (visible) {
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
        }

        private fun parseColorSafe(hex: String?, fallback: Int): Int {
            return try {
                if (hex.isNullOrBlank()) fallback else Color.parseColor(hex)
            } catch (_: Exception) {
                fallback
            }
        }

        private fun drawFrame() {
            val holder = surfaceHolder
            var canvas: Canvas? = null
            try {
                canvas = holder.lockCanvas() ?: return
                val prefs = getSharedPreferences("WasuJarvisPrefs", Context.MODE_PRIVATE)
                val style = prefs.getString("live_wallpaper_style", "oneui9_aurora") ?: "oneui9_aurora"
                val accentColor = parseColorSafe(prefs.getString("oneui_accent_hex", "#00f0ff"), Color.parseColor("#00f0ff"))
                val clockColor = parseColorSafe(prefs.getString("oneui_clock_hex", "#e0f2fe"), Color.parseColor("#e0f2fe"))
                val showClock = prefs.getBoolean("wallpaper_show_clock", true)

                val t = (System.currentTimeMillis() - startTimeMs) / 1000f
                val w = canvas.width.toFloat()
                val h = canvas.height.toFloat()
                val cx = w / 2f
                val cy = h / 2f

                // 1. Base Gradient
                val (cTop, cBot) = when (style) {
                    "emerald_matrix" -> Color.parseColor("#02110b") to Color.parseColor("#041c13")
                    "solar_plasma" -> Color.parseColor("#18060d") to Color.parseColor("#250e04")
                    "deep_ocean" -> Color.parseColor("#020c1b") to Color.parseColor("#051e34")
                    "velvet_ripples" -> Color.parseColor("#140622") to Color.parseColor("#060b1e")
                    else -> Color.parseColor("#030714") to Color.parseColor("#0b112a")
                }
                bgPaint.shader = LinearGradient(0f, 0f, w, h, cTop, cBot, Shader.TileMode.CLAMP)
                canvas.drawRect(0f, 0f, w, h, bgPaint)

                // 2. Dynamic Aurora / Nebula Orbs
                val orb1X = cx + cos(t * 0.45f) * (w * 0.28f)
                val orb1Y = cy * 0.65f + sin(t * 0.38f) * (h * 0.14f)
                glowPaint.shader = RadialGradient(
                    orb1X, orb1Y, min(w, h) * 0.68f,
                    Color.argb(115, Color.red(accentColor), Color.green(accentColor), Color.blue(accentColor)),
                    Color.TRANSPARENT,
                    Shader.TileMode.CLAMP
                )
                canvas.drawCircle(orb1X, orb1Y, min(w, h) * 0.68f, glowPaint)

                val secColor = when (style) {
                    "emerald_matrix" -> Color.parseColor("#10b981")
                    "solar_plasma" -> Color.parseColor("#f59e0b")
                    "deep_ocean" -> Color.parseColor("#38bdf8")
                    else -> Color.parseColor("#a855f7")
                }
                val orb2X = cx + sin(t * 0.35f) * (w * 0.3f)
                val orb2Y = cy * 1.38f + cos(t * 0.42f) * (h * 0.12f)
                glowPaint.shader = RadialGradient(
                    orb2X, orb2Y, min(w, h) * 0.62f,
                    Color.argb(95, Color.red(secColor), Color.green(secColor), Color.blue(secColor)),
                    Color.TRANSPARENT,
                    Shader.TileMode.CLAMP
                )
                canvas.drawCircle(orb2X, orb2Y, min(w, h) * 0.62f, glowPaint)

                // 3. Style-specific Geometric Layer
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
                    "quantum_singularity", "jarvis_reactor_clock" -> {
                        val ringCenterY = if (showClock) cy * 1.12f else cy
                        val baseR = min(w, h) * 0.28f
                        for (rIdx in 0..3) {
                            val r = baseR * (0.58f + rIdx * 0.22f)
                            strokePaint.strokeWidth = (5 - rIdx).toFloat() * 1.8f
                            strokePaint.color = Color.argb(
                                185 - rIdx * 32,
                                Color.red(if (rIdx % 2 == 0) accentColor else secColor),
                                Color.green(if (rIdx % 2 == 0) accentColor else secColor),
                                Color.blue(if (rIdx % 2 == 0) accentColor else secColor)
                            )
                            val startAngle = (t * (28f + rIdx * 18f) * (if (rIdx % 2 == 0) 1 else -1)) % 360f
                            val rect = RectF(cx - r, ringCenterY - r, cx + r, ringCenterY + r)
                            canvas.drawArc(rect, startAngle, 235f, false, strokePaint)
                        }
                    }
                    else -> {
                        // Gentle floating prism waves & starlight particles
                        for (i in drops.indices) {
                            val d = drops[i]
                            val px = ((d.x + sin(t * 0.25f + i) * 0.04f) * w)
                            val py = ((d.y + t * 0.015f) % 1f) * h
                            particlePaint.color = Color.argb(d.alpha / 2, Color.red(accentColor), Color.green(accentColor), Color.blue(accentColor))
                            canvas.drawCircle(px, py, 2.5f + (i % 4), particlePaint)
                        }
                    }
                }

                // 4. Optional Live One UI 9 Wallpaper Clock
                if (showClock) {
                    val timeStr = SimpleDateFormat("hh:mm", Locale.getDefault()).format(Date())
                    val dateStr = SimpleDateFormat("EEE, d MMM", Locale.getDefault()).format(Date()).uppercase(Locale.US)
                    textPaint.textSize = min(w, h) * 0.165f
                    textPaint.color = clockColor
                    canvas.drawText(timeStr, cx, h * 0.24f, textPaint)

                    subTextPaint.textSize = min(w, h) * 0.032f
                    subTextPaint.color = Color.argb(210, Color.red(accentColor), Color.green(accentColor), Color.blue(accentColor))
                    canvas.drawText("$dateStr • WASU'S JARVIS ONE UI 9", cx, h * 0.29f, subTextPaint)
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
