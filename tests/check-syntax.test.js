import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('repository syntax checker covers source, tests, scripts, vendor and app configs', () => {
  const script = fileURLToPath(new URL('../scripts/check-syntax.js', import.meta.url));
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'repository syntax check failed');
  assert.match(result.stdout, /Syntax checked \\d+ JavaScript files/);
});
