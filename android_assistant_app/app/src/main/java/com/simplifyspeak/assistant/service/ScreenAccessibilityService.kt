package com.simplifyspeak.assistant.service

import android.accessibilityservice.AccessibilityService
import android.graphics.Rect
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.simplifyspeak.assistant.ui.OverlayManager

class ScreenAccessibilityService : AccessibilityService() {

    private lateinit var overlayManager: OverlayManager

    override fun onCreate() {
        super.onCreate()
        overlayManager = OverlayManager(this)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        when (event.eventType) {
            AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED -> {
                val source = event.source ?: return
                val text = source.text
                val selectionStart = event.fromIndex
                val selectionEnd = event.toIndex

                if (text != null && selectionStart >= 0 && selectionEnd > selectionStart && selectionEnd <= text.length) {
                    val selectedSnippet = text.subSequence(selectionStart, selectionEnd).toString().trim()
                    if (selectedSnippet.length > 5) {
                        val rect = Rect()
                        source.getBoundsInScreen(rect)
                        overlayManager.showPill(rect.left, Math.max(50, rect.bottom + 10), selectedSnippet)
                    }
                }
            }
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                overlayManager.hidePill()
            }
        }
    }

    override fun onInterrupt() {
        overlayManager.hidePill()
    }
}
