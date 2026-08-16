# Simplify & Speak: AI Reading & Voice Assistant

**Simplify & Speak** is a Google Chrome Extension designed for people who find reading long AI-generated text tiring. It allows you to select text on any website, simplify it using Gemini AI, NVIDIA NIM, or a zero-setup offline fallback model, and read it aloud with Chrome's native offline Text-to-Speech (TTS) engine.

---

## ✨ Features

- **Zero-Setup Offline Fallback**: Works immediately out-of-the-box! If no API key is provided, an on-device extractive summarizer condenses the text without errors.
- **Dual Cloud AI Support**: Seamlessly connect **Google Gemini** (`gemini-3.6-flash`) or **NVIDIA NIM** (`meta/llama-3.1-8b-instruct`) for deep conversational simplification.
- **Interactive Follow-Up Mini-Chat**: Ask follow-up questions directly inside the floating card (e.g. *"Explain point 2 in more detail"* or *"Translate this to Spanish"*) and listen to the reply.
- **Real-Time Visual Sentence Tracking**: Highlights the active sentence with a soft glowing background as the voice reads, scrolling automatically for smooth reading.
- **One-Click Inline Platform Injectors**: Automatically injects a discrete `✨ Simplify & Listen` button next to AI responses on **ChatGPT**, **Gemini**, **Claude**, and **Reddit**.
- **Accessibility & Bionic Reading**:
  - **Bionic Reading Mode**: Bolds the first half of words for rapid scanning.
  - **Dyslexia-Friendly Font**: High-legibility font option for easy reading.
- **Quick Export & Copy**: One-click copy and instant `.txt` transcript download including original text, summary, and Q&A history.
- **Robust Audio Controls**: Sentence-by-sentence streaming queue that guarantees **Pause**, **Resume**, and **Stop** features work reliably across all operating systems.
- **Free High-Quality Voices**: Defaults to natural voices like **Microsoft Neerja / Ravi (India)** or Google natural models.

---

## 📁 File Structure

- `manifest.json`: Manifest V3 configuration with permissions (`storage`, `tts`).
- `background.js`: Background service worker handling cloud API calls (Gemini/NVIDIA), offline fallback extractive summarizer, and chat completions.
- `content.js` / `content.css`: Client-side floating card, real-time sentence highlight tracker, mini-chat interface, and platform auto-injectors.
- `popup.html` / `popup.js` / `popup.css`: Extension control dashboard with API keys, voice selection, Bionic reading, and Dyslexia toggles.
- `icon.svg`: High-resolution vector logo.
- `mobile_app/`: Cross-platform Flutter mobile application source code.
- `test_check.js`: Integration and algorithm self-check tests.

---

## 🚀 How to Install in Chrome

1. Clone or download this repository as a ZIP.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select this directory.
5. Highlight any text on any website, click the floating **🔊 Simplify & Speak** button, and enjoy!
