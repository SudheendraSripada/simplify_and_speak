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
  
  // Verify scripts inside popup HTML exist
  const popupHtml = fs.readFileSync(popupPath, 'utf8');
  if (popupHtml.includes('src="popup.js"')) {
    const jsPath = path.join(__dirname, 'popup.js');
    console.log("Verifying popup JS: popup.js");
    assert.ok(fs.existsSync(jsPath), "popup.js referenced in popup.html but not found on disk!");
  }
  if (popupHtml.includes('href="popup.css"')) {
    const cssPath = path.join(__dirname, 'popup.css');
    console.log("Verifying popup CSS: popup.css");
    assert.ok(fs.existsSync(cssPath), "popup.css referenced in popup.html but not found on disk!");
  }
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

// 2. Unit test: formatText parser from content.js
function formatText(text) {
  return text
    .split("\n\n")
    .map(para => `<p>${para.replace(/\*\*/g, "").replace(/^\* /gm, "• ").replace(/\n/g, "<br>")}</p>`)
    .join("");
}

try {
  console.log("Testing text formatting rules...");

  // Test bold stripping
  const boldTest = "This is **bold** text.";
  const boldExpected = "<p>This is bold text.</p>";
  assert.strictEqual(formatText(boldTest), boldExpected, "Bold markdown formatting failed!");

  // Test paragraph layout
  const paragraphTest = "Paragraph one.\n\nParagraph two.";
  const paragraphExpected = "<p>Paragraph one.</p><p>Paragraph two.</p>";
  assert.strictEqual(formatText(paragraphTest), paragraphExpected, "Paragraph double-newline separation failed!");

  // Test list bullets
  const listTest = "* First item\n* Second item";
  const listExpected = "<p>• First item<br>• Second item</p>";
  assert.strictEqual(formatText(listTest), listExpected, "Bullet point formatting failed!");

  // Test single newlines inside paragraphs converting to <br>
  const newlineTest = "Line one.\nLine two.";
  const newlineExpected = "<p>Line one.<br>Line two.</p>";
  assert.strictEqual(formatText(newlineTest), newlineExpected, "Single newline <br> formatting failed!");

  console.log("✅ Text formatting tests: PASSED\n");
  console.log("🎉 All self-checks passed successfully!");

} catch (err) {
  console.error("❌ Text formatting tests: FAILED");
  console.error(err);
  process.exit(1);
}
