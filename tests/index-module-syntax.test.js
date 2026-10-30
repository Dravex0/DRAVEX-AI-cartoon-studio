import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

test('published index contains exactly one parseable module script', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script\s+type=["']module["']\s*>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 1, 'expected one inline ES module in the published page');
  const result = spawnSync(process.execPath, ['--check', '--input-type=module'], {
    input: scripts[0][1],
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'inline module syntax check failed');
});

test('published page imports the prompt-guided motion module', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /from ["']\.\/src\/prompt-camera-motion\.js["']/);
  assert.match(html, /getPromptCameraTransform\(currentSceneData\.motionPrompt/);
});

test('local AI director receives and preserves the saved character bible', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /directStoryboardWithLocalAI\(\{runtime:localTextRuntime,basePlan,storyText:story,language:languageName,character,characterBible\}\)/);
  assert.match(html, /function ensureMainCharacterReference\(character\)/);
  assert.doesNotMatch(html, /characterBible=upsertCharacterReference\(\[\],\s*\{characterId:character\}\)/);
});
