import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

test('published index loads one external module and the application module parses', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const appPath = new URL('../src/app.js', import.meta.url);
  assert.match(html, /<script type="module" src="\.\/src\/app\.js"><\/script>/);
  const result = spawnSync(process.execPath, ['--check', appPath.pathname], {
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'application module syntax check failed');
});



test('published page imports the prompt-guided motion module', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(html, /from ["']\.\/prompt-camera-motion\.js["']/);
  assert.match(html, /getPromptCameraTransform\(currentSceneData\.motionPrompt/);
});

test('local AI director receives and preserves the saved character bible', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(html, /directStoryboardWithLocalAI\(\{runtime:localTextRuntime,basePlan,storyText:story,language:languageName,character,characterBible\}\)/);
  assert.match(html, /function ensureMainCharacterReference\(character\)/);
  assert.doesNotMatch(html, /characterBible=upsertCharacterReference\(\[\],\s*\{characterId:character\}\)/);
});

test('published page wires source-grounded state changes into storyboard scenes and local AI', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(html, /from ["']\.\/scene-state-changes\.js["']/);
  assert.match(html, /inferStoryboardStateChanges\(preparedScenes,lang,character\)/);
  assert.match(html, /inferStoryboardStateChanges\(castScenes,language,character\)/);
});


test('published storyboard workflow rebuilds the event chain after cast and state inference', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(html, /from ["']\.\/story-event-chain\.js["']/);
  assert.match(html, /eventChain:buildStoryEventChain\(sceneMetadata\)/);
  assert.match(html, /eventChain:buildStoryEventChain\(preparedScenes\)/);
});


test('scene editor exposes local voice generation and explicitly labels export limitations', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(html, /createBrowserLocalTtsEngine/);
  assert.match(html, /createVoiceAudioStorage/);
  assert.match(html, /assignCharacterVoices/);
  assert.match(html, /buildSceneVoiceTimeline/);
  assert.match(html, /id="loadSceneVoiceModel"/);
  assert.match(html, /id="generateSceneVoices"/);
  assert.match(html, /id="voiceNonCommercialConsent"/);
  assert.ok(html.includes('voiceTracks.push({cueId:cue.cueId,blob:record.blob,startMs,durationMs:Number(cue.durationMs),sceneIndex:segment.sceneIndex,characterId:String(cue.characterId||cue.characterName||"Narrator"),characterName:String(cue.characterName||cue.characterId||"Narrator"),text:String(cue.text||""),language:String(cue.language||storyLanguage()),phonemeChunks:Array.isArray(cue.phonemeChunks)?cue.phonemeChunks:[],visemeEvents:Array.isArray(cue.visemeEvents)?cue.visemeEvents:[]})'));
  assert.match(html, /createAudioExportSession\(\{videoStream:stream,audioElement,volume:Number\(\$\('audioVolume'\)\.value\)\/100,voiceTracks,voiceVolume:0\.9\}\)/);
  assert.match(html, /Generated scene video clips are used when available/);
  assert.match(html, /WebM combines the clips with timed dialogue and optional local music/);
});


test('facial rig editor exposes bounded part positioning and expression controls', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(html, /id="characterFacialEditor"/);
  assert.match(html, /id="facialPartImageUrl"/);
  assert.match(html, /id="saveFacialPart"/);
  assert.match(html, /id="applyFacialExpression"/);
  assert.match(html, /upsertCharacterFacialPart\(sceneMetadata/);
  assert.match(html, /applyCharacterFacialExpressionToScene\(/);
});

test('scene Play preview schedules local dialogue and drives facial lip-sync from the same audio clock', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(html, /createVoicePreviewSession/);
  assert.match(html, /previewMouthOriginTimeMs=await pendingSession.start\(\)/);
  assert.match(html, /previewMouthTracks=pendingSession\.decodedTracks\.map/);
  assert.match(html, /startSceneVoicePreview\(sceneIndex\)/);
  assert.match(html, /stopSceneVoicePreview\(\)/);
  assert.match(html, /activeMouthTracks=exportMouthOriginTimeMs!==null\?exportMouthTracks:previewMouthTracks/);
});
test('WebM export derives built-in character mouth movement from scheduled local dialogue WAVs', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(html, /buildAudioMouthEnvelope, sampleAudioMouthEnvelope/);
  assert.match(html, /getAudioTimelineOffsetMs\(audioScheduledStartAtMs,exportMouthOriginTimeMs\)/);
  assert.match(html, /decodeContext\.decodeAudioData\(await track\.blob\.arrayBuffer\(\)\)/);
  assert.match(html, /exportMouthTracks\.push\(\{sceneIndex:track\.sceneIndex,characterId:track\.characterId,characterName:track\.characterName,startMs:track\.startMs,envelope,visemes\}\)/);
  assert.match(html, /mouthClockOrigin=exportMouthOriginTimeMs!==null\?exportMouthOriginTimeMs:previewMouthOriginTimeMs/);
  assert.match(html, /performance\.now\(\)-mouthClockOrigin/);
  assert.match(html, /exportElapsedMs>=track\.startMs/);
  assert.match(html, /sampleAudioMouthEnvelope\(activeMouthTrack\.envelope,mouthTrackTimeMs\)/);
  assert.match(html, /sampleCharacterFacialLipSync\(activeMouthTracks,sceneIndex,exportElapsedMs\)/);
  assert.match(html, /facialVisemes:facialLipSync\.facialVisemes,facialMouthOpenness:facialLipSync\.facialMouthOpenness/);
  assert.match(html, /recorder\.start\(250\);\s*exportMouthOriginTimeMs=performance\.now\(\);\s*if\(audioScheduledStartAtMs!==null\)\{[\s\S]*?getAudioTimelineOffsetMs\(audioScheduledStartAtMs,exportMouthOriginTimeMs\)[\s\S]*?\}/);
  assert.match(html, /mainCharacterVoiceTracks=voiceTracks\.filter\(track=>\{/);
  assert.match(html, /hasFacialRig=Array\.isArray\(meta\.characterFacialRigs\)/);
  assert.match(html, /hasFacialRig=Array\.isArray\(meta\.characterFacialRigs\)/);
  assert.match(html, /lipSyncSkippedTracks\+\+/);
  assert.match(html, /lipSyncSkippedTracks=lipSyncRenderableTracks\.length/);
  assert.match(html, /Lip-sync analysis was skipped for /);
  assert.match(html, /Анализ синхронизации губ пропущен для /);
  assert.match(html, /lipSyncGeneratedMediaTracks\+\+/);
  assert.match(html, /Mouth animation is not composited into AI-generated scene media for /);
  assert.match(html, /Анимация рта не накладывается на AI-изображения и видео для /);
});

 
test('WebM export uses model-timestamped visemes with measured dialogue energy and safe fallbacks', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.ok(html.includes('buildVisemeTimeline, sampleVisemeTimeline'));
  assert.ok(html.includes('text:String(cue.text||""),language:String(cue.language||storyLanguage()),phonemeChunks:Array.isArray(cue.phonemeChunks)?cue.phonemeChunks:[],visemeEvents:Array.isArray(cue.visemeEvents)?cue.visemeEvents:[]'));
  assert.ok(html.includes('buildVisemeTimeline({text:track.text,durationMs:envelope.durationMs,language:track.language,fps:24,phonemeChunks:track.phonemeChunks,visemeEvents:track.visemeEvents})'));
  assert.ok(html.includes('sampleVisemeTimeline(activeMouthTrack.visemes,mouthTrackTimeMs)'));
  assert.ok(html.includes("exportViseme==='closed'"));
  assert.ok(html.includes("exportViseme==='round'"));
  assert.ok(html.includes("exportViseme==='wide'"));
});


test('published page exposes the experimental English timestamped Kokoro voice engine', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.ok(html.includes('createTimestampedKokoroEngine'));
  assert.ok(html.includes('value="timestamped"'));
  assert.ok(html.includes('Experimental timestamped Kokoro · English only'));
  assert.ok(html.includes('timestamped&&locale!==\'en\''));
});


test('uses a logical 640x360 drawing space on a 1280x720 widescreen export canvas', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8') + '\\n' + readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(html, /<canvas id="canvas" width="1280" height="720"/);
  assert.match(html, /w=640,h=360,t=animationTimeMs\\/1000;ctx\\.setTransform\\(canvas\\.width\\/w,0,0,canvas\\.height\\/h,0,0\\)/);
  assert.match(html, /standard:\\{width:640,height:384,steps:20\\},high:\\{width:768,height:448,steps:24\\},ultra:\\{width:1024,height:576,steps:30\\}/);
});
