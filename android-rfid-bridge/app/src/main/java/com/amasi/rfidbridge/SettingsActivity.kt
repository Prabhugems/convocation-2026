package com.amasi.rfidbridge

import android.content.Context
import android.os.Bundle
import android.util.Log
import android.widget.EditText
import android.widget.ImageButton
import android.widget.SeekBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SwitchCompat
import java.net.HttpURLConnection
import java.net.URL

class SettingsActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "SettingsActivity"
        private const val PREFS_NAME = "rfid_bridge_prefs"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        // Back button
        findViewById<ImageButton>(R.id.backButton).setOnClickListener {
            finish()
        }

        // Sound toggle
        val soundSwitch = findViewById<SwitchCompat>(R.id.soundSwitch)
        soundSwitch.isChecked = prefs.getBoolean("sound_enabled", true)
        soundSwitch.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean("sound_enabled", isChecked).apply()
        }

        // Vibration toggle
        val vibrationSwitch = findViewById<SwitchCompat>(R.id.vibrationSwitch)
        vibrationSwitch.isChecked = prefs.getBoolean("vibration_enabled", true)
        vibrationSwitch.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean("vibration_enabled", isChecked).apply()
        }

        // Web Server URL
        val webUrlInput = findViewById<EditText>(R.id.webServerUrlInput)
        webUrlInput.setText(prefs.getString("web_server_url", "https://convocation-2026.vercel.app"))
        webUrlInput.setOnFocusChangeListener { _, hasFocus ->
            if (!hasFocus) {
                val url = webUrlInput.text.toString().trim()
                if (url.isNotEmpty()) {
                    prefs.edit().putString("web_server_url", url).apply()
                }
            }
        }

        // Power level SeekBar
        val powerLabel = findViewById<TextView>(R.id.powerLevelLabel)
        val powerSeekBar = findViewById<SeekBar>(R.id.powerSeekBar)
        val savedPower = prefs.getInt("power_level", 26)
        powerSeekBar.progress = savedPower
        powerLabel.text = "$savedPower dBm"

        powerSeekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                val level = progress.coerceIn(1, 33)
                powerLabel.text = "$level dBm"
            }

            override fun onStartTrackingTouch(seekBar: SeekBar?) {}

            override fun onStopTrackingTouch(seekBar: SeekBar?) {
                val level = (seekBar?.progress ?: 26).coerceIn(1, 33)
                prefs.edit().putInt("power_level", level).apply()
                setPowerViaApi(level)
            }
        })
    }

    private fun setPowerViaApi(level: Int) {
        Thread {
            try {
                val url = URL("http://localhost:8080/api/power")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true
                conn.outputStream.use { os ->
                    os.write("""{"power":$level}""".toByteArray())
                }
                val code = conn.responseCode
                Log.i(TAG, "Set power to $level dBm — HTTP $code")
                conn.disconnect()
            } catch (e: Exception) {
                Log.w(TAG, "Failed to set power via API", e)
            }
        }.start()
    }
}
