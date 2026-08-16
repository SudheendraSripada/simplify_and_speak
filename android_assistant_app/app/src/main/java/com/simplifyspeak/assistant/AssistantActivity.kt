package com.simplifyspeak.assistant

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import com.simplifyspeak.assistant.ui.OverlayManager

class AssistantActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val text = intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()
            ?: intent.getStringExtra(Intent.EXTRA_TEXT)

        if (!text.isNullOrBlank()) {
            val overlayManager = OverlayManager(applicationContext)
            overlayManager.showAssistantSheet(text)
        }

        finish()
    }
}
