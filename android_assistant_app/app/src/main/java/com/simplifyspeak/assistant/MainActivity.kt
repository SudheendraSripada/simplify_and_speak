package com.simplifyspeak.assistant

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val btnSetAssistant = findViewById<Button>(R.id.btnSetAssistant)
        val btnSetAccessibility = findViewById<Button>(R.id.btnSetAccessibility)
        val etGeminiKey = findViewById<EditText>(R.id.etGeminiKey)
        val btnSaveKeys = findViewById<Button>(R.id.btnSaveKeys)

        val prefs = getSharedPreferences("simplify_prefs", Context.MODE_PRIVATE)
        etGeminiKey.setText(prefs.getString("gemini_api_key", ""))

        btnSetAssistant.setOnClickListener {
            val intent = Intent(Settings.ACTION_VOICE_INPUT_SETTINGS)
            try {
                startActivity(intent)
            } catch (e: Exception) {
                startActivity(Intent(Settings.ACTION_SETTINGS))
            }
        }

        btnSetAccessibility.setOnClickListener {
            // Check Overlay Permission first
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
                val overlayIntent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:$packageName")
                )
                startActivity(overlayIntent)
            } else {
                val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                startActivity(intent)
            }
        }

        btnSaveKeys.setOnClickListener {
            val key = etGeminiKey.text.toString().trim()
            prefs.edit().putString("gemini_api_key", key).apply()
            Toast.makeText(this, "Settings saved!", Toast.LENGTH_SHORT).show()
        }
    }
}
