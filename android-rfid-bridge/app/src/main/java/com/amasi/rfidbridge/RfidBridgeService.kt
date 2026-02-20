package com.amasi.rfidbridge

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
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

    companion object {
        private const val TAG = "RfidBridgeService"
        private const val CHANNEL_ID = "rfid_bridge_channel"
        private const val NOTIFICATION_ID = 1

        @Volatile
        var currentState = State()
            private set
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

        // Initialize RFID manager
        val manager = RfidManager()
        rfidManager = manager

        val connected = manager.connect()
        Log.i(TAG, "RFID reader connected: $connected")

        // Start HTTP server
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

        try {
            server.start()
            Log.i(TAG, "HTTP server started on port 8080")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start HTTP server", e)
        }

        // Update notification and state
        val statusText = if (connected) "Reader connected — :8080 ready" else "Reader not connected — :8080 ready"
        updateNotification(statusText)
        currentState = State(connected = connected, scanning = false, tagCount = 0, power = manager.getPower())

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
