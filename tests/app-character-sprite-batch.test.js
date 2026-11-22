import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

test('batch sprite generation persists the same current-scene edits used by its planner before provider calls', () => {
  const start = app.indexOf("$('generateCharacterSprites').addEventListener('click'");
  const end = app.indexOf('function renderCharacterRigPartSets', start);
  const block = app.slice(start, end);
  assert.ok(start >= 0 && end > start);
  const merge = block.indexOf('mergeCharacterSpriteSceneOverrides(currentMeta,currentSceneOverrides)');
  const persist = block.indexOf('sceneMetadata[sceneIndex]=updatedCurrentScene');
  const provider = block.indexOf('generateCharacterSpriteAsset({plan');
  assert.ok(merge >= 0 && persist > merge && provider > persist);
  assert.match(block, /eventChain:buildStoryEventChain\(sceneMetadata\)/);
  assert.match(block, /titles\[sceneIndex\]=updatedCurrentScene\.title/);
  assert.match(block, /descriptions\[sceneIndex\]=updatedCurrentScene\.description/);
});


test('keeps the single-scene sprite planner imported for the live production preview', () => {
  assert.match(app, /import\\s+\\{[^}]*\\bbuildCharacterSpriteAssetPlan\\b[^}]*\\}\\s+from\\s+['"]\\.\\/character-sprite-asset-plan\\.js['"]/);
  assert.match(app, /buildCharacterSpriteAssetPlan\\(scene,characterBible\\)/);
});
