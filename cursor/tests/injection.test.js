const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  injectHtml,
  removeHtml,
  computeChecksum,
  updateChecksumInProduct,
  restoreProductJson,
  TAG_START,
  TAG_END,
} = require('../src/utils.js');

test('HTML injection and removal correctly handles Cursor workbench.html', () => {
  const originalHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Cursor</title>
</head>
<body>
</body>
</html>`;

  // Injection
  const injectedHtml = injectHtml(originalHtml, './cursor-persian.css', './cursor-persian.js');
  assert.ok(injectedHtml.includes(TAG_START), 'Should contain start tag');
  assert.ok(injectedHtml.includes(TAG_END), 'Should contain end tag');
  assert.ok(injectedHtml.includes('href="./cursor-persian.css"'), 'Should link cursor-persian.css');
  assert.ok(injectedHtml.includes('src="./cursor-persian.js"'), 'Should link cursor-persian.js');
  assert.ok(injectedHtml.includes('</html>'), 'Should retain closing html tag');

  // Double injection prevention
  const doubleInjected = injectHtml(injectedHtml, './cursor-persian.css', './cursor-persian.js');
  assert.equal(doubleInjected, injectedHtml, 'Double injection must be a no-op');

  // Removal
  const restoredHtml = removeHtml(injectedHtml);
  assert.ok(!restoredHtml.includes(TAG_START), 'Should not contain start tag');
  assert.ok(!restoredHtml.includes(TAG_END), 'Should not contain end tag');
  assert.ok(!restoredHtml.includes('cursor-persian.css'), 'Should not contain css link');
  assert.ok(restoredHtml.includes('</html>'), 'Should retain closing tag');
});

test('Product checksums calculate and update correctly for Cursor electron-sandbox path', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-test-'));
  const testHtml = path.join(tmpDir, 'workbench.html');
  const testProduct = path.join(tmpDir, 'product.json');

  fs.writeFileSync(testHtml, '<html><body>Cursor Content</body></html>', 'utf8');

  const initialProduct = {
    nameShort: 'Cursor',
    checksums: {
      'vs/code/electron-sandbox/workbench/workbench.html': 'OLD_HASH',
      'vs/workbench/workbench.desktop.main.js': 'MAIN_JS_HASH'
    }
  };
  fs.writeFileSync(testProduct, JSON.stringify(initialProduct, null, 2), 'utf8');

  const expectedHash = computeChecksum(testHtml);
  assert.ok(expectedHash && expectedHash.length > 10, 'Hash should be non-empty base64');

  updateChecksumInProduct(testProduct, {
    'vs/code/electron-sandbox/workbench/workbench.html': testHtml
  });

  const updatedProduct = JSON.parse(fs.readFileSync(testProduct, 'utf8'));
  assert.equal(
    updatedProduct.checksums['vs/code/electron-sandbox/workbench/workbench.html'],
    expectedHash,
    'Checksum in product.json should match the computed hash'
  );
  assert.ok(fs.existsSync(testProduct + '.bak'), 'Backup file must exist');

  restoreProductJson(testProduct);
  const revertedProduct = JSON.parse(fs.readFileSync(testProduct, 'utf8'));
  assert.equal(
    revertedProduct.checksums['vs/code/electron-sandbox/workbench/workbench.html'],
    'OLD_HASH',
    'Product checksum should revert to original on restore'
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
