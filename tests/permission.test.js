const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

test('apply-persian-rtl.sh does not break chrome-sandbox permissions', () => {
  const scriptContent = fs.readFileSync(path.join(repoRoot, 'apply-persian-rtl.sh'), 'utf8');

  // Must NOT chown the entire /opt/antigravity-ide root recursively
  assert.strictEqual(
    scriptContent.includes('chown -R "$CURRENT_USER:$CURRENT_USER" /opt/antigravity-ide\n') ||
    scriptContent.includes('chown -R "$CURRENT_USER:$CURRENT_USER" /opt/antigravity-ide '),
    false,
    'Script must not chown the entire /opt/antigravity-ide directory, which breaks chrome-sandbox'
  );

  // Must ensure chrome-sandbox permissions are set to root:root 4755
  assert.ok(
    scriptContent.includes('chrome-sandbox') && scriptContent.includes('4755'),
    'Script must check or ensure chrome-sandbox has 4755 permissions and root ownership'
  );

  // Must target APP_PATH (resources/app) for user permissions
  assert.ok(
    scriptContent.includes('"$APP_PATH"'),
    'Script must specifically target $APP_PATH for user write permissions'
  );
});

test('extension.js does not suggest breaking chrome-sandbox', () => {
  const extensionContent = fs.readFileSync(path.join(repoRoot, 'src', 'extension.js'), 'utf8');

  // Must NOT suggest recursive chown on /opt/antigravity-ide
  assert.strictEqual(
    extensionContent.includes('sudo chown -R $USER /opt/antigravity-ide`'),
    false,
    'Extension must not recommend chown on /opt/antigravity-ide'
  );

  // Should target resources/app and preserve/restore chrome-sandbox
  assert.ok(
    extensionContent.includes('resources/app') && extensionContent.includes('chrome-sandbox'),
    'Extension command must target resources/app and restore chrome-sandbox'
  );
});
