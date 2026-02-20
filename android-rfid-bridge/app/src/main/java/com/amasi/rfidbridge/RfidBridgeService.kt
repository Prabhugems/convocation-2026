package com.amasi.rfidbridge

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager

/**
 * Foreground service that keeps the HTTP server and RFID reader alive
 * while the app is in the background.
 */
class RfidBridgeService : Service() {

    companion object {
        private const val TAG = "RfidBridgeService"
        private const val CHANNEL_ID = "rfid_bridge_channel"
        private const val NOTIFICATION_ID = 1
        const val ACTION_STATUS_UPDATE = "com.amasi.rfidbridge.STATUS_UPDATE"
        const val EXTRA_CONNECTED = "connected"
        const val EXTRA_SCANNING = "scanning"
        const val EXTRA_SERVER_URL = "server_url"
    }

    private var rfidManager: RfidManager? = null
    private var httpServer: RfidHttpServer? = null

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
        try {
            server.start()
            Log.i(TAG, "HTTP server started on port 8080")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start HTTP server", e)
        }

        // Update notification and broadcast status
        val statusText = if (connected) "Reader connected — :8080 ready" else "Reader not connected — :8080 ready"
        updateNotification(statusText)
        broadcastStatus(connected, false)

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

    // ---- Broadcast to MainActivity ----

    private fun broadcastStatus(connected: Boolean, scanning: Boolean) {
        val intent = Intent(ACTION_STATUS_UPDATE).apply {
            putExtra(EXTRA_CONNECTED, connected)
            putExtra(EXTRA_SCANNING, scanning)
            putExtra(EXTRA_SERVER_URL, "http://localhost:8080")
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }
}
