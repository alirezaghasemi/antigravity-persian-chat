const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('cursor-chat.js must NOT discard elements inside monaco-list-row', () => {
  const scriptPath = path.join(__dirname, '../src/cursor-chat.js');
  const content = fs.readFileSync(scriptPath, 'utf8');

  // Chat message rows in Cursor are wrapped in .monaco-list-row
  assert.equal(
    content.includes("el.closest('.monaco-list-row')"),
    false,
    'cursor-chat.js must not discard elements inside .monaco-list-row because chat list items are in monaco list rows'
  );
});

test('styles.css must be compliant with Cursor CSP and not use external @import', () => {
  const stylesPath = path.join(__dirname, '../styles.css');
  const content = fs.readFileSync(stylesPath, 'utf8');

  // External @import is blocked by Cursor CSP (style-src 'self' 'unsafe-inline')
  assert.equal(
    content.includes('@import url('),
    false,
    'styles.css must not use external @import which is blocked by Cursor CSP'
  );

  // Must reference local fonts directory
  assert.ok(
    content.includes('./fonts/vazirmatn-arabic.woff2') || content.includes('./fonts/'),
    'styles.css must reference bundled local fonts'
  );

  // Must include Cursor specific selectors
  assert.ok(content.includes('.rendered-markdown'), 'styles.css must include .rendered-markdown');
  assert.ok(content.includes('.composer-messages-container'), 'styles.css must include .composer-messages-container');
  assert.ok(content.includes('.composer-human-message'), 'styles.css must include .composer-human-message');
});
