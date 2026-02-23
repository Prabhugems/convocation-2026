package com.amasi.rfidbridge

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

/**
 * Background worker that periodically resolves unresolved RFID tag EPCs
 * by calling the web server's batch verify endpoint.
 *
 * Runs on a [ScheduledExecutorService] every 2 seconds.
 */
class TagResolver(private val context: Context) {

    companion object {
        private const val TAG = "TagResolver"
        private const val BATCH_SIZE = 50
        private const val RESOLVE_INTERVAL_SECONDS = 2L
        private const val PREFS_NAME = "rfid_bridge_prefs"
        private const val DEFAULT_WEB_URL = "https://convocation-2026.vercel.app"
    }

    private var executor: ScheduledExecutorService? = null
    private val gson = Gson()

    fun start() {
        if (executor != null) return
        val exec = Executors.newSingleThreadScheduledExecutor { r ->
            Thread(r, "TagResolver").apply { isDaemon = true }
        }
        executor = exec
        exec.scheduleWithFixedDelay(
            ::resolveOnce,
            RESOLVE_INTERVAL_SECONDS,
            RESOLVE_INTERVAL_SECONDS,
            TimeUnit.SECONDS,
        )
        Log.i(TAG, "Started")
    }

    fun stop() {
        executor?.shutdownNow()
        executor = null
        Log.i(TAG, "Stopped")
    }

    private fun getWebServerUrl(): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString("web_server_url", DEFAULT_WEB_URL) ?: DEFAULT_WEB_URL
    }

    private fun resolveOnce() {
        try {
            val unresolved = TagRepository.unresolvedEpcs()
            if (unresolved.isEmpty()) return

            // Process in batches
            unresolved.chunked(BATCH_SIZE).forEach { batch ->
                resolveBatch(batch)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Resolve cycle failed", e)
        }
    }

    private fun resolveBatch(epcs: List<String>) {
        val baseUrl = getWebServerUrl().trimEnd('/')
        try {
            val url = URL("$baseUrl/api/rfid/verify")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Accept", "application/json")
            conn.doOutput = true
            conn.connectTimeout = 5000
            conn.readTimeout = 10000

            val body = gson.toJson(mapOf("epcs" to epcs))
            conn.outputStream.use { it.write(body.toByteArray()) }

            val code = conn.responseCode
            if (code == 200) {
                val responseText = conn.inputStream.bufferedReader().readText()
                parseAndApply(responseText)
                Log.d(TAG, "Resolved batch of ${epcs.size} — HTTP 200")
            } else {
                Log.w(TAG, "Verify endpoint returned HTTP $code")
            }
            conn.disconnect()
        } catch (e: java.net.ConnectException) {
            // Web server not running — silent, will retry
            Log.d(TAG, "Web server not reachable at $baseUrl")
        } catch (e: Exception) {
            Log.w(TAG, "Batch resolve failed", e)
        }
    }

    /**
     * Actual server response format (from convocation-2026 POST /api/rfid/verify):
     * ```json
     * {
     *   "success": true,
     *   "data": {
     *     "results": [
     *       {
     *         "epc": "E280...",
     *         "found": true,
     *         "tag": {
     *           "epc": "118AEC1001",
     *           "type": "graduate",
     *           "graduateName": "John Doe",
     *           "convocationNumber": "118AEC1001",
     *           "status": "encoded",
     *           "currentStation": "encoding",
     *           ...
     *         }
     *       },
     *       { "epc": "E280...", "found": false }
     *     ],
     *     "summary": { "total": 2, "found": 1, "notFound": 1 }
     *   }
     * }
     * ```
     */
    private fun parseAndApply(responseText: String) {
        try {
            val responseType = object : TypeToken<Map<String, Any>>() {}.type
            val response: Map<String, Any> = gson.fromJson(responseText, responseType)

            // Navigate: response.data.results
            @Suppress("UNCHECKED_CAST")
            val data = response["data"] as? Map<String, Any> ?: return
            @Suppress("UNCHECKED_CAST")
            val results = data["results"] as? List<Map<String, Any>> ?: return

            for (result in results) {
                val epc = result["epc"] as? String ?: continue
                val found = result["found"] as? Boolean ?: false
                if (!found) {
                    TagRepository.markResolved(epc, null, null, "unknown", null, null)
                    continue
                }

                // Tag data is nested under "tag" key
                @Suppress("UNCHECKED_CAST")
                val tag = result["tag"] as? Map<String, Any>
                if (tag == null) {
                    TagRepository.markResolved(epc, null, null, "unknown", null, null)
                    continue
                }

                TagRepository.markResolved(
                    epc = epc,
                    graduateName = tag["graduateName"] as? String,
                    convocationNumber = tag["convocationNumber"] as? String,
                    status = tag["status"] as? String,
                    type = tag["type"] as? String,
                    station = tag["currentStation"] as? String,
                )
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse verify response", e)
        }
    }
}
