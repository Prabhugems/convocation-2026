package com.amasi.rfidbridge

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.content.Intent
import android.view.View
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
        private const val NOTIFICATION_PERMISSION_CODE = 100
        private const val CAMERA_PERMISSION_CODE = 101
    }

    private lateinit var statusDot: View
    private lateinit var statusText: TextView
    private lateinit var serverUrlText: TextView
    private lateinit var powerText: TextView
    private lateinit var scanCountText: TextView
    private lateinit var toggleButton: MaterialButton
    private lateinit var scanBarcodeButton: MaterialButton
    private lateinit var lastBarcodeContainer: LinearLayout
    private lateinit var lastBarcodeText: TextView
    private lateinit var barcodeScannerLauncher: ActivityResultLauncher<Intent>

    private var serviceRunning = false
    private val handler = Handler(Looper.getMainLooper())
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
                lastBarcodeText.text = barcode.value
            }

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
        scanBarcodeButton = findViewById(R.id.scanBarcodeButton)
        lastBarcodeContainer = findViewById(R.id.lastBarcodeContainer)
        lastBarcodeText = findViewById(R.id.lastBarcodeText)

        barcodeScannerLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            if (result.resultCode == RESULT_OK) {
                val value = result.data?.getStringExtra(BarcodeScannerActivity.EXTRA_BARCODE)
                if (!value.isNullOrEmpty()) {
                    RfidBridgeService.lastBarcodeResult =
                        RfidBridgeService.BarcodeResult(value, System.currentTimeMillis())
                    lastBarcodeContainer.visibility = View.VISIBLE
                    lastBarcodeText.text = value
                    Toast.makeText(this, "Scanned: $value", Toast.LENGTH_LONG).show()
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
