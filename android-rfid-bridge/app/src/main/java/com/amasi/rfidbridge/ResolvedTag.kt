package com.amasi.rfidbridge

/**
 * Represents an RFID tag that has been scanned and optionally resolved
 * against the web server's graduate database.
 */
data class ResolvedTag(
    val epc: String,
    var rssi: Int = 0,
    var readCount: Int = 1,
    var firstSeen: Long = System.currentTimeMillis(),
    var lastSeen: Long = System.currentTimeMillis(),

    // Resolved fields (populated by TagResolver after API call)
    var graduateName: String? = null,
    var convocationNumber: String? = null,
    var status: String? = null,       // e.g. "linked", "unlinked", "collected"
    var type: String? = null,          // e.g. "degree", "diploma"
    var station: String? = null,       // e.g. "Station A"
    var resolved: Boolean = false,

    // Scan history: list of (timestamp, rssi) pairs
    val scanHistory: MutableList<ScanEntry> = mutableListOf(),
) {
    data class ScanEntry(val timestamp: Long, val rssi: Int)

    /** Human-readable display: conv number + name, or just EPC if unresolved */
    val displayName: String
        get() {
            if (!resolved) return epc
            val parts = mutableListOf<String>()
            convocationNumber?.let { parts.add(it) }
            graduateName?.let { parts.add(it) }
            return if (parts.isNotEmpty()) parts.joinToString(" — ") else epc
        }

    /** Short label for list rows */
    val shortLabel: String
        get() = convocationNumber ?: epc.takeLast(8)
}
