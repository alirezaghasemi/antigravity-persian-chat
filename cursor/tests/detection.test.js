const test = require('node:test');
const assert = require('node:assert/strict');
const { detectDirection } = require('../src/utils.js');

test('detectDirection correctly identifies Persian, English, and mixed inputs', () => {
  // Pure Persian
  assert.equal(detectDirection('سلام دنیا'), 'rtl');
  assert.equal(detectDirection('این یک پیام آزمایشی در نرم‌افزار کرسر است.'), 'rtl');

  // Pure English
  assert.equal(detectDirection('Hello world'), 'ltr');
  assert.equal(detectDirection('This is a test message in Cursor IDE.'), 'ltr');

  // Persian with numbers and symbols
  assert.equal(detectDirection('شماره ۱۲۳: خطای ۵۰۰ رخ داد!'), 'rtl');

  // Persian with code blocks or technical terms
  assert.equal(detectDirection('تابع `fetchData` را فراخوانی کنید.'), 'rtl');

  // English with code
  assert.equal(detectDirection('Call the function `getUser()` to get data.'), 'ltr');

  // URLs ignored
  assert.equal(detectDirection('مستندات در https://cursor.com موجود است'), 'rtl');
  assert.equal(detectDirection('Documentation at https://cursor.com'), 'ltr');

  // Empty / Whitespace
  assert.equal(detectDirection(''), null);
  assert.equal(detectDirection('   '), null);
  assert.equal(detectDirection('12345'), null);
});
