package com.simplifyspeak.assistant.ai

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class AiService(private val context: Context) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    suspend fun simplify(originalText: String, apiKey: String, provider: String = "gemini"): String = withContext(Dispatchers.IO) {
        val trimmed = originalText.trim()
        if (trimmed.isEmpty()) return@withContext "No text provided."

        if (apiKey.isEmpty()) {
            return@withContext localExtractiveSummarize(trimmed)
        }

        try {
            if (provider == "nvidia") {
                simplifyWithNvidia(trimmed, apiKey)
            } else {
                simplifyWithGemini(trimmed, apiKey)
            }
        } catch (e: Exception) {
            localExtractiveSummarize(trimmed)
        }
    }

    private fun simplifyWithGemini(text: String, apiKey: String): String {
        val url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=$apiKey"
        val prompt = "Simplify the following text so it is very easy to read and understand. Keep key info, make it concise, plain and straightforward. Output ONLY the simplified text.\n\nOriginal Text:\n$text"

        val json = JSONObject().apply {
            put("contents", JSONArray().apply {
                put(JSONObject().apply {
                    put("parts", JSONArray().apply {
                        put(JSONObject().apply { put("text", prompt) })
                    })
                })
            })
        }

        val request = Request.Builder()
            .url(url)
            .post(json.toString().toRequestBody("application/json".toMediaType()))
            .build()

        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: throw Exception("Empty response from Gemini")
        val responseJson = JSONObject(body)
        
        return responseJson.optJSONArray("candidates")
            ?.optJSONObject(0)
            ?.optJSONObject("content")
            ?.optJSONArray("parts")
            ?.optJSONObject(0)
            ?.optString("text")
            ?.trim() ?: localExtractiveSummarize(text)
    }

    private fun simplifyWithNvidia(text: String, apiKey: String): String {
        val url = "https://integrate.api.nvidia.com/v1/chat/completions"
        val json = JSONObject().apply {
            put("model", "meta/llama-3.1-8b-instruct")
            put("messages", JSONArray().apply {
                put(JSONObject().apply {
                    put("role", "system")
                    put("content", "Simplify the following text so it is very easy to read and understand. Plain English only.")
                })
                put(JSONObject().apply {
                    put("role", "user")
                    put("content", text)
                })
            })
            put("max_tokens", 1024)
        }

        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer $apiKey")
            .post(json.toString().toRequestBody("application/json".toMediaType()))
            .build()

        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: throw Exception("Empty response from NVIDIA")
        val responseJson = JSONObject(body)

        return responseJson.optJSONArray("choices")
            ?.optJSONObject(0)
            ?.optJSONObject("message")
            ?.optString("content")
            ?.trim() ?: localExtractiveSummarize(text)
    }

    // ponytail: naive frequency-based extractive summarizer for offline zero-config fallback
    fun localExtractiveSummarize(text: String): String {
        val sentences = text.split(Regex("(?<=[.!?])\\s+(?=[a-zA-Z0-9])"))
            .map { it.trim() }
            .filter { it.length > 15 }

        if (sentences.size <= 2) return text

        val stopWords = setOf(
            "the","is","in","and","to","of","a","that","it","for","on","with","as",
            "this","was","at","by","an","be","from","or","are","your","you","we",
            "our","their","they","can","have","has","were","been","will","would"
        )

        val words = Regex("\\b[a-zA-Z]{3,}\\b").findAll(text.lowercase()).map { it.value }
        val freq = mutableMapOf<String, Int>()
        for (w in words) {
            if (w !in stopWords) freq[w] = (freq[w] ?: 0) + 1
        }

        data class Scored(val sentence: String, val score: Double, val index: Int)

        val scored = sentences.mapIndexed { index, sentence ->
            val sWords = Regex("\\b[a-zA-Z]{3,}\\b").findAll(sentence.lowercase()).map { it.value }.toList()
            var sScore = 0.0
            for (w in sWords) {
                sScore += (freq[w] ?: 0)
            }
            sScore /= Math.max(5, sWords.size)
            if (index == 0) sScore *= 1.3
            Scored(sentence, sScore, index)
        }

        val targetCount = Math.max(2, Math.min(5, (sentences.size * 0.45).toInt()))
        val selected = scored.sortedByDescending { it.score }
            .take(targetCount)
            .sortedBy { it.index }

        return selected.joinToString(" ") { it.sentence }
    }
}
