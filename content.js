// content.js - Handles page selection, floating button, card overlay, and robust sentence TTS controls

let floatingBtn = null;
let card = null;
let currentSimplifiedText = "";
let playbackState = "stopped"; // "speaking", "paused", "stopped", "loading"

let sentences = [];
let currentSentenceIndex = 0;

// Listen for messages from background script about TTS events
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "sentence_finished") {
    if (playbackState === "speaking") {
      currentSentenceIndex++;
      speakNextSentence();
    }
  } else if (request.action === "sentence_stopped") {
    // Sentence finished speaking due to interruption or error
  }
});

// Track mouseup to check selection and show floating button
document.addEventListener("mouseup", function(event) {
  // If clicking inside the active card or floating button, do nothing
  if (card && card.contains(event.target)) return;
  if (floatingBtn && floatingBtn.contains(event.target)) return;

  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  // Remove existing floating button if clicking elsewhere
  if (floatingBtn && selectedText.length === 0) {
    removeFloatingBtn();
  }

  // If text is selected and it is outside our overlay card
  if (selectedText.length > 0) {
    // Check if range starts/ends inside the card
    try {
      const range = selection.getRangeAt(0);
      if (card && (card.contains(range.startContainer) || card.contains(range.endContainer))) {
        return;
      }
    } catch (e) {}

    // Show floating button
    showFloatingButton(event);
  }
});

// Remove overlays on click outside
document.addEventListener("mousedown", function(event) {
  if (floatingBtn && !floatingBtn.contains(event.target)) {
    removeFloatingBtn();
  }
  if (card && !card.contains(event.target) && event.target.id !== "simplify-speak-floating-btn") {
    // If the user clicks outside, stop audio and remove card
    stopAudio();
    removeCard();
  }
});

function showFloatingButton(event) {
  removeFloatingBtn();

  floatingBtn = document.createElement("button");
  floatingBtn.id = "simplify-speak-floating-btn";
  floatingBtn.innerHTML = `<span class="ss-btn-icon">🔊</span> Simplify & Speak`;

  // Get selection bounding box for precise positioning
  try {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Position button slightly below selection bounding rect
    floatingBtn.style.top = (rect.bottom + window.scrollY + 10) + "px";
    floatingBtn.style.left = Math.max(10, Math.min(window.innerWidth - 180, rect.left + window.scrollX)) + "px";
  } catch (e) {
    // Fallback to mouse coordinates if range bounding rect fails
    floatingBtn.style.top = (event.pageY + 15) + "px";
    floatingBtn.style.left = Math.max(10, event.pageX) + "px";
  }

  document.body.appendChild(floatingBtn);

  // Trigger simplify action on click
  floatingBtn.addEventListener("click", function(e) {
    e.stopPropagation();
    const selectionText = window.getSelection().toString().trim();
    if (selectionText) {
      removeFloatingBtn();
      showCard(selectionText);
    }
  });
}

function removeFloatingBtn() {
  if (floatingBtn) {
    floatingBtn.remove();
    floatingBtn = null;
  }
}

function showCard(originalText) {
  removeCard();

  card = document.createElement("div");
  card.id = "simplify-speak-card";

  // Position card near where selection was
  try {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    card.style.top = (rect.bottom + window.scrollY + 12) + "px";
    card.style.left = Math.max(16, Math.min(window.innerWidth - 380, rect.left + window.scrollX)) + "px";
  } catch (e) {
    card.style.top = (window.scrollY + 100) + "px";
    card.style.left = "20px";
  }

  card.innerHTML = `
    <div class="ss-header">
      <span class="ss-title">✨ Simplify & Speak</span>
      <button class="ss-close-btn" id="ss-close-btn" title="Close">&times;</button>
    </div>
    <div class="ss-content" id="ss-content">
      <div class="ss-loader">
        <div class="ss-spinner"></div>
        <div class="ss-loading-text">Simplifying text...</div>
      </div>
    </div>
    <div class="ss-controls" id="ss-controls" style="display: none;">
      <button class="ss-control-btn" id="ss-play-pause-btn" title="Pause">⏸</button>
      <button class="ss-control-btn" id="ss-stop-btn" title="Stop">⏹</button>
      <span class="ss-divider"></span>
      <label class="ss-label" for="ss-speed-select">Speed:</label>
      <select class="ss-speed-select" id="ss-speed-select">
        <option value="0.8">0.8x</option>
        <option value="1.0" selected>1.0x</option>
        <option value="1.2">1.2x</option>
        <option value="1.5">1.5x</option>
      </select>
      <div class="ss-status-container">
        <span class="ss-status-dot"></span>
        <span class="ss-status-text" id="ss-status-text">Speaking</span>
      </div>
    </div>
  `;

  document.body.appendChild(card);

  // Setup close listener
  document.getElementById("ss-close-btn").addEventListener("click", () => {
    stopAudio();
    removeCard();
  });

  // Call background to simplify text
  playbackState = "loading";
  chrome.runtime.sendMessage({ action: "simplify", text: originalText }, function(response) {
    if (!card) return; // User closed card before response

    const contentDiv = document.getElementById("ss-content");

    if (response && response.error) {
      playbackState = "stopped";
      if (response.error === "API_KEY_MISSING") {
        contentDiv.innerHTML = `
          <div class="ss-error-message">
            <strong>API Key Missing</strong><br>
            Please set your Gemini or NVIDIA API key in the extension popup to use this tool.
          </div>
        `;
      } else {
        contentDiv.innerHTML = `
          <div class="ss-error-message">
            <strong>Simplification Failed</strong><br>
            ${response.error}
          </div>
        `;
      }
      return;
    }

    if (response && response.simplifiedText) {
      currentSimplifiedText = response.simplifiedText;
      contentDiv.innerHTML = `<div class="ss-text-body">${formatText(currentSimplifiedText)}</div>`;
      
      // Setup controls
      setupControls();
      
      // Start speaking automatically
      speakText(currentSimplifiedText);
    } else {
      playbackState = "stopped";
      contentDiv.innerHTML = `<div class="ss-error-message">No response received from AI.</div>`;
    }
  });
}

