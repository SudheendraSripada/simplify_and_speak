// test_check.js - Validation and unit tests for Simplify & Speak extension

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("🚀 Starting Self-Check for Simplify & Speak Chrome Extension...\n");

// 1. Verify Manifest and file existence
try {
  const manifestPath = path.join(__dirname, 'manifest.json');
  console.log("Checking manifest.json...");
  
  assert.ok(fs.existsSync(manifestPath), "manifest.json does not exist!");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  assert.strictEqual(manifest.manifest_version, 3, "Manifest version must be 3!");
  assert.strictEqual(manifest.name, "Simplify & Speak", "Manifest name is incorrect!");

  // Verify background script path
  const bgPath = path.join(__dirname, manifest.background.service_worker);
  console.log(`Verifying background service worker: ${manifest.background.service_worker}`);
  assert.ok(fs.existsSync(bgPath), `Background worker file not found at ${bgPath}`);

  // Verify content scripts
  manifest.content_scripts.forEach(scriptGroup => {
    scriptGroup.js.forEach(jsFile => {
      const jsPath = path.join(__dirname, jsFile);
      console.log(`Verifying content JS file: ${jsFile}`);
      assert.ok(fs.existsSync(jsPath), `Content script file not found at ${jsPath}`);
    });
    
    scriptGroup.css.forEach(cssFile => {
      const cssPath = path.join(__dirname, cssFile);
      console.log(`Verifying content CSS file: ${cssFile}`);
      assert.ok(fs.existsSync(cssPath), `Content CSS file not found at ${cssPath}`);
    });
  });

  // Verify action popup
  const popupPath = path.join(__dirname, manifest.action.default_popup);
  console.log(`Verifying popup HTML: ${manifest.action.default_popup}`);
  assert.ok(fs.existsSync(popupPath), `Popup HTML file not found at ${popupPath}`);
  
  if (manifest.action.default_icon) {
    const iconPath = path.join(__dirname, manifest.action.default_icon);
    console.log(`Verifying action icon: ${manifest.action.default_icon}`);
    assert.ok(fs.existsSync(iconPath), `Action icon file not found at ${iconPath}`);
  }

  console.log("✅ File structure check: PASSED\n");

} catch (err) {
  console.error("❌ File structure check: FAILED");
  console.error(err);
  process.exit(1);
}

// 2. Unit test: Extractive Summarizer Logic
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

try {
  console.log("Testing offline extractive summarizer...");
  const sampleArticle = "Artificial intelligence is transforming every industry rapidly across the globe. Machine learning models can analyze vast amounts of data in seconds. However, reading long AI generated responses can sometimes be tiring and hard to digest. Text to speech systems allow users to listen to content hands free. Summarization algorithms extract the key sentences so people save valuable time.";
  const summary = localExtractiveSummarize(sampleArticle, "standard");
  assert.ok(summary.length > 0, "Summary output is empty!");
  assert.ok(summary.length < sampleArticle.length, "Summary did not condense the input text!");
  console.log("✅ Offline Extractive Summarizer: PASSED\n");

  console.log("🎉 All self-checks passed successfully!");
} catch (err) {
  console.error("❌ Summarizer test: FAILED");
  console.error(err);
  process.exit(1);
}
