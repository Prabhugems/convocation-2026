package com.amasi.rfidbridge

import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonParser
import fi.iki.elonen.NanoHTTPD
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicLong

/**
 * HTTP server exposing the RFID reader over REST on port 8080.
 * Designed to be consumed by the Convocation web app running in a browser
 * on the same device or local network.
 */
class RfidHttpServer(
    private val rfidManager: RfidManager?,
    port: Int = 8080,
) : NanoHTTPD(port) {

    companion object {
        private const val TAG = "RfidHttpServer"
    }

    private val gson = Gson()
    private val recentTags = ConcurrentLinkedQueue<Map<String, Any>>()
    private val totalTagCount = AtomicLong(0)

    /** Callback invoked on the main thread with updated scan count. */
    var onScanCountUpdated: ((Long) -> Unit)? = null

    override fun serve(session: IHTTPSession): Response {
        // Handle CORS preflight
        if (session.method == Method.OPTIONS) {
            return corsResponse(newFixedLengthResponse(Response.Status.NO_CONTENT, MIME_PLAINTEXT, ""))
        }

        val uri = session.uri
        val method = session.method

        return try {
            when {
                uri == "/api/status" && method == Method.GET -> handleStatus()
                uri == "/api/inventory/start" && method == Method.POST -> handleStartInventory()
                uri == "/api/inventory/stop" && method == Method.POST -> handleStopInventory()
                uri == "/api/inventory/tags" && method == Method.GET -> handleGetTags()
                uri == "/api/read" && method == Method.POST -> handleRead(session)
                uri == "/api/write" && method == Method.POST -> handleWrite(session)
                uri == "/api/power" && method == Method.GET -> handleGetPower()
                uri == "/api/power" && method == Method.POST -> handleSetPower(session)
                uri == "/api/barcode/result" && method == Method.GET -> handleGetBarcodeResult()
                else -> corsResponse(
                    newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json", """{"error":"Not found"}""")
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling $method $uri", e)
            corsResponse(
                newFixedLengthResponse(
                    Response.Status.INTERNAL_ERROR,
                    "application/json",
                    gson.toJson(mapOf("error" to (e.message ?: "Internal error")))
                )
            )
        }
    }

    // ---- Endpoint handlers ----

    private fun handleStatus(): Response {
        val body = mapOf(
            "connected" to (rfidManager?.isConnected() ?: false),
            "scanning" to (rfidManager?.isScanning() ?: false),
            "power" to (rfidManager?.getPower() ?: 0),
            "model" to (rfidManager?.getModel() ?: "No reader"),
        )
        return jsonResponse(body)
    }

    private fun handleStartInventory(): Response {
        if (rfidManager == null) return errorResponse("No RFID reader available")
        recentTags.clear()
        totalTagCount.set(0)
        rfidManager.onTagScanned = { epc, rssi ->
            // Keep only last 500 entries to prevent unbounded growth
            if (recentTags.size > 500) recentTags.poll()
            recentTags.add(mapOf("epc" to epc, "rssi" to rssi, "ts" to System.currentTimeMillis()))
            val count = totalTagCount.incrementAndGet()
            onScanCountUpdated?.invoke(count)
        }
        val success = rfidManager.startInventory()
        return jsonResponse(mapOf("success" to success))
    }

    private fun handleStopInventory(): Response {
        rfidManager?.onTagScanned = null
        val success = rfidManager?.stopInventory() ?: true
        return jsonResponse(mapOf("success" to success))
    }

    /** Returns and clears all tags scanned since the last poll. */
    private fun handleGetTags(): Response {
        val tags = mutableListOf<Map<String, Any>>()
        while (true) {
            val tag = recentTags.poll() ?: break
            tags.add(tag)
        }
        return jsonResponse(mapOf("tags" to tags))
    }

    private fun handleRead(session: IHTTPSession): Response {
        if (rfidManager == null) return errorResponse("No RFID reader available")
        val body = parseBody(session)
        val epc = body?.get("epc")?.asString ?: return errorResponse("Missing epc field")
        val bank = body.get("bank")?.asInt ?: 1
        val offset = body.get("offset")?.asInt ?: 0
        val length = body.get("length")?.asInt ?: 6

        val data = rfidManager.readTag(epc, bank, offset, length)
        return if (data != null) {
            jsonResponse(mapOf("success" to true, "data" to data))
        } else {
            jsonResponse(mapOf("success" to false, "error" to "Read failed"))
        }
    }

    private fun handleWrite(session: IHTTPSession): Response {
        if (rfidManager == null) return errorResponse("No RFID reader available")
        val body = parseBody(session)
        val epc = body?.get("epc")?.asString ?: return errorResponse("Missing epc field")
        val data = body.get("data")?.asString ?: return errorResponse("Missing data field")

        val success = rfidManager.writeTag(epc, data)
        return jsonResponse(mapOf("success" to success))
    }

    private fun handleGetPower(): Response {
        if (rfidManager == null) return errorResponse("No RFID reader available")
        return jsonResponse(mapOf("power" to rfidManager.getPower()))
    }

    private fun handleSetPower(session: IHTTPSession): Response {
        if (rfidManager == null) return errorResponse("No RFID reader available")
        val body = parseBody(session)
        val power = body?.get("power")?.asInt ?: return errorResponse("Missing power field")
        val success = rfidManager.setPower(power)
        return jsonResponse(mapOf("success" to success, "power" to rfidManager.getPower()))
    }

    /** Returns and clears the last scanned barcode value. */
    private fun handleGetBarcodeResult(): Response {
        val result = RfidBridgeService.lastBarcodeResult
        RfidBridgeService.lastBarcodeResult = null
        return if (result != null) {
            jsonResponse(mapOf("value" to result.value, "timestamp" to result.timestamp))
        } else {
            jsonResponse(mapOf("value" to null))
        }
    }

    // ---- Helpers ----

    private fun parseBody(session: IHTTPSession): com.google.gson.JsonObject? {
        val files = HashMap<String, String>()
        session.parseBody(files)
        val postData = files["postData"] ?: return null
        return try {
            JsonParser.parseString(postData).asJsonObject
        } catch (e: Exception) {
            null
        }
    }

    private fun jsonResponse(data: Any): Response {
        return corsResponse(
            newFixedLengthResponse(Response.Status.OK, "application/json", gson.toJson(data))
        )
    }

    private fun errorResponse(message: String): Response {
        return corsResponse(
            newFixedLengthResponse(
                Response.Status.BAD_REQUEST, "application/json",
                gson.toJson(mapOf("error" to message))
            )
        )
    }

    private fun corsResponse(response: Response): Response {
        response.addHeader("Access-Control-Allow-Origin", "*")
        response.addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        response.addHeader("Access-Control-Allow-Headers", "Content-Type")
        return response
    }
}
