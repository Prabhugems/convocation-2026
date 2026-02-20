package com.amasi.rfidbridge

import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonParser
import fi.iki.elonen.NanoHTTPD
import java.io.PipedInputStream
import java.io.PipedOutputStream
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * HTTP server exposing the RFID reader over REST + SSE on port 8080.
 * Designed to be consumed by the Convocation web app running in a browser
 * on the same device or local network.
 */
class RfidHttpServer(
    private val rfidManager: RfidManager,
    port: Int = 8080,
) : NanoHTTPD(port) {

    companion object {
        private const val TAG = "RfidHttpServer"
    }

    private val gson = Gson()
    private val sseClients = ConcurrentLinkedQueue<PipedOutputStream>()

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
                uri == "/api/inventory/stream" && method == Method.GET -> handleStream()
                uri == "/api/read" && method == Method.POST -> handleRead(session)
                uri == "/api/write" && method == Method.POST -> handleWrite(session)
                uri == "/api/power" && method == Method.GET -> handleGetPower()
                uri == "/api/power" && method == Method.POST -> handleSetPower(session)
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
            "connected" to rfidManager.isConnected(),
            "scanning" to rfidManager.isScanning(),
            "power" to rfidManager.getPower(),
            "model" to rfidManager.getModel(),
        )
        return jsonResponse(body)
    }

    private fun handleStartInventory(): Response {
        val success = rfidManager.startInventory()
        if (success) {
            rfidManager.onTagScanned = { epc, rssi ->
                broadcastTag(epc, rssi)
            }
        }
        return jsonResponse(mapOf("success" to success))
    }

    private fun handleStopInventory(): Response {
        rfidManager.onTagScanned = null
        val success = rfidManager.stopInventory()
        // Close all SSE clients
        closeSseClients()
        return jsonResponse(mapOf("success" to success))
    }

    private fun handleStream(): Response {
        val pipedOut = PipedOutputStream()
        val pipedIn = PipedInputStream(pipedOut, 8192)
        sseClients.add(pipedOut)

        // Send initial keep-alive comment
        try {
            pipedOut.write(": connected\n\n".toByteArray())
            pipedOut.flush()
        } catch (e: Exception) {
            sseClients.remove(pipedOut)
            throw e
        }

        val response = newChunkedResponse(Response.Status.OK, "text/event-stream", pipedIn)
        response.addHeader("Cache-Control", "no-cache")
        response.addHeader("Connection", "keep-alive")
        return corsResponse(response)
    }

    private fun handleRead(session: IHTTPSession): Response {
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
        val body = parseBody(session)
        val epc = body?.get("epc")?.asString ?: return errorResponse("Missing epc field")
        val data = body.get("data")?.asString ?: return errorResponse("Missing data field")

        val success = rfidManager.writeTag(epc, data)
        return jsonResponse(mapOf("success" to success))
    }

    private fun handleGetPower(): Response {
        return jsonResponse(mapOf("power" to rfidManager.getPower()))
    }

    private fun handleSetPower(session: IHTTPSession): Response {
        val body = parseBody(session)
        val power = body?.get("power")?.asInt ?: return errorResponse("Missing power field")
        val success = rfidManager.setPower(power)
        return jsonResponse(mapOf("success" to success, "power" to rfidManager.getPower()))
    }

    // ---- SSE broadcast ----

    private fun broadcastTag(epc: String, rssi: Int) {
        val payload = "data: ${gson.toJson(mapOf("epc" to epc, "rssi" to rssi))}\n\n"
        val bytes = payload.toByteArray()
        val deadClients = mutableListOf<PipedOutputStream>()

        for (client in sseClients) {
            try {
                client.write(bytes)
                client.flush()
            } catch (e: Exception) {
                deadClients.add(client)
            }
        }

        // Prune dead clients
        sseClients.removeAll(deadClients.toSet())
    }

    private fun closeSseClients() {
        while (sseClients.isNotEmpty()) {
            val client = sseClients.poll() ?: break
            try {
                client.close()
            } catch (_: Exception) {}
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
