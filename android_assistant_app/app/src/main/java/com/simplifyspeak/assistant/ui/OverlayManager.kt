package com.simplifyspeak.assistant.ui

import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.TextView
import com.simplifyspeak.assistant.R
import com.simplifyspeak.assistant.ai.AiService
import com.simplifyspeak.assistant.tts.TtsEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class OverlayManager(private val context: Context) {

    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private val aiService = AiService(context)
    private val scope = CoroutineScope(Dispatchers.Main)

    private var ttsEngine: TtsEngine? = null
    private var pillView: View? = null
    private var overlaySheetView: View? = null

    init {
        ttsEngine = TtsEngine(context) {}
    }

    fun showPill(x: Int, y: Int, selectedText: String) {
        hidePill()

        val inflater = LayoutInflater.from(context)
        pillView = inflater.inflate(R.layout.view_floating_pill, null)

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            this.x = x
            this.y = y
        }

        pillView?.setOnClickListener {
            hidePill()
            showAssistantSheet(selectedText)
        }

        try {
            windowManager.addView(pillView, params)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun hidePill() {
        pillView?.let {
            try {
                windowManager.removeView(it)
            } catch (e: Exception) {}
            pillView = null
        }
    }

    fun showAssistantSheet(originalText: String) {
        hideAssistantSheet()

        val inflater = LayoutInflater.from(context)
        overlaySheetView = inflater.inflate(R.layout.view_assistant_overlay, null)

        val tvContent = overlaySheetView?.findViewById<TextView>(R.id.tvSimplifiedContent)
        val btnPlayPause = overlaySheetView?.findViewById<Button>(R.id.btnPlayPause)
        val btnStop = overlaySheetView?.findViewById<Button>(R.id.btnStop)
        val btnClose = overlaySheetView?.findViewById<ImageButton>(R.id.btnClose)
        val progressBar = overlaySheetView?.findViewById<ProgressBar>(R.id.progressBar)
        val tvStatus = overlaySheetView?.findViewById<TextView>(R.id.tvStatus)

        progressBar?.visibility = View.VISIBLE
        tvContent?.text = "✨ Simplifying content with AI..."

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM
        }

        btnClose?.setOnClickListener {
            ttsEngine?.stop()
            hideAssistantSheet()
        }

        btnStop?.setOnClickListener {
            ttsEngine?.stop()
            tvStatus?.text = "Stopped"
        }

        var isPlaying = true
        btnPlayPause?.setOnClickListener {
            if (isPlaying) {
                ttsEngine?.pause()
                btnPlayPause.text = "▶ Play"
                tvStatus?.text = "Paused"
                isPlaying = false
            } else {
                ttsEngine?.resume()
                btnPlayPause.text = "⏸ Pause"
                tvStatus?.text = "Speaking"
                isPlaying = true
            }
        }

        try {
            windowManager.addView(overlaySheetView, params)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Call AI to simplify and read aloud
        scope.launch {
            val prefs = context.getSharedPreferences("simplify_prefs", Context.MODE_PRIVATE)
            val apiKey = prefs.getString("gemini_api_key", "") ?: ""
            val simplified = aiService.simplify(originalText, apiKey)

            progressBar?.visibility = View.GONE
            tvContent?.text = simplified
            tvStatus?.text = "Speaking..."
            ttsEngine?.speak(simplified)
        }
    }

    fun hideAssistantSheet() {
        overlaySheetView?.let {
            try {
                windowManager.removeView(it)
            } catch (e: Exception) {}
            overlaySheetView = null
        }
    }
}
