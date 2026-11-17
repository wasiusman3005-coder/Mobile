package com.qnexus.jarvis

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.LocationManager
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * Lightweight hardware sensor + speed classifier that detects real-time user posture/activity:
 * "lying_sleeping", "sitting_stationary", "walking", "riding_bike"
 */
class UserActivityMonitor(private val context: Context) : SensorEventListener {

    companion object {
        private const val PREFS = "WasuJarvisPrefs"
        const val STATE_LYING_SLEEPING = "lying_sleeping"
        const val STATE_SITTING = "sitting_stationary"
        const val STATE_WALKING = "walking"
        const val STATE_RIDING_BIKE = "riding_bike"
        const val STATE_UNKNOWN = "unknown"

        @Volatile
        var currentActivityState: String = STATE_UNKNOWN
            private set

        fun getLastKnownState(context: Context): String {
            return try {
                if (currentActivityState != STATE_UNKNOWN) return currentActivityState
                context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .getString("user_activity_state", STATE_SITTING) ?: STATE_SITTING
            } catch (_: Exception) {
                STATE_SITTING
            }
        }
    }

    private var sensorManager: SensorManager? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var started = false

    private var lastAccelMag = 9.8f
    private var movementAccum = 0f
    private var sampleCount = 0
    private var flatTimeMs = 0L
    private var lastSampleMs = 0L
    private var lastLightLux = 50f
    private var isNearFace = false
    private var recentSteps = 0

    private val evaluateRunnable = object : Runnable {
        override fun run() {
            if (!started) return
            evaluateState()
            mainHandler.postDelayed(this, 6000L)
        }
    }

    fun start() {
        if (started) return
        started = true
        try {
            sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
            val sm = sensorManager
            if (sm != null) {
                sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)?.let {
                    sm.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
                }
                sm.getDefaultSensor(Sensor.TYPE_LIGHT)?.let {
                    sm.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
                }
                sm.getDefaultSensor(Sensor.TYPE_PROXIMITY)?.let {
                    sm.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
                }
                sm.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)?.let {
                    sm.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
                }
            }
            lastSampleMs = System.currentTimeMillis()
            mainHandler.postDelayed(evaluateRunnable, 3500L)
        } catch (_: Exception) {}
    }

    fun stop() {
        started = false
        mainHandler.removeCallbacksAndMessages(null)
        try {
            sensorManager?.unregisterListener(this)
        } catch (_: Exception) {}
        sensorManager = null
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null) return
        val now = System.currentTimeMillis()
        when (event.sensor.type) {
            Sensor.TYPE_ACCELEROMETER -> {
                val x = event.values[0]
                val y = event.values[1]
                val z = event.values[2]
                val mag = sqrt(x * x + y * y + z * z)
                val delta = abs(mag - lastAccelMag)
                lastAccelMag = mag
                movementAccum += delta
                sampleCount++

                val dt = if (lastSampleMs > 0L) (now - lastSampleMs).coerceIn(0L, 1500L) else 0L
                lastSampleMs = now
                // Phone lying nearly horizontal / still on bed or table
                val isFlat = abs(z) > 8.6f && abs(x) < 3.2f && abs(y) < 3.2f && delta < 0.25f
                if (isFlat) {
                    flatTimeMs = (flatTimeMs + dt).coerceAtMost(600_000L)
                } else if (delta > 0.65f) {
                    flatTimeMs = 0L
                }
            }
            Sensor.TYPE_LIGHT -> {
                lastLightLux = event.values[0]
            }
            Sensor.TYPE_PROXIMITY -> {
                isNearFace = event.values[0] < (event.sensor.maximumRange * 0.5f)
            }
            Sensor.TYPE_STEP_DETECTOR -> {
                recentSteps++
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    private fun readSpeedMetersPerSec(): Float {
        return try {
            val hasCoarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
            val hasFine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            if (!hasCoarse && !hasFine) return -1f
            val lm = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return -1f
            val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            var bestSpeed = -1f
            for (p in providers) {
                val loc = try { lm.getLastKnownLocation(p) } catch (_: Exception) { null } ?: continue
                if (System.currentTimeMillis() - loc.time < 120_000L && loc.hasSpeed()) {
                    bestSpeed = maxOf(bestSpeed, loc.speed)
                }
            }
            bestSpeed
        } catch (_: Exception) {
            -1f
        }
    }

    private fun evaluateState() {
        val avgDelta = if (sampleCount > 0) movementAccum / sampleCount else 0f
        movementAccum = 0f
        sampleCount = 0
        val steps = recentSteps
        recentSteps = 0

        val speedMps = readSpeedMetersPerSec()
        val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
        val isNightHours = hour >= 22 || hour <= 6

        val nextState = when {
            speedMps >= 4.2f -> STATE_RIDING_BIKE // >15 km/h (bike / vehicle)
            steps >= 3 || avgDelta > 0.78f -> STATE_WALKING
            flatTimeMs >= 90_000L && avgDelta < 0.18f && (isNightHours || lastLightLux < 8f || isNearFace) -> STATE_LYING_SLEEPING
            else -> STATE_SITTING
        }

        val changed = nextState != currentActivityState
        currentActivityState = nextState
        try {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString("user_activity_state", nextState)
                .apply()
        } catch (_: Exception) {}

        if (changed) {
            QNexusPlugin.instance?.emitUserActivityEvent(nextState, speedMps)
        }
    }
}
