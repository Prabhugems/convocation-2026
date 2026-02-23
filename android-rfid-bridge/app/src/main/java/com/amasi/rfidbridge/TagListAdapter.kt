package com.amasi.rfidbridge

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.RecyclerView

class TagListAdapter(
    private val onTagClicked: (ResolvedTag) -> Unit,
) : RecyclerView.Adapter<TagListAdapter.TagViewHolder>() {

    private var tags: List<ResolvedTag> = emptyList()

    fun submitList(newTags: List<ResolvedTag>) {
        val diff = DiffUtil.calculateDiff(TagDiffCallback(tags, newTags))
        tags = newTags
        diff.dispatchUpdatesTo(this)
    }

    override fun getItemCount(): Int = tags.size

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TagViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_tag, parent, false)
        return TagViewHolder(view)
    }

    override fun onBindViewHolder(holder: TagViewHolder, position: Int) {
        holder.bind(tags[position])
    }

    inner class TagViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val rssiBar: View = itemView.findViewById(R.id.rssiBar)
        private val tagLabelText: TextView = itemView.findViewById(R.id.tagLabelText)
        private val tagNameText: TextView = itemView.findViewById(R.id.tagNameText)
        private val statusChip: TextView = itemView.findViewById(R.id.statusChip)
        private val readCountText: TextView = itemView.findViewById(R.id.readCountText)

        fun bind(tag: ResolvedTag) {
            // Label: convocation number or last 8 chars of EPC
            tagLabelText.text = tag.shortLabel

            // Graduate name (only if resolved)
            if (tag.graduateName != null) {
                tagNameText.text = tag.graduateName
                tagNameText.visibility = View.VISIBLE
            } else {
                tagNameText.visibility = View.GONE
            }

            // Status chip
            if (tag.status != null) {
                statusChip.text = tag.status!!.uppercase()
                statusChip.visibility = View.VISIBLE
                val chipColor = when (tag.status) {
                    "linked" -> R.color.status_green
                    "collected" -> R.color.cyan_primary
                    else -> R.color.status_amber
                }
                statusChip.setBackgroundColor(
                    ContextCompat.getColor(itemView.context, chipColor) and 0x33FFFFFF
                )
                statusChip.setTextColor(ContextCompat.getColor(itemView.context, chipColor))
            } else {
                statusChip.visibility = View.GONE
            }

            // RSSI color bar
            val rssiColor = when {
                tag.rssi > -30 -> R.color.rssi_green
                tag.rssi > -50 -> R.color.rssi_lime
                tag.rssi > -70 -> R.color.rssi_amber
                else -> R.color.rssi_red
            }
            rssiBar.setBackgroundColor(ContextCompat.getColor(itemView.context, rssiColor))

            // Read count
            readCountText.text = "${tag.readCount}x"

            itemView.setOnClickListener { onTagClicked(tag) }
        }
    }

    private class TagDiffCallback(
        private val oldList: List<ResolvedTag>,
        private val newList: List<ResolvedTag>,
    ) : DiffUtil.Callback() {
        override fun getOldListSize() = oldList.size
        override fun getNewListSize() = newList.size
        override fun areItemsTheSame(oldPos: Int, newPos: Int) =
            oldList[oldPos].epc == newList[newPos].epc
        override fun areContentsTheSame(oldPos: Int, newPos: Int): Boolean {
            val old = oldList[oldPos]
            val new = newList[newPos]
            return old.rssi == new.rssi &&
                old.readCount == new.readCount &&
                old.resolved == new.resolved &&
                old.status == new.status
        }
    }
}
