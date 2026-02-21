package com.amasi.rfidbridge

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Foreground service that keeps the HTTP server and RFID reader alive
 * while the app is in the background.
 */
class RfidBridgeService : Service() {

    data class State(
        val connected: Boolean = false,
        val scanning: Boolean = false,
        val tagCount: Long = 0,
        val power: Int = 0,
    )

    data class BarcodeResult(val value: String, val timestamp: Long) {
        /** Resolved graduate name or convocation number (set async after lookup) */
        @Volatile
        var resolvedDisplay: String? = null

        /** Extract convocation number or ticket ID from QR URL */
        val ticketSlug: String?
            get() {
                try {
                    if (value.startsWith("http://") || value.startsWith("https://")) {
                        val path = Uri.parse(value).path ?: ""
                        val match = Regex("(?:tickets?/)([^/]+)$").find(path)
                        if (match != null) return match.groupValues[1]
                    }
                } catch (_: Exception) {}
                return null
            }

        val displayValue: String
            get() {
                // Show resolved name if available
                resolvedDisplay?.let { return it }
                try {
                    if (value.startsWith("http://") || value.startsWith("https://")) {
                        val uri = Uri.parse(value)

                        // Track URL: ?q=118AEC1001
                        val q = uri.getQueryParameter("q")
                        if (!q.isNullOrEmpty()) return q.uppercase()

                        // Tito ticket URL — show "Resolving..." while looking up
                        val slug = ticketSlug
                        if (slug != null) return "Resolving…"
                    }
                } catch (_: Exception) {}
                return value
            }
    }

    companion object {
        private const val TAG = "RfidBridgeService"
        private const val CHANNEL_ID = "rfid_bridge_channel"
        private const val NOTIFICATION_ID = 1

        @Volatile
        var currentState = State()
            private set

        @Volatile
        var lastBarcodeResult: BarcodeResult? = null

        private const val MAX_RECENT_BARCODES = 10
        val recentBarcodes: MutableList<BarcodeResult> = mutableListOf()

        fun addRecentBarcode(result: BarcodeResult) {
            synchronized(recentBarcodes) {
                recentBarcodes.add(0, result)
                if (recentBarcodes.size > MAX_RECENT_BARCODES) {
                    recentBarcodes.removeAt(recentBarcodes.size - 1)
                }
            }
        }
    }

    private var rfidManager: RfidManager? = null
    private var httpServer: RfidHttpServer? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var lastBroadcastCount = 0L

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification("Starting..."))

        // Initialize RFID manager — don't crash if hardware is unavailable
        var connected = false
        val manager = try {
            val m = RfidManager()
            connected = m.connect()
            Log.i(TAG, "RFID reader connected: $connected")
            m
        } catch (e: Exception) {
            Log.e(TAG, "RFID hardware init failed — running without reader", e)
            null
        }
        rfidManager = manager

        // Start HTTP server (works even without RFID hardware)
        val server = RfidHttpServer(manager)
        httpServer = server

        // Wire up scan count updates — throttle notification to every 50 reads
        server.onScanCountUpdated = { count ->
            currentState = currentState.copy(scanning = true, tagCount = count)
            if (count - lastBroadcastCount >= 50 || count <= 1) {
                lastBroadcastCount = count
                mainHandler.post {
                    updateNotification("Scanning — $count tags read")
                }
            }
        }

        var serverStarted = false
        try {
            server.start()
            serverStarted = true
            Log.i(TAG, "HTTP server started on port 8080")
        } catch (e: java.net.BindException) {
            // Port 8080 is stuck from a previous session — retry after a brief wait
            Log.w(TAG, "Port 8080 in use, retrying in 2s...", e)
            try {
                Thread.sleep(2000)
                server.start()
                serverStarted = true
                Log.i(TAG, "HTTP server started on port 8080 (retry)")
            } catch (e2: Exception) {
                Log.e(TAG, "Failed to start HTTP server on retry", e2)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start HTTP server", e)
        }

        // Update notification and state
        val statusText = if (!serverStarted) "Server failed — restart app"
            else if (connected) "Reader connected — :8080 ready"
            else "Reader not connected — :8080 ready"
        updateNotification(statusText)
        currentState = State(connected = connected, scanning = false, tagCount = 0, power = manager?.getPower() ?: 0)

        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            httpServer?.stop()
            Log.i(TAG, "HTTP server stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping server", e)
        }
        try {
            rfidManager?.disconnect()
            Log.i(TAG, "RFID reader disconnected")
        } catch (e: Exception) {
            Log.e(TAG, "Error disconnecting reader", e)
        }
        rfidManager = null
        httpServer = null
        currentState = State()
        recentBarcodes.clear()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ---- Notifications ----

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "RFID Bridge Service",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Keeps the RFID reader bridge running"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("RFID Bridge")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(text: String) {
        val notification = buildNotification(text)
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, notification)
    }

}
