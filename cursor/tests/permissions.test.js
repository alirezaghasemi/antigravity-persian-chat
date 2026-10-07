const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('apply-cursor-persian.sh strictly prevents modifying chrome-sandbox or parent root', () => {
  const scriptPath = path.join(__dirname, '../apply-cursor-persian.sh');
  const scriptContent = fs.readFileSync(scriptPath, 'utf8');

  // Must NOT chown the entire /usr/share/cursor root recursively
  assert.equal(
    scriptContent.includes('chown -R "$CURRENT_USER:$CURRENT_USER" /usr/share/cursor\n') ||
    scriptContent.includes('chown -R "$CURRENT_USER:$CURRENT_USER" /usr/share/cursor ') ||
    scriptContent.includes('chown -R "$CURRENT_USER:$CURRENT_USER" /opt/cursor'),
    false,
    'Script must not chown the entire cursor installation directory, which would break chrome-sandbox'
  );

  // Must protect chrome-sandbox permissions if touched
  assert.ok(
    scriptContent.includes('chrome-sandbox'),
    'Script must check or preserve chrome-sandbox root:4755 permissions'
  );

  // Must restrict permission scope to APP_PATH (resources/app)
  assert.ok(
    scriptContent.includes('sudo chown -R "$CURRENT_USER:$CURRENT_USER" "$APP_PATH"'),
    'Script should only grant write access to resources/app'
  );
});

test('extension.js does not suggest breaking chrome-sandbox permissions', () => {
  const extensionPath = path.join(__dirname, '../src/extension.js');
  const extensionContent = fs.readFileSync(extensionPath, 'utf8');

  // Must NOT suggest recursive chown on /usr/share/cursor
  assert.equal(
    extensionContent.includes('sudo chown -R $USER /usr/share/cursor`') ||
    extensionContent.includes('sudo chown -R $USER /opt/cursor`'),
    false,
    'Extension must not recommend chown on cursor root directory'
  );

  // Must explicitly ensure chrome-sandbox stays root:4755 if clipboard command is provided
  assert.ok(
    extensionContent.includes('4755'),
    'Clipboard command must preserve root:4755 for chrome-sandbox'
  );
});
