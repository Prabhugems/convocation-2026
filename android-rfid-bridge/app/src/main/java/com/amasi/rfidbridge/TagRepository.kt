package com.amasi.rfidbridge

import java.util.concurrent.ConcurrentHashMap

/**
 * Singleton in-memory store for scanned RFID tags.
 * Shared between [RfidBridgeService] (writes) and UI activities (reads).
 */
object TagRepository {

    private val tags = ConcurrentHashMap<String, ResolvedTag>()

    @Volatile
    var expectedTotal: Int = 550

    /** Add a new tag or update an existing one with a fresh RSSI reading. */
    fun addOrUpdate(epc: String, rssi: Int) {
        val now = System.currentTimeMillis()
        val existing = tags[epc]
        if (existing != null) {
            existing.rssi = rssi
            existing.readCount++
            existing.lastSeen = now
            existing.scanHistory.add(ResolvedTag.ScanEntry(now, rssi))
            // Cap scan history at 100 entries per tag
            if (existing.scanHistory.size > 100) {
                existing.scanHistory.removeAt(0)
            }
        } else {
            val tag = ResolvedTag(
                epc = epc,
                rssi = rssi,
                firstSeen = now,
                lastSeen = now,
                scanHistory = mutableListOf(ResolvedTag.ScanEntry(now, rssi)),
            )
            tags[epc] = tag
        }
    }

    /** Get a tag by EPC. */
    fun get(epc: String): ResolvedTag? = tags[epc]

    /** Get all tags as a list, sorted by last seen (newest first). */
    fun allTags(): List<ResolvedTag> {
        // Snapshot the lastSeen values to avoid TimSort crash when
        // background threads mutate lastSeen during the sort.
        val snapshot = tags.values.toList()
        val timestamps = snapshot.associateWith { it.lastSeen }
        return snapshot.sortedByDescending { timestamps[it] ?: 0L }
    }

    /** EPCs that haven't been resolved yet. */
    fun unresolvedEpcs(): List<String> =
        tags.values.filter { !it.resolved }.map { it.epc }

    /** Total unique tags scanned. */
    val uniqueCount: Int get() = tags.size

    /** Count of resolved tags. */
    val resolvedCount: Int get() = tags.values.count { it.resolved }

    /** Update a tag with resolved data from the API. */
    fun markResolved(
        epc: String,
        graduateName: String?,
        convocationNumber: String?,
        status: String?,
        type: String?,
        station: String?,
    ) {
        tags[epc]?.apply {
            this.graduateName = graduateName
            this.convocationNumber = convocationNumber
            this.status = status
            this.type = type
            this.station = station
            this.resolved = true
        }
    }

    /** Clear all tags (called on service destroy). */
    fun clear() {
        tags.clear()
    }
}
