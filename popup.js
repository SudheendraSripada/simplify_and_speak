// popup.js - Saves settings and tests native voice selection with NVIDIA API NIM support

document.addEventListener("DOMContentLoaded", () => {
  const providerSelect = document.getElementById("provider-select");
  const geminiKeyGroup = document.getElementById("gemini-key-group");
  const nvidiaKeyGroup = document.getElementById("nvidia-key-group");
  
  const apiKeyInput = document.getElementById("api-key");
  const toggleKeyBtn = document.getElementById("toggle-api-key");
  
  const nvidiaKeyInput = document.getElementById("nvidia-key");
  const toggleNvidiaKeyBtn = document.getElementById("toggle-nvidia-key");
  
  const styleSelect = document.getElementById("style-select");
  const voiceSelect = document.getElementById("voice-select");
  const rateSelect = document.getElementById("rate-select");
  const saveBtn = document.getElementById("save-btn");
  const testBtn = document.getElementById("test-voice-btn");
  const statusMsg = document.getElementById("status-message");

  // Toggle provider visual groups
  providerSelect.addEventListener("change", () => {
    const val = providerSelect.value;
    if (val === "nvidia") {
      geminiKeyGroup.style.display = "none";
      nvidiaKeyGroup.style.display = "flex";
    } else {
      geminiKeyGroup.style.display = "flex";
      nvidiaKeyGroup.style.display = "none";
    }
  });

  // Toggle API Key visibility
  toggleKeyBtn.addEventListener("click", () => {
    if (apiKeyInput.type === "password") {
      apiKeyInput.type = "text";
      toggleKeyBtn.innerText = "🔒";
    } else {
      apiKeyInput.type = "password";
      toggleKeyBtn.innerText = "👁️";
    }
  });

  toggleNvidiaKeyBtn.addEventListener("click", () => {
    if (nvidiaKeyInput.type === "password") {
      nvidiaKeyInput.type = "text";
      toggleNvidiaKeyBtn.innerText = "🔒";
    } else {
      nvidiaKeyInput.type = "password";
      toggleNvidiaKeyBtn.innerText = "👁️";
    }
  });

  // Populate Voice Selection list
  function populateVoices() {
    chrome.tts.getVoices((voices) => {
      voiceSelect.innerHTML = '<option value="">Default System Voice</option>';
      
      // Sort voices: English first, then others
      const enVoices = voices.filter(v => v.lang && v.lang.startsWith("en"));
      const otherVoices = voices.filter(v => !v.lang || !v.lang.startsWith("en"));
      const sortedVoices = [...enVoices, ...otherVoices];

      sortedVoices.forEach((voice) => {
        const option = document.createElement("option");
        option.value = voice.voiceName;
        option.textContent = `${voice.voiceName} (${voice.lang || "unknown"})`;
        voiceSelect.appendChild(option);
      });

      // Load saved settings once voices are populated
      loadSettings(voices);
    });
  }

  // Load configuration from local storage
  function loadSettings(voices) {
    chrome.storage.local.get([
      "apiProvider",
      "apiKey",
      "nvidiaApiKey",
      "simplificationStyle",
      "ttsVoice",
      "ttsRate"
    ], (data) => {
      if (data.apiProvider) {
        providerSelect.value = data.apiProvider;
        providerSelect.dispatchEvent(new Event("change"));
      }
      
      if (data.apiKey) apiKeyInput.value = data.apiKey;
      if (data.nvidiaApiKey) nvidiaKeyInput.value = data.nvidiaApiKey;
      if (data.simplificationStyle) styleSelect.value = data.simplificationStyle;
      if (data.ttsRate) rateSelect.value = data.ttsRate;

      // Handle voice selection fallback (e.g. default to Microsoft Ravi if it exists on system and no voice is saved)
      if (data.ttsVoice) {
        voiceSelect.value = data.ttsVoice;
      } else {
        // Look for a voice name that contains "Ravi"
        const raviVoice = voices.find(v => v.voiceName.toLowerCase().includes("ravi"));
        if (raviVoice) {
          voiceSelect.value = raviVoice.voiceName;
          chrome.storage.local.set({ ttsVoice: raviVoice.voiceName });
        }
      }
    });
  }

  // Save settings to local storage
  saveBtn.addEventListener("click", () => {
    const provider = providerSelect.value;
    const apiKey = apiKeyInput.value.trim();
    const nvidiaApiKey = nvidiaKeyInput.value.trim();
    const style = styleSelect.value;
    const voice = voiceSelect.value;
    const rate = rateSelect.value;

    chrome.storage.local.set({
      apiProvider: provider,
      apiKey: apiKey,
      nvidiaApiKey: nvidiaApiKey,
      simplificationStyle: style,
      ttsVoice: voice,
      ttsRate: rate
    }, () => {
      showStatus("Settings saved successfully!", "success");
    });
  });

  // Test the selected Voice config
  testBtn.addEventListener("click", () => {
    const voice = voiceSelect.value;
    const rate = parseFloat(rateSelect.value) || 1.0;
    const testText = "Hello! Your voice settings are configured correctly.";

    chrome.tts.stop();
    chrome.tts.speak(testText, {
      voiceName: voice || undefined,
      rate: rate,
      enqueue: false
    });
    
    showStatus("Testing voice...", "info");
  });

  function showStatus(text, type) {
    statusMsg.innerText = text;
    statusMsg.className = `status-banner show ${type}`;
    
    setTimeout(() => {
      statusMsg.classList.remove("show");
    }, 2500);
  }

  // Initial load
  populateVoices();
});
