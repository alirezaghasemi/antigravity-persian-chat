const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('styles.css includes Antigravity 2.6.0 selectors and offline fonts', () => {
  const stylesPath = path.join(__dirname, '../styles.css');
  const content = fs.readFileSync(stylesPath, 'utf8');

  // Must include local bundled font files for offline resilience
  assert.ok(
    content.includes('./fonts/vazirmatn-arabic.woff2') || content.includes('./fonts/'),
    'styles.css must reference local ./fonts/ directory for offline support'
  );

  // Must include Antigravity 2.6.0 DOM selectors
  assert.ok(
    content.includes('[data-testid="user-message-bubble"]'),
    'styles.css must style [data-testid="user-message-bubble"]'
  );
  assert.ok(
    content.includes('[data-quotable="true"]'),
    'styles.css must style [data-quotable="true"]'
  );
  assert.ok(
    content.includes('[data-testid="agent-input-box"]'),
    'styles.css must style [data-testid="agent-input-box"]'
  );
  assert.ok(
    content.includes('[contenteditable="true"]'),
    'styles.css must style [contenteditable="true"]'
  );
});

test('src/persian-chat.js includes Antigravity 2.6.0 selectors and robust mutation handling', () => {
  const scriptPath = path.join(__dirname, '../src/persian-chat.js');
  const content = fs.readFileSync(scriptPath, 'utf8');

  // TARGET_SELECTORS must cover user-message-bubble and data-quotable
  assert.ok(
    content.includes('[data-testid="user-message-bubble"]'),
    'TARGET_SELECTORS must include [data-testid="user-message-bubble"]'
  );
  assert.ok(
    content.includes('[data-quotable="true"]'),
    'TARGET_SELECTORS must include [data-quotable="true"]'
  );

  // Must handle contenteditable and agent-input-box in input observers
  assert.ok(
    content.includes('agent-input-box') || content.includes('processInput'),
    'persian-chat.js must explicitly process agent-input-box or have dedicated processInput'
  );

  // Must avoid returning early if React stripped class or dir attribute
  assert.ok(
    content.includes('classList.contains') || content.includes('hasRtlClass') || !content.includes('if (currentDir === dir) return;'),
    'persian-chat.js must ensure RTL classes are re-applied if React stripped them during re-render'
  );
});

