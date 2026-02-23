package com.amasi.rfidbridge

import android.os.Bundle
import android.view.View
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class TagDetailActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_tag_detail)

        findViewById<ImageButton>(R.id.backButton).setOnClickListener { finish() }

        val epc = intent.getStringExtra("epc") ?: run { finish(); return }
        val tag = TagRepository.get(epc) ?: run { finish(); return }

        val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.US)
        val dateTimeFormat = SimpleDateFormat("MMM dd, HH:mm:ss", Locale.US)

        // Title
        findViewById<TextView>(R.id.detailTitle).text = tag.shortLabel

        // EPC
        findViewById<TextView>(R.id.detailEpc).text = tag.epc

        // Graduate Name
        tag.graduateName?.let { name ->
            findViewById<LinearLayout>(R.id.nameRow).visibility = View.VISIBLE
            findViewById<TextView>(R.id.detailName).text = name
        }

        // Convocation Number
        tag.convocationNumber?.let { num ->
            findViewById<LinearLayout>(R.id.convRow).visibility = View.VISIBLE
            findViewById<TextView>(R.id.detailConvNumber).text = num
        }

        // Status
        tag.status?.let { status ->
            val statusRow = findViewById<LinearLayout>(R.id.statusRow)
            val statusText = findViewById<TextView>(R.id.detailStatus)
            statusRow.visibility = View.VISIBLE
            statusText.text = status.replaceFirstChar { it.uppercase() }
            val statusColor = when (status) {
                "linked" -> R.color.status_green
                "collected" -> R.color.cyan_primary
                "unlinked" -> R.color.status_amber
                else -> R.color.text_secondary
            }
            statusText.setTextColor(ContextCompat.getColor(this, statusColor))
        }

        // Type
        tag.type?.let { type ->
            findViewById<LinearLayout>(R.id.typeRow).visibility = View.VISIBLE
            findViewById<TextView>(R.id.detailType).text = type.replaceFirstChar { it.uppercase() }
        }

        // Station
        tag.station?.let { station ->
            findViewById<LinearLayout>(R.id.stationRow).visibility = View.VISIBLE
            findViewById<TextView>(R.id.detailStation).text = station
        }

        // RSSI with color
        val rssiText = findViewById<TextView>(R.id.detailRssi)
        rssiText.text = "${tag.rssi} dBm"
        val rssiColor = when {
            tag.rssi > -30 -> R.color.rssi_green
            tag.rssi > -50 -> R.color.rssi_lime
            tag.rssi > -70 -> R.color.rssi_amber
            else -> R.color.rssi_red
        }
        rssiText.setTextColor(ContextCompat.getColor(this, rssiColor))

        // Read count
        findViewById<TextView>(R.id.detailReadCount).text = "${tag.readCount}x"

        // First / Last seen
        findViewById<TextView>(R.id.detailFirstSeen).text = dateTimeFormat.format(Date(tag.firstSeen))
        findViewById<TextView>(R.id.detailLastSeen).text = dateTimeFormat.format(Date(tag.lastSeen))

        // Scan history timeline (last 20 entries, newest first)
        val container = findViewById<LinearLayout>(R.id.scanTimelineContainer)
        val history = tag.scanHistory.takeLast(20).reversed()
        if (history.isEmpty()) {
            val empty = TextView(this).apply {
                text = "No scan history"
                setTextColor(ContextCompat.getColor(this@TagDetailActivity, R.color.text_secondary))
                textSize = 14f
            }
            container.addView(empty)
        } else {
            for (entry in history) {
                val row = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = android.view.Gravity.CENTER_VERTICAL
                    setPadding(0, 6, 0, 6)
                }

                // Color dot
                val dot = View(this).apply {
                    val size = (8 * resources.displayMetrics.density).toInt()
                    layoutParams = LinearLayout.LayoutParams(size, size).apply {
                        marginEnd = (10 * resources.displayMetrics.density).toInt()
                    }
                    val dotColor = when {
                        entry.rssi > -30 -> R.color.rssi_green
                        entry.rssi > -50 -> R.color.rssi_lime
                        entry.rssi > -70 -> R.color.rssi_amber
                        else -> R.color.rssi_red
                    }
                    setBackgroundColor(ContextCompat.getColor(this@TagDetailActivity, dotColor))
                }
                row.addView(dot)

                // Timestamp
                val time = TextView(this).apply {
                    text = timeFormat.format(Date(entry.timestamp))
                    setTextColor(ContextCompat.getColor(this@TagDetailActivity, R.color.text_primary))
                    textSize = 13f
                    typeface = android.graphics.Typeface.MONOSPACE
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                }
                row.addView(time)

                // RSSI
                val rssi = TextView(this).apply {
                    text = "${entry.rssi} dBm"
                    textSize = 13f
                    typeface = android.graphics.Typeface.MONOSPACE
                    val c = when {
                        entry.rssi > -30 -> R.color.rssi_green
                        entry.rssi > -50 -> R.color.rssi_lime
                        entry.rssi > -70 -> R.color.rssi_amber
                        else -> R.color.rssi_red
                    }
                    setTextColor(ContextCompat.getColor(this@TagDetailActivity, c))
                }
                row.addView(rssi)

                container.addView(row)
            }
        }
    }
}
