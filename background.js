// background.js - Handles Gemini/NVIDIA API call and Chrome TTS commands

let currentTabId = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "simplify") {
    handleSimplify(request.text, sendResponse);
    return true; // Keep message channel open for async response
  } else if (request.action === "speak") {
    currentTabId = sender.tab ? sender.tab.id : null;
    handleSpeak(request.text, currentTabId);
    sendResponse({ status: "Speaking started" });
  } else if (request.action === "stop") {
    chrome.tts.stop();
    sendResponse({ status: "Speaking stopped" });
  }
});

async function handleSimplify(text, sendResponse) {
  try {
    const settings = await chrome.storage.local.get([
      "apiProvider",
      "apiKey",
      "nvidiaApiKey",
      "simplificationStyle"
    ]);

    const provider = settings.apiProvider || "gemini";
    const style = settings.simplificationStyle || "standard";

    let systemInstruction = "Simplify the following text so it is very easy to read and understand. Keep the key information but make it concise, plain, and straightforward. Respond ONLY with the simplified text, no conversational introductions, preambles, or formatting headers.";
    if (style === "eli5") {
      systemInstruction = "Explain the following text like I'm 5 years old. Use simple analogies, very basic words, and keep it concise. Respond ONLY with the simplified text, no conversational introductions or preambles.";
    } else if (style === "bullets") {
      systemInstruction = "Summarize the key takeaways of the following text into clear, simple bullet points. Do not include markdown headers or titles. Respond ONLY with the bullet points, no conversational introductions or preambles.";
    } else if (style === "key_takeaways") {
      systemInstruction = "Extract the key takeaways of the following text in a brief, plain English paragraph. Respond ONLY with the key takeaways, no conversational introductions or preambles.";
    }

    if (provider === "nvidia") {
      const nvidiaKey = settings.nvidiaApiKey;
      if (!nvidiaKey) {
        sendResponse({ error: "API_KEY_MISSING" });
        return;
      }

      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${nvidiaKey}`
        },
        body: JSON.stringify({
          model: "meta/llama-3.1-8b-instruct",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: text }
          ],
          max_tokens: 1024
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData?.error?.message || `HTTP error! status: ${response.status}`;
        sendResponse({ error: errMsg });
        return;
      }

      const data = await response.json();
      const simplifiedText = data.choices?.[0]?.message?.content?.trim();
      if (!simplifiedText) {
        sendResponse({ error: "Empty response from NVIDIA API" });
        return;
      }
      sendResponse({ simplifiedText });

    } else {
      // Gemini
      const apiKey = settings.apiKey;
      if (!apiKey) {
        sendResponse({ error: "API_KEY_MISSING" });
        return;
      }

      const promptText = `${systemInstruction}\n\nOriginal Text:\n${text}`;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: promptText }]
          }]
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData?.error?.message || `HTTP error! status: ${response.status}`;
        sendResponse({ error: errMsg });
        return;
      }

      const data = await response.json();
      const simplifiedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!simplifiedText) {
        sendResponse({ error: "Empty response from Gemini API" });
        return;
      }
      sendResponse({ simplifiedText });
    }
  } catch (error) {
    sendResponse({ error: error.message || "Failed to contact AI API" });
  }
}

async function handleSpeak(text, tabId) {
  chrome.tts.stop();
  const settings = await chrome.storage.local.get(["ttsVoice", "ttsRate"]);
  const voiceName = settings.ttsVoice;
  const rate = settings.ttsRate ? parseFloat(settings.ttsRate) : 1.0;

  chrome.tts.speak(text, {
    voiceName: voiceName || undefined,
    rate: rate,
    enqueue: false,
    onEvent: (event) => {
      if (tabId) {
        if (event.type === "end") {
          chrome.tabs.sendMessage(tabId, { action: "sentence_finished" }).catch(() => {});
        } else if (event.type === "error" || event.type === "interrupted" || event.type === "cancelled") {
          chrome.tabs.sendMessage(tabId, { action: "sentence_stopped", eventType: event.type }).catch(() => {});
        }
      }
    }
  });
}
