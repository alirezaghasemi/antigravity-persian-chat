const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Cursor extension does not collide with Antigravity extension', () => {
  const agPkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
  const cursorPkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

  // Names and IDs must differ
  assert.notEqual(cursorPkg.name, agPkg.name, 'Extension names must differ');
  assert.notEqual(cursorPkg.displayName, agPkg.displayName, 'Display names must differ');

  // Commands must not overlap
  const agCommands = agPkg.contributes.commands.map(c => c.command);
  const cursorCommands = cursorPkg.contributes.commands.map(c => c.command);

  for (const cmd of cursorCommands) {
    assert.equal(
      agCommands.includes(cmd),
      false,
      `Command "${cmd}" must not collide with Antigravity commands`
    );
  }

  // Configuration keys must not overlap
  const agConfigKeys = Object.keys(agPkg.contributes.configuration.properties);
  const cursorConfigKeys = Object.keys(cursorPkg.contributes.configuration.properties);

  for (const key of cursorConfigKeys) {
    assert.equal(
      agConfigKeys.includes(key),
      false,
      `Configuration key "${key}" must not collide with Antigravity configuration keys`
    );
  }
});
