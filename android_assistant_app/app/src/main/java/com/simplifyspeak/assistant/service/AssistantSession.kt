package com.simplifyspeak.assistant.service

import android.app.assist.AssistContent
import android.app.assist.AssistStructure
import android.content.Context
import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import android.view.View
import com.simplifyspeak.assistant.ui.OverlayManager

class AssistantSession(context: Context) : VoiceInteractionSession(context) {

    private val overlayManager = OverlayManager(context)

    override fun onCreate() {
        super.onCreate()
    }

    override fun onHandleAssist(
        data: Bundle?,
        structure: AssistStructure?,
        content: AssistContent?
    ) {
        super.onHandleAssist(data, structure, content)

        if (structure == null) {
            hide()
            return
        }

        val extractedText = StringBuilder()
        val windowNodesCount = structure.windowNodeCount

        for (i in 0 until windowNodesCount) {
            val windowNode = structure.getWindowNodeAt(i)
            traverseViewNode(windowNode.rootViewNode, extractedText)
        }

        val fullText = extractedText.toString().trim()

        if (fullText.isNotEmpty()) {
            overlayManager.showAssistantSheet(fullText)
        }

        hide()
    }

    private fun traverseViewNode(node: AssistStructure.ViewNode?, buffer: StringBuilder) {
        if (node == null || node.visibility != View.VISIBLE) return

        val text = node.text
        if (!text.isNullOrBlank() && text.length > 2) {
            buffer.append(text).append(" ")
        }

        for (i in 0 until node.childCount) {
            traverseViewNode(node.getChildAt(i), buffer)
        }
    }
}
