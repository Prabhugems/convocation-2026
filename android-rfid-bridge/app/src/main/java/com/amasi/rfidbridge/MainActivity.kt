package com.amasi.rfidbridge

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.content.Intent
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    companion object {
        private const val NOTIFICATION_PERMISSION_CODE = 100
        private const val CAMERA_PERMISSION_CODE = 101
    }

    private lateinit var statusText: TextView
    private lateinit var serverUrlText: TextView
    private lateinit var powerText: TextView
    private lateinit var scanCountText: TextView
    private lateinit var toggleButton: Button
    private lateinit var scanBarcodeButton: Button
    private lateinit var barcodeScannerLauncher: ActivityResultLauncher<Intent>

    private var serviceRunning = false
    private val handler = Handler(Looper.getMainLooper())
    private val uiUpdater = object : Runnable {
        override fun run() {
            val state = RfidBridgeService.currentState
            statusText.text = when {
                state.scanning -> "Scanning — ${state.tagCount} tags"
                state.connected -> "Reader Connected"
                else -> "Reader Not Connected"
            }
            serverUrlText.text = if (state.connected) "http://localhost:8080" else ""
            scanCountText.text = state.tagCount.toString()
            if (state.power > 0) {
                powerText.text = "${state.power} dBm"
            }
            handler.postDelayed(this, 500)
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
        scanBarcodeButton = findViewById(R.id.scanBarcodeButton)

        barcodeScannerLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            if (result.resultCode == RESULT_OK) {
                val value = result.data?.getStringExtra(BarcodeScannerActivity.EXTRA_BARCODE)
                if (!value.isNullOrEmpty()) {
                    RfidBridgeService.lastBarcodeResult =
                        RfidBridgeService.BarcodeResult(value, System.currentTimeMillis())
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
