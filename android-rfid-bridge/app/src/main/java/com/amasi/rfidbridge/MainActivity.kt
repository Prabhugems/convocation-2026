package com.amasi.rfidbridge

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.drawable.GradientDrawable
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.content.Intent
import android.util.Log
import android.view.View
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.material.button.MaterialButton

class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "MainActivity"
        private const val NOTIFICATION_PERMISSION_CODE = 100
        private const val CAMERA_PERMISSION_CODE = 101
    }

    private lateinit var statusDot: View
    private lateinit var statusText: TextView
    private lateinit var serverUrlText: TextView
    private lateinit var powerText: TextView
    private lateinit var scanCountText: TextView
    private lateinit var toggleButton: MaterialButton
    private lateinit var rfidScanButton: MaterialButton
    private lateinit var rfidScanStatusText: TextView
    private lateinit var scanBarcodeButton: MaterialButton
    private lateinit var lastBarcodeContainer: LinearLayout
    private lateinit var lastBarcodeText: TextView
    private lateinit var scanHistoryContainer: LinearLayout
    private lateinit var barcodeScannerLauncher: ActivityResultLauncher<Intent>

    private var serviceRunning = false
    private var rfidScanning = false
    private var wasScanning = false // track scan-session start for one-shot feedback
    private val handler = Handler(Looper.getMainLooper())

    private fun fireRfidScanFeedback() {
        val prefs = getSharedPreferences("rfid_bridge_prefs", Context.MODE_PRIVATE)

        if (prefs.getBoolean("sound_enabled", true)) {
            try {
                val toneGen = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100)
                toneGen.startTone(ToneGenerator.TONE_PROP_ACK, 150)
                handler.postDelayed({ toneGen.release() }, 200)
            } catch (e: Exception) {
                Log.w(TAG, "Tone playback failed", e)
            }
        }

        if (prefs.getBoolean("vibration_enabled", true)) {
            try {
                val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val mgr = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                    mgr.defaultVibrator
                } else {
                    @Suppress("DEPRECATION")
                    getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(100, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(100)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Vibration failed", e)
            }
        }
    }

    private fun formatRelativeTime(timestamp: Long): String {
        val diff = System.currentTimeMillis() - timestamp
        val seconds = diff / 1000
        val minutes = seconds / 60
        val hours = minutes / 60
        return when {
            seconds < 10 -> getString(R.string.scan_history_just_now)
            seconds < 60 -> "${seconds}s ago"
            minutes < 60 -> "${minutes}m ago"
            hours < 24 -> "${hours}h ago"
            else -> "${hours / 24}d ago"
        }
    }

    private fun updateScanHistory() {
        scanHistoryContainer.removeAllViews()
        val barcodes = RfidBridgeService.recentBarcodes
        if (barcodes.isEmpty()) {
            val empty = TextView(this).apply {
                text = getString(R.string.scan_history_empty)
                setTextColor(ContextCompat.getColor(this@MainActivity, R.color.text_secondary))
                textSize = 14f
                setPadding(0, 16, 0, 16)
            }
            scanHistoryContainer.addView(empty)
            return
        }
        for (barcode in barcodes) {
            val row = layoutInflater.inflate(R.layout.item_barcode_history, scanHistoryContainer, false)
            row.findViewById<TextView>(R.id.historyBarcodeText).text = barcode.displayValue
            row.findViewById<TextView>(R.id.historyTimeText).text = formatRelativeTime(barcode.timestamp)
            scanHistoryContainer.addView(row)
        }
    }

    private val uiUpdater = object : Runnable {
        override fun run() {
            val state = RfidBridgeService.currentState
            statusText.text = when {
                state.scanning -> "Scanning — ${state.tagCount} tags"
                state.connected -> getString(R.string.status_connected)
                else -> getString(R.string.status_disconnected)
            }
            serverUrlText.text = if (state.connected) "http://localhost:8080" else "—"
            scanCountText.text = state.tagCount.toString()
            if (state.power > 0) {
                powerText.text = "${state.power} dBm"
            }

            // One-shot haptic/sound on scan session start
            if (state.scanning && !wasScanning) {
                fireRfidScanFeedback()
            }
            wasScanning = state.scanning

            // Sync RFID scan button state with actual scanning state
            if (state.scanning && !rfidScanning) {
                rfidScanning = true
                rfidScanButton.text = getString(R.string.btn_stop_rfid_scan)
                rfidScanButton.backgroundTintList = android.content.res.ColorStateList.valueOf(
                    ContextCompat.getColor(this@MainActivity, R.color.status_red)
                )
                rfidScanStatusText.text = "Scanning — ${state.tagCount} tags"
                rfidScanStatusText.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.status_amber))
            } else if (!state.scanning && rfidScanning) {
                rfidScanning = false
                rfidScanButton.text = getString(R.string.btn_start_rfid_scan)
                rfidScanButton.backgroundTintList = android.content.res.ColorStateList.valueOf(
                    ContextCompat.getColor(this@MainActivity, R.color.cyan_dark)
                )
                rfidScanStatusText.text = getString(R.string.rfid_scan_idle)
                rfidScanStatusText.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.text_secondary))
            } else if (state.scanning) {
                rfidScanStatusText.text = "Scanning — ${state.tagCount} tags"
            }

            // Drive status dot color
            val dotColor = when {
                state.scanning -> ContextCompat.getColor(this@MainActivity, R.color.status_amber)
                state.connected -> ContextCompat.getColor(this@MainActivity, R.color.status_green)
                else -> ContextCompat.getColor(this@MainActivity, R.color.status_red)
            }
            (statusDot.background as? GradientDrawable)?.setColor(dotColor)

            // Show last barcode if available
            val barcode = RfidBridgeService.lastBarcodeResult
            if (barcode != null) {
                lastBarcodeContainer.visibility = View.VISIBLE
                lastBarcodeText.text = barcode.displayValue
            }

            // Update scan history timestamps
            updateScanHistory()

            handler.postDelayed(this, 500)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusDot = findViewById(R.id.statusDot)
        statusText = findViewById(R.id.statusText)
        serverUrlText = findViewById(R.id.serverUrlText)
        powerText = findViewById(R.id.powerText)
        scanCountText = findViewById(R.id.scanCountText)
        toggleButton = findViewById(R.id.toggleButton)
        rfidScanButton = findViewById(R.id.rfidScanButton)
        rfidScanStatusText = findViewById(R.id.rfidScanStatusText)
        scanBarcodeButton = findViewById(R.id.scanBarcodeButton)
        lastBarcodeContainer = findViewById(R.id.lastBarcodeContainer)
        lastBarcodeText = findViewById(R.id.lastBarcodeText)
        scanHistoryContainer = findViewById(R.id.scanHistoryContainer)

        // Settings gear button
        findViewById<ImageButton>(R.id.settingsButton).setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }

        barcodeScannerLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            if (result.resultCode == RESULT_OK) {
                val value = result.data?.getStringExtra(BarcodeScannerActivity.EXTRA_BARCODE)
                if (!value.isNullOrEmpty()) {
                    val barcodeResult = RfidBridgeService.BarcodeResult(value, System.currentTimeMillis())
                    RfidBridgeService.lastBarcodeResult = barcodeResult
                    RfidBridgeService.addRecentBarcode(barcodeResult)
                    lastBarcodeContainer.visibility = View.VISIBLE
                    lastBarcodeText.text = barcodeResult.displayValue
                    Toast.makeText(this, "Scanned: ${barcodeResult.displayValue}", Toast.LENGTH_LONG).show()

                    // Resolve Tito ticket slug to graduate name async
                    val slug = barcodeResult.ticketSlug
                    if (slug != null) {
                        resolveTicketSlug(barcodeResult, slug)
                    }
                }
            }
        }

        toggleButton.setOnClickListener {
            if (serviceRunning) {
                stopBridgeService()
            } else {
                startBridgeService()
            }
        }

        rfidScanButton.setOnClickListener {
            if (rfidScanning) {
                stopRfidScan()
            } else {
                startRfidScan()
            }
        }

        scanBarcodeButton.setOnClickListener {
            launchBarcodeScanner()
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

    override fun onStart() {
        super.onStart()
        handler.post(uiUpdater)
    }

    override fun onStop() {
        super.onStop()
        handler.removeCallbacks(uiUpdater)
    }

    private fun startBridgeService() {
        val intent = Intent(this, RfidBridgeService::class.java)
        ContextCompat.startForegroundService(this, intent)
        serviceRunning = true
        toggleButton.text = getString(R.string.btn_stop_bridge)
        toggleButton.setTextColor(ContextCompat.getColor(this, R.color.status_red))
        toggleButton.strokeColor = android.content.res.ColorStateList.valueOf(
            ContextCompat.getColor(this, R.color.status_red)
        )
        statusText.text = getString(R.string.status_starting)
    }

    private fun stopBridgeService() {
        stopService(Intent(this, RfidBridgeService::class.java))
        serviceRunning = false
        toggleButton.text = getString(R.string.btn_start_bridge)
        toggleButton.setTextColor(ContextCompat.getColor(this, R.color.status_green))
        toggleButton.strokeColor = android.content.res.ColorStateList.valueOf(
            ContextCompat.getColor(this, R.color.status_green)
        )
        statusText.text = getString(R.string.status_stopped)
        serverUrlText.text = "—"
        (statusDot.background as? GradientDrawable)?.setColor(
            ContextCompat.getColor(this, R.color.status_red)
        )
    }

    private fun startRfidScan() {
        rfidScanning = true
        rfidScanButton.text = getString(R.string.btn_stop_rfid_scan)
        rfidScanButton.backgroundTintList = android.content.res.ColorStateList.valueOf(
            ContextCompat.getColor(this, R.color.status_red)
        )
        rfidScanStatusText.text = getString(R.string.rfid_scan_active)
        rfidScanStatusText.setTextColor(ContextCompat.getColor(this, R.color.status_amber))
        Thread {
            try {
                val url = java.net.URL("http://localhost:8080/api/inventory/start")
                val conn = url.openConnection() as java.net.HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.connectTimeout = 3000
                conn.readTimeout = 3000
                val code = conn.responseCode
                Log.i(TAG, "Start RFID scan — HTTP $code")
                conn.disconnect()
            } catch (e: Exception) {
                Log.w(TAG, "Failed to start RFID scan", e)
                handler.post {
                    Toast.makeText(this, "Failed to start scan", Toast.LENGTH_SHORT).show()
                    rfidScanning = false
                    rfidScanButton.text = getString(R.string.btn_start_rfid_scan)
                    rfidScanButton.backgroundTintList = android.content.res.ColorStateList.valueOf(
                        ContextCompat.getColor(this, R.color.cyan_dark)
                    )
                    rfidScanStatusText.text = getString(R.string.rfid_scan_idle)
                    rfidScanStatusText.setTextColor(ContextCompat.getColor(this, R.color.text_secondary))
                }
            }
        }.start()
    }

    private fun stopRfidScan() {
        rfidScanning = false
        rfidScanButton.text = getString(R.string.btn_start_rfid_scan)
        rfidScanStatusText.text = getString(R.string.rfid_scan_idle)
        rfidScanStatusText.setTextColor(ContextCompat.getColor(this, R.color.text_secondary))
        Thread {
            try {
                val url = java.net.URL("http://localhost:8080/api/inventory/stop")
                val conn = url.openConnection() as java.net.HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.connectTimeout = 3000
                conn.readTimeout = 3000
                val code = conn.responseCode
                Log.i(TAG, "Stop RFID scan — HTTP $code")
                conn.disconnect()
            } catch (e: Exception) {
                Log.w(TAG, "Failed to stop RFID scan", e)
            }
        }.start()
    }

    private fun resolveTicketSlug(barcodeResult: RfidBridgeService.BarcodeResult, slug: String) {
        Thread {
            try {
                val url = java.net.URL(
                    "https://api.tito.io/v3/amasi/convocation-2026-kolkata/tickets/$slug"
                )
                val conn = url.openConnection() as java.net.HttpURLConnection
                conn.requestMethod = "GET"
                conn.setRequestProperty("Authorization", "Token token=secret_sUEj6AsYSssYRQjuStGe")
                conn.setRequestProperty("Accept", "application/json")
                conn.connectTimeout = 5000
                conn.readTimeout = 5000

                if (conn.responseCode == 200) {
                    val json = conn.inputStream.bufferedReader().readText()
                    // Extract name and tags (convocation number) from JSON
                    val nameMatch = Regex("\"first_name\"\\s*:\\s*\"([^\"]+)\"").find(json)
                    val lastMatch = Regex("\"last_name\"\\s*:\\s*\"([^\"]+)\"").find(json)
                    val tagsMatch = Regex("\"tags\"\\s*:\\s*\"([^\"]+)\"").find(json)
                    val firstName = nameMatch?.groupValues?.get(1) ?: ""
                    val lastName = lastMatch?.groupValues?.get(1) ?: ""
                    val convocationNum = tagsMatch?.groupValues?.get(1)?.uppercase() ?: ""
                    val fullName = "$firstName $lastName".trim()

                    if (convocationNum.isNotEmpty() || fullName.isNotEmpty()) {
                        // Show convocation number first, then name
                        val display = when {
                            convocationNum.isNotEmpty() && fullName.isNotEmpty() -> "$convocationNum — $fullName"
                            convocationNum.isNotEmpty() -> convocationNum
                            else -> fullName
                        }
                        barcodeResult.resolvedDisplay = display
                        handler.post {
                            lastBarcodeText.text = barcodeResult.displayValue
                        }
                        Log.i(TAG, "Resolved $slug -> $display")
                    }
                }
                conn.disconnect()
            } catch (e: Exception) {
                Log.w(TAG, "Failed to resolve ticket slug: $slug", e)
            }
        }.start()
    }

    private fun launchBarcodeScanner() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED
        ) {
            barcodeScannerLauncher.launch(Intent(this, BarcodeScannerActivity::class.java))
        } else {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.CAMERA),
                CAMERA_PERMISSION_CODE,
            )
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == CAMERA_PERMISSION_CODE &&
            grantResults.isNotEmpty() &&
            grantResults[0] == PackageManager.PERMISSION_GRANTED
        ) {
            barcodeScannerLauncher.launch(Intent(this, BarcodeScannerActivity::class.java))
        }
    }
}
