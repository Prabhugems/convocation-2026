package com.amasi.rfidbridge

import android.util.Log

/**
 * Wrapper around the Mivanta UHF RFID SDK (HCUHF).
 *
 * Requires the SDK AAR in app/src/main/libs/ and .so files in jniLibs/.
 * Replace stub calls with actual SDK methods once the AAR is integrated.
 */
class RfidManager {

    companion object {
        private const val TAG = "RfidManager"
    }

    var onTagScanned: ((epc: String, rssi: Int) -> Unit)? = null

    private var isConnected = false
    private var isInventoryRunning = false
    private var currentPower = 26 // default dBm

    // ---- Connection ----

    fun connect(): Boolean {
        return try {
            // TODO: Replace with actual SDK call:
            // val reader = UHFReader.getInstance()
            // reader.openSerial("/dev/ttyS1", 115200)
            Log.i(TAG, "Connecting to RFID reader via serial...")
            isConnected = true
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to connect", e)
            isConnected = false
            false
        }
    }

    fun disconnect() {
        try {
            stopInventory()
            // TODO: reader.closeSerial()
            Log.i(TAG, "Disconnected from RFID reader")
        } catch (e: Exception) {
            Log.e(TAG, "Error disconnecting", e)
        } finally {
            isConnected = false
        }
    }

    fun isConnected(): Boolean = isConnected

    // ---- Inventory (bulk scan) ----

    fun startInventory(): Boolean {
        if (!isConnected) return false
        if (isInventoryRunning) return true

        return try {
            // TODO: Replace with actual SDK call:
            // reader.startInventory { epc, rssi, tid ->
            //     onTagScanned?.invoke(epc, rssi)
            // }
            Log.i(TAG, "Starting inventory scan")
            isInventoryRunning = true
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start inventory", e)
            false
        }
    }

    fun stopInventory(): Boolean {
        if (!isInventoryRunning) return true

        return try {
            // TODO: reader.stopInventory()
            Log.i(TAG, "Stopping inventory scan")
            isInventoryRunning = false
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop inventory", e)
            false
        }
    }

    fun isScanning(): Boolean = isInventoryRunning

    // ---- Single tag operations ----

    fun readTag(epc: String, bank: Int = 1, offset: Int = 0, length: Int = 6): String? {
        if (!isConnected) return null
        return try {
            // TODO: reader.readTag(epc, bank, offset, length)
            Log.i(TAG, "Reading tag: $epc bank=$bank")
            null
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read tag", e)
            null
        }
    }

    fun writeTag(epc: String, data: String, bank: Int = 1, offset: Int = 0): Boolean {
        if (!isConnected) return false
        return try {
            // TODO: reader.writeTag(epc, data, bank, offset, accessPassword = "00000000")
            Log.i(TAG, "Writing tag: $epc data=$data")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to write tag", e)
            false
        }
    }

    // ---- Power control ----

    fun getPower(): Int = currentPower

    fun setPower(dbm: Int): Boolean {
        if (!isConnected) return false
        val clamped = dbm.coerceIn(1, 33)
        return try {
            // TODO: reader.setPower(clamped)
            Log.i(TAG, "Setting power to $clamped dBm")
            currentPower = clamped
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set power", e)
            false
        }
    }

    fun getModel(): String {
        // TODO: reader.getModel() or hardcode device model
        return "Mivanta MPower200"
    }
}
