package com.amasi.rfidbridge

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import android.view.View
import android.widget.ImageButton
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.google.android.material.button.MaterialButton
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors

class BarcodeScannerActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "BarcodeScanner"
        const val EXTRA_BARCODE = "barcode"
    }

    private lateinit var previewView: PreviewView
    private lateinit var reticleView: View
    private lateinit var flashButton: ImageButton
    private val cameraExecutor = Executors.newSingleThreadExecutor()
    private var scanComplete = false
    private var camera: Camera? = null
    private var torchOn = false
    private var reticleAnimator: ObjectAnimator? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_barcode_scanner)

        previewView = findViewById(R.id.previewView)
        reticleView = findViewById(R.id.reticleView)
        flashButton = findViewById(R.id.flashButton)

        findViewById<ImageButton>(R.id.backButton).setOnClickListener {
            setResult(RESULT_CANCELED)
            finish()
        }

        findViewById<MaterialButton>(R.id.cancelButton).setOnClickListener {
            setResult(RESULT_CANCELED)
            finish()
        }

        flashButton.setOnClickListener {
            torchOn = !torchOn
            camera?.cameraControl?.enableTorch(torchOn)
            flashButton.alpha = if (torchOn) 1.0f else 0.6f
        }
        flashButton.alpha = 0.6f

        startReticlePulse()
        startCamera()
    }

    private fun startReticlePulse() {
        reticleAnimator = ObjectAnimator.ofFloat(reticleView, View.ALPHA, 1.0f, 0.4f).apply {
            duration = 1200
            repeatMode = ValueAnimator.REVERSE
            repeatCount = ValueAnimator.INFINITE
            start()
        }
    }

    private fun stopReticlePulse() {
        reticleAnimator?.cancel()
        reticleView.alpha = 1.0f
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder().build().also {
                it.surfaceProvider = previewView.surfaceProvider
            }

            val imageAnalysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also {
                    it.setAnalyzer(cameraExecutor, BarcodeAnalyzer { value ->
                        onBarcodeDetected(value)
                    })
                }

            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

            try {
                cameraProvider.unbindAll()
                camera = cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageAnalysis)
            } catch (e: Exception) {
                Log.e(TAG, "Camera bind failed", e)
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun fireScanFeedback() {
        val prefs = getSharedPreferences("rfid_bridge_prefs", Context.MODE_PRIVATE)

        if (prefs.getBoolean("sound_enabled", true)) {
            try {
                val toneGen = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100)
                toneGen.startTone(ToneGenerator.TONE_PROP_ACK, 150)
                Handler(Looper.getMainLooper()).postDelayed({ toneGen.release() }, 200)
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

    private fun onBarcodeDetected(value: String) {
        if (scanComplete) return
        scanComplete = true

        runOnUiThread {
            // Haptic + sound feedback
            fireScanFeedback()

            // Visual confirmation: reticle turns cyan, pulse stops
            stopReticlePulse()
            reticleView.setBackgroundResource(R.drawable.bg_reticle_active)

            // Brief delay for visual feedback before finishing
            Handler(Looper.getMainLooper()).postDelayed({
                val resultIntent = Intent().apply {
                    putExtra(EXTRA_BARCODE, value)
                }
                setResult(RESULT_OK, resultIntent)
                finish()
            }, 200)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        reticleAnimator?.cancel()
        cameraExecutor.shutdown()
    }

    private class BarcodeAnalyzer(
        private val onDetected: (String) -> Unit,
    ) : ImageAnalysis.Analyzer {

        private val scanner = BarcodeScanning.getClient()

        @ExperimentalGetImage
        override fun analyze(imageProxy: ImageProxy) {
            val mediaImage = imageProxy.image
            if (mediaImage == null) {
                imageProxy.close()
                return
            }

            val inputImage = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)

            scanner.process(inputImage)
                .addOnSuccessListener { barcodes ->
                    for (barcode in barcodes) {
                        val value = barcode.rawValue
                        if (!value.isNullOrEmpty()) {
                            onDetected(value)
                            return@addOnSuccessListener
                        }
                    }
                }
                .addOnCompleteListener {
                    imageProxy.close()
                }
        }
    }
}
