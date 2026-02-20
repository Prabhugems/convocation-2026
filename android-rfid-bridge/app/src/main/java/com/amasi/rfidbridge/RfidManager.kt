package com.amasi.rfidbridge

import android.util.Log
import com.xlzn.hcpda.uhf.UHFReader
import com.xlzn.hcpda.uhf.entity.UHFReaderResult
import com.xlzn.hcpda.uhf.entity.UHFTagEntity
import com.xlzn.hcpda.uhf.enums.ConnectState
import com.xlzn.hcpda.uhf.interfaces.OnInventoryDataListener

/**
 * Wrapper around the Mivanta/HCUHF UHF RFID SDK.
 * Exposes connect, inventory, read, write, and power control.
 */
class RfidManager {

    companion object {
        private const val TAG = "RfidManager"
        private const val DEFAULT_PASSWORD = "00000000"
    }

    var onTagScanned: ((epc: String, rssi: Int) -> Unit)? = null

    private val reader: UHFReader = UHFReader.getInstance()
    private var isInventoryRunning = false
    private var currentPower = 26

    // ---- Connection ----

    fun connect(): Boolean {
        return try {
            if (reader.connectState == ConnectState.CONNECTED) {
                Log.i(TAG, "Already connected")
                return true
            }
            Log.i(TAG, "Connecting to RFID reader...")
            val result: UHFReaderResult<*> = reader.connect()
            if (result.resultCode == UHFReaderResult.ResultCode.CODE_SUCCESS) {
                reader.setPower(currentPower)
                reader.setDynamicTarget(0)
                Log.i(TAG, "Connected, power set to $currentPower dBm")
                true
            } else {
                Log.e(TAG, "Connect failed, code: ${result.resultCode}")
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to connect", e)
            false
        }
    }

    fun disconnect() {
        try {
            stopInventory()
            reader.disConnect()
            Log.i(TAG, "Disconnected from RFID reader")
        } catch (e: Exception) {
            Log.e(TAG, "Error disconnecting", e)
        }
    }

    fun isConnected(): Boolean {
        return try {
            reader.connectState == ConnectState.CONNECTED
        } catch (e: Exception) {
            false
        }
    }

    // ---- Inventory (bulk scan) ----

    fun startInventory(): Boolean {
        if (!isConnected()) return false
        if (isInventoryRunning) return true

        return try {
            reader.setOnInventoryDataListener(object : OnInventoryDataListener {
                override fun onInventoryData(tagEntityList: List<UHFTagEntity>?) {
                    tagEntityList?.forEach { tag ->
                        val epc = tag.ecpHex
                        if (!epc.isNullOrEmpty()) {
                            onTagScanned?.invoke(epc, tag.rssi)
                        }
                    }
                }
            })

            val result: UHFReaderResult<Boolean> = reader.startInventory()
            if (result.resultCode == UHFReaderResult.ResultCode.CODE_SUCCESS) {
                isInventoryRunning = true
                Log.i(TAG, "Inventory started")
                true
            } else {
                Log.e(TAG, "Start inventory failed, code: ${result.resultCode}")
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start inventory", e)
            false
        }
    }

    fun stopInventory(): Boolean {
        if (!isInventoryRunning) return true

        return try {
            reader.stopInventory()
            isInventoryRunning = false
            Log.i(TAG, "Inventory stopped")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop inventory", e)
            false
        }
    }

    fun isScanning(): Boolean = isInventoryRunning

    // ---- Single tag operations ----

    fun readTag(epc: String?, bank: Int = 1, offset: Int = 2, length: Int = 6, password: String = DEFAULT_PASSWORD): String? {
        if (!isConnected()) return null
        return try {
            val result: UHFReaderResult<String> = reader.read(password, bank, offset, length, epc)
            if (result.resultCode == UHFReaderResult.ResultCode.CODE_SUCCESS) {
                Log.i(TAG, "Read tag OK: bank=$bank offset=$offset")
                result.data
            } else {
                Log.e(TAG, "Read failed, code: ${result.resultCode}")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read tag", e)
            null
        }
    }

    fun writeTag(epc: String?, data: String, bank: Int = 1, offset: Int = 2, password: String = DEFAULT_PASSWORD): Boolean {
        if (!isConnected()) return false
        return try {
            val length = data.length / 4 // words (2 bytes each, hex = 4 chars)
            val result: UHFReaderResult<Boolean> = reader.write(password, bank, offset, length, data, epc)
            if (result.resultCode == UHFReaderResult.ResultCode.CODE_SUCCESS) {
                Log.i(TAG, "Write tag OK: bank=$bank offset=$offset len=$length")
                true
            } else {
                Log.e(TAG, "Write failed, code: ${result.resultCode}")
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to write tag", e)
            false
        }
    }

    // ---- Power control ----

    fun getPower(): Int = currentPower

    fun setPower(dbm: Int): Boolean {
        if (!isConnected()) return false
        val clamped = dbm.coerceIn(1, 33)
        return try {
            reader.setPower(clamped)
            currentPower = clamped
            Log.i(TAG, "Power set to $clamped dBm")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set power", e)
            false
        }
    }

    fun getModel(): String = "Mivanta MPower200"
}
