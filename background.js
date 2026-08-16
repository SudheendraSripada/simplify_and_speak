// background.js - Handles Gemini/NVIDIA API calls, local fallback summarizer, follow-up chat, and Chrome TTS commands

let currentTabId = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "simplify") {
    handleSimplify(request.text, sendResponse);
    return true; // Keep message channel open for async response
  } else if (request.action === "chat") {
    handleChat(request.message, request.history || [], request.context || "", sendResponse);
    return true;
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
        const fallbackText = localExtractiveSummarize(text, style);
        sendResponse({ simplifiedText: fallbackText, isFallback: true });
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
        const fallbackText = localExtractiveSummarize(text, style);
        sendResponse({ simplifiedText: fallbackText, isFallback: true });
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

// ponytail: naive frequency-based extractive summarizer for offline zero-config fallback
function localExtractiveSummarize(text, style) {
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[a-zA-Z0-9])/g)
    .map(s => s.trim())
    .filter(s => s.length > 15);
  
  if (sentences.length <= 2) return text;

  const stopWords = new Set([
    "the","is","in","and","to","of","a","that","it","for","on","with","as",
    "this","was","at","by","an","be","from","or","are","your","you","we",
    "our","their","they","can","have","has","were","been","will","would"
  ]);
  
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const freq = {};
  for (const w of words) {
    if (!stopWords.has(w)) freq[w] = (freq[w] || 0) + 1;
  }

  const scored = sentences.map((sentence, index) => {
    const sWords = sentence.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    let score = 0;
    for (const w of sWords) {
      if (freq[w]) score += freq[w];
    }
    score = score / Math.max(5, sWords.length);
    if (index === 0) score *= 1.3;
    return { sentence, score, index };
  });

  const targetCount = Math.max(2, Math.min(5, Math.ceil(sentences.length * 0.45)));
  scored.sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, targetCount).sort((a, b) => a.index - b.index);

  if (style === "bullets") {
    return selected.map(s => `• ${s.sentence}`).join("\n\n");
  }
  return selected.map(s => s.sentence).join(" ");
}

async function handleChat(message, history, context, sendResponse) {
  try {
    const settings = await chrome.storage.local.get(["apiProvider", "apiKey", "nvidiaApiKey"]);
    const provider = settings.apiProvider || "gemini";
    const sysPrompt = `You are an AI assistant assisting a reader. You have simplified the following passage for them:\n\n"""\n${context}\n"""\n\nAnswer the reader's question clearly, concisely, and directly. Keep answers plain and brief without fluff.`;

    if (provider === "nvidia") {
      const nvidiaKey = settings.nvidiaApiKey;
      if (!nvidiaKey) {
        sendResponse({ reply: "Please configure your NVIDIA API key in the extension settings to enable interactive follow-up chat." });
        return;
      }
      const messages = [
        { role: "system", content: sysPrompt },
        ...history.map(h => ({ role: h.role, content: h.content })),
        { role: "user", content: message }
      ];
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${nvidiaKey}` },
        body: JSON.stringify({ model: "meta/llama-3.1-8b-instruct", messages, max_tokens: 500 })
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content?.trim() || "No response received.";
      sendResponse({ reply });
    } else {
      const apiKey = settings.apiKey;
      if (!apiKey) {
        sendResponse({ reply: "Please configure your Gemini API key in the extension settings to enable interactive follow-up chat." });
        return;
      }
      const prompt = `${sysPrompt}\n\nConversation Context:\n${history.map(h => `${h.role}: ${h.content}`).join("\n")}\nuser: ${message}\nassistant:`;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "No response received.";
      sendResponse({ reply });
    }
  } catch (err) {
    sendResponse({ reply: `Error: ${err.message || "Failed to generate answer"}` });
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
