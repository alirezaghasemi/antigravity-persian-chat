const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('apply-persian-rtl.sh copies fonts to workbench directory', () => {
  const shPath = path.join(__dirname, '../apply-persian-rtl.sh');
  const content = fs.readFileSync(shPath, 'utf8');

  assert.ok(
    content.includes('cp -r') && content.includes('fonts') && content.includes('WORKBENCH_DIR'),
    'apply-persian-rtl.sh must copy fonts folder to WORKBENCH_DIR for offline loading'
  );
});

test('src/extension.js copies fonts to workbench directory', () => {
  const extPath = path.join(__dirname, '../src/extension.js');
  const content = fs.readFileSync(extPath, 'utf8');

  assert.ok(
    content.includes('fonts') && (content.includes('cpSync') || content.includes('copyFileSync')),
    'extension.js must copy fonts to workbench folder'
  );
});

