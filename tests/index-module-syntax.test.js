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



test('preflights minimum Hugging Face duration and retimes longer storyboard scenes', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /if\(mode==='huggingface'\)\s*\{[\s\S]*?const tooShortIndex=scenes\.findIndex/);
  assert.match(app, /return seconds<0\.5/);
  assert.match(app, /Math\.min\(5,requestedDuration\)/);
  assert.match(app, /fitSceneVideoToDuration\(video,sceneDuration\)/);
  assert.match(app, /video\.loop=false/);
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
  assert.match(html, /const previewStartInfo=await pendingSession.start\(\);previewMouthOriginTimeMs=getScheduledAudioStartAtMs\(previewStartInfo\)/);
  assert.match(html, /previewMouthTracks=pendingSession\.decodedTracks\.map/);
  assert.match(html, /startSceneVoicePreview\(sceneIndex\)/);
  assert.match(html, /stopSceneVoicePreview\(\)/);
  assert.match(html, /activeMouthTracks=exportMouthOriginTimeMs!==null\?exportMouthTracks:previewMouthTracks/);
});
test('WebM export derives built-in character mouth movement only from renderable dialogue tracks', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(html, /buildAudioMouthEnvelope, sampleAudioMouthEnvelope/);
  assert.match(html, /decodeContext\.decodeAudioData\(await track\.blob\.arrayBuffer\(\)\)/);
  assert.match(html, /selectRenderableLipSyncTracks\(/);
  assert.match(html, /const lipSyncRenderableTracks=selectRenderableLipSyncTracks\(/);
  assert.match(html, /lipSyncEligibleTrackCount=lipSyncRenderableTracks\.length/);
  assert.match(html, /sampleCharacterFacialLipSync\(activeMouthTracks,sceneIndex,exportElapsedMs\)/);
  assert.match(html, /buildLipSyncQualityReport\(/);
  assert.match(html, /Audio analysis was skipped for /);
  assert.match(html, /Анализ аудио пропущен для /);
  assert.doesNotMatch(html, /const lipSyncRenderableTracks=mainCharacterVoiceTracks;/);
  assert.doesNotMatch(html, /lipSyncGeneratedMediaTracks/);
});

 
test('WebM export uses model-timestamped visemes with measured dialogue energy and safe fallbacks', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.ok(html.includes('buildVisemeTimeline, sampleVisemeTimeline'));
  assert.ok(html.includes('text:String(cue.text||""),language:String(cue.language||storyLanguage()),phonemeChunks:Array.isArray(cue.phonemeChunks)?cue.phonemeChunks:[],visemeEvents:Array.isArray(cue.visemeEvents)?cue.visemeEvents:[]'));
  assert.ok(html.includes('buildVisemeTimeline({text:track.text,durationMs:envelope.durationMs,language:track.language,fps:24,phonemeChunks:track.phonemeChunks,visemeEvents:track.visemeEvents})'));
  assert.ok(html.includes('sampleVisemeTimeline(activeMouthTrack.visemes,mouthTrackTimeMs)'));
  const renderer = readFileSync(new URL('../src/demo-character-renderer.js', import.meta.url), 'utf8');
  assert.match(html, /drawProceduralDemoFox/);
  assert.ok(renderer.includes("viseme === 'closed'"));
  assert.ok(renderer.includes("viseme === 'round'"));
  assert.ok(renderer.includes("viseme === 'wide'"));
});


test('published page exposes the experimental English timestamped Kokoro voice engine', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.ok(html.includes('createTimestampedKokoroEngine'));
  assert.ok(html.includes('value="timestamped"'));
  assert.ok(html.includes('Experimental timestamped Kokoro · English only'));
  assert.ok(html.includes('timestamped&&locale!==\'en\''));
});


test('restricts lip-sync analysis to dialogue with a renderable mouth', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.ok(app.includes('selectRenderableLipSyncTracks'));
  assert.ok(app.includes('const lipSyncRenderableTracks=selectRenderableLipSyncTracks({'));
  assert.ok(app.includes('lipSyncEligibleTrackCount=lipSyncRenderableTracks.length'));
  assert.ok(app.includes('drawFacialRigs:true,characterFacialRigs:currentSceneData.characterFacialRigs'));
  assert.ok(!app.includes('const lipSyncRenderableTracks=mainCharacterVoiceTracks;'));
});

test('wires landscape and portrait formats through canvas preview and export', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8') + '\\n' + readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.ok(html.includes('<canvas id="canvas" width="1280" height="720"'));
  assert.ok(html.includes('<select id="canvasFormat">'));
  assert.ok(html.includes('dimensions=getCanvasDimensions(activeCanvasFormat),w=dimensions.logicalWidth,h=dimensions.logicalHeight'));
  assert.ok(html.includes('canvas.width=dimensions.width;canvas.height=dimensions.height'));
  assert.ok(html.includes('getImageGenerationDimensions(activeCanvasFormat,$(\'imageQuality\').value)'));
  assert.ok(html.includes('getSceneComposition(activeCanvasFormat,sceneIndex)'));
  assert.ok(html.includes('canvasFormat:activeCanvasFormat'));
});


test('does not publish a successful WebM after MediaRecorder reports an error', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.ok(app.includes('recorderFailed=false'));
  assert.ok(app.includes("recorder.onerror=()=>{\n      recorderFailed=true;"));
  assert.ok(app.includes("if(recorderFailed)throw new Error('MediaRecorder failed before producing a complete video.')"));
});


test('cinematic camera transform covers generated media, props, and rigged characters while keeping the title overlay fixed', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const cameraStart = app.indexOf('ctx.save();ctx.translate(w/2,h/2+cameraPlan.offsetY);');
  const mediaDraw = app.indexOf('drawImageCover(ctx,generatedVideo,w,h,motionTransform)', cameraStart);
  const propsDraw = app.indexOf('drawSceneProps(ctx,currentSceneData', cameraStart);
  const characterDraw = app.indexOf('drawCharacterLayers(ctx,currentSceneData.characterLayers', cameraStart);
  const cameraRestore = app.indexOf('ctx.restore();', characterDraw);
  const titleDraw = app.indexOf("ctx.fillText($('character').value", cameraRestore);
  assert.ok(cameraStart >= 0);
  assert.ok(mediaDraw > cameraStart);
  assert.ok(propsDraw > mediaDraw);
  assert.ok(characterDraw > propsDraw);
  assert.ok(cameraRestore > characterDraw);
  assert.ok(titleDraw > cameraRestore);
});


test('all ComfyUI scene-generation paths prioritize manual references and preserve provider capacity reporting', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /import \{ prioritizeCharacterReferenceImages \} from ["']\.\/character-reference-selection\.js["']/);
  assert.match(app, /async function buildCharacterReferenceImagesForScene\(scene\)[\s\S]*?return prioritizeCharacterReferenceImages\(comfyCharacterReferenceFiles,profileImages\)/);
  assert.equal((app.match(/buildCharacterReferenceImagesForScene\(/g) || []).length, 4);
  assert.doesNotMatch(app, /profileReferences\.concat\(comfyCharacterReferenceFiles\.filter\(Boolean\)\)\.slice\(0,2\)/);
  assert.doesNotMatch(app, /profileReferenceImages\.concat\(comfyCharacterReferenceFiles\.filter\(Boolean\)\)\.slice\(0,2\)/);
});
