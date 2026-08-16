// content.js - Selection button, card overlay, sentence tracker, follow-up chat, export, and platform auto-injectors

let floatingBtn = null;
let card = null;
let currentOriginalText = "";
let currentSimplifiedText = "";
let playbackState = "stopped"; // "speaking", "paused", "stopped", "loading"

let sentences = [];
let currentSentenceIndex = 0;
let chatHistory = [];
let isFallbackActive = false;

// Listen for messages from background script about TTS events
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "sentence_finished") {
    if (playbackState === "speaking") {
      currentSentenceIndex++;
      speakNextSentence();
    }
  } else if (request.action === "sentence_stopped") {
    // Current sentence stopped/interrupted
  }
});

// Track mouseup to check selection and show floating button
document.addEventListener("mouseup", function(event) {
  if (card && card.contains(event.target)) return;
  if (floatingBtn && floatingBtn.contains(event.target)) return;

  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (floatingBtn && selectedText.length === 0) {
    removeFloatingBtn();
  }

  if (selectedText.length > 0) {
    try {
      const range = selection.getRangeAt(0);
      if (card && (card.contains(range.startContainer) || card.contains(range.endContainer))) {
        return;
      }
    } catch (e) {}

    showFloatingButton(event);
  }
});

// Remove overlays on click outside
document.addEventListener("mousedown", function(event) {
  if (floatingBtn && !floatingBtn.contains(event.target)) {
    removeFloatingBtn();
  }
  if (card && !card.contains(event.target) && event.target.id !== "simplify-speak-floating-btn" && !event.target.closest(".ss-inline-btn")) {
    stopAudio();
    removeCard();
  }
});

