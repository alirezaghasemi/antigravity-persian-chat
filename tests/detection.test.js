const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Extract detectDirection from src/persian-chat.js
function getDetectDirection() {
  const scriptPath = path.join(__dirname, '../src/persian-chat.js');
  const content = fs.readFileSync(scriptPath, 'utf8');
  const match = content.match(/function detectDirection\([\s\S]*?\n  \}/);
  if (!match) throw new Error('detectDirection function not found');

  const PERSIAN_CHARS_REGEX = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFC]/;
  const PERSIAN_CHARS_GLOBAL = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFC]/g;
  const LATIN_CHARS_GLOBAL = /[A-Za-z]/g;

  const fn = new Function(
    'PERSIAN_CHARS_REGEX',
    'PERSIAN_CHARS_GLOBAL',
    'LATIN_CHARS_GLOBAL',
    `return ${match[0]}`
  )(PERSIAN_CHARS_REGEX, PERSIAN_CHARS_GLOBAL, LATIN_CHARS_GLOBAL);

  return fn;
}

test('detectDirection detects Persian and English properly', () => {
  const detectDirection = getDetectDirection();

  assert.equal(detectDirection('سلام دنیا'), 'rtl');
  assert.equal(detectDirection('Hello world'), 'ltr');
  assert.equal(detectDirection('این یک تست با کد `const a = 1;` است'), 'rtl');
  assert.equal(detectDirection('Fix the bug in src/index.ts please'), 'ltr');
  assert.equal(detectDirection('۱. گزینه اول'), 'rtl');
  assert.equal(detectDirection(''), null);
});

