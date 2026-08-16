package com.simplifyspeak.assistant.tts

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale

class TtsEngine(private val context: Context, private val onSentenceDone: () -> Unit) : TextToSpeech.OnInitListener {

    private var tts: TextToSpeech? = null
    private var isInitialized = false

    private var sentences: List<String> = emptyList()
    private var currentIndex = 0
    private var isPaused = false

    init {
        tts = TextToSpeech(context, this)
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            isInitialized = true
            tts?.language = Locale.getDefault()
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {}
                override fun onDone(utteranceId: String?) {
                    if (!isPaused) {
                        currentIndex++
                        speakCurrent()
                    }
                }
                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {}
            })
        }
    }

    fun speak(text: String) {
        sentences = text.split(Regex("(?<=[.!?])\\s+(?=[a-zA-Z0-9])")).filter { it.trim().isNotEmpty() }
        currentIndex = 0
        isPaused = false
        speakCurrent()
    }

    private fun speakCurrent() {
        if (currentIndex < sentences.size) {
            val sentence = sentences[currentIndex].trim()
            tts?.speak(sentence, TextToSpeech.QUEUE_FLUSH, null, "sentence_$currentIndex")
            onSentenceDone()
        } else {
            onSentenceDone()
        }
    }

    fun pause() {
        isPaused = true
        tts?.stop()
    }

    fun resume() {
        if (isPaused) {
            isPaused = false
            speakCurrent()
        }
    }

    fun stop() {
        isPaused = false
        currentIndex = 0
        tts?.stop()
    }

    fun shutdown() {
        tts?.stop()
        tts?.shutdown()
    }
}