function showFloatingButton(event) {
  removeFloatingBtn();

  floatingBtn = document.createElement("button");
  floatingBtn.id = "simplify-speak-floating-btn";
  floatingBtn.innerHTML = `<span class="ss-btn-icon">🔊</span> Simplify & Speak`;

  try {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    floatingBtn.style.top = (rect.bottom + window.scrollY + 10) + "px";
    floatingBtn.style.left = Math.max(10, Math.min(window.innerWidth - 180, rect.left + window.scrollX)) + "px";
  } catch (e) {
    floatingBtn.style.top = (event.pageY + 15) + "px";
    floatingBtn.style.left = Math.max(10, event.pageX) + "px";
  }

  document.body.appendChild(floatingBtn);

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

function showCard(originalText, targetElement = null) {
  removeCard();
  currentOriginalText = originalText;
  chatHistory = [];

  card = document.createElement("div");
  card.id = "simplify-speak-card";

  // Check Accessibility font settings
  chrome.storage.local.get(["dyslexiaFont"], (data) => {
    if (data.dyslexiaFont) {
      card.classList.add("ss-dyslexic-font");
    }
  });

  if (targetElement) {
    const rect = targetElement.getBoundingClientRect();
    card.style.top = (rect.bottom + window.scrollY + 10) + "px";
    card.style.left = Math.max(16, Math.min(window.innerWidth - 380, rect.left + window.scrollX)) + "px";
  } else {
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
  }

  card.innerHTML = `
    <div class="ss-header">
      <div class="ss-header-left">
        <span class="ss-title">✨ Simplify & Speak</span>
        <span class="ss-badge" id="ss-badge" style="display:none;">Free Local AI</span>
      </div>
      <div class="ss-header-actions">
        <button class="ss-icon-btn" id="ss-copy-btn" title="Copy to Clipboard">📋</button>
        <button class="ss-icon-btn" id="ss-export-btn" title="Export Transcript (.txt)">📥</button>
        <button class="ss-close-btn" id="ss-close-btn" title="Close">&times;</button>
      </div>
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
    <!-- Follow-up Mini Chat -->
    <div class="ss-chat-section" id="ss-chat-section" style="display:none;">
      <div class="ss-chat-history" id="ss-chat-history"></div>
      <div class="ss-chat-input-bar">
        <input type="text" id="ss-chat-input" placeholder="Ask a follow-up question..." />
        <button id="ss-chat-send" title="Send Question">➤</button>
      </div>
    </div>
  `;

  document.body.appendChild(card);

  // Setup header tool listeners
  document.getElementById("ss-close-btn").addEventListener("click", () => {
    stopAudio();
    removeCard();
  });

  document.getElementById("ss-copy-btn").addEventListener("click", () => {
    if (currentSimplifiedText) {
      navigator.clipboard.writeText(currentSimplifiedText).then(() => {
        const copyBtn = document.getElementById("ss-copy-btn");
        copyBtn.innerText = "✅";
        setTimeout(() => { copyBtn.innerText = "📋"; }, 2000);
      });
    }
  });

  document.getElementById("ss-export-btn").addEventListener("click", () => {
    if (currentSimplifiedText) {
      const fullTranscript = `SIMPLIFY & SPEAK TRANSCRIPT\n\nORIGINAL TEXT:\n${currentOriginalText}\n\nSIMPLIFIED SUMMARY:\n${currentSimplifiedText}\n\nFOLLOW-UP Q&A:\n${chatHistory.map(h => `${h.role.toUpperCase()}: ${h.content}`).join('\n')}`;
      const blob = new Blob([fullTranscript], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `simplified-summary-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  });

  // Call background to simplify
  playbackState = "loading";
  chrome.runtime.sendMessage({ action: "simplify", text: originalText }, function(response) {
    if (!card) return;

    const contentDiv = document.getElementById("ss-content");

    if (response && response.error) {
      playbackState = "stopped";
      contentDiv.innerHTML = `
        <div class="ss-error-message">
          <strong>Simplification Failed</strong><br>
          ${response.error}
        </div>
      `;
      return;
    }

    if (response && response.simplifiedText) {
      currentSimplifiedText = response.simplifiedText;
      isFallbackActive = !!response.isFallback;

      if (isFallbackActive) {
        const badge = document.getElementById("ss-badge");
        if (badge) badge.style.display = "inline-block";
      }

      // Check Bionic Reading mode
      chrome.storage.local.get(["bionicReading"], (data) => {
        const useBionic = !!data.bionicReading;
        renderSentences(currentSimplifiedText, useBionic);
      });

      setupControls();
      setupChat();
      speakText(currentSimplifiedText);
    } else {
      playbackState = "stopped";
      contentDiv.innerHTML = `<div class="ss-error-message">No response received from AI.</div>`;
    }
  });
}

function renderSentences(text, useBionic = false) {
  const contentDiv = document.getElementById("ss-content");
  sentences = text.split(/(?<=[.!?])\s+(?=[a-zA-Z0-9])/g).filter(s => s.trim().length > 0);
  
  let html = "";
  sentences.forEach((sentence, idx) => {
    const formatted = useBionic ? applyBionic(sentence) : sentence;
    html += `<span class="ss-sentence-span" id="ss-s-${idx}">${formatted} </span>`;
  });

  contentDiv.innerHTML = `<div class="ss-text-body">${html}</div>`;
}

function applyBionic(text) {
  return text.replace(/\b([a-zA-Z]{2,})\b/g, (match) => {
    const mid = Math.ceil(match.length / 2);
    return `<b class="ss-bionic-bold">${match.slice(0, mid)}</b>${match.slice(mid)}`;
  });
}

function highlightActiveSentence(index) {
  if (!card) return;
  const allSpans = card.querySelectorAll(".ss-sentence-span");
  allSpans.forEach(span => span.classList.remove("ss-sentence-active"));

  const activeSpan = document.getElementById(`ss-s-${index}`);
  if (activeSpan) {
    activeSpan.classList.add("ss-sentence-active");
    activeSpan.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function removeCard() {
  if (card) {
    card.remove();
    card = null;
    currentOriginalText = "";
    currentSimplifiedText = "";
    playbackState = "stopped";
    sentences = [];
    currentSentenceIndex = 0;
    chatHistory = [];
  }
}

function setupControls() {
  const controlsDiv = document.getElementById("ss-controls");
  controlsDiv.style.display = "flex";

  const playPauseBtn = document.getElementById("ss-play-pause-btn");
  const stopBtn = document.getElementById("ss-stop-btn");
  const speedSelect = document.getElementById("ss-speed-select");

  chrome.storage.local.get(["ttsRate"], function(data) {
    if (data.ttsRate) {
      speedSelect.value = data.ttsRate;
    }
  });

  playPauseBtn.addEventListener("click", () => {
    if (playbackState === "speaking") {
      chrome.runtime.sendMessage({ action: "stop" }, () => {
        playbackState = "paused";
        updateUIForStopped(true);
      });
    } else if (playbackState === "paused") {
      playbackState = "speaking";
      updateUIForSpeaking();
      speakNextSentence();
    } else if (playbackState === "stopped") {
      speakText(currentSimplifiedText);
    }
  });

  stopBtn.addEventListener("click", () => {
    stopAudio();
  });

  speedSelect.addEventListener("change", () => {
    const rate = speedSelect.value;
    chrome.storage.local.set({ ttsRate: rate }, () => {
      if (playbackState === "speaking") {
        chrome.runtime.sendMessage({ action: "stop" }, () => {
          speakNextSentence();
        });
      }
    });
  });
}

function setupChat() {
  const chatSection = document.getElementById("ss-chat-section");
  const chatInput = document.getElementById("ss-chat-input");
  const chatSend = document.getElementById("ss-chat-send");
  const chatHistoryDiv = document.getElementById("ss-chat-history");

  chatSection.style.display = "flex";

  const handleSend = () => {
    const question = chatInput.value.trim();
    if (!question) return;

    chatInput.value = "";
    
    // Render user message
    const userMsg = document.createElement("div");
    userMsg.className = "ss-chat-bubble ss-chat-user";
    userMsg.innerText = question;
    chatHistoryDiv.appendChild(userMsg);
    chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;

    chatHistory.push({ role: "user", content: question });

    // Render loading bubble
    const aiMsg = document.createElement("div");
    aiMsg.className = "ss-chat-bubble ss-chat-ai ss-chat-loading";
    aiMsg.innerText = "Thinking...";
    chatHistoryDiv.appendChild(aiMsg);
    chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;

    chrome.runtime.sendMessage({
      action: "chat",
      message: question,
      history: chatHistory.slice(0, -1),
      context: currentSimplifiedText
    }, (res) => {
      aiMsg.classList.remove("ss-chat-loading");
      const answer = res?.reply || "No answer received.";
      aiMsg.innerText = answer;
      chatHistory.push({ role: "assistant", content: answer });
      chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;

      // Read reply aloud
      speakText(answer);
    });
  };

  chatSend.addEventListener("click", handleSend);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });
}

function speakText(text) {
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
    highlightActiveSentence(-1);
    return;
  }
  
  const sentence = sentences[currentSentenceIndex].trim();
  highlightActiveSentence(currentSentenceIndex);

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
    highlightActiveSentence(-1);
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

function updateUIForStopped(isPaused = false) {
  const playPauseBtn = document.getElementById("ss-play-pause-btn");
  const statusText = document.getElementById("ss-status-text");
  const statusDot = card?.querySelector(".ss-status-dot");

  if (playPauseBtn) {
    playPauseBtn.innerHTML = "▶";
    playPauseBtn.title = "Play";
  }
  if (statusText) {
    statusText.innerText = isPaused ? "Paused" : "Stopped";
  }
  if (statusDot) {
    statusDot.classList.add("ss-status-dot-paused");
  }
}

// ----------------------------------------------------
// Platform Auto-Injectors (ChatGPT, Gemini, Claude, Reddit)
// ----------------------------------------------------
function initPlatformInjectors() {
  chrome.storage.local.get(["enableAutoInject"], (data) => {
    if (data.enableAutoInject === false) return; // disabled by user

    const hostname = window.location.hostname;

    if (hostname.includes("chatgpt.com") || hostname.includes("openai.com")) {
      injectChatGPT();
    } else if (hostname.includes("gemini.google.com")) {
      injectGemini();
    } else if (hostname.includes("claude.ai")) {
      injectClaude();
    } else if (hostname.includes("reddit.com")) {
      injectReddit();
    }
  });
}

function injectChatGPT() {
  const observer = new MutationObserver(() => {
    const assistants = document.querySelectorAll('article div[data-message-author-role="assistant"]');
    assistants.forEach(node => {
      if (node.querySelector(".ss-inline-btn")) return;
      const btn = createInlineBtn(() => {
        const text = node.innerText.trim();
        if (text) showCard(text, btn);
      });
      node.parentElement?.appendChild(btn);
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function injectGemini() {
  const observer = new MutationObserver(() => {
    const responses = document.querySelectorAll('.model-response-text, message-content');
    responses.forEach(node => {
      if (node.querySelector(".ss-inline-btn")) return;
      const btn = createInlineBtn(() => {
        const text = node.innerText.trim();
        if (text) showCard(text, btn);
      });
      node.appendChild(btn);
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function injectClaude() {
  const observer = new MutationObserver(() => {
    const messages = document.querySelectorAll('.font-claude-message');
    messages.forEach(node => {
      if (node.querySelector(".ss-inline-btn")) return;
      const btn = createInlineBtn(() => {
        const text = node.innerText.trim();
        if (text) showCard(text, btn);
      });
      node.appendChild(btn);
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function injectReddit() {
  const observer = new MutationObserver(() => {
    const comments = document.querySelectorAll('shreddit-comment, div[data-testid="comment"]');
    comments.forEach(node => {
      if (node.querySelector(".ss-inline-btn")) return;
      const btn = createInlineBtn(() => {
        const text = node.innerText.trim();
        if (text) showCard(text, btn);
      });
      node.appendChild(btn);
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function createInlineBtn(onClick) {
  const btn = document.createElement("button");
  btn.className = "ss-inline-btn";
  btn.innerHTML = `<span>✨ Simplify & Listen</span>`;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

// Initialize platform injectors on load
initPlatformInjectors();