function removeCard() {
  if (card) {
    card.remove();
    card = null;
    currentSimplifiedText = "";
    playbackState = "stopped";
    sentences = [];
    currentSentenceIndex = 0;
  }
}

// ponytail: naive regex markdown parser, replace with marked.js if complex formatting (like tables) is required
function formatText(text) {
  // Convert basic double newlines to paragraphs and clean up trailing spaces/asterisks
  return text
    .split("\n\n")
    .map(para => `<p>${para.replace(/\*\*/g, "").replace(/^\* /gm, "• ").replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function setupControls() {
  const controlsDiv = document.getElementById("ss-controls");
  controlsDiv.style.display = "flex";

  const playPauseBtn = document.getElementById("ss-play-pause-btn");
  const stopBtn = document.getElementById("ss-stop-btn");
  const speedSelect = document.getElementById("ss-speed-select");
  const statusText = document.getElementById("ss-status-text");
  const statusDot = card.querySelector(".ss-status-dot");

  // Load configured rate from storage to pre-select
  chrome.storage.local.get(["ttsRate"], function(data) {
    if (data.ttsRate) {
      speedSelect.value = data.ttsRate;
    }
  });

  playPauseBtn.addEventListener("click", () => {
    if (playbackState === "speaking") {
      // Pause - Send stop to background to silence speech immediately, but keep index position
      chrome.runtime.sendMessage({ action: "stop" }, () => {
        playbackState = "paused";
        playPauseBtn.innerHTML = "▶";
        playPauseBtn.title = "Play";
        statusText.innerText = "Paused";
        statusDot.classList.add("ss-status-dot-paused");
      });
    } else if (playbackState === "paused") {
      // Resume - continue speaking from current sentence index
      playbackState = "speaking";
      playPauseBtn.innerHTML = "⏸";
      playPauseBtn.title = "Pause";
      statusText.innerText = "Speaking";
      statusDot.classList.remove("ss-status-dot-paused");
      speakNextSentence();
    } else if (playbackState === "stopped") {
      // Play again from start
      speakText(currentSimplifiedText);
    }
  });

  stopBtn.addEventListener("click", () => {
    stopAudio();
  });

  speedSelect.addEventListener("change", () => {
    const rate = speedSelect.value;
    chrome.storage.local.set({ ttsRate: rate }, () => {
      // If we are currently speaking, stop and restart from current sentence index to apply speed
      if (playbackState === "speaking") {
        chrome.runtime.sendMessage({ action: "stop" }, () => {
          speakNextSentence();
        });
      }
    });
  });
}

function speakText(text) {
  // Split simplified text into sentences based on standard punctuation
  // Avoids splitting on decimals (e.g. 1.5) by validating characters
  sentences = text.split(/(?<=[.!?])\s+(?=[a-zA-Z0-9])/g).filter(s => s.trim().length > 0);
  currentSentenceIndex = 0;
  
  if (sentences.length === 0) return;

  playbackState = "speaking";
  updateUIForSpeaking();
  speakNextSentence();
}

function speakNextSentence() {
  if (playbackState !== "speaking") return;
  
  if (currentSentenceIndex >= sentences.length) {
    playbackState = "stopped";
    updateUIForStopped();
    return;
  }
  
  const sentence = sentences[currentSentenceIndex].trim();
  if (sentence.length > 0) {
    chrome.runtime.sendMessage({ action: "speak", text: sentence });
  } else {
    currentSentenceIndex++;
    speakNextSentence();
  }
}

function stopAudio() {
  if (playbackState !== "stopped") {
    chrome.runtime.sendMessage({ action: "stop" });
    playbackState = "stopped";
    currentSentenceIndex = 0;
    updateUIForStopped();
  }
}

function updateUIForSpeaking() {
  const playPauseBtn = document.getElementById("ss-play-pause-btn");
  const statusText = document.getElementById("ss-status-text");
  const statusDot = card?.querySelector(".ss-status-dot");

  if (playPauseBtn) {
    playPauseBtn.innerHTML = "⏸";
    playPauseBtn.title = "Pause";
  }
  if (statusText) {
    statusText.innerText = "Speaking";
  }
  if (statusDot) {
    statusDot.classList.remove("ss-status-dot-paused");
  }
}

function updateUIForStopped() {
  const playPauseBtn = document.getElementById("ss-play-pause-btn");
  const statusText = document.getElementById("ss-status-text");
  const statusDot = card?.querySelector(".ss-status-dot");

  if (playPauseBtn) {
    playPauseBtn.innerHTML = "▶";
    playPauseBtn.title = "Play";
  }
  if (statusText) {
    statusText.innerText = "Stopped";
  }
  if (statusDot) {
    statusDot.classList.add("ss-status-dot-paused");
  }
}
