package com.amasi.rfidbridge

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.util.Log
import android.view.View
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.floatingactionbutton.FloatingActionButton
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class TagListActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "TagListActivity"
    }

    private lateinit var wifiIpText: TextView
    private lateinit var tagProgressText: TextView
    private lateinit var resolvedText: TextView
    private lateinit var tagProgressBar: ProgressBar
    private lateinit var tagRecyclerView: RecyclerView
    private lateinit var emptyText: TextView
    private lateinit var exportFab: FloatingActionButton
    private lateinit var adapter: TagListAdapter

    private val handler = Handler(Looper.getMainLooper())

    private val uiUpdater = object : Runnable {
        override fun run() {
            refreshUI()
            handler.postDelayed(this, 500)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_tag_list)

        wifiIpText = findViewById(R.id.wifiIpText)
        tagProgressText = findViewById(R.id.tagProgressText)
        resolvedText = findViewById(R.id.resolvedText)
        tagProgressBar = findViewById(R.id.tagProgressBar)
        tagRecyclerView = findViewById(R.id.tagRecyclerView)
        emptyText = findViewById(R.id.emptyText)
        exportFab = findViewById(R.id.exportFab)

        findViewById<ImageButton>(R.id.backButton).setOnClickListener { finish() }

        adapter = TagListAdapter { tag ->
            val intent = Intent(this, TagDetailActivity::class.java)
            intent.putExtra("epc", tag.epc)
            startActivity(intent)
        }
        tagRecyclerView.layoutManager = LinearLayoutManager(this)
        tagRecyclerView.adapter = adapter

        exportFab.setOnClickListener { exportCsv() }

        // Show WiFi IP
        wifiIpText.text = getWifiIpAddress()
    }

    override fun onStart() {
        super.onStart()
        handler.post(uiUpdater)
    }

    override fun onStop() {
        super.onStop()
        handler.removeCallbacks(uiUpdater)
    }

    private fun refreshUI() {
        val tags = TagRepository.allTags()
        val unique = TagRepository.uniqueCount
        val expected = TagRepository.expectedTotal
        val resolved = TagRepository.resolvedCount

        tagProgressText.text = "$unique / $expected tags"
        resolvedText.text = "$resolved resolved"
        tagProgressBar.max = expected
        tagProgressBar.progress = unique

        if (tags.isEmpty()) {
            emptyText.visibility = View.VISIBLE
            tagRecyclerView.visibility = View.GONE
        } else {
            emptyText.visibility = View.GONE
            tagRecyclerView.visibility = View.VISIBLE
            adapter.submitList(tags)
        }
    }

    @Suppress("DEPRECATION")
    private fun getWifiIpAddress(): String {
        try {
            val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            val ip = wifiManager.connectionInfo.ipAddress
            if (ip == 0) return "No WiFi"
            val ipStr = String.format(
                "%d.%d.%d.%d",
                ip and 0xff, ip shr 8 and 0xff, ip shr 16 and 0xff, ip shr 24 and 0xff,
            )
            return "$ipStr:8080"
        } catch (e: Exception) {
            return "Unknown"
        }
    }

    private fun exportCsv() {
        val tags = TagRepository.allTags()
        if (tags.isEmpty()) {
            Toast.makeText(this, "No tags to export", Toast.LENGTH_SHORT).show()
            return
        }

        val dateFormat = SimpleDateFormat("yyyy-MM-dd_HH-mm-ss", Locale.US)
        val timestamp = dateFormat.format(Date())
        val fileName = "rfid_tags_$timestamp.csv"

        val csv = buildString {
            appendLine("EPC,Convocation Number,Graduate Name,Status,Type,Station,RSSI,Read Count,First Seen,Last Seen")
            val timeFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
            for (tag in tags) {
                appendLine(
                    listOf(
                        tag.epc,
                        tag.convocationNumber ?: "",
                        tag.graduateName ?: "",
                        tag.status ?: "",
                        tag.type ?: "",
                        tag.station ?: "",
                        tag.rssi.toString(),
                        tag.readCount.toString(),
                        timeFormat.format(Date(tag.firstSeen)),
                        timeFormat.format(Date(tag.lastSeen)),
                    ).joinToString(",") { "\"${it.replace("\"", "\"\"")}\""  }
                )
            }
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Use MediaStore for Android 10+
                val contentValues = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                    put(MediaStore.Downloads.MIME_TYPE, "text/csv")
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                }
                val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                if (uri != null) {
                    contentResolver.openOutputStream(uri)?.use { it.write(csv.toByteArray()) }
                    Toast.makeText(this, "Exported ${tags.size} tags to Downloads/$fileName", Toast.LENGTH_LONG).show()
                }
            } else {
                // Legacy: write directly to Downloads
                @Suppress("DEPRECATION")
                val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                val file = File(dir, fileName)
                FileOutputStream(file).use { it.write(csv.toByteArray()) }
                Toast.makeText(this, "Exported ${tags.size} tags to ${file.absolutePath}", Toast.LENGTH_LONG).show()
            }
            Log.i(TAG, "Exported ${tags.size} tags to $fileName")
        } catch (e: Exception) {
            Log.e(TAG, "CSV export failed", e)
            Toast.makeText(this, "Export failed: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }
}
