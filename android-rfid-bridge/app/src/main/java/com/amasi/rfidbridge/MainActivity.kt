package com.amasi.rfidbridge

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager

class MainActivity : AppCompatActivity() {

    companion object {
        private const val NOTIFICATION_PERMISSION_CODE = 100
    }

    private lateinit var statusText: TextView
    private lateinit var serverUrlText: TextView
    private lateinit var powerText: TextView
    private lateinit var scanCountText: TextView
    private lateinit var toggleButton: Button

    private var serviceRunning = false

    private val statusReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val connected = intent.getBooleanExtra(RfidBridgeService.EXTRA_CONNECTED, false)
            val scanning = intent.getBooleanExtra(RfidBridgeService.EXTRA_SCANNING, false)
            val url = intent.getStringExtra(RfidBridgeService.EXTRA_SERVER_URL) ?: ""

            statusText.text = when {
                scanning -> "Scanning..."
                connected -> "Reader Connected"
                else -> "Reader Not Connected"
            }
            serverUrlText.text = url
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.statusText)
        serverUrlText = findViewById(R.id.serverUrlText)
        powerText = findViewById(R.id.powerText)
        scanCountText = findViewById(R.id.scanCountText)
        toggleButton = findViewById(R.id.toggleButton)

        toggleButton.setOnClickListener {
            if (serviceRunning) {
                stopBridgeService()
            } else {
                startBridgeService()
            }
        }

        // Request notification permission on Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    NOTIFICATION_PERMISSION_CODE,
                )
            }
        }

        // Auto-start the service
        startBridgeService()
    }

    override fun onResume() {
        super.onResume()
        LocalBroadcastManager.getInstance(this).registerReceiver(
            statusReceiver,
            IntentFilter(RfidBridgeService.ACTION_STATUS_UPDATE),
        )
    }

    override fun onPause() {
        super.onPause()
        LocalBroadcastManager.getInstance(this).unregisterReceiver(statusReceiver)
    }

    private fun startBridgeService() {
        val intent = Intent(this, RfidBridgeService::class.java)
        ContextCompat.startForegroundService(this, intent)
        serviceRunning = true
        toggleButton.text = "Stop Bridge"
        statusText.text = "Starting..."
    }

    private fun stopBridgeService() {
        stopService(Intent(this, RfidBridgeService::class.java))
        serviceRunning = false
        toggleButton.text = "Start Bridge"
        statusText.text = "Stopped"
        serverUrlText.text = ""
    }
}
