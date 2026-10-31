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

test('published page wires source-grounded state changes into storyboard scenes and local AI', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /from ["']\.\/src\/scene-state-changes\.js["']/);
  assert.match(html, /inferStoryboardStateChanges\(preparedScenes,lang,character\)/);
  assert.match(html, /inferStoryboardStateChanges\(castScenes,language,character\)/);
});


test('published storyboard workflow rebuilds the event chain after cast and state inference', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /from ["']\.\/src\/story-event-chain\.js["']/);
  assert.match(html, /eventChain:buildStoryEventChain\(sceneMetadata\)/);
  assert.match(html, /eventChain:buildStoryEventChain\(preparedScenes\)/);
});


test('scene editor exposes local voice generation and explicitly labels export limitations', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /createBrowserLocalTtsEngine/);
  assert.match(html, /createVoiceAudioStorage/);
  assert.match(html, /assignCharacterVoices/);
  assert.match(html, /buildSceneVoiceTimeline/);
  assert.match(html, /id="loadSceneVoiceModel"/);
  assert.match(html, /id="generateSceneVoices"/);
  assert.match(html, /id="voiceNonCommercialConsent"/);
  assert.match(html, /voiceTracks\.push\(\{cueId:cue\.cueId,blob:record\.blob,startMs\}\)/);
  assert.match(html, /createAudioExportSession\(\{videoStream:stream,audioElement,volume:Number\(\$\('audioVolume'\)\.value\)\/100,voiceTracks,voiceVolume:0\.9\}\)/);
  assert.match(html, /Generated scene dialogue is mixed into WebM at its scheduled time/);
});


test('WebM export derives built-in character mouth movement from scheduled local dialogue WAVs', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /buildAudioMouthEnvelope, sampleAudioMouthEnvelope/);
  assert.match(html, /decodeContext\.decodeAudioData\(await track\.blob\.arrayBuffer\(\)\)/);
  assert.match(html, /exportMouthTracks\.push\(\{sceneIndex:track\.sceneIndex,startMs:track\.startMs,envelope\}\)/);
  assert.match(html, /exportElapsedMs>=track\.startMs/);
  assert.match(html, /sampleAudioMouthEnvelope\(activeMouthTrack\.envelope,exportElapsedMs-activeMouthTrack\.startMs\)/);
  assert.match(html, /exportMouthOriginFrame=frame;\s*recorder\.start\(250\)/);
  assert.match(html, /track\.characterName\.trim\(\)\.toLowerCase\(\)!==mainCharacterKey/);
});
