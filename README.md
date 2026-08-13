# Simplify & Speak Chrome Extension

**Simplify & Speak** is a premium, lightweight Google Chrome Extension designed for people who find reading long, complex AI-generated text tiring. It allows you to select text on any website, simplify it using Gemini AI or NVIDIA NIM models, and read it aloud with Chrome's native offline Text-to-Speech (TTS) engine.

It is designed to be resilient, so small network glitches will not interrupt your playback, and features a Sider-AI style player with a gorgeous glassmorphism UI.

---

## ✨ Features

- **Dual AI Provider Support**: Choose between **Google Gemini** (`gemini-3.6-flash`) and **NVIDIA NIM** (`meta/llama-3.1-8b-instruct`) for content simplification.
- **Robust Audio Controls**: Sentence-by-sentence streaming queue that guarantees **Pause**, **Resume**, and **Stop** features work perfectly on all platforms.
- **Smart Voice Defaults**: Automatically lists available system voices and defaults to **Microsoft Ravi - English (India)** (if available on your device) to ensure clear English narration.
- **Micro-Animations & Glassmorphism**: High-quality floating selection button with blue-to-purple gradient glow effects, smooth card transitions, and active playback badges.
- **Complete Client-Side Storage**: API Keys and configurations are stored securely inside your browser local storage (`chrome.storage.local`).

---

## 📁 File Structure

- `manifest.json`: Configuration settings and permissions (`storage`, `tts`) for the extension.
- `background.js`: Background script handling fetch requests to Gemini/NVIDIA API endpoints and executing native TTS commands.
- `content.js` / `content.css`: Client-side logic for rendering selection buttons, cards, and coordinates mapping.
- `popup.html` / `popup.js` / `popup.css`: User settings interface for managing credentials and default narration speech options.
- `icon.svg`: High-resolution vector icon logo.
- `test_check.js`: Integration self-checks for verification.

---

## 🚀 How to Install (Load Unpacked)

Since this extension is open-source and free, you can load it directly without using the Chrome Web Store:

1. **Download the Repository**:
   - Clone this repository:
     ```bash
     git clone https://github.com/SudheendraSripada/simplify_and_speak.git
     ```
   - Alternatively, download it as a **ZIP** file from GitHub and extract the folder.
2. **Open Extensions Page**:
   - Open your Chrome browser, type `chrome://extensions/` in the URL bar, and press Enter.
3. **Turn on Developer Mode**:
   - Toggle the **Developer mode** switch in the top-right corner to **ON**.
4. **Load the Folder**:
   - Click the **Load unpacked** button in the top-left corner.
   - Select the folder containing these files.

---

## ⚙️ Configuration & Usage

1. Click the puzzle icon (Extensions) in Chrome and select **Simplify & Speak** (pin it for easy access).
2. Choose your **AI Provider** (Google Gemini or NVIDIA NIM) and enter your corresponding API Key:
   - [Get Gemini Key (Free) on Google AI Studio](https://aistudio.google.com/)
   - [Get NVIDIA Key on NVIDIA Build API Catalog](https://build.nvidia.com/)
3. Select your **Simplification Level**:
   - *Standard Simple* (natural plain text)
   - *ELI5* (analogies for simple comprehension)
   - *Bullet Points* (concise list summaries)
   - *Key Takeaways* (summarized paragraph)
4. Select your preferred voice (defaults to **Microsoft Ravi** if found on your system) and speech speed.
5. Click **Test Voice** to verify audio output, then click **Save Settings**.
6. Select any text on a webpage, click the floating **🔊 Simplify & Speak** button, and enjoy the simplified audio read!

---

## 🧪 Developer Tests

To verify file dependencies and parser functions:
```bash
node test_check.js
```
