import { drawProceduralSceneEnvironment } from './procedural-scene-environment.js';
import { drawSceneProps } from './scene-prop-renderer.js';
import { validateStoryScenes } from "./story-qa.js";
import { buildStoryboardFromText } from "./storyboard-generator.js";
import { evaluatePromptToFilmStart } from "./prompt-to-film-gate.js";
import { resolveSceneVideoTaskType } from "./scene-video-task.js";
import { resolveStoryProtagonist } from "./story-protagonist.js";
import { calculateCinematicShot } from "./director-engine.js";
import { detectDeviceCapabilities } from "./device-capabilities.js";
import { createLocalTransformersRuntime } from "./transformers-local-runtime.js";
import { directStoryboardWithLocalAI } from "./local-story-director.js";
import { directStoryboardForFilm } from './automatic-story-direction.js';
import { planUniversalTask } from "./universal-task-planner.js";
import { createUniversalCapabilityRegistry, bindUniversalPlanCapabilities } from "./universal-capability-registry.js";
import { executeUniversalTaskPlan } from "./universal-task-executor.js";
import { createUniversalLocalVideoCapability } from "./universal-local-video-capability.js";
import { createUniversalRemoteVideoCapability } from "./universal-remote-video-capability.js";
import { createUniversalFilmCompositionCapability } from "./universal-film-composition-capability.js";
import { resolveUniversalSceneTarget } from "./universal-scene-target.js";
import { resolveUniversalVoiceTargets } from "./universal-voice-target.js";
import { resolveAutomaticSpeechTasks } from "./automatic-speech-workflow.js";
import { findScenesWithMissingVoiceAudio } from "./voice-artifact-readiness.js";
import { generateSceneDialogue, selectScenesMissingDialogue } from "./scene-dialogue-generator.js";
import { generateImageWithHorde } from "./ai-horde-image-provider.js";
import { resolveSceneImageSource } from "./scene-image-source.js";
import { getCanvasDimensions, getImageGenerationDimensions, normalizeCanvasFormat } from "./canvas-format.js";
import { getSceneComposition } from "./scene-layout.js";
import { drawImageCover } from "./image-frame.js";
import { drawCharacterLayers } from "./scene-character-layers.js";
import { validateCharacterRigTimeline, sampleCharacterRigTimeline } from "./character-rig-timeline.js";
import { createCharacterRigMotionPreset, listCharacterRigMotionPresets } from "./character-rig-motion-presets.js";
import { createCharacterRigTimelineFromActionTimeline } from "./character-rig-action-planner.js";
import { generateCharacterRigTimelinesForScenes } from "./character-rig-scene-batch.js";
import { validateCharacterRig, normalizeCharacterRigPoses, characterRigPosesFor } from "./character-rig.js";
import { upsertCharacterMotionPhase } from "./character-motion-editor.js";
import { planCharacterMotionFromActionTimeline } from "./character-motion-planner.js";
import { generateCharacterMotionTimelinesForScenes } from "./character-motion-scene-batch.js";
import { attachCharacterSpriteToSceneLayers } from "./scene-character-layers.js";
import { createSceneId, ensureSceneIds } from "./scene-identity.js";
import { formatDialogueLines, parseDialogueLines } from "./dialogue-lines.js";
import { createBrowserLocalTtsEngine } from "./browser-local-tts-engine.js";
import { createTimestampedKokoroEngine } from "./timestamped-kokoro-engine.js";
import { createVoiceAudioStorage } from "./voice-audio-storage.js";
import { assignCharacterVoices, buildSceneVoiceTimeline, normalizeSpeakerKey } from "./scene-voice-workflow.js";
import { createVoiceGenerationCheckpoint, restoreVoiceGenerationCheckpoint } from "./voice-generation-checkpoint.js";
import { resolvePromptVoiceModelLoad } from "./prompt-voice-model-load.js";
import { createSceneVideoStorage, persistSceneVideoBestEffort } from "./scene-video-storage.js";
import { createFacialAssetStorage } from "./facial-asset-storage.js";
import { createCharacterReferenceImageStorage } from "./character-reference-image-storage.js";
import { generateStoryboardVideos, readVideoProgressPercent } from "./scene-video-batch.js";
import { createHuggingFaceZeroGPUVideoProvider, HUGGING_FACE_ZERO_GPU_SPACE_ID } from "./huggingface-zerogpu-video-provider.js";
import { fitSceneVideoToDuration, syncSceneVideoPlayback } from "./scene-video-transport.js";
import { waitForSceneVideoReady, rewindSceneVideoAndWait, waitForSceneImageReady, isSceneVideoDecoded } from "./scene-video-readiness.js";
import { createAnimationClock } from "./animation-clock.js";
import { getPromptCameraTransform } from "./prompt-camera-motion.js";
import { detectSceneActionForScene } from "./scene-action.js";
import { buildExportTimeline } from "./export-timeline.js";
import { captureFilmSceneSnapshot, matchesFilmSceneSnapshot } from "./film-scene-snapshot.js";
import { createSceneGenerationGuard } from "./scene-generation-guard.js";
import { buildAudioMouthEnvelope, sampleAudioMouthEnvelope } from "./audio-mouth-envelope.js";
import { sampleCharacterFacialLipSync, sceneHasFacialRigForSpeaker } from "./facial-lipsync-runtime.js";
import { createFaceLandmarkerWorkerClient } from "./face-landmarker-worker-client.js";
import { sampleFaceLandmarkTimeline } from "./face-landmark-timeline.js";
import { projectFaceLandmarkOverlay } from "./face-landmark-overlay.js";
import { analyzeFaceVideoFrames } from "./face-video-analysis.js";
import { createVideoFrameCapture } from "./video-frame-capture.js";
import { getAudioTimelineOffsetMs, getScheduledAudioStartAtMs } from "./audio-clock-alignment.js";
import { buildVisemeTimeline, sampleVisemeTimeline } from "./viseme-timeline.js";
import { createAudioExportSession } from "./audio-export.js";
import { buildLipSyncQualityReport } from "./lip-sync-quality-report.js";
import { waitForExportVideoReady, validateExportTracks } from "./film-export-readiness.js";
import { buildSceneMediaReport } from "./scene-media-report.js";
import { analyzeSceneVideoMotion, captureSceneVideoFrameSamples } from "./scene-motion-analysis.js";
import { createSceneFrameContactSheet } from "./scene-frame-contact-sheet.js";
import { buildCompositedCharacterRegions, sampleCanvasRegion, analyzeCharacterRegionFrames } from "./scene-character-region.js";
import { buildBackgroundControlRegions, classifyCharacterBackgroundMotion } from "./scene-motion-separation.js";
import { buildCharacterBodyPartRegions } from "./character-rig-body-regions.js";
import { createCharacterBodyPartContactSheet } from "./character-motion-evidence.js";
import { auditAnimationCompatibility } from './animation-compatibility-audit.js';
import { summarizeSceneMotionResults } from "./scene-motion-results.js";
import { createVoicePreviewSession } from "./audio-preview.js";
import { upsertCharacterFacialPart, applyCharacterFacialExpressionToScene } from "./character-facial-editor.js";
import { checkComfyUIConnection, createComfyUIVideoProvider } from "./comfyui-video-provider.js";
import { createVideoProviderRegistry, generateVideoWithProvider } from "./video-provider-contract.js";
import { buildImageGenerationPrompt, buildMotionGenerationPrompt, buildSceneIdentitySeed, sceneHasSavedCharacterImageReference, validateSceneProductionReadiness } from "./scene-production.js";
import { buildCharacterSpriteAssetPlan } from "./character-sprite-asset-plan.js";
import { generateCharacterRigParts } from "./character-rig-part-generation.js";
import { reviewCharacterRigPart, assembleApprovedCharacterRig } from './character-rig-part-review.js';
import { generateCharacterSpriteAsset } from "./character-sprite-generation.js";
import { verifySpriteTransparency } from "./character-sprite-verification.js";
import { upsertCharacterReference, mergeCharacterReferences } from "./character-reference.js";
import { prepareStoryCharacterContext } from "./story-character-context.js";
import { normalizeSceneCast } from "./scene-cast.js";
import { inferStoryboardStateChanges } from "./scene-state-changes.js";
import { buildStoryEventChain } from "./story-event-chain.js";
import { shouldShowProceduralDemoCharacter } from './demo-character-mode.js';
import { drawProceduralDemoFox } from './demo-character-renderer.js';
const localTextRuntime = createLocalTransformersRuntime();
let activeUniversalPlanController = null;
const translations={
en:{freeTag:'FREE · LOCAL-FIRST',previewTag:'CARTOON WORKSPACE · EARLY PREVIEW',headline:'Turn your idea<br>into a story.',intro:'Create a storyboard, generate short AI scene clips through the optional free Hugging Face ZeroGPU queue or local ComfyUI, and assemble a WebM with timed dialogue and optional local music. Free cloud GPU is quota-limited; production voice and lip-sync are still in development.',createTitle:'01 · Create a story',ideaLabel:'Story idea',ideaPlaceholder:'A curious fox discovers a glowing star in the forest...',characterLabel:'Main character',styleLabel:'Visual style',durationLabel:'Scene duration',seconds3:'3 seconds',seconds5:'5 seconds',seconds8:'8 seconds',storyLanguageLabel:'Story language',createButton:'Start working',qualityLabel:'Image quality',qualityNote:'Applies to optional AI-generated still images. Higher quality takes longer in the free queue.',styleStorybook:'Storybook',styleAnime:'2D Anime',styleFlat2D:'Flat 2D',stylePixelArt:'Pixel Art',style3DAnimated:'3D Animation',style3DRealistic:'Realistic 3D',styleClay3D:'Clay 3D',styleWatercolor:'Watercolor',styleManga:'Comic / Manga',stylePaperCutout:'Paper Cutout',styleStopMotion:'Stop-motion',qualityStandard:'Standard · 640×384',qualityHigh:'High · 768×448',qualityUltra:'Maximum · 1024×576',saveButton:'Save draft',readyStatus:'Ready. Your idea stays in this browser unless you export it.',previewTitle:'02 · Preview',playButton:'Play preview',pauseButton:'Pause preview',exportButton:'Export WebM with dialogue',previewDisclaimer:'Generated scene video clips are used when available; scenes without clips use the still-image/canvas preview. WebM combines the clips with timed dialogue and optional local music. Lip-sync is still in development.',footer:'DRAVEX AI Cartoon Studio · Prototype · No paid API required · Use only media you have rights to',sceneTitles:['A discovery','A closer look','A new adventure'],sceneDescriptions:['The fox spots a glowing star.','The little star floats nearby.','The fox follows the light.'],sceneLabel:'Scene',ready:'Ready. Your idea stays in this browser unless you export it.',emptyIdea:'Add a story idea first.',created:'Local DRAVEX storyboard created.',saved:'Draft saved in this browser.',storageError:'Browser storage is unavailable; you can still keep this page open.',restored:'Restored draft from this browser.',recording:'Recording a short preview…',exported:'WebM storyboard exported.',unsupported:'WebM recording is not supported by this browser.',exportFailed:'Export failed in this browser. Try Play preview first.'},
ru:{freeTag:'БЕСПЛАТНО · ЛОКАЛЬНАЯ РАБОТА',previewTag:'РАБОЧЕЕ ПРОСТРАНСТВО МУЛЬТФИЛЬМОВ · РАННИЙ ПРЕДПРОСМОТР',headline:'Преврати идею<br>в историю.',intro:'Создавай раскадровку, генерируй короткие AI-видеосцены через бесплатную очередь Hugging Face ZeroGPU или локальный ComfyUI и собирай WebM с диалогами и локальной музыкой. Бесплатная облачная квота ограничена; профессиональная озвучка и синхронизация губ ещё разрабатываются.',createTitle:'01 · Создание истории',ideaLabel:'Идея истории',ideaPlaceholder:'Любопытный лисёнок находит светящуюся звезду в лесу…',characterLabel:'Главный персонаж',styleLabel:'Визуальный стиль',durationLabel:'Длительность сцены',seconds3:'3 секунды',seconds5:'5 секунд',seconds8:'8 секунд',storyLanguageLabel:'Язык истории',createButton:'Начать работу',qualityLabel:'Качество изображения',qualityNote:'Настройка применяется к дополнительной AI-генерации отдельных изображений сцен. Высокое качество может дольше ожидать в бесплатной очереди.',styleStorybook:'Книжная иллюстрация',styleAnime:'2D-аниме',styleFlat2D:'Плоский 2D',stylePixelArt:'Пиксель-арт',style3DAnimated:'3D-анимация',style3DRealistic:'Реалистичный 3D',styleClay3D:'Пластилиновая 3D-анимация',styleWatercolor:'Акварель',styleManga:'Комикс / манга',stylePaperCutout:'Бумажная аппликация',styleStopMotion:'Покадровая анимация',qualityStandard:'Стандарт · 640×384',qualityHigh:'Высокое · 768×448',qualityUltra:'Максимум · 1024×576',saveButton:'Сохранить черновик',readyStatus:'Готово. Идея хранится в этом браузере, пока ты не экспортируешь её.',previewTitle:'02 · Предпросмотр',playButton:'Воспроизвести',pauseButton:'Пауза',exportButton:'Экспорт WebM с диалогами',previewDisclaimer:'Готовые видеоклипы сцен используются при наличии; для остальных сцен остаётся предпросмотр изображения и холста. WebM объединяет клипы, диалоги по таймлайну и необязательную локальную музыку. Синхронизация губ ещё разрабатывается.',footer:'DRAVEX AI Cartoon Studio · Прототип · Платный API не требуется · Используй только материалы, на которые у тебя есть права',sceneTitles:['Открытие','Поближе','Новое приключение'],sceneDescriptions:['Лисёнок замечает светящуюся звезду.','Маленькая звезда парит рядом.','Лисёнок следует за светом.'],sceneLabel:'Сцена',ready:'Готово. Идея хранится в этом браузере, пока ты не экспортируешь её.',emptyIdea:'Сначала добавь идею истории.',created:'Раскадровка создана локальным движком DRAVEX.',saved:'Черновик сохранён в этом браузере.',storageError:'Хранилище браузера недоступно; можно оставить страницу открытой.',restored:'Черновик восстановлен из этого браузера.',recording:'Записываем короткий предпросмотр…',exported:'Раскадровка экспортирована в WebM.',unsupported:'Этот браузер не поддерживает запись WebM.',exportFailed:'Не удалось экспортировать видео. Сначала попробуй запустить предпросмотр.'}
};
function readLocalStorage(key){try{return window.localStorage.getItem(key)}catch(error){return null}}
function writeLocalStorage(key,value){try{window.localStorage.setItem(key,value);return true}catch(error){return false}}
let uiLang=readLocalStorage('dravex-ui-language')||'en';
let activeCanvasFormat=normalizeCanvasFormat(readLocalStorage('dravex-canvas-format')||'landscape');
function tr(key){return translations[uiLang]?.[key]??translations.en[key]??key}
const $=id=>document.getElementById(id);
function applyLanguage(){document.documentElement.lang=uiLang;$('uiLanguage').value=uiLang;document.querySelectorAll('[data-i18n]').forEach(el=>{const key=el.dataset.i18n;if(key==='headline'||key==='readyStatus'){el.innerHTML=tr(key)}else el.textContent=tr(key)});document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>el.placeholder=tr(el.dataset.i18nPlaceholder));$('play').textContent=playing?tr('pauseButton'):tr('playButton');$('sceneLabel').textContent=storyLabels[storyLanguage()]+' '+(sceneIndex+1)+' · '+titles[sceneIndex];syncImageQualityLabels();renderScenes();applySceneEditorLanguage();syncSceneEditor()}
$('uiLanguage').addEventListener('change',()=>{uiLang=$('uiLanguage').value;writeLocalStorage('dravex-ui-language',uiLang);applyLanguage()});
$('style').addEventListener('change',()=>{if(!playing)draw()});
let selectedMusicUrl='';
$('audioFile').addEventListener('change',()=>{
  const file=$('audioFile').files?.[0]||null;
  if(selectedMusicUrl){URL.revokeObjectURL(selectedMusicUrl);selectedMusicUrl=''}
  $('audioPreview').pause();
  $('audioPreview').removeAttribute('src');
  $('audioPreview').hidden=true;
  if(!file){$('audioStatus').textContent='No music selected / Музыка не выбрана';return}
  if(!file.type.startsWith('audio/')){$('audioStatus').textContent='Choose an audio file / Выбери аудиофайл';$('audioFile').value='';return}
  if(file.size>50*1024*1024){$('audioStatus').textContent='Audio file is larger than 50 MB / Файл больше 50 МБ';$('audioFile').value='';return}
  selectedMusicUrl=URL.createObjectURL(file);
  $('audioPreview').src=selectedMusicUrl;
  $('audioPreview').hidden=false;
  $('audioStatus').textContent=file.name+' · '+(file.size/1024/1024).toFixed(1)+' MB · local only';
});
$('audioVolume').addEventListener('input',()=>{$('audioVolumeValue').textContent=$('audioVolume').value+'%'});

const canvas=$('canvas'),ctx=canvas.getContext('2d');let frame=0,playing=true,raf=0,sceneIndex=0;
function syncImageQualityLabels(){const names=uiLang==='ru'?['Стандарт','Высокое','Максимум']:['Standard','High','Maximum'];['standard','high','ultra'].forEach((quality,index)=>{const size=getImageGenerationDimensions(activeCanvasFormat,quality);$('imageQuality').options[index].textContent=names[index]+' · '+size.width+'×'+size.height;});}
function applyCanvasFormat(){const dimensions=getCanvasDimensions(activeCanvasFormat);canvas.width=dimensions.width;canvas.height=dimensions.height;$('canvasFormat').value=activeCanvasFormat;syncImageQualityLabels();if(!playing)draw();}
applyCanvasFormat();
$('canvasFormat').addEventListener('change',()=>{activeCanvasFormat=normalizeCanvasFormat($('canvasFormat').value);writeLocalStorage('dravex-canvas-format',activeCanvasFormat);applyCanvasFormat();if(playing){if(raf)cancelAnimationFrame(raf);raf=0;draw();}});
const animationClock=createAnimationClock();let exportMouthTracks=[],exportMouthOriginTimeMs=null;let previewMouthTracks=[],previewMouthOriginTimeMs=null,previewVoiceSession=null,previewVoiceRequestToken=0;let sceneMotionSceneIndex=-1,sceneMotionStartTimeMs=0,rigPreviewProgress=null;let titles=[...translations[uiLang].sceneTitles];let descriptions=[...translations[uiLang].sceneDescriptions];let sceneMetadata=titles.map((title,index)=>({id:createSceneId(),title,description:descriptions[index],prompt:descriptions[index],visibleAction:descriptions[index],camera:''}));let characterBible=[];let currentStoryboardPlan=null;
let lastUniversalTaskPlan=null;
let universalTaskCheckpoint=null;
let activeUniversalExecutionController=null;
const universalCapabilityRegistry=createUniversalCapabilityRegistry();
universalCapabilityRegistry.setRemoteConsent(false);
universalCapabilityRegistry.register({
 id:'storyboard.create',
 name:'Create a local storyboard',
 privacy:'local',
 run:async({plan,step,signal})=>{
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  if(!/(video|film|movie|clip|animation|cartoon|story|storyboard|scene|мульт|видео|ролик|істор|истор|сцен|анімац)/i.test(String(plan?.sourceRequest||''))){
   const error=new Error('The local storyboard adapter only accepts explicit story, scene, animation, film, or video requests.');
   error.code='CAPABILITY_REQUEST_MISMATCH';
   throw error;
  }
  if(!step||!Array.isArray(step.requiredCapabilities)||step.requiredCapabilities.length!==1||step.requiredCapabilities[0]!=='storyboard.create'){
   const error=new Error('The storyboard adapter requires one explicit storyboard.create capability.');
   error.code='CAPABILITY_BINDING_MISMATCH';
   throw error;
  }
  const created=createStoryboard(plan.sourceRequest,{throwOnError:true});
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  return {type:'storyboard',sceneCount:Array.isArray(created?.scenes)?created.scenes.length:0,sourceLanguage:created?.sourceLanguage||null};
 }
});
universalCapabilityRegistry.register({
 id:'dialogue.generate',
 name:'Write source-grounded local dialogue for storyboard scenes',
 privacy:'local',
 isAvailable:context=>isLocalDialogueGenerationReady(context),
 run:async({plan,step,signal,reportProgress})=>{
  if(!/(dialogue|speech|spoken|voice|voiceover|narrat|script|реплик|диалог|голос|озвуч|текст)/i.test(String(plan?.sourceRequest||''))){
   const error=new Error('The dialogue writer only accepts explicit dialogue, speech, narration, or voice requests.');
   error.code='CAPABILITY_REQUEST_MISMATCH';
   throw error;
  }
  if(!step||!Array.isArray(step.requiredCapabilities)||step.requiredCapabilities.length!==1||step.requiredCapabilities[0]!=='dialogue.generate'){
   const error=new Error('The dialogue writer requires one explicit dialogue.generate capability.');
   error.code='CAPABILITY_BINDING_MISMATCH';
   throw error;
  }
  const targets=resolveUniversalVoiceTargets(step,sceneMetadata,sceneIndex);
  if(!targets.ok)throw new Error('Could not resolve dialogue-generation target: '+targets.reason+'.');
  const locale=storyLanguage();
  persistCurrentSceneDialogueToMetadata(locale);
  const expectedSceneIds=new Set(sceneMetadata.map(meta=>String(meta?.id||'')));
  if(expectedSceneIds.size!==sceneMetadata.length||expectedSceneIds.has(''))throw new Error('Storyboard scenes need unique stable IDs before dialogue generation.');
  const targetScenes=targets.indices
   .filter(index=>selectScenesMissingDialogue([sceneMetadata[index]]).length>0)
   .map(index=>({sceneId:String(sceneMetadata[index]?.id||''),originalIndex:index}));
  if(!targetScenes.length)throw new Error('No scenes need generated dialogue. Existing dialogue was preserved.');
  if(targetScenes.some(target=>!target.sceneId)||new Set(targetScenes.map(target=>target.sceneId)).size!==targetScenes.length)throw new Error('Storyboard scenes need unique stable IDs before dialogue generation.');
  const completed=[];
  for(let position=0;position<targetScenes.length;position++){
   if(signal?.aborted)throw new DOMException('Dialogue generation was cancelled.','AbortError');
   const target=targetScenes[position];
   const index=sceneMetadata.findIndex(item=>item&&String(item.id||'')===target.sceneId);
   if(index<0)throw new Error('Scene '+(target.originalIndex+1)+' was removed during dialogue generation.');
   const meta=sceneMetadata[index];
   const sceneId=String(meta?.id||'');
   if(!sceneId)throw new Error('Scene '+(index+1)+' has no stable ID.');
   const scene={...meta,title:titles[index]||meta.title||'',description:descriptions[index]||meta.description||'',characters:Array.isArray(meta.characters)?meta.characters:[]};
   const fingerprint=JSON.stringify({id:scene.id,title:scene.title,storyDetail:scene.storyDetail,visibleAction:scene.visibleAction,description:scene.description,prompt:scene.prompt,characters:scene.characters});
   reportProgress?.('Writing dialogue for scene '+(index+1)+' / '+targets.indices.length);
   const generated=await generateSceneDialogue({runtime:localTextRuntime,scene,language:locale,request:plan.sourceRequest,characterBible,signal});
   if(!generated.ok)throw new Error('Dialogue generation failed for scene '+(index+1)+': '+generated.reason+'.');
   if(signal?.aborted)throw new DOMException('Dialogue generation was cancelled.','AbortError');
   const resolvedIndex=sceneMetadata.findIndex(item=>item&&String(item.id||'')===sceneId);
   if(resolvedIndex<0)throw new Error('Scene '+(index+1)+' was removed during dialogue generation.');
   const liveMeta=sceneMetadata[resolvedIndex];
   const liveScene={...liveMeta,title:titles[resolvedIndex]||liveMeta.title||'',description:descriptions[resolvedIndex]||liveMeta.description||'',characters:Array.isArray(liveMeta.characters)?liveMeta.characters:[]};
   const liveFingerprint=JSON.stringify({id:liveScene.id,title:liveScene.title,storyDetail:liveScene.storyDetail,visibleAction:liveScene.visibleAction,description:liveScene.description,prompt:liveScene.prompt,characters:liveScene.characters});
   if(liveFingerprint!==fingerprint)throw new Error('Scene '+(index+1)+' changed while dialogue was being generated. The stale result was not attached.');
   if(sceneIndex===resolvedIndex&&parseDialogueLines($('sceneDialogue').value,locale).length)throw new Error('Dialogue was added to scene '+(resolvedIndex+1)+' while generation was running; existing text was preserved.');
   sceneMetadata[resolvedIndex]={...liveMeta,dialogue:generated.lines,voiceCues:[],voiceTimeline:null};
   persistCurrentSceneDialogueToMetadata(locale);
   const saved=writeLocalStorage('dravex-cartoon-draft',JSON.stringify({
    idea:$('idea').value,character:$('character').value,style:$('style').value,canvasFormat:activeCanvasFormat,imageQuality:$('imageQuality').value,duration:$('duration').value,
    language:$('language').value,uiLanguage:uiLang,titles,descriptions,sceneMetadata,characterBible,sceneIndex
   }));
   completed.push({sceneId,lineCount:generated.lines.length,persistedInDraft:saved});
   if(sceneIndex===resolvedIndex){syncSceneEditor();$('sceneVoiceStatus').textContent=uiLang==='ru'?'Диалоги созданы. Загрузи локальную модель голоса и запусти озвучку.':'Dialogue generated. Load the local voice model and run voice synthesis.';}
   reportProgress?.('Dialogue ready for scene '+(resolvedIndex+1)+' · '+generated.lines.length+' lines');
  }
  if(targets.allScenes){
   const liveIds=sceneMetadata.map(meta=>String(meta?.id||''));
   if(liveIds.length!==expectedSceneIds.size||liveIds.some(id=>!expectedSceneIds.has(id)))throw new Error('The storyboard changed during all-scene dialogue generation. Completed scene dialogue was saved, but the batch must be reviewed.');
   const missing=selectScenesMissingDialogue(sceneMetadata).map(item=>item.index+1);
   if(missing.length)throw new Error('Dialogue generation is incomplete for scene(s): '+missing.join(', ')+'.');
  }
  return {type:'scene-dialogue',sceneIds:completed.map(item=>item.sceneId),lineCount:completed.reduce((sum,item)=>sum+item.lineCount,0),scenes:completed.length,local:true,persistedInDraft:completed.every(item=>item.persistedInDraft)};
 }
});
universalCapabilityRegistry.register({
 id:'voice.generate',
 name:'Generate local scene dialogue audio',
 privacy:'local',
 isAvailable:context=>isLocalSceneVoiceReady(context),
 run:async({plan,step,signal,reportProgress})=>{
  if(!/(voice|speech|dialogue|audio|narrat|озвуч|голос|реплик|звук)/i.test(String(plan?.sourceRequest||''))){
   const error=new Error('The local voice adapter only accepts explicit voice, speech, dialogue, or audio requests.');
   error.code='CAPABILITY_REQUEST_MISMATCH';
   throw error;
  }
  if(!step||!Array.isArray(step.requiredCapabilities)||step.requiredCapabilities.length!==1||step.requiredCapabilities[0]!=='voice.generate'){
   const error=new Error('The voice adapter requires one explicit voice.generate capability.');
   error.code='CAPABILITY_BINDING_MISMATCH';
   throw error;
  }
  return generateSceneVoicesForCurrentScene({
   signal,
   step,
   onProgress:progress=>reportProgress?.('Generating local voice for scene '+(progress.sceneIndex+1)+' · '+progress.overallIndex+'/'+progress.overallTotal)
  });
 }
});
const localVideoCapability=createUniversalLocalVideoCapability({
 isAvailable:context=>isLocalVideoGenerationReady(context),
 generateScene:context=>generateLocalSceneVideoForUniversal(context)
});
universalCapabilityRegistry.register(localVideoCapability);
universalCapabilityRegistry.register(createUniversalRemoteVideoCapability({
 isAvailable:context=>isRemoteVideoGenerationReady(context),
 hasConsent:()=>universalCapabilityRegistry.remoteConsent&&$('hfVideoConsent').checked===true,
 generateScene:context=>generateRemoteSceneVideoForUniversal(context)
}));
universalCapabilityRegistry.register(createUniversalFilmCompositionCapability({
 getSceneReport:()=>buildSceneMediaReport(sceneMetadata,new Set([...sceneVideoCache].filter(([,entry])=>isSceneVideoDecoded(entry?.video)).map(([key])=>key))),
 composeFilm:async({signal,reportProgress,sceneCount})=>{
  const result=await exportFilm({signal,requireAllVideos:true,download:true,onProgress:detail=>reportProgress?.(detail?.phase==='recording'?'Recording final film: '+detail.percent+'%':detail?.phase==='scene'?'Composing scene '+(detail.sceneIndex+1)+' / '+detail.sceneCount:String(detail||''))});
  if(result?.status!=='completed')throw new Error(result?.reason||'Full-film WebM composition did not complete.');
  if(result.sceneCount!==sceneCount)throw new Error('The number of exported scenes changed during full-film composition.');
  return result;
 }
}));
function getSceneAction(index){return detectSceneActionForScene(sceneMetadata[index]||{},titles[index]||'',descriptions[index]||'');}
class ParticleEmitter {
constructor(){this.particles=[];this.maxParticles=160}
emit(x,y,count=5,color='#ffe58a'){
const amount=Math.max(0,Math.min(Math.floor(count)||0,this.maxParticles-this.particles.length));
for(let i=0;i<amount;i++)this.particles.push({x,y,vx:(Math.random()-.5)*3.6,vy:(Math.random()-.5)*3.6-1.4,life:1,decay:Math.random()*.025+.018,size:Math.random()*2.2+1,color});
}
updateAndDraw(context){
for(let i=this.particles.length-1;i>=0;i--){
const p=this.particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=.025;p.life-=p.decay;
if(p.life<=0){this.particles.splice(i,1);continue}
context.globalAlpha=Math.max(0,Math.min(1,p.life));context.fillStyle=p.color;context.beginPath();context.arc(p.x,p.y,p.size,0,Math.PI*2);context.fill();
}
context.globalAlpha=1;
}
}
let characterMotionAudit = null;
let lastCharacterMotionAuditEvidence = [];
const CHARACTER_MOTION_SAMPLE_PROGRESS = [0.1, 0.3, 0.5, 0.7, 0.9];
function captureCharacterMotionAuditFrame({ currentSceneData, progress, viewportWidth, viewportHeight, camera, focusX, focusY, rigPoses }) {
 if (!characterMotionAudit) return;
 if (characterMotionAudit.sceneIndex !== sceneIndex) {
  characterMotionAudit = null;
  $('characterMotionAuditStatus').textContent = uiLang === 'ru'
   ? 'Проверка отменена: была выбрана другая сцена.'
   : 'Audit cancelled because a different scene was selected.';
  return;
 }
 if (!playing || !Number.isFinite(progress)) return;
 if (characterMotionAudit.startProgress === null) {
  characterMotionAudit.startProgress = progress;
  characterMotionAudit.targets = CHARACTER_MOTION_SAMPLE_PROGRESS.map(value =>
   progress + (1 - progress) * value
  );
 }
 const target = characterMotionAudit.targets[characterMotionAudit.nextSample];
 if (target === undefined || progress + 0.0001 < target) return;
 const regions = buildCompositedCharacterRegions({
  layers: currentSceneData.characterLayers,
  characterRigs: currentSceneData.characterRigs,
  rigPoses,
  motionTimeline: currentSceneData.characterMotionTimeline || currentSceneData.actionTimeline,
  progress,
  viewport: { width: viewportWidth, height: viewportHeight },
  camera: { zoom: camera.zoom, offsetY: camera.offsetY, focusX, focusY },
  resolveImage: getLoadedSceneImage
 });
 if (!regions.length) {
  characterMotionAudit = null;
  $('characterMotionAuditStatus').textContent = uiLang === 'ru'
   ? 'В этой сцене нет подключённых слоёв персонажа или проверяемого скелета.'
   : 'This scene has no attached character sprite layers or valid rig parts to inspect.';
  return;
 }
 const scaleX = canvas.width / viewportWidth;
 const scaleY = canvas.height / viewportHeight;
 for (const region of regions) {
  const frame = sampleCanvasRegion(canvas, region.bounds, { width: 32, height: 32, scaleX, scaleY });
  const key = region.characterId.toLocaleLowerCase();
  const entry = characterMotionAudit.frames.get(key) || { characterId: region.characterId, frames: [] };
  entry.frames.push(frame);
  characterMotionAudit.frames.set(key, entry);
 }
 // Sample articulated body groups only when the compositor uses a complete,
 // image-ready rig. Fallback sprites are deliberately excluded.
 for (const rig of Array.isArray(currentSceneData.characterRigs) ? currentSceneData.characterRigs : []) {
  const characterRegion = regions.find(item =>
   item.characterId.toLocaleLowerCase() === String(rig.characterId || '').toLocaleLowerCase()
   && Array.isArray(item.sources) && item.sources.includes('rig')
  );
  if (!characterRegion) continue;
  const candidatePose = rigPoses && typeof rigPoses === 'object'
   ? (rigPoses[rig.characterId] || Object.entries(rigPoses).find(([id]) =>
      id.toLocaleLowerCase() === String(rig.characterId || '').toLocaleLowerCase())?.[1])
   : null;
  const bodyReport = buildCharacterBodyPartRegions({
   rig,
   rigPose: candidatePose && typeof candidatePose === 'object' ? candidatePose : {},
   viewport: { width: viewportWidth, height: viewportHeight },
   camera: { zoom: camera.zoom, offsetY: camera.offsetY, focusX, focusY }
  });
  for (const bodyRegion of bodyReport.regions) {
   const frame = sampleCanvasRegion(canvas, bodyRegion.bounds, { width: 32, height: 32, scaleX, scaleY });
   const key = rig.characterId.toLocaleLowerCase() + ':' + bodyRegion.bodyPart;
   const entry = characterMotionAudit.bodyPartFrames.get(key) || {
    characterId: rig.characterId, bodyPart: bodyRegion.bodyPart, frames: []
   };
   entry.frames.push(frame);
   characterMotionAudit.bodyPartFrames.set(key, entry);
  }
 }
 // Lock the initial control tiles for this audit. If the character later
 // enters a tile, invalidate that tile for the entire comparison so frames
 // from different timestamps are never mixed into one background report.
 const backgroundRegions = buildBackgroundControlRegions({
  viewport: { width: viewportWidth, height: viewportHeight },
  characterRegions: regions,
  columns: 5,
  rows: 5,
  maxRegions: 8
 });
 const availableBackground = new Map(backgroundRegions.map(region => [region.id, region]));
 if (characterMotionAudit.backgroundControlIds === null) {
  characterMotionAudit.backgroundControlIds = backgroundRegions.map(region => region.id);
 }
 for (const id of characterMotionAudit.backgroundControlIds) {
  if (!availableBackground.has(id)) {
   characterMotionAudit.blockedBackgroundControlIds.add(id);
   characterMotionAudit.backgroundFrames.delete(id);
   continue;
  }
  if (characterMotionAudit.blockedBackgroundControlIds.has(id)) continue;
  const region = availableBackground.get(id);
  const frame = sampleCanvasRegion(canvas, region.bounds, { width: 32, height: 32, scaleX, scaleY });
  const entry = characterMotionAudit.backgroundFrames.get(id) || { id, frames: [] };
  entry.frames.push(frame);
  characterMotionAudit.backgroundFrames.set(id, entry);
 }
 characterMotionAudit.nextSample += 1;
 const total = CHARACTER_MOTION_SAMPLE_PROGRESS.length;
 if (characterMotionAudit.nextSample >= total) {
  const backgroundReports = [];
  for (const entry of characterMotionAudit.backgroundFrames.values()) {
   if (entry.frames.length !== CHARACTER_MOTION_SAMPLE_PROGRESS.length) continue;
   backgroundReports.push(analyzeCharacterRegionFrames(entry.frames));
  }
  const labels = uiLang === 'ru' ? {
   'character-localized-change': 'изменения локализованы в области персонажа',
   'scene-wide-or-mixed-change': 'изменяются персонаж и фон: широкая активность или смешанные изменения',
   'background-or-camera-change': 'изменяется фон, персонаж почти неподвижен',
   'little-visible-change': 'почти нет видимых изменений',
   'insufficient-background-controls': 'недостаточно контрольных областей фона',
   'inconclusive-mixed-background': 'неоднозначные изменения в контрольных областях',
   'inconclusive-character-samples': 'недостаточно кадров персонажа'
  } : {
   'character-localized-change': 'change localized to character region',
   'scene-wide-or-mixed-change': 'character and background show widespread or mixed pixel activity',
   'background-or-camera-change': 'background changes while character appears still',
   'little-visible-change': 'little visible change',
   'insufficient-background-controls': 'not enough background control regions',
   'inconclusive-mixed-background': 'mixed background activity; inconclusive',
   'inconclusive-character-samples': 'not enough character samples'
  };
  const summaries = [];
  for (const entry of characterMotionAudit.frames.values()) {
   if (entry.frames.length < 2) continue;
   const report = analyzeCharacterRegionFrames(entry.frames);
   const comparison = classifyCharacterBackgroundMotion(report, backgroundReports);
   summaries.push(entry.characterId + ': ' + (labels[comparison.status] || comparison.status)
    + ' (' + entry.frames.length + '/5; '
    + comparison.backgroundChangedRegions + '/' + comparison.backgroundSampledRegions
    + (uiLang === 'ru' ? ' областей фона изменились)' : ' background regions changed)'));
  }
  const bodyPartSummaries = [];
  for (const entry of characterMotionAudit.bodyPartFrames.values()) {
   if (entry.frames.length < 2) continue;
   const report = analyzeCharacterRegionFrames(entry.frames);
   const statusLabel = report.status === 'visible-change'
    ? (uiLang === 'ru' ? 'есть изменения' : 'changed')
    : (uiLang === 'ru' ? 'почти без изменений' : 'little change');
   bodyPartSummaries.push(entry.characterId + ' / ' + entry.bodyPart + ': ' + statusLabel
    + ' (' + entry.frames.length + '/5)');
  }
  lastCharacterMotionAuditEvidence = [...characterMotionAudit.bodyPartFrames.values()].map(entry => ({
   characterId: entry.characterId, bodyPart: entry.bodyPart, frames: [...entry.frames]
  }));
  $('downloadCharacterMotionEvidence').disabled = lastCharacterMotionAuditEvidence.length === 0;
  $('downloadCharacterMotionEvidence').textContent = uiLang === 'ru'
   ? 'Скачать визуальные доказательства движения'
   : 'Download visual motion evidence';
  $('characterMotionAuditStatus').textContent = (uiLang === 'ru'
   ? 'Сравнение движения персонажа и фона завершено. '
   : 'Character/background motion comparison completed. ')
   + (summaries.length ? summaries.join('; ') : (uiLang === 'ru' ? 'Недостаточно кадров для сравнения.' : 'Not enough samples to compare.'))
   + (bodyPartSummaries.length
    ? (uiLang === 'ru' ? ' Части тела: ' : ' Body parts: ') + bodyPartSummaries.join('; ')
    : (uiLang === 'ru' ? ' Разбивка по частям тела недоступна: нет готового рига с загруженными изображениями.' : ' Body-part breakdown unavailable: no ready rig with loaded part images.'))
   + (uiLang === 'ru'
    ? '. Изменения пикселей не доказывают правильность жеста или действия; возможны перекрытия и фоновые пиксели.'
    : '. Pixel changes do not prove the intended gesture or action; overlap and background pixels may be included.');
  characterMotionAudit = null;
 } else {
  $('characterMotionAuditStatus').textContent = (uiLang === 'ru'
   ? 'Сравниваю персонажа и фон: кадр '
   : 'Comparing character and background: frame ')
   + (characterMotionAudit.nextSample + 1) + '/' + total + '.';
 }
}
const magicParticles=new ParticleEmitter();
const sceneImageCache=new Map();
const sceneVideoCache=new Map();
let activeFaceAnalysisController=null;
let activeFaceAnalysisWorker=null;
let lastFaceAnalysisExport=null;
let lastFaceAnalysisVideoEntry=null;
let faceLandmarkOverlayLastTimeBucket=-1;
function hideFaceLandmarkPreviewOverlay(message=''){
 const overlay=$('faceLandmarkOverlay');
 if(overlay&&(!overlay.hidden||overlay.childElementCount)){overlay.hidden=true;overlay.replaceChildren();}
 const status=$('faceLandmarkOverlayStatus');
 if(status&&message&&status.textContent!==message)status.textContent=message;
}
function updateFaceLandmarkPreviewOverlay({currentSceneData,generatedVideo,hasGeneratedVideo,motionTransform,viewportWidth,viewportHeight,cameraPlan,focusX,focusY}){
 const overlay=$('faceLandmarkOverlay');
 const status=$('faceLandmarkOverlayStatus');
 if(!$('showFaceLandmarkOverlay')?.checked){
  hideFaceLandmarkPreviewOverlay(uiLang==='ru'?'Диагностический слой выключен.':'Diagnostic overlay is off.');
  faceLandmarkOverlayLastTimeBucket=-1;
  return;
 }
 const meta=currentSceneData||{};
 const entry=sceneVideoCache.get(sceneVideoKey(sceneIndex,meta));
 const report=lastFaceAnalysisExport;
 if(!report||!hasGeneratedVideo||!generatedVideo||!entry||lastFaceAnalysisVideoEntry!==entry||report.sceneId!==String(meta.id||'')||report.videoFilename!==String(entry.filename||'')) {
  faceLandmarkOverlayLastTimeBucket=-1;
  hideFaceLandmarkPreviewOverlay(uiLang==='ru'?'Нет анализа для текущего видеоклипа. Сначала выполни анализ выбранной сцены.':'No matching analysis for this clip. Analyze the selected scene first.');
  return;
 }
 const timeMs=Math.max(0,Number(generatedVideo.currentTime)*1000);
 if(!Number.isFinite(timeMs)){
  hideFaceLandmarkPreviewOverlay(uiLang==='ru'?'Время видеокадра недоступно.':'Video frame time is unavailable.');
  return;
 }
 const bucket=Math.floor(timeMs/100);
 if(bucket===faceLandmarkOverlayLastTimeBucket&&overlay)return;
 faceLandmarkOverlayLastTimeBucket=bucket;
 const maxGapMs=Math.max(500,Math.min(1000,Number(report.sampleIntervalMs||500)*1.25));
 const sample=sampleFaceLandmarkTimeline(report.faceSamples,timeMs,{maxGapMs});
 if(sample.status!=='face-detected'||!sample.anchors){
  hideFaceLandmarkPreviewOverlay(uiLang==='ru'?'На текущем участке лицо не обнаружено; рамка скрыта.':'No face detected at this moment; overlay hidden.');
  return;
 }
 const projected=projectFaceLandmarkOverlay(
  sample.anchors,
  generatedVideo.videoWidth,
  generatedVideo.videoHeight,
  viewportWidth,
  viewportHeight,
  {cover:motionTransform,camera:{zoom:cameraPlan.zoom,offsetY:cameraPlan.offsetY,focusX,focusY}}
 );
 if(projected.status!=='ready'||!projected.overlay){
  hideFaceLandmarkPreviewOverlay(uiLang==='ru'?'Не удалось безопасно преобразовать координаты лица.':'Could not safely project face coordinates.');
  return;
 }
 const stage=canvas.parentElement;
 const stageRect=stage?.getBoundingClientRect();
 const canvasRect=canvas.getBoundingClientRect();
 if(!stage||!stageRect||!canvasRect.width||!canvasRect.height){
  hideFaceLandmarkPreviewOverlay(uiLang==='ru'?'Размер предпросмотра недоступен.':'Preview dimensions are unavailable.');
  return;
 }
 overlay.style.left=(canvasRect.left-stageRect.left)+'px';
 overlay.style.top=(canvasRect.top-stageRect.top)+'px';
 overlay.style.width=canvasRect.width+'px';
 overlay.style.height=canvasRect.height+'px';
 overlay.setAttribute('viewBox','0 0 '+viewportWidth+' '+viewportHeight);
 overlay.setAttribute('preserveAspectRatio','none');
 overlay.replaceChildren();
 const ns='http://www.w3.org/2000/svg';
 const bounds=projected.overlay.bounds;
 const rect=document.createElementNS(ns,'rect');
 rect.setAttribute('x',String(bounds.x));rect.setAttribute('y',String(bounds.y));
 rect.setAttribute('width',String(bounds.width));rect.setAttribute('height',String(bounds.height));
 rect.setAttribute('fill','none');rect.setAttribute('stroke','#67e8f9');
 rect.setAttribute('stroke-width',String(Math.max(2,viewportWidth/500)));
 rect.setAttribute('stroke-dasharray','8 5');rect.setAttribute('vector-effect','non-scaling-stroke');
 overlay.appendChild(rect);
 for(const [name,point] of [['eye',projected.overlay.eyeCenter],['mouth',projected.overlay.mouthCenter]]){
  const marker=document.createElementNS(ns,'circle');
  marker.setAttribute('cx',String(point.x));marker.setAttribute('cy',String(point.y));
  marker.setAttribute('r',String(Math.max(4,viewportWidth/180)));
  marker.setAttribute('fill',name==='eye'?'#a7f3d0':'#f9a8d4');
  marker.setAttribute('stroke','#111827');marker.setAttribute('stroke-width','2');
  overlay.appendChild(marker);
 }
 overlay.hidden=false;
 if(status)status.textContent=(uiLang==='ru'?'Показаны ориентиры лица из локального анализа. Это не привязка к персонажу и не изменение видео.':'Showing face landmarks from local analysis. This is not character binding or video editing.');
}
let finalFilmObjectUrl=null;
let sceneVideoRestorePromise=Promise.resolve();
const sceneVideoStorage=createSceneVideoStorage();
const facialAssetStorage=createFacialAssetStorage();
const characterReferenceImageStorage=createCharacterReferenceImageStorage();
let characterReferencePreviewUrl=null;
let characterReferencePreviewToken=0;
async function showCharacterReferenceImage(profile){
 const token=++characterReferencePreviewToken;
 if(characterReferencePreviewUrl){URL.revokeObjectURL(characterReferencePreviewUrl);characterReferencePreviewUrl=null;}
 const preview=$('bibleReferenceImagePreview'),remove=$('removeCharacterReferenceImage');
 preview.hidden=true;remove.hidden=true;preview.removeAttribute('src');
 if(!profile?.referenceImageAssetId)return;
 try{
  const record=await characterReferenceImageStorage.get(profile.referenceImageAssetId);
  if(token!==characterReferencePreviewToken||!record?.blob?.size)return;
  characterReferencePreviewUrl=URL.createObjectURL(record.blob);
  preview.src=characterReferencePreviewUrl;preview.hidden=false;remove.hidden=false;
 }catch(error){console.warn('Could not load character reference preview:',error);}
}
function disposeSceneVideoEntry(entry){
 if(!entry)return;
 entry.video.pause();
 entry.video.removeAttribute("src");
 entry.video.load();
 URL.revokeObjectURL(entry.url);
}
function attachSceneVideo(index,meta,blob,filename){
 const key=sceneVideoKey(index,meta);
 disposeSceneVideoEntry(sceneVideoCache.get(key));
 const url=URL.createObjectURL(blob);
 const video=document.createElement("video");
 const sceneDuration=Number(meta.durationSeconds??meta.duration??$('duration').value)||3;
 video.muted=true;video.loop=false;video.playsInline=true;video.preload="auto";video.src=url;
 const fitDuration=()=>fitSceneVideoToDuration(video,sceneDuration);
 video.addEventListener("loadedmetadata",fitDuration,{once:true});
 if(video.readyState>=1)fitDuration();
 video.addEventListener("loadeddata",()=>{fitDuration();updateFaceAnalysisControls();if(sceneIndex===index)draw()},{once:true});
 const entry={video,url,filename};
 sceneVideoCache.set(key,entry);
 if(index===sceneIndex)syncSceneVideoPlayback({cache:sceneVideoCache,activeKey:key,shouldPlay:playing,restart:true});
 updateFaceAnalysisControls();
 return entry;
}
function faceAnalysisCheckpointKey(sceneId){return 'dravex-face-analysis-checkpoint:'+String(sceneId||'')}
function readFaceAnalysisCheckpoint(sceneId,entry,intervalMs){
 const key=faceAnalysisCheckpointKey(sceneId);
 try{
  const value=JSON.parse(readLocalStorage(key)||'null');
  const durationMs=Number(entry?.video?.duration)*1000;
  if(!value||value.sceneId!==String(sceneId)||value.sampleIntervalMs!==intervalMs||
     value.filename!==String(entry?.filename||'')||
     !Number.isFinite(durationMs)||Math.abs(Number(value.durationMs)-durationMs)>1000||
     !Number.isFinite(Number(value.nextTimestampMs))||Number(value.nextTimestampMs)<0||
     Number(value.nextTimestampMs)>=durationMs)return null;
  return value;
 }catch{return null}
}
function updateFaceAnalysisControls(){
 const button=$('analyzeFaceVideo'),resume=$('resumeFaceVideo'),cancel=$('cancelFaceVideo');
 if(!button||!resume||!cancel)return;
 const entry=sceneVideoCache.get(sceneVideoKey(sceneIndex));
 const available=Boolean(entry&&entry.video.readyState>=2&&Number.isFinite(entry.video.duration)&&entry.video.duration>0);
 const running=Boolean(activeFaceAnalysisController);
 button.disabled=!available||running;
 cancel.disabled=!running;
 const interval=Number($('faceAnalysisInterval')?.value)||500;
 const checkpoint=available?readFaceAnalysisCheckpoint(sceneMetadata[sceneIndex]?.id,entry,interval):null;
 resume.disabled=!available||running||!checkpoint;
 const overlayToggle=$('showFaceLandmarkOverlay');
 const reportMatches=Boolean(lastFaceAnalysisExport&&lastFaceAnalysisVideoEntry===entry&&entry&&lastFaceAnalysisExport.sceneId===String(sceneMetadata[sceneIndex]?.id||'')&&lastFaceAnalysisExport.videoFilename===String(entry.filename||'')&&Array.isArray(lastFaceAnalysisExport.faceSamples)&&lastFaceAnalysisExport.faceSamples.some(sample=>sample.status==='face-detected'&&sample.anchors));
 if(overlayToggle){overlayToggle.disabled=!reportMatches;if(!reportMatches)overlayToggle.checked=false;}
 if(!reportMatches)hideFaceLandmarkPreviewOverlay(uiLang==='ru'?'Сначала проанализируй текущее видео, чтобы включить рамку.':'Analyze the current clip before enabling the overlay.');
}
function downloadFaceAnalysisReport(){
 if(!lastFaceAnalysisExport)return;
 const blob=new Blob([JSON.stringify(lastFaceAnalysisExport,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 const anchor=document.createElement('a');
 anchor.href=url;
 anchor.download='dravex-face-landmarks-'+String(lastFaceAnalysisExport.sceneId||'scene')+'.json';
 document.body.appendChild(anchor);
 anchor.click();
 anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function runFaceAnalysis({resume=false}={}){
 if(activeFaceAnalysisController)return;
 const meta=sceneMetadata[sceneIndex];
 const entry=sceneVideoCache.get(sceneVideoKey(sceneIndex,meta));
 if(!entry||entry.video.readyState<2||!Number.isFinite(entry.video.duration)||entry.video.duration<=0){
  $('faceAnalysisStatus').textContent=uiLang==='ru'?'Для этой сцены ещё нет готового декодируемого видеоклипа.':'This scene has no decoded generated video clip yet.';
  return;
 }
 const video=entry.video;
 const interval=Number($('faceAnalysisInterval').value)||500;
 const durationMs=video.duration*1000;
 const checkpoint=resume?readFaceAnalysisCheckpoint(meta.id,entry,interval):null;
 if(resume&&!checkpoint){
  $('faceAnalysisStatus').textContent=uiLang==='ru'?'Контрольная точка не подходит к текущему видео. Запусти новый анализ.':'The saved checkpoint does not match this video. Start a new analysis.';
  updateFaceAnalysisControls();
  return;
 }
 const startTimeMs=checkpoint?Number(checkpoint.nextTimestampMs):0;
 const controller=new AbortController();
 let capture=null,worker=null;
 activeFaceAnalysisController=controller;
 lastFaceAnalysisExport=null;
 lastFaceAnalysisVideoEntry=null;
 $('downloadFaceAnalysis').disabled=true;
 $('faceAnalysisProgress').value=Math.round(startTimeMs/durationMs*100);
 $('faceAnalysisStatus').textContent=uiLang==='ru'?'Подготавливаю локальный анализ. Модель может загружаться при первом запуске…':'Preparing local analysis. The model may download on first use…';
 updateFaceAnalysisControls();
 try{
  capture=createVideoFrameCapture(video);
  worker=createFaceLandmarkerWorkerClient({requestTimeoutMs:120000});
  activeFaceAnalysisWorker=worker;
  await worker.initialize({delegate:'CPU'});
  if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
  const samples=[];
  const report=await analyzeFaceVideoFrames({
   durationMs,
   captureFrame:capture.captureFrame,
   workerClient:worker,
   sampleIntervalMs:interval,
   startTimeMs,
   signal:controller.signal,
   onProgress:detail=>{
    const percent=Math.round(Math.min(durationMs,detail.currentTimestampMs+interval)/durationMs*100);
    $('faceAnalysisProgress').value=percent;
    $('faceAnalysisStatus').textContent=(uiLang==='ru'?'Анализ: ':'Analyzing: ')+percent+'% · '+detail.processed+'/'+detail.total+
     (uiLang==='ru'?' · лиц обнаружено: ':' · faces detected: ')+detail.detected;
   },
   onCheckpoint:value=>{
    writeLocalStorage(faceAnalysisCheckpointKey(meta.id),JSON.stringify({
     sceneId:String(meta.id),filename:String(entry.filename||''),durationMs,
     sampleIntervalMs:interval,nextTimestampMs:value.nextTimestampMs,
     lastTimestampMs:value.lastTimestampMs,processed:value.processed,total:value.total
    }));
    updateFaceAnalysisControls();
   },
   onFrameResult:value=>{
    samples.push({
     timestampMs:value.timestampMs,
     status:value.status,
     faceCount:value.faceCount,
     anchors:value.status==='face-detected'?value.anchors:null,
     issues:value.issues
    });
   }
  });
  lastFaceAnalysisExport={
   format:'dravex-face-landmark-analysis-v2',
   sceneId:String(meta.id),
   sceneTitle:String(meta.title||titles[sceneIndex]||''),
   videoFilename:String(entry.filename||''),
   durationMs,
   sampleIntervalMs:interval,
   resumedFromMs:startTimeMs,
   resultScope:resume?'Only face samples from this resumed session; earlier checkpoint samples were not retained in memory.':'All face samples from this analysis session.',
   analysis:report,
   faceSamples:samples,
   limitations:[
    'Only one face is detected in each sampled frame; identity is not tracked across time.',
    'Landmarks are normalized coordinates and do not modify the source video pixels.',
    'A face overlay or lip-sync export has not been applied.'
   ]
  };
  lastFaceAnalysisVideoEntry=entry;
  $('downloadFaceAnalysis').disabled=false;
  if(report.status==='completed'){
   try{window.localStorage.removeItem(faceAnalysisCheckpointKey(meta.id))}catch{}
   $('faceAnalysisProgress').value=100;
  }
  const summary=(uiLang==='ru'
   ?'Готово: обработано кадров '
   :'Finished: processed frames ')+report.processed+'/'+report.total+
   (uiLang==='ru'?' · найдено лиц: ':' · faces found: ')+report.detected+
   (uiLang==='ru'?' · без лица: ':' · no face: ')+report.noFace+
   (report.failed?(uiLang==='ru'?' · ошибок: ':' · errors: ')+report.failed:'')+
   (report.status==='cancelled'?(uiLang==='ru'?' · анализ остановлен, можно продолжить':' · cancelled; you can resume'):'');
  $('faceAnalysisStatus').textContent=summary;
 }catch(error){
  $('faceAnalysisStatus').textContent=(error?.name==='AbortError'
   ?(uiLang==='ru'?'Анализ отменён.':'Analysis cancelled.')
   :(uiLang==='ru'?'Ошибка анализа: ':'Analysis error: ')+String(error?.message||error));
 }finally{
  try{await capture?.restore()}catch(error){console.warn('Could not restore scene video after face analysis:',error)}
  try{await worker?.dispose()}catch(error){console.warn('Could not dispose face analysis worker:',error)}
  if(activeFaceAnalysisWorker===worker)activeFaceAnalysisWorker=null;
  if(activeFaceAnalysisController===controller)activeFaceAnalysisController=null;
  if(sceneVideoCache.get(sceneVideoKey(sceneIndex))?.video===video)draw();
  updateFaceAnalysisControls();
 }
}
$('analyzeFaceVideo')?.addEventListener('click',()=>void runFaceAnalysis({resume:false}));
$('resumeFaceVideo')?.addEventListener('click',()=>void runFaceAnalysis({resume:true}));
$('cancelFaceVideo')?.addEventListener('click',()=>activeFaceAnalysisController?.abort());
$('downloadFaceAnalysis')?.addEventListener('click',downloadFaceAnalysisReport);
$('faceAnalysisInterval')?.addEventListener('change',updateFaceAnalysisControls);
$('showFaceLandmarkOverlay')?.addEventListener('change',()=>{faceLandmarkOverlayLastTimeBucket=-1;if(!playing)draw();});
function releaseSceneVideo(meta,index){
 const key=sceneVideoKey(index,meta);
 sceneGenerationGuard.invalidate(meta.id);
 const invalidationStorageRevision=sceneGenerationGuard.storageRevision(meta.id);
 disposeSceneVideoEntry(sceneVideoCache.get(key));
 sceneVideoCache.delete(key);
 void sceneVideoStorage.deleteOlderThanRevision(key,invalidationStorageRevision).catch(error=>console.warn("Could not delete superseded persisted scene video:",error));
}
async function restorePersistedSceneVideos(){
 let restored=0,discarded=0;
 for(let index=0;index<sceneMetadata.length;index++){
  const meta=sceneMetadata[index];
  const restoreToken=sceneGenerationGuard.capture(meta.id);
  try{
   const record=await sceneVideoStorage.get(meta.id);
   if(!record)continue;
   sceneGenerationGuard.observeStorageRevision(meta.id,record.generationRevision||0);
   if(!(record.blob instanceof Blob)||record.blob.size===0){
    await sceneVideoStorage.deleteIfRevision(meta.id,record.generationRevision||0);discarded++;continue;
   }
   if(!sceneGenerationGuard.isCurrent(restoreToken))continue;
   const entry=attachSceneVideo(index,meta,record.blob,record.filename||("dravex-scene-"+(index+1)+".webm"));
   try{
    await waitForSceneVideoReady(entry.video,{timeoutMs:20000});
    if(!sceneGenerationGuard.isCurrent(restoreToken)){
     if(sceneVideoCache.get(sceneVideoKey(index,meta))===entry)sceneVideoCache.delete(sceneVideoKey(index,meta));
     disposeSceneVideoEntry(entry);
     continue;
    }
    restored++;
   }catch(decodeError){
    if(sceneVideoCache.get(sceneVideoKey(index,meta))===entry)sceneVideoCache.delete(sceneVideoKey(index,meta));
    disposeSceneVideoEntry(entry);
    await sceneVideoStorage.deleteIfRevision(meta.id,record.generationRevision||0);
    discarded++;
    console.warn("Discarded persisted scene video that cannot be decoded:",decodeError);
   }
  }catch(error){console.warn("Could not restore scene video:",error);}
 }
 if(restored){renderComfySceneVideo();if(!playing)draw();}
 renderScenes();
}
function getLoadedSceneImage(url){
const key=String(url||'').trim();
if(!key)return null;
let entry=sceneImageCache.get(key);
if(!entry){
const image=new Image();
entry={image,state:'loading'};
image.crossOrigin='anonymous';
image.decoding='async';
image.onload=()=>{entry.state='ready';if(!playing)draw()};
image.onerror=()=>{entry.state='error';if(sceneMetadata[sceneIndex]?.generatedImageUrl===key)$('imageGenerationStatus').textContent=uiLang==='ru'?'Изображение создано, но браузер не разрешил встроить его в холст из-за ограничений CORS. Оно остаётся доступно в карточке сцены.':'Image generated, but browser CORS rules prevented placing it on the export canvas. It remains available in the scene preview card.'};
sceneImageCache.set(key,entry);
if(key.startsWith("dravex-facial-asset://")){
const assetId=key.slice("dravex-facial-asset://".length);
facialAssetStorage.get(assetId).then(record=>{if(!record?.blob)throw new Error("Saved facial image is missing from this device.");entry.objectUrl=URL.createObjectURL(record.blob);image.src=entry.objectUrl;}).catch(error=>{entry.state='error';console.warn("Could not restore local facial image:",error);if(!playing)draw();});
}else image.src=key;
}
return entry.state==='ready'&&entry.image.naturalWidth>0?entry.image:null;
}
async function stopSceneVoicePreview(){
 previewVoiceRequestToken++;
 const session=previewVoiceSession;previewVoiceSession=null;previewMouthTracks=[];previewMouthOriginTimeMs=null;
 if(session)await session.cleanup().catch(error=>console.warn("DRAVEX voice preview cleanup failed:",error));
}
async function startSceneVoicePreview(index=sceneIndex){
 const token=++previewVoiceRequestToken;
 const previous=previewVoiceSession;previewVoiceSession=null;previewMouthTracks=[];previewMouthOriginTimeMs=null;
 if(previous)await previous.cleanup().catch(error=>console.warn("DRAVEX previous voice preview cleanup failed:",error));
 if(!playing||index!==sceneIndex)return;
 const meta=sceneMetadata[index]||{},cues=Array.isArray(meta.voiceCues)?meta.voiceCues:[];
 if(!cues.length)return;
 let pendingSession=null;
 try{
  if(!sceneVoiceStorage)sceneVoiceStorage=createVoiceAudioStorage();
  const tracks=[];
  for(const cue of cues){
   if(cue.language&&cue.language!==storyLanguage())throw new Error("Scene dialogue uses a different language. Regenerate its voices.");
   if(!/^[a-f0-9]{64}$/i.test(String(cue.audioHash||"")))throw new Error("A dialogue audio reference is invalid.");
   const record=await sceneVoiceStorage.get(cue.audioHash);
   if(!record?.blob)throw new Error("A generated voice file is missing from this device. Regenerate the dialogue.");
   tracks.push({cueId:cue.cueId,blob:record.blob,startMs:(Number(cue.startFrame)||0)*(1000/24),durationMs:Number(cue.durationMs),characterId:String(cue.characterId||cue.characterName||"Narrator"),characterName:String(cue.characterName||cue.characterId||"Narrator"),text:String(cue.text||""),language:String(cue.language||storyLanguage()),phonemeChunks:Array.isArray(cue.phonemeChunks)?cue.phonemeChunks:[],visemeEvents:Array.isArray(cue.visemeEvents)?cue.visemeEvents:[]});
  }
  if(token!==previewVoiceRequestToken||!playing||index!==sceneIndex)return;
  pendingSession=await createVoicePreviewSession({voiceTracks:tracks,voiceVolume:0.9});
  if(token!==previewVoiceRequestToken||!playing||index!==sceneIndex){await pendingSession.cleanup();return;}
  previewVoiceSession=pendingSession;
  const previewStartInfo=await pendingSession.start();previewMouthOriginTimeMs=getScheduledAudioStartAtMs(previewStartInfo);
  // Build facial controls for every scene. drawCharacterLayers applies them only
  // when a matching character facial rig is attached, including over generated media.
  previewMouthTracks=pendingSession.decodedTracks.map(track=>{
   const decoded=track.buffer;
   const channels=Array.from({length:decoded.numberOfChannels},(_,channel)=>decoded.getChannelData(channel));
   const envelope=buildAudioMouthEnvelope({channels,sampleRate:decoded.sampleRate,fps:24});
   const visemes=buildVisemeTimeline({text:track.text,durationMs:envelope.durationMs,language:track.language,fps:24,phonemeChunks:track.phonemeChunks,visemeEvents:track.visemeEvents});
   return {sceneIndex:index,characterId:track.characterId,startMs:track.startMs,envelope,visemes};
  });
  if(!raf)draw();
 }catch(error){
  if(pendingSession&&previewVoiceSession===pendingSession){previewVoiceSession=null;await pendingSession.cleanup().catch(()=>{});}
  if(token===previewVoiceRequestToken){previewMouthTracks=[];previewMouthOriginTimeMs=null;$("status").textContent=(uiLang==="ru"?"Голосовой предпросмотр не запущен: ":"Voice preview could not start: ")+(error.message||"Unknown error");}
 }
}
function draw(){const animationTimeMs=animationClock.advance(performance.now(),playing),dimensions=getCanvasDimensions(activeCanvasFormat),w=dimensions.logicalWidth,h=dimensions.logicalHeight,t=animationTimeMs/1000;ctx.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);ctx.clearRect(0,0,w,h);const g=ctx.createLinearGradient(0,0,0,h);const paletteSets={ 'Storybook':[['#29274d','#132b3b'],['#49304e','#192b46'],['#193f45','#102735'],['#4b3440','#20243c'],['#243c55','#102c38']], 'Anime-inspired':[['#40265f','#132b4c'],['#702f62','#172d52'],['#124e67','#172044'],['#713b48','#211c46'],['#3b3978','#12394a']], 'Flat 2D':[['#83c5be','#277da1'],['#ffafcc','#6d597a'],['#90be6d','#277da1'],['#f9c74f','#577590'],['#bde0fe','#5e548e']], 'Pixel art':[['#312e2e','#1d3557'],['#6a4c93','#1982c4'],['#386641','#1d3557'],['#bc4749','#283618'],['#3a506b','#0b132b']]};const scenePalettes=paletteSets[$('style').value]||paletteSets['Storybook'];const palette=scenePalettes[sceneIndex%scenePalettes.length];g.addColorStop(0,palette[0]);g.addColorStop(1,palette[1]);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);for(let i=0;i<45;i++){let x=(i*97+25)%w,y=(i*53+17)%(h*.61);ctx.fillStyle='rgba(255,255,255,'+(0.25+0.45*Math.abs(Math.sin(t+i)))+')';ctx.fillRect(x,y,2,2)}ctx.fillStyle=sceneIndex===1?'#25434a':sceneIndex===2?'#244c3b':'#183b38';ctx.beginPath();ctx.ellipse(w/2,h*1.03,w*.453,h*.278,0,0,Math.PI*2);ctx.fill();for(let i=0;i<7;i++){let x=(i+.25)*w/7,baseY=h*.86,peakY=h*.43+(i%3)*h*.0694;ctx.fillStyle='#172d36';ctx.beginPath();ctx.moveTo(x,baseY);ctx.lineTo(x+w*.07,peakY);ctx.lineTo(x+w*.14,baseY);ctx.fill()}const currentSceneData=sceneMetadata[sceneIndex]||{title:titles[sceneIndex],visibleAction:descriptions[sceneIndex],prompt:descriptions[sceneIndex]};drawProceduralSceneEnvironment(ctx,currentSceneData,w,h,t);if(sceneMotionSceneIndex!==sceneIndex){sceneMotionSceneIndex=sceneIndex;sceneMotionStartTimeMs=animationTimeMs;rigPreviewProgress=null;if($('characterRigScrubber')){$('characterRigScrubber').value='0';$('characterRigScrubberValue').textContent='Scene clock'}syncSceneVideoPlayback({cache:sceneVideoCache,activeKey:String(currentSceneData.id||('scene-index-'+sceneIndex)),shouldPlay:playing,restart:exportMouthOriginTimeMs===null})}const sceneDurationRaw=Number(currentSceneData.durationSeconds??$('duration').value);const sceneDuration=Number.isFinite(sceneDurationRaw)&&sceneDurationRaw>=0.25&&sceneDurationRaw<=30?sceneDurationRaw:3;const sceneMotionProgress=Math.max(0,Math.min(1,(animationTimeMs-sceneMotionStartTimeMs)/(sceneDuration*1000)));const rigAnimationProgress=rigPreviewProgress===null?sceneMotionProgress:rigPreviewProgress;const previousSceneData=sceneIndex>0?(sceneMetadata[sceneIndex-1]||{title:titles[sceneIndex-1],visibleAction:descriptions[sceneIndex-1],prompt:descriptions[sceneIndex-1]}):null;const previousScale=previousSceneData?calculateCinematicShot({...previousSceneData,beatIndex:sceneIndex-1}).shotScale:null;const directorShot=calculateCinematicShot({...currentSceneData,beatIndex:sceneIndex},previousScale);const cameraPlan=directorShot.cameraTransform;const composition=getSceneComposition(activeCanvasFormat,sceneIndex);const starBase=[composition.star.x*w,composition.star.y*h];const foxBase=[composition.character.x*w,composition.character.y*h];const showDemoFox=shouldShowProceduralDemoCharacter({storyUsesFallback:currentStoryboardPlan?currentStoryboardPlan.proceduralDemoCharacter===true:!String($('character').value||'').trim(),hasCharacterLayers:Array.isArray(currentSceneData.characterLayers)&&currentSceneData.characterLayers.length>0});const focusX=showDemoFox&&directorShot.focusTarget==='prop'?starBase[0]:showDemoFox?foxBase[0]:w/2;const focusY=showDemoFox&&directorShot.focusTarget==='prop'?starBase[1]:showDemoFox?foxBase[1]:h*.65;ctx.save();ctx.translate(w/2,h/2+cameraPlan.offsetY);ctx.scale(cameraPlan.zoom,cameraPlan.zoom);ctx.translate(-focusX,-focusY);const action=getSceneAction(sceneIndex);const activeMouthTracks=exportMouthOriginTimeMs!==null?exportMouthTracks:previewMouthTracks;const mouthClockOrigin=exportMouthOriginTimeMs!==null?exportMouthOriginTimeMs:previewMouthOriginTimeMs;const exportElapsedMs=mouthClockOrigin===null?-1:performance.now()-mouthClockOrigin;const facialLipSync=sampleCharacterFacialLipSync(activeMouthTracks,sceneIndex,exportElapsedMs);const activeMouthTrack=activeMouthTracks.find(track=>track.sceneIndex===sceneIndex&&exportElapsedMs>=track.startMs&&exportElapsedMs<track.startMs+track.envelope.durationMs);const mouthTrackTimeMs=activeMouthTrack?exportElapsedMs-activeMouthTrack.startMs:-1;const exportMouthOpenness=activeMouthTrack?sampleAudioMouthEnvelope(activeMouthTrack.envelope,mouthTrackTimeMs):0;const exportViseme=activeMouthTrack?sampleVisemeTimeline(activeMouthTrack.visemes,mouthTrackTimeMs):"neutral";let sx=320,sy=300;if(showDemoFox){sx=starBase[0]+Math.sin(t*1.5)*15;sy=starBase[1]+Math.cos(t*2)*12;if(action==='run'){sx+=Math.sin(t*2)*36;sy-=Math.abs(Math.sin(t*3))*10}else if(action==='float'){sy-=Math.abs(Math.sin(t*1.4))*24}else if(action==='vanish'){sx+=Math.sin(t)*4}const starPulse=1+Math.sin(t*3)*.08;const starScale=action==='magic'?1.35:action==='vanish'?Math.max(.08,1-((frame%45)/45)):action==='float'?.88:sceneIndex===1?1.18:sceneIndex===3?1.35:sceneIndex===4?.88:1; if(sceneIndex===3){ctx.save();ctx.translate(sx,sy);ctx.strokeStyle='rgba(255,229,138,'+(.35+.25*Math.abs(Math.sin(t*3)))+')';ctx.lineWidth=3;for(let ray=0;ray<8;ray++){const a=ray*Math.PI/4+t*.08;ctx.beginPath();ctx.moveTo(Math.cos(a)*34,Math.sin(a)*34);ctx.lineTo(Math.cos(a)*48,Math.sin(a)*48);ctx.stroke()}ctx.restore()}if(sceneIndex===4){for(let spark=0;spark<7;spark++){const a=spark*Math.PI*2/7+t*.35;const px=sx+Math.cos(a)*(24+Math.sin(t*2+spark)*5),py=sy+Math.sin(a)*(24+Math.sin(t*2+spark)*5);ctx.fillStyle='rgba(255,229,138,.8)';ctx.beginPath();ctx.arc(px,py,2.5,0,Math.PI*2);ctx.fill()}}ctx.save();ctx.translate(sx,sy);ctx.scale(starScale*starPulse,starScale*starPulse);ctx.rotate(t*.25);ctx.shadowBlur=sceneIndex===3?38:25;ctx.shadowColor='#ffe58a';ctx.fillStyle='#ffe58a';ctx.beginPath();for(let i=0;i<10;i++){let a=-Math.PI/2+i*Math.PI/5,r=i%2?13:30;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r)}ctx.closePath();ctx.fill();ctx.restore();}if(showDemoFox){drawProceduralDemoFox(ctx,{x:foxBase[0],y:foxBase[1],time:t,action,sceneIndex,mouthOpenness:exportMouthOpenness,viseme:exportViseme});}const generatedFrame=getLoadedSceneImage(currentSceneData.generatedImageUrl);
const generatedVideo=sceneVideoCache.get(String(currentSceneData.id||('scene-index-'+sceneIndex)));
const hasGeneratedVideo=Boolean(generatedVideo&&generatedVideo.readyState>=2&&generatedVideo.videoWidth>0);
const hasGeneratedMedia=hasGeneratedVideo||Boolean(generatedFrame);
const motionTransform=getPromptCameraTransform(currentSceneData.motionPrompt||currentSceneData.visibleAction,sceneMotionProgress);
if(hasGeneratedVideo){drawImageCover(ctx,generatedVideo,w,h,motionTransform)}
else if(generatedFrame){drawImageCover(ctx,generatedFrame,w,h,motionTransform)}
const sampledRigPoses=currentSceneData.characterRigTimeline?.keyframes?.length
 ? sampleCharacterRigTimeline(currentSceneData.characterRigTimeline,rigAnimationProgress)
 : currentSceneData.characterRigPoses;
drawSceneProps(ctx,currentSceneData,currentSceneData.characterLayers,sceneMotionProgress,w,h,t,{characterRigs:currentSceneData.characterRigs,rigPoses:sampledRigPoses});drawCharacterLayers(ctx,currentSceneData.characterLayers,getLoadedSceneImage,w,h,{motionTimeline:currentSceneData.characterMotionTimeline||currentSceneData.actionTimeline,progress:rigAnimationProgress,drawRigParts:true,preferRigParts:true,characterRigs:currentSceneData.characterRigs,rigPoses:sampledRigPoses,drawFacialRigs:true,characterFacialRigs:currentSceneData.characterFacialRigs,facialExpressions:currentSceneData.characterFacialExpressions,facialVisemes:facialLipSync.facialVisemes,facialMouthOpenness:facialLipSync.facialMouthOpenness});if(showDemoFox&&!hasGeneratedMedia&&playing&&frame%7===0&&(action==='magic'||sceneIndex===3))magicParticles.emit(sx,sy,4,sceneIndex===3?'#fff1a8':'#ffe58a');if(!showDemoFox||hasGeneratedMedia)magicParticles.particles.length=0;else magicParticles.updateAndDraw(ctx);ctx.restore();
updateFaceLandmarkPreviewOverlay({currentSceneData,generatedVideo,hasGeneratedVideo,motionTransform,viewportWidth:w,viewportHeight:h,cameraPlan,focusX,focusY});
try {
 captureCharacterMotionAuditFrame({
  currentSceneData,
  progress: sceneMotionProgress,
  viewportWidth: w,
  viewportHeight: h,
  camera: cameraPlan,
  focusX,
  focusY,
  rigPoses: sampledRigPoses
 });
} catch (error) {
 characterMotionAudit = null;
 $('characterMotionAuditStatus').textContent = (uiLang === 'ru'
  ? 'Не удалось прочитать пиксели композиции: '
  : 'Could not read composed pixels: ') + (error?.message || 'Canvas readback failed');
}
ctx.fillStyle='#fff';ctx.font='bold 21px system-ui';ctx.fillText($('character').value||(uiLang==='ru'?'Главный герой':'Main character'),24,38);if(playing){frame++;raf=requestAnimationFrame(draw)}else{raf=0}}
const storyTemplates={
en:{titles:['The beginning','A turning point','The next step'],middle:'A new detail changes the moment.',ending:'The story moves forward.',status:'Local DRAVEX storyboard created.'},
ru:{titles:['Начало','Поворот','Продолжение'],middle:'Новая деталь меняет ход событий.',ending:'История продолжается.',status:'Раскадровка создана локальным движком DRAVEX.'},
uk:{titles:['Початок','Поворот','Продовження'],middle:'Нова деталь змінює перебіг подій.',ending:'Історія продовжується.',status:'Розкадровку створено локальним рушієм DRAVEX.'},
es:{titles:['El comienzo','Un giro','El siguiente paso'],middle:'Un nuevo detalle cambia el momento.',ending:'La historia continúa.',status:'Guion gráfico creado con el motor local de DRAVEX.'}
};
const storyLabels={en:'Scene',ru:'Сцена',uk:'Сцена',es:'Escena'};
function storyLanguage(){return $('language').value||'en'}
const sceneEditorLabels={
en:{title:'Selected scene title',description:'Selected scene description',cast:'Characters in this scene · comma-separated',apply:'Apply scene edits',add:'Add scene',del:'Delete scene',titlePlaceholder:'Scene title',descriptionPlaceholder:'Describe what happens in this scene',limit:'You can add up to 12 scenes in this prototype.',minimum:'Keep at least one scene.',updated:'Scene updated.',added:'New scene added.',deleted:'Scene deleted.',production:'Scene production instructions',camera:'Camera / composition',image:'Image prompt · what the still frame must show',motion:'Motion prompt · what changes over time',start:'Start state',end:'End state',negative:'Avoid / negative prompt',continuity:'Continuity lock · details that must not change',compiled:'Preview of the final AI instructions',imagePreview:'Image generation instruction',motionPreview:'Animation instruction',characters:'Character consistency reference',noCharacters:'No character bible was returned. Add character details in the story brief or edit the scene prompts manually.',ready:'Scene is ready for image and motion generation.',incomplete:'Production brief incomplete: ',missing:{'missing-image-prompt':'image prompt','missing-motion-prompt':'motion prompt','missing-camera-plan':'camera plan','missing-start-state':'start state','missing-end-state':'end state'}},
ru:{title:'Название выбранной сцены',description:'Описание выбранной сцены',cast:'Персонажи в этой сцене · имена через запятую',apply:'Применить изменения',add:'Добавить сцену',del:'Удалить сцену',titlePlaceholder:'Название сцены',descriptionPlaceholder:'Опиши, что происходит в этой сцене',limit:'В этой версии можно добавить не более 12 сцен.',minimum:'Нужно оставить хотя бы одну сцену.',updated:'Сцена обновлена.',added:'Новая сцена добавлена.',deleted:'Сцена удалена.',production:'Инструкции для создания сцены',camera:'Камера и композиция',image:'Промпт изображения · что должно быть на кадре',motion:'Промпт движения · что меняется во времени',start:'Начальное состояние',end:'Конечное состояние',negative:'Чего избегать · negative prompt',continuity:'Фиксация постоянства · что нельзя менять',compiled:'Предпросмотр итоговых инструкций для AI',imagePreview:'Инструкция для генерации изображения',motionPreview:'Инструкция для анимации',characters:'Постоянство внешности персонажей',noCharacters:'Character Bible не получен. Добавь описание персонажей в сюжет или заполни промпты сцены вручную.',ready:'Сцена подготовлена для генерации изображения и движения.',incomplete:'Не хватает данных для подготовки сцены: ',missing:{'missing-image-prompt':'промпт изображения','missing-motion-prompt':'промпт движения','missing-camera-plan':'план камеры','missing-start-state':'начальное состояние','missing-end-state':'конечное состояние'}}
};
function applySceneEditorLanguage(){
const t=sceneEditorLabels[uiLang]||sceneEditorLabels.en;
const dialogueLabels={
 en:{summary:'Scene dialogue and narration',label:'One speaker per line',hint:'Use “Character: line” or “Character — line”. Unlabelled lines are narration. Load a local model, then generate and preview each dialogue line here.'},
 ru:{summary:'Диалоги и закадровый текст сцены',label:'Одна реплика на строку',hint:'Формат: «Персонаж: реплика» или «Персонаж — реплика». Строки без имени считаются текстом рассказчика. Загрузи локальную модель, затем создай и прослушай реплики здесь.'},
 uk:{summary:'Діалоги та закадровий текст сцени',label:'Одна репліка на рядок',hint:'Формат: «Персонаж: репліка» або «Персонаж — репліка». Рядки без імені — текст оповідача. Завантаж локальну модель, потім згенеруй і прослухай репліки тут.'},
 es:{summary:'Diálogo y narración de la escena',label:'Un hablante por línea',hint:'Usa “Personaje: texto” o “Personaje — texto”. Las líneas sin nombre son narración. Carga un modelo local y genera y escucha aquí cada línea.'}
};
const dialogue=dialogueLabels[storyLanguage()]||dialogueLabels.en;
$('dialogueSummary').textContent=dialogue.summary;$('sceneDialogueLabel').textContent=dialogue.label;$('sceneDialogueHint').textContent=dialogue.hint;
$('sceneTitleLabel').textContent=t.title;$('sceneDescriptionLabel').textContent=t.description;$('sceneCharactersLabel').textContent=t.cast;$('applyScene').textContent=t.apply;$('addScene').textContent=t.add;$('deleteScene').textContent=t.del;
$('sceneTitle').placeholder=t.titlePlaceholder;$('sceneDescription').placeholder=t.descriptionPlaceholder;
const labels={production:'productionSummary',camera:'sceneCameraLabel',image:'sceneImagePromptLabel',motion:'sceneMotionPromptLabel',start:'sceneStartStateLabel',end:'sceneEndStateLabel',negative:'sceneNegativePromptLabel',continuity:'sceneContinuityLockLabel',compiled:'compiledPromptSummary',imagePreview:'imagePromptPreviewLabel',motionPreview:'motionPromptPreviewLabel',characters:'characterBibleSummary'};
for(const [key,id] of Object.entries(labels))$(id).textContent=t[key];
}
function ensureMainCharacterReference(character){const id=String(character||'').trim();if(id&&!characterBible.some(entry=>String(entry.characterId||'').trim().toLowerCase()===id.toLowerCase()))characterBible=mergeCharacterReferences(characterBible,[{characterId:id}]);}
function renderCharacterBible(){
  const activeId=$('bibleCharacterId');
  const current=characterBible.find(entry=>entry.characterId===activeId.value.trim())||characterBible[0]||{};
  if(!characterBible.some(entry=>entry.characterId.toLowerCase()===activeId.value.trim().toLowerCase()))activeId.value=current.characterId||$('character').value.trim()||'';
  if(!activeId.dataset.loaded||activeId.dataset.loaded!==String(sceneIndex)){
    const profile=characterBible.find(entry=>entry.characterId.toLowerCase()===activeId.value.trim().toLowerCase())||current;
    $('bibleVisualDescription').value=profile.visualDescription||'';
    $('bibleClothing').value=profile.clothing||'';
    $('bibleColors').value=profile.colors||'';
    $('bibleDistinctiveFeatures').value=profile.distinctiveFeatures||'';
    $('bibleReferenceImageStatus').textContent=profile.referenceImageAssetId?(uiLang==='ru'?'Фото-референс сохранён локально на этом устройстве.':'Reference image is saved locally on this device.'):(uiLang==='ru'?'Фото-референс не добавлен.':'No reference image saved yet.');
    showCharacterReferenceImage(profile);
    activeId.dataset.loaded=String(sceneIndex);
  }
  const cards=$('characterReferenceCards');
  cards.replaceChildren();
  characterBible.forEach(entry=>{
    const card=document.createElement('div');card.className='character-reference-card';
    const title=document.createElement('strong');title.textContent=entry.characterId||'Character';
    const details=document.createElement('small');
    details.textContent=[entry.visualDescription,entry.clothing,entry.colors,entry.distinctiveFeatures].filter(Boolean).join(' · ')||'No appearance details saved yet.';
    card.append(title,details);cards.appendChild(card);
  });
}
$('saveCharacterReference').addEventListener('click',()=>{
  try{
    characterBible=upsertCharacterReference(characterBible,{
      characterId:$('bibleCharacterId').value,
      visualDescription:$('bibleVisualDescription').value,
      clothing:$('bibleClothing').value,
      colors:$('bibleColors').value,
      distinctiveFeatures:$('bibleDistinctiveFeatures').value,
      referenceImageAssetId:characterBible.find(entry=>entry.characterId.toLowerCase()===$('bibleCharacterId').value.trim().toLowerCase())?.referenceImageAssetId||''
    });
    $('bibleCharacterId').dataset.loaded=String(sceneIndex);
    $('characterReferenceStatus').textContent=uiLang==='ru'?'Образ сохранён. Он будет добавляться в промпты сцен с этим персонажем. Нажми «Сохранить черновик», чтобы сохранить его в браузере.':'Reference saved. It will be included in prompts for scenes featuring this character. Save the draft to persist it in this browser.';
    updateProductionPreview();
    renderCharacterBible();
  }catch(error){
    $('characterReferenceStatus').textContent=error.message;
  }
});
$('bibleReferenceImageFile').addEventListener('change',async()=>{
  const file=$('bibleReferenceImageFile').files?.[0]||null;
  if(!file)return;
  const characterId=$('bibleCharacterId').value.trim();
  if(!characterId){
    $('bibleReferenceImageStatus').textContent=uiLang==='ru'?'Сначала укажи имя персонажа.':'Enter the character name first.';
    $('bibleReferenceImageFile').value='';
    return;
  }
  try{
    const current=characterBible.find(entry=>entry.characterId.toLowerCase()===characterId.toLowerCase())||{};
    const randomPart=window.crypto?.randomUUID?.().replace(/-/g,'')||Date.now().toString(36)+Math.random().toString(36).slice(2);
    const assetId='refimg_'+randomPart;
    await characterReferenceImageStorage.put(assetId,file,file.name);
    if(current.referenceImageAssetId)await characterReferenceImageStorage.delete(current.referenceImageAssetId);
    characterBible=upsertCharacterReference(characterBible,{
      ...current,
      characterId,
      visualDescription:$('bibleVisualDescription').value,
      clothing:$('bibleClothing').value,
      colors:$('bibleColors').value,
      distinctiveFeatures:$('bibleDistinctiveFeatures').value,
      referenceImageAssetId:assetId
    });
    $('bibleCharacterId').dataset.loaded=String(sceneIndex);
    $('bibleReferenceImageStatus').textContent=uiLang==='ru'
      ?'Фото сохранено только в этом браузере ('+Math.round(file.size/1024)+' КБ). Для использования в сцене выбери локальный ComfyUI и настрой входы Reference Image 1/2 в workflow.'
      :'Image saved only in this browser ('+Math.round(file.size/1024)+' KB). To use it in a scene, choose local ComfyUI and configure Reference Image 1/2 workflow inputs.';
    showCharacterReferenceImage(characterBible.find(entry=>entry.characterId.toLowerCase()===characterId.toLowerCase()));
    renderCharacterBible();
  }catch(error){
    $('bibleReferenceImageStatus').textContent=error.message||'Could not save character reference image.';
  }
});
$('removeCharacterReferenceImage').addEventListener('click',async()=>{
 const characterId=$('bibleCharacterId').value.trim();
 const profile=characterBible.find(entry=>entry.characterId.toLowerCase()===characterId.toLowerCase());
 if(!profile?.referenceImageAssetId)return;
 try{
  await characterReferenceImageStorage.delete(profile.referenceImageAssetId);
  characterBible=upsertCharacterReference(characterBible,{...profile,referenceImageAssetId:''});
  $('bibleReferenceImageFile').value='';
  $('bibleReferenceImageStatus').textContent=uiLang==='ru'?'Фото удалено из локального хранилища. Нажми «Сохранить черновик», чтобы сохранить изменение.':'Photo removed from local storage. Save the draft to persist this change.';
  showCharacterReferenceImage(null);
  renderCharacterBible();
 }catch(error){$('bibleReferenceImageStatus').textContent=error.message||'Could not remove reference image.';}
});
async function loadCharacterReferenceImagesForScene(scene){
  const cast=normalizeSceneCast('',scene?.characters);
  const profiles=characterBible.filter(profile=>cast.some(name=>name.toLowerCase()===profile.characterId.toLowerCase()));
  const images=[];
  for(const profile of profiles){
    if(images.length>=2)break;
    if(!profile.referenceImageAssetId)continue;
    const record=await characterReferenceImageStorage.get(profile.referenceImageAssetId);
    if(record?.blob?.size)images.push({name:record.filename||profile.characterId+'.png',blob:record.blob});
  }
  return images;
}
function updateProductionPreview(){
const meta=sceneMetadata[sceneIndex]||{};
const scene={...meta,title:titles[sceneIndex],characters:normalizeSceneCast($('sceneCharacters').value,meta.characters),imagePrompt:$('sceneImagePrompt').value,motionPrompt:$('sceneMotionPrompt').value,camera:$('sceneCamera').value,startState:$('sceneStartState').value,endState:$('sceneEndState').value,negativePrompt:$('sceneNegativePrompt').value,continuityLock:$('sceneContinuityLock').value};
const t=sceneEditorLabels[uiLang]||sceneEditorLabels.en;
const readiness=validateSceneProductionReadiness(scene,characterBible);
$('sceneReadiness').textContent=readiness.ready?t.ready:t.incomplete+readiness.issues.map(issue=>t.missing[issue.code]||issue.field).join(', ');
$('imagePromptPreview').textContent=buildImageGenerationPrompt(scene,characterBible);
$('motionPromptPreview').textContent=buildMotionGenerationPrompt(scene,characterBible);
const spritePlan=buildCharacterSpriteAssetPlan(scene,characterBible);
$('spritePlanPreviewLabel').textContent=uiLang==='ru'?'План спрайтов персонажей · локальный предпросмотр':'Per-character sprite plan · local preview only';
$('spritePlanPreview').textContent=spritePlan.length?spritePlan.map(asset=>[
  asset.characterId+' · '+asset.status.toUpperCase(),
  asset.appearanceReference?'Appearance: '+asset.appearanceReference:'Appearance reference: missing',
  Number.isInteger(asset.identitySeed)?'Identity seed: '+asset.identitySeed+' · stable for this character profile across scenes':'Identity seed: unavailable',
  asset.action?'Action: '+asset.action:'Action: not safely assigned',
  asset.issues.length?'Blocked: '+asset.issues.map(issue=>issue.code).join(', '):'Prompt: '+asset.prompt
].join('\n')).join('\n\n'):(uiLang==='ru'?'В сцене пока нет отдельных персонажей.':'No individual characters are assigned to this scene.');
}
function renderGeneratedSceneImage(){
const meta=sceneMetadata[sceneIndex]||{},wrap=$('generatedImageWrap'),image=$('generatedSceneImage');
const url=String(meta.generatedImageUrl||'').trim();
if(!url){wrap.hidden=true;image.removeAttribute('src');$('generatedImageMeta').textContent='';return}
image.src=url;image.alt=(uiLang==='ru'?'Изображение сцены: ':'Generated scene image: ')+String(titles[sceneIndex]||'');
const info=[meta.generatedImageModel,meta.generatedImageWorker,meta.generatedImageSeed?'seed '+meta.generatedImageSeed:''].filter(Boolean);
$('generatedImageMeta').textContent=info.join(' · ');wrap.hidden=false;
}
function renderCharacterSpriteAssets(){
 const host=$('characterSpriteResults');
 if(!host)return;
 host.replaceChildren();
 const assets=Array.isArray(sceneMetadata[sceneIndex]?.characterSpriteAssets)?sceneMetadata[sceneIndex].characterSpriteAssets:[];
 if(!assets.length){
  const note=document.createElement('small');note.className='muted';
  note.textContent=uiLang==='ru'?'Для этой сцены ещё нет сгенерированных спрайтов.':'No generated character sprites for this scene yet.';
  host.appendChild(note);return;
 }
 assets.forEach(asset=>{
  if(!asset||!/^https:\/\//i.test(String(asset.imageUrl||'')))return;
  const card=document.createElement('div');card.className='sprite-result';
  const image=document.createElement('img');image.alt=(uiLang==='ru'?'Спрайт персонажа ':'Character sprite ')+String(asset.characterId||'');
  image.loading='lazy';image.referrerPolicy='no-referrer';
  const title=document.createElement('strong');title.textContent=String(asset.characterId||'Character');
  const note=document.createElement('small');
  const initialTransparency=asset.transparencyStatus||'unverified';
  note.textContent=uiLang==='ru'?'Прозрачность: '+initialTransparency+' · сходство не проверено · общий seed помогает повторяемости, но не гарантирует одинаковый образ':'Transparency: '+initialTransparency+' · identity not verified · shared seed helps repeatability but does not guarantee an identical design';
  const sceneId=String(sceneMetadata[sceneIndex]?.id||'');
  const assetId=String(asset.assetId||'');
  const updateTransparency=(status,check=null)=>{
   const resolvedSceneIndex=sceneMetadata.findIndex(item=>item&&String(item.id||'')===sceneId);
   if(resolvedSceneIndex>=0){
    const current=Array.isArray(sceneMetadata[resolvedSceneIndex].characterSpriteAssets)?sceneMetadata[resolvedSceneIndex].characterSpriteAssets:[];
    sceneMetadata[resolvedSceneIndex]={...sceneMetadata[resolvedSceneIndex],characterSpriteAssets:current.map(item=>item&&String(item.assetId||'')===assetId?{...item,transparencyStatus:status,transparencyCheck:check,verificationStatus:'not_verified',visualIdentityStatus:'not_verified'}:item)};
   }
  };
  const verificationImage=new Image();
  verificationImage.crossOrigin='anonymous';verificationImage.referrerPolicy='no-referrer';
  verificationImage.onload=()=>{
   try{
    const canvas=document.createElement('canvas');canvas.width=verificationImage.naturalWidth;canvas.height=verificationImage.naturalHeight;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context)throw new Error('Canvas 2D context unavailable');
    context.drawImage(verificationImage,0,0);
    const check=verifySpriteTransparency(context.getImageData(0,0,canvas.width,canvas.height),canvas.width,canvas.height);
    updateTransparency(check.status,check);
    note.textContent=uiLang==='ru'
      ?(check.passed?'Прозрачность подтверждена':'Прозрачность не пройдена')+' · сходство персонажа не проверено'
      :(check.passed?'Transparency verified':'Transparency check failed')+' · character identity not verified';
   }catch(error){
    updateTransparency('unverified',{reason:'image-pixels-unavailable'});
    note.textContent=uiLang==='ru'?'Пиксели недоступны (CORS) · проверка не выполнена':'Image pixels unavailable (CORS) · verification not performed';
   }
  };
  verificationImage.onerror=()=>{
   updateTransparency('unverified',{reason:'image-load-failed-or-cors'});
   note.textContent=uiLang==='ru'?'Проверка недоступна (CORS) · изображение можно открыть отдельно':'Verification unavailable (CORS) · preview can still be opened separately';
  };
  image.src=asset.imageUrl;
  verificationImage.src=asset.imageUrl;
  const addButton=document.createElement('button');addButton.type='button';addButton.className='secondary';
  const alreadyAttached=(Array.isArray(sceneMetadata[sceneIndex]?.characterLayers)?sceneMetadata[sceneIndex].characterLayers:[]).some(layer=>String(layer?.characterId||'').toLocaleLowerCase()===String(asset.characterId||'').toLocaleLowerCase());
  addButton.textContent=alreadyAttached?(uiLang==='ru'?'Обновить на сцене':'Update on scene'):(uiLang==='ru'?'Добавить на сцену':'Add to scene');
  addButton.addEventListener('click',()=>{
   const resolvedSceneIndex=sceneMetadata.findIndex(item=>item&&String(item.id||'')===sceneId);
   if(resolvedSceneIndex<0)return;
   const result=attachCharacterSpriteToSceneLayers(sceneMetadata[resolvedSceneIndex],asset);
   if(result.status==='invalid'){
    $('status').textContent=uiLang==='ru'?'Не удалось добавить спрайт: проверь имя персонажа и HTTPS-ссылку.':'Could not attach sprite: check character ID and HTTPS image URL.';
    return;
   }
   if(result.status==='limit-reached'){
    $('status').textContent=uiLang==='ru'?'Достигнут лимит слоёв персонажей для сцены.':'Character layer limit reached for this scene.';
    return;
   }
   sceneMetadata[resolvedSceneIndex]={...sceneMetadata[resolvedSceneIndex],characterLayers:result.layers};
   if(resolvedSceneIndex===sceneIndex)syncCharacterMotionEditor();
   addButton.textContent=uiLang==='ru'?'Обновить на сцене':'Update on scene';
   $('status').textContent=uiLang==='ru'
    ?(result.status==='added'?'Персонаж добавлен на сцену.':'Спрайт персонажа обновлён; положение сохранено.')
    :(result.status==='added'?'Character added to scene.':'Character sprite updated; placement preserved.');
   if(!playing)draw();
  });
  const link=document.createElement('a');link.href=asset.imageUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent=uiLang==='ru'?'Открыть изображение':'Open image';
  card.append(image,title,note,addButton,link);host.appendChild(card);
 });
}
function syncCharacterMotionEditor(){
 const meta=sceneMetadata[sceneIndex]||{};
 const select=$('sceneMotionActor');
 const layers=Array.isArray(meta.characterLayers)?meta.characterLayers:[];
 const selected=select.value;
 select.replaceChildren();
 layers.forEach(layer=>{
   const option=document.createElement('option');
   option.value=String(layer.characterId||'');
   option.textContent=String(layer.characterId||'Character');
   select.appendChild(option);
 });
 if(layers.some(layer=>String(layer.characterId||'')===selected))select.value=selected;
 const actor=layers.find(layer=>String(layer.characterId||'')===select.value)||layers[0];
 if(!actor){
   const option=document.createElement('option');option.value='';option.textContent='Add a character sprite to this scene first';select.appendChild(option);
   select.disabled=true;$('applyCharacterMotion').disabled=true;
   $('characterMotionStatus').textContent='Add a generated character sprite to enable motion controls.';
   return;
 }
 select.disabled=false;$('applyCharacterMotion').disabled=false;
 const phase=(meta.characterMotionTimeline?.phases||[]).find(item=>String(item.actorId||'').toLowerCase()===String(actor.characterId||'').toLowerCase());
 const from=phase?.motion?.from||actor;
 const to=phase?.motion?.to||actor;
 $('sceneMotionStart').value=phase?.start??0;
 $('sceneMotionEnd').value=phase?.end??1;
 $('sceneMotionX').value=to.x??actor.x??0.5;
 $('sceneMotionY').value=to.y??actor.y??0.5;
 $('sceneMotionScale').value=to.scale??actor.scale??1;
 $('sceneMotionRotation').value=Math.round((to.rotation??actor.rotation??0)*180/Math.PI);
 $('sceneMotionOpacity').value=to.opacity??actor.opacity??1;
 $('sceneMotionEasing').value=phase?.easing||'ease-in-out';
 $('characterMotionStatus').textContent=phase
   ? 'Motion keyframes loaded for '+actor.characterId+'. Preview and export use this timeline.'
   : 'No motion keyframes yet. The current sprite transform will be used as the start pose.';
}
$('sceneMotionActor').addEventListener('change',syncCharacterMotionEditor);
$('sceneMotionActor').addEventListener('change',syncCharacterRigEditor);
$('characterRigMotionPreset').innerHTML=listCharacterRigMotionPresets().map(item=>'<option value="'+item.id+'">'+item.label+'</option>').join('');
$('characterRigScrubber').addEventListener('input',()=>{
 rigPreviewProgress=Number($('characterRigScrubber').value)/100;
 $('characterRigScrubberValue').textContent=$('characterRigScrubber').value+'%';
 if(!playing)draw();
});
$('resetCharacterRigScrubber').addEventListener('click',()=>{
 rigPreviewProgress=null;
 $('characterRigScrubber').value='0';
 $('characterRigScrubberValue').textContent='Scene clock';
 sceneMotionSceneIndex=-1;
 if(!playing)draw();
});

$('generateCharacterRigPreset').addEventListener('click',()=>{
 const actorId=$('sceneMotionActor').value;
 const meta=sceneMetadata[sceneIndex]||{};
 const rig=(meta.characterRigs||[]).find(item=>String(item.characterId||'').toLowerCase()===String(actorId||'').toLowerCase());
 if(!rig){$('characterRigStatus').textContent='Attach a valid segmented rig first.';return}
 const result=createCharacterRigMotionPreset(rig,$('characterRigMotionPreset').value);
 if(result.status!=='ready'){
  $('characterRigStatus').textContent='Preset unavailable: '+(result.issues||[]).map(issue=>issue.message).join(' ');
  return;
 }
 sceneMetadata[sceneIndex]={...meta,characterRigTimeline:result.timeline};
 $('characterRigTimelineJson').value=JSON.stringify(result.timeline,null,2);
 $('characterRigScrubber').disabled=false;
 $('resetCharacterRigScrubber').disabled=false;
 rigPreviewProgress=0;
 $('characterRigScrubber').value='0';
 $('characterRigScrubberValue').textContent='0%';
 $('characterRigStatus').textContent=result.label+' generated for '+actorId+'. Animated bones: '+(result.animatedBoneIds.join(', ')||'none')+'. '+(result.warnings.join(' ')||'No rig mapping warnings.');
 sceneMotionSceneIndex=-1;
 if(!playing)draw();
});

$('generateCharacterRigFromStory').addEventListener('click',()=>{
  const batch=generateCharacterRigTimelinesForScenes(sceneMetadata,createCharacterRigTimelineFromActionTimeline);
  sceneMetadata=batch.scenes;
  const current=sceneMetadata[sceneIndex]||{};
  syncCharacterRigEditor();
  $('characterRigTimelineJson').value=current.characterRigTimeline?JSON.stringify(current.characterRigTimeline,null,2):'';
  $('characterRigScrubber').disabled=!current.characterRigTimeline?.keyframes?.length;
  $('resetCharacterRigScrubber').disabled=!current.characterRigTimeline?.keyframes?.length;
  rigPreviewProgress=current.characterRigTimeline?.keyframes?.length?0:null;
  $('characterRigScrubber').value='0';
  $('characterRigScrubberValue').textContent=rigPreviewProgress===null?'Scene clock':'0%';
  const details=batch.skipped.map(item=>'Scene '+(item.sceneIndex+1)+': '+(item.reason||((item.skippedActions||0)+' action(s) skipped')));
  $('characterRigStatus').textContent='Story animation generated for '+batch.generatedScenes+' scene(s), '+batch.generatedActions+' action(s). '+batch.scenesWithoutRig+' scene(s) have no attached segmented rig; '+batch.scenesWithoutActions+' scene(s) have no supported validated actions; '+batch.preservedTimelines+' existing timeline(s) preserved.'+(details.length?' Details: '+details.join(' · '):'')+' Preview and canvas export sample the same rig timelines.';
  sceneMotionSceneIndex=-1;
  if(!playing)draw();
});

function rigJsonTemplate(characterId){
 return JSON.stringify({
  schemaVersion:1,characterId,
  bones:[{id:'root',parentId:null,pivotX:0.5,pivotY:0.5}],
  parts:[{id:'body',boneId:'root',imageUrl:'https://example.com/replace-with-body.png',x:0.5,y:0.5,width:0.3,height:0.5,rotation:0,zIndex:0}]
 },null,2);
}
function syncCharacterRigEditor(){
 const meta=sceneMetadata[sceneIndex]||{};
 const actorId=$('sceneMotionActor').value;
 const rig=(meta.characterRigs||[]).find(item=>String(item.characterId||'').toLowerCase()===String(actorId||'').toLowerCase());
 $('characterRigJson').value=rig?JSON.stringify(rig,null,2):(actorId?rigJsonTemplate(actorId):'');
 const poses=characterRigPosesFor(actorId,meta.characterRigPoses);
 $('characterRigPoseJson').value=JSON.stringify(poses,null,2);
 const rigBones=rig?.bones||[];
 const neutralPose={};
 rigBones.forEach(bone=>{neutralPose[bone.id]={x:0,y:0,rotation:0}});
 const exampleTimeline={schemaVersion:1,keyframes:[
  {time:0,easing:'linear',poses:{[actorId||'Character']:neutralPose}},
  {time:1,easing:'ease-in-out',poses:{[actorId||'Character']:Object.fromEntries(rigBones.map(bone=>[bone.id,{x:0,y:0,rotation:bone.id.toLowerCase().includes('arm')?0.25:0}]))}}
 ]};
 $('characterRigTimelineJson').value=meta.characterRigTimeline
  ?JSON.stringify(meta.characterRigTimeline,null,2)
  :JSON.stringify(exampleTimeline,null,2);
 $('characterRigJson').disabled=!actorId;
 $('characterRigPoseJson').disabled=!actorId||!rig;
 $('applyCharacterRig').disabled=!actorId;
 $('applyCharacterRigPose').disabled=!actorId||!rig;
 $('characterRigTimelineJson').disabled=!actorId||!rig;
 $('applyCharacterRigTimeline').disabled=!actorId||!rig;
 $('characterRigScrubber').disabled=!actorId||!rig||!meta.characterRigTimeline?.keyframes?.length;
 $('resetCharacterRigScrubber').disabled=!actorId||!rig||!meta.characterRigTimeline?.keyframes?.length;
 $('characterRigMotionPreset').disabled=!actorId||!rig;
 $('generateCharacterRigPreset').disabled=!actorId||!rig;
 $('characterRigStatus').textContent=rig
  ? 'Rig loaded for '+actorId+'. '+rig.bones.length+' bones · '+rig.parts.length+' image parts.'
  : 'Choose a character sprite first. Replace the example URL with transparent images for separate body parts.';
}
$('applyCharacterRig').addEventListener('click',()=>{
 const actorId=$('sceneMotionActor').value;
 if(!actorId){$('characterRigStatus').textContent='Add a character sprite to this scene first.';return}
 try{
  const parsed=JSON.parse($('characterRigJson').value);
  const report=validateCharacterRig(parsed);
  if(!report.passed){
   $('characterRigStatus').textContent='Rig rejected: '+report.issues.map(issue=>issue.message).join(' ');
   return;
  }
  if(report.rig.characterId.toLowerCase()!==actorId.toLowerCase()){
   $('characterRigStatus').textContent='Rig characterId must match selected sprite: '+actorId+'.';
   return;
  }
  const meta=sceneMetadata[sceneIndex]||{};
  const rigs=(meta.characterRigs||[]).filter(item=>String(item.characterId||'').toLowerCase()!==actorId.toLowerCase());
  rigs.push(report.rig);
  sceneMetadata[sceneIndex]={...meta,characterRigs:rigs};
  syncCharacterRigEditor();
  if(!playing)draw();
  $('characterRigStatus').textContent='Rig validated and attached: '+report.rig.bones.length+' bones, '+report.rig.parts.length+' parts. Preview uses rig parts when every image loads.';
 }catch(error){$('characterRigStatus').textContent='Invalid JSON: '+error.message}
});
$('applyCharacterRigTimeline').addEventListener('click',()=>{
 const meta=sceneMetadata[sceneIndex]||{};
 const rigs=Array.isArray(meta.characterRigs)?meta.characterRigs:[];
 if(!rigs.length){$('characterRigStatus').textContent='Attach at least one valid rig before adding bone animation.';return}
 try{
  const parsed=JSON.parse($('characterRigTimelineJson').value);
  const report=validateCharacterRigTimeline(parsed);
  if(!report.passed){
   $('characterRigStatus').textContent='Animation rejected: '+report.issues.map(issue=>issue.message).join(' ');
   return;
  }
  const rigMap=new Map(rigs.map(rig=>[String(rig.characterId||'').toLowerCase(),new Set((rig.bones||[]).map(bone=>String(bone.id||'').toLowerCase()))]));
  const unknown=[];
  report.timeline.keyframes.forEach((keyframe,index)=>{
   Object.entries(keyframe.poses).forEach(([characterId,bones])=>{
    const allowed=rigMap.get(characterId.toLowerCase());
    if(!allowed){unknown.push('keyframe '+index+': '+characterId+' has no attached rig');return}
    Object.keys(bones).forEach(boneId=>{if(!allowed.has(boneId.toLowerCase()))unknown.push('keyframe '+index+': '+characterId+'.'+boneId+' is not in its rig')});
   });
  });
  if(unknown.length){$('characterRigStatus').textContent='Animation references invalid rigs/bones: '+unknown.join('; ');return}
  sceneMetadata[sceneIndex]={...meta,characterRigTimeline:report.timeline};
  $('characterRigScrubber').disabled=false;
  $('resetCharacterRigScrubber').disabled=false;
  rigPreviewProgress=0;
  $('characterRigScrubber').value='0';
  $('characterRigScrubberValue').textContent='0%';
  $('characterRigStatus').textContent='Bone animation validated: '+report.timeline.keyframes.length+' keyframes. Preview and canvas export sample the same timeline.';
  sceneMotionSceneIndex=-1;
  if(!playing)draw();
 }catch(error){$('characterRigStatus').textContent='Invalid animation JSON: '+error.message}
});
$('applyCharacterRigPose').addEventListener('click',()=>{
 const actorId=$('sceneMotionActor').value;
 const meta=sceneMetadata[sceneIndex]||{};
 const rig=(meta.characterRigs||[]).find(item=>String(item.characterId||'').toLowerCase()===String(actorId||'').toLowerCase());
 if(!rig){$('characterRigStatus').textContent='Attach a valid rig first.';return}
 try{
  const parsed=JSON.parse($('characterRigPoseJson').value);
  const normalized=normalizeCharacterRigPoses({[actorId]:parsed})[actorId]||{};
  const validBoneIds=new Set(rig.bones.map(bone=>bone.id.toLowerCase()));
  const unknown=Object.keys(normalized).filter(id=>!validBoneIds.has(id.toLowerCase()));
  if(unknown.length){$('characterRigStatus').textContent='Unknown bone IDs: '+unknown.join(', ');return}
  sceneMetadata[sceneIndex]={...meta,characterRigPoses:{...(meta.characterRigPoses||{}),[actorId]:normalized}};
  $('characterRigStatus').textContent='Bone pose saved for '+actorId+'. Preview and canvas export use the same scene compositor.';
  if(!playing)draw();
 }catch(error){$('characterRigStatus').textContent='Invalid pose JSON: '+error.message}
});

$('applyCharacterMotion').addEventListener('click',()=>{
 const meta=sceneMetadata[sceneIndex]||{};
 const actorId=$('sceneMotionActor').value;
 const layer=(meta.characterLayers||[]).find(item=>String(item.characterId||'')===actorId);
 if(!layer){$('characterMotionStatus').textContent='Add a character sprite to this scene first.';return}
 const number=id=>Number($(id).value);
 try{
   const timeline=upsertCharacterMotionPhase(meta.characterMotionTimeline,{
     actorId,
     start:number('sceneMotionStart'),
     end:number('sceneMotionEnd'),
     easing:$('sceneMotionEasing').value,
     from:{x:Number(layer.x),y:Number(layer.y),scale:Number(layer.scale),rotation:Number(layer.rotation),opacity:Number(layer.opacity)},
     to:{x:number('sceneMotionX'),y:number('sceneMotionY'),scale:number('sceneMotionScale'),rotation:number('sceneMotionRotation')*Math.PI/180,opacity:number('sceneMotionOpacity')}
   });
   sceneMetadata[sceneIndex]={...meta,characterMotionTimeline:timeline};
   sceneMotionSceneIndex=-1;
   $('characterMotionStatus').textContent='Motion saved for '+actorId+'. Play the scene or export to see the movement.';
   if(!playing)draw();
 }catch(error){$('characterMotionStatus').textContent=error.message||'Invalid motion settings.'}
});
$('generateCharacterMotion').addEventListener('click',()=>{
 const meta=sceneMetadata[sceneIndex]||{};
 const result=planCharacterMotionFromActionTimeline(meta,meta.characterLayers||[]);
 if(!result.timeline){
   $('characterMotionStatus').textContent=result.reason||'No safe motion plan could be generated.';
   return;
 }
 sceneMetadata[sceneIndex]={...meta,characterMotionTimeline:result.timeline};
 sceneMotionSceneIndex=-1;
 const skipped=result.skipped?.length||0;
 $('characterMotionStatus').textContent='Generated '+result.generatedCount+' motion keyframe phases from grounded story actions.'+(skipped?' Skipped '+skipped+' ambiguous or unavailable action(s).':'')+' Preview and canvas export use this motion timeline.';
 syncCharacterMotionEditor();
 if(!playing)draw();
});
function syncFacialRigEditor(){
 const meta=sceneMetadata[sceneIndex]||{};
 const rigs=Array.isArray(meta.characterFacialRigs)?meta.characterFacialRigs:[];
 const characterId=String($("facialCharacterId")?.value||"").trim()||rigs[0]?.characterId||meta.characters?.[0]||$("character").value||"";
 const rig=rigs.find(item=>String(item?.characterId||"").toLowerCase()===String(characterId).toLowerCase())||null;
 $("facialCharacterId").value=characterId;
 $("facialHeadBoneId").value=rig?.headBoneId||$("facialHeadBoneId").value||"head";
 const select=$("facialPartSelect"),previous=select.value;
 select.replaceChildren(new Option("New part / Новая часть",""));
 for(const part of rig?.parts||[])select.add(new Option(String(part.id)+" · "+String(part.role),String(part.id)));
 select.value=(rig?.parts||[]).some(part=>String(part.id)===previous)?previous:"";
 const part=(rig?.parts||[]).find(item=>String(item.id)===select.value)||null;
 $("facialPartId").value=part?.id||"";$("facialPartRole").value=part?.role||"eye-left";$("facialPartViseme").value=part?.viseme||"";$("facialPartImageUrl").value=part?.imageUrl||"";
 $("facialPartX").value=String(part?.x??0.5);$("facialPartY").value=String(part?.y??0.5);$("facialPartWidth").value=String(part?.width??0.1);$("facialPartHeight").value=String(part?.height??0.1);
 $("facialPartRotation").value=String((Number(part?.rotation)||0)*180/Math.PI);$("facialPartZIndex").value=String(part?.zIndex??10);
 const expression=meta.characterFacialExpressions?.[characterId]||{};
 $("facialExpressionPreset").value=expression.name||"neutral";$("facialEyeOpen").value=String(expression.eyeOpen??1);$("facialMouthOpen").value=String(expression.mouthOpen??0);$("facialBrowY").value=String(expression.browY??0);$("facialMouthWidth").value=String(expression.mouthWidth??1);
 $("removeFacialPart").disabled=!part;
}
function syncSceneEditor(){
const meta=sceneMetadata[sceneIndex]||{};
$('sceneTitle').value=titles[sceneIndex]||'';
$('sceneDescription').value=descriptions[sceneIndex]||'';
$('sceneCharacters').value=(Array.isArray(meta.characters)?meta.characters:[]).join(', ');
$('sceneDialogue').value=formatDialogueLines(meta.dialogue);
$('sceneCamera').value=meta.camera||'';
$('sceneImagePrompt').value=meta.imagePrompt||meta.prompt||descriptions[sceneIndex]||'';
$('sceneMotionPrompt').value=meta.motionPrompt||meta.visibleAction||descriptions[sceneIndex]||'';
$('sceneStartState').value=meta.startState||'';
$('sceneEndState').value=meta.endState||'';
$('sceneNegativePrompt').value=meta.negativePrompt||'No extra characters, no character redesign, no duplicate body parts, no text or watermark.';
$('sceneContinuityLock').value=meta.continuityLock||'';
updateProductionPreview();
renderCharacterBible();
renderGeneratedSceneImage();
renderCharacterSpriteAssets();
renderCharacterRigPartSets();
syncCharacterMotionEditor();
syncCharacterRigEditor();
renderComfySceneVideo();
renderSceneVoiceAudio();
refreshSceneVoiceControls();
syncFacialRigEditor();
}
const pendingSceneVideoInvalidations=new Map();
const sceneGenerationGuard=createSceneGenerationGuard();
function invalidateCurrentSceneVideoForEdit(){
 const meta=sceneMetadata[sceneIndex];
 const key=meta?.id?String(meta.id):'';
 if(!key)return;
 const invalidationRevision=sceneGenerationGuard.invalidate(key);const invalidationStorageRevision=sceneGenerationGuard.storageRevision(key);
 const entry=sceneVideoCache.get(key);
 if(entry){
  sceneVideoCache.delete(key);
  disposeSceneVideoEntry(entry);
  renderComfySceneVideo();
  updateFaceAnalysisControls();
  if(!playing)draw();
  $('status').textContent=uiLang==='ru'
   ?'Параметры сцены изменены. Старый видеоклип удалён — создай новый, чтобы он соответствовал изменениям.'
   :'Scene settings changed. The previous clip was removed; generate a new clip to match the edits.';
 }
 if(pendingSceneVideoInvalidations.has(key))return;
 const pending=(async()=>{
  await sceneVideoRestorePromise;
  const restored=sceneVideoCache.get(key);
  if(restored){
   sceneVideoCache.delete(key);
   disposeSceneVideoEntry(restored);
   renderComfySceneVideo();
   updateFaceAnalysisControls();
   if(!playing)draw();
  }
  await sceneVideoStorage.deleteOlderThanRevision(key,invalidationStorageRevision);
 })().catch(error=>console.warn('Could not invalidate the previous scene video:',error))
   .finally(()=>pendingSceneVideoInvalidations.delete(key));
 pendingSceneVideoInvalidations.set(key,pending);
}
['sceneCamera','sceneImagePrompt','sceneMotionPrompt','sceneStartState','sceneEndState','sceneNegativePrompt','sceneContinuityLock','sceneCharacters'].forEach(id=>$(id).addEventListener('input',()=>{
 invalidateCurrentSceneVideoForEdit();
 updateProductionPreview();
}));
$("facialPartSelect").addEventListener("change",syncFacialRigEditor);
$("facialPartImageFile").addEventListener("change",async event=>{
const file=event.target.files?.[0];if(!file)return;const status=$("facialAssetUploadStatus");
try{
const randomId=globalThis.crypto?.randomUUID?.().replace(/-/g,"")||Date.now().toString(36)+Math.random().toString(36).slice(2,10);
const assetId="faceasset_"+randomId;await facialAssetStorage.put(assetId,file,file.name);
$("facialPartImageUrl").value="dravex-facial-asset://"+assetId;
status.textContent=uiLang==="ru"?"Изображение сохранено только на этом устройстве.":"Image saved on this device only.";
const saved=writeLocalStorage("dravex-cartoon-draft",JSON.stringify({idea:$("idea").value,character:$("character").value,style:$("style").value,canvasFormat:activeCanvasFormat,imageQuality:$("imageQuality").value,duration:$("duration").value,language:$("language").value,uiLanguage:uiLang,titles,descriptions,sceneMetadata,characterBible,sceneIndex}));
if(!saved)status.textContent+=" Draft storage is full; save the project manually.";
}catch(error){status.textContent=error.message||"Could not save facial image.";event.target.value="";}
});
$("saveFacialPart").addEventListener("click",()=>{
 const result=upsertCharacterFacialPart(sceneMetadata[sceneIndex]||{},{characterId:$("facialCharacterId").value,headBoneId:$("facialHeadBoneId").value,partId:$("facialPartId").value,role:$("facialPartRole").value,viseme:$("facialPartViseme").value,imageUrl:$("facialPartImageUrl").value,x:Number($("facialPartX").value),y:Number($("facialPartY").value),width:Number($("facialPartWidth").value),height:Number($("facialPartHeight").value),rotation:Number($("facialPartRotation").value)*Math.PI/180,zIndex:Number($("facialPartZIndex").value)});
 if(result.status==="invalid"){$("facialEditorStatus").textContent=result.issues.map(issue=>issue.message).join(" ");return;}
 sceneMetadata[sceneIndex]=result.scene;
 const draftSaved=writeLocalStorage("dravex-cartoon-draft",JSON.stringify({idea:$("idea").value,character:$("character").value,style:$("style").value,canvasFormat:activeCanvasFormat,imageQuality:$("imageQuality").value,duration:$("duration").value,language:$("language").value,uiLanguage:uiLang,titles,descriptions,sceneMetadata,characterBible,sceneIndex}));
 if(currentStoryboardPlan)currentStoryboardPlan={...currentStoryboardPlan,scenes:sceneMetadata,eventChain:buildStoryEventChain(sceneMetadata)};
 syncFacialRigEditor();if(!playing)draw();
 $("facialEditorStatus").textContent=(result.status==="updated"?"Facial part updated. / Часть лица обновлена.":"Facial part added. / Часть лица добавлена.")+(draftSaved?" Draft saved.":" Draft could not be saved; use Save project.");
});
$("removeFacialPart").addEventListener("click",()=>{
 const characterId=String($("facialCharacterId").value||"").trim(),partId=$("facialPartSelect").value;
 if(!characterId||!partId)return;
 const meta=sceneMetadata[sceneIndex]||{},rigs=Array.isArray(meta.characterFacialRigs)?meta.characterFacialRigs:[];
 const next=rigs.map(rig=>String(rig.characterId).toLowerCase()===characterId.toLowerCase()?{...rig,parts:(rig.parts||[]).filter(part=>String(part.id)!==partId)}:rig).filter(rig=>rig.parts?.length);
 sceneMetadata[sceneIndex]={...meta,characterFacialRigs:next};syncFacialRigEditor();if(!playing)draw();
 $("facialEditorStatus").textContent="Facial part removed. / Часть лица удалена.";
});
$("applyFacialExpression").addEventListener("click",()=>{
 const result=applyCharacterFacialExpressionToScene(sceneMetadata[sceneIndex]||{},$("facialCharacterId").value,$("facialExpressionPreset").value,{eyeOpen:Number($("facialEyeOpen").value),mouthOpen:Number($("facialMouthOpen").value),browY:Number($("facialBrowY").value),mouthWidth:Number($("facialMouthWidth").value)});
 if(result.status!=="ready"){$("facialEditorStatus").textContent=result.issues.map(issue=>issue.message).join(" ");return;}
 sceneMetadata[sceneIndex]=result.scene;if(currentStoryboardPlan)currentStoryboardPlan={...currentStoryboardPlan,scenes:sceneMetadata,eventChain:buildStoryEventChain(sceneMetadata)};
 if(!playing)draw();$("facialEditorStatus").textContent="Expression applied to preview. / Эмоция применена к предпросмотру.";
});
function updateStoryQA(){
  const safeText=value=>{
    if(value===null||value===undefined)return '';
    if(typeof value==='string'||typeof value==='number')return String(value).trim();
    return '';
  };
  const sourceTitles=Array.isArray(titles)?titles:[];
  const sourceDescriptions=Array.isArray(descriptions)?descriptions:[];
  const rawDuration=Number($('duration')?.value);
  const duration=Number.isFinite(rawDuration)&&rawDuration>=0.25&&rawDuration<=30?rawDuration:3;
  const scenes=sourceTitles.map((title,index)=>{const metadata=sceneMetadata[index]||{};const description=safeText(sourceDescriptions[index]);return {
    id:safeText(metadata.id)||'scene_'+(index+1),order:index+1,title:safeText(title),
    prompt:safeText(metadata.prompt)||description,visibleAction:safeText(metadata.visibleAction)||description,
    camera:safeText(metadata.camera),duration
  }});
  let qa;
  try{qa=validateStoryScenes(scenes)}
  catch(error){
    console.error('Storyboard QA failed:',error);
    qa={ok:false,errorCount:1,warningCount:0,totalDurationSeconds:0,issues:[{severity:'error',message:'Could not validate the storyboard.'}]};
  }
  const issues=Array.isArray(qa.issues)?qa.issues:[];
  const report=$('qaReport');
  const errors=Number.isFinite(qa.errorCount)?qa.errorCount:1;
  const warnings=Number.isFinite(qa.warningCount)?qa.warningCount:0;
  const statusClass=errors>0?'qa-report--error':warnings>0?'qa-report--warning':'qa-report--ok';
  const visibleIssues=issues.filter(issue=>issue&&safeText(issue.message));
  if(report){
    report.replaceChildren();
    report.classList.add('qa-report');
    report.classList.remove('qa-report--ok','qa-report--warning','qa-report--error');
    report.classList.add(statusClass);
    const heading=document.createElement('p');
    heading.className='qa-report__summary';
    heading.textContent=(uiLang==='ru'?'Проверка раскадровки: ':'Storyboard QA: ')+
      (errors===0?(uiLang==='ru'?'критических ошибок нет':'no critical errors'):(uiLang==='ru'?'ошибок: ':'errors: ')+errors)+
      ' · '+(uiLang==='ru'?'предупреждений: ':'warnings: ')+warnings+
      ' · '+(uiLang==='ru'?'сцен: ':'scenes: ')+scenes.length;
    report.appendChild(heading);
    if(visibleIssues.length){
      const list=document.createElement('ul');
      list.className='qa-report__list';
      visibleIssues.slice(0,5).forEach(issue=>{
        const item=document.createElement('li');
        const severity=issue.severity==='error'?'error':issue.severity==='warning'?'warning':'info';
        item.className='qa-report__item'+(severity==='error'?' qa-report__item--error':severity==='warning'?' qa-report__item--warning':'');
        const badge=document.createElement('span');
        badge.className='qa-badge';
        badge.textContent=severity==='error'?(uiLang==='ru'?'Ошибка':'Error'):severity==='warning'?(uiLang==='ru'?'Внимание':'Warning'):(uiLang==='ru'?'Совет':'Info');
        item.appendChild(badge);
        item.appendChild(document.createTextNode(safeText(issue.message)));
        list.appendChild(item);
      });
      if(visibleIssues.length>5){
        const more=document.createElement('li');
        more.className='qa-report__item qa-report__item--more';
        more.textContent=uiLang==='ru'?'И ещё замечаний: '+(visibleIssues.length-5):'And '+(visibleIssues.length-5)+' more issue(s).';
        list.appendChild(more);
      }
      report.appendChild(list);
    }
    report.dataset.errorCount=String(errors);
    report.dataset.warningCount=String(warnings);
    report.setAttribute('aria-live','polite');
  }
  return {...qa,issues,scenes,canContinue:errors===0};
}
$('applyScene').onclick=()=>{
const title=$('sceneTitle').value.trim(),description=$('sceneDescription').value.trim();
if(!title||!description){$('status').textContent=uiLang==='ru'?'Заполни название и описание сцены.':'Please enter both a scene title and description.';return}
const imagePrompt=$('sceneImagePrompt').value.trim()||description;
const motionPrompt=$('sceneMotionPrompt').value.trim()||description;
const characters=normalizeSceneCast($('sceneCharacters').value,sceneMetadata[sceneIndex]?.characters);
titles[sceneIndex]=title;descriptions[sceneIndex]=description;
const previousDialogue=formatDialogueLines(sceneMetadata[sceneIndex]?.dialogue);const nextDialogue=$('sceneDialogue').value.trim();const dialogueChanged=previousDialogue!==nextDialogue;sceneMetadata[sceneIndex]={...(sceneMetadata[sceneIndex]||{}),title,description,characters,dialogue:parseDialogueLines($('sceneDialogue').value,storyLanguage()),voiceCues:dialogueChanged?[]:(sceneMetadata[sceneIndex]?.voiceCues||[]),voiceTimeline:dialogueChanged?null:(sceneMetadata[sceneIndex]?.voiceTimeline||null),prompt:imagePrompt,imagePrompt,visibleAction:motionPrompt,motionPrompt,camera:$('sceneCamera').value.trim(),startState:$('sceneStartState').value.trim(),endState:$('sceneEndState').value.trim(),negativePrompt:$('sceneNegativePrompt').value.trim(),continuityLock:$('sceneContinuityLock').value.trim()};if(currentStoryboardPlan)currentStoryboardPlan={...currentStoryboardPlan,scenes:sceneMetadata,eventChain:buildStoryEventChain(sceneMetadata)};
$('sceneLabel').textContent=(storyLabels[storyLanguage()]||'Scene')+' '+(sceneIndex+1)+' · '+title;
renderScenes();syncSceneEditor();updateStoryQA();if(!playing)draw();$('status').textContent=(sceneEditorLabels[uiLang]||sceneEditorLabels.en).updated
};
$('addScene').onclick=()=>{const t=sceneEditorLabels[uiLang]||sceneEditorLabels.en;if(titles.length>=12){$('status').textContent=t.limit;return}titles.push(uiLang==='ru'?'Новая сцена':'New scene');descriptions.push(uiLang==='ru'?'Добавь описание этой сцены.':'Add a description for this scene.');sceneMetadata.push({id:createSceneId(),title:titles[titles.length-1],description:descriptions[descriptions.length-1],prompt:descriptions[descriptions.length-1],visibleAction:descriptions[descriptions.length-1],camera:''});if(currentStoryboardPlan)currentStoryboardPlan={...currentStoryboardPlan,scenes:sceneMetadata,eventChain:buildStoryEventChain(sceneMetadata)};sceneIndex=titles.length-1;$('sceneLabel').textContent=(storyLabels[storyLanguage()]||'Scene')+' '+(sceneIndex+1)+' · '+titles[sceneIndex];renderScenes();syncSceneEditor();updateStoryQA();$('status').textContent=t.added};
$('deleteScene').onclick=()=>{const t=sceneEditorLabels[uiLang]||sceneEditorLabels.en;if(titles.length<=1){$('status').textContent=t.minimum;return}const removedScene=sceneMetadata[sceneIndex]||{};releaseSceneVideo(removedScene,sceneIndex);titles.splice(sceneIndex,1);descriptions.splice(sceneIndex,1);sceneMetadata.splice(sceneIndex,1);if(currentStoryboardPlan)currentStoryboardPlan={...currentStoryboardPlan,scenes:sceneMetadata,eventChain:buildStoryEventChain(sceneMetadata)};sceneIndex=Math.min(sceneIndex,titles.length-1);$('sceneLabel').textContent=(storyLabels[storyLanguage()]||'Scene')+' '+(sceneIndex+1)+' · '+titles[sceneIndex];renderScenes();syncSceneEditor();updateStoryQA();if(!playing)draw();$('status').textContent=t.deleted};

let sceneMotionAnalysisSummary=null;
let sceneMotionAnalysisResults=new Map();
let sceneMotionAnalysisRunning=false;
async function runSceneMotionAnalysis(){
  if(sceneMotionAnalysisRunning)return;
  const entries=sceneMetadata.map((meta,index)=>({meta,index,key:String(meta?.id||''),entry:sceneVideoCache.get(String(meta?.id||''))})).filter(item=>item.entry?.video);
  sceneMotionAnalysisRunning=true;
  sceneMotionAnalysisSummary={checked:0,static:0,changed:0,skipped:0};
  sceneMotionAnalysisResults=new Map();
  renderSceneMediaReport();
  try{
    for(const item of entries){
      if(sceneVideoCache.get(item.key)!==item.entry){
        sceneMotionAnalysisResults.set(item.key,{status:'skipped',message:'Video changed before analysis.'});
        sceneMotionAnalysisSummary=summarizeSceneMotionResults(sceneMotionAnalysisResults);
        renderSceneMediaReport();
        continue;
      }
      try{
        await waitForSceneVideoReady(item.entry.video,{timeoutMs:12000});
        if(sceneVideoCache.get(item.key)!==item.entry)throw new Error('Video changed during analysis.');
        const result=await analyzeSceneVideoMotion(item.entry.video);
        let frameSamples=[];
        let frameCaptureMessage='';
        try{
          frameSamples=await captureSceneVideoFrameSamples(item.entry.video);
        }catch(frameError){
          frameCaptureMessage=String(frameError?.message||'Frame evidence unavailable.');
          console.warn('Scene frame evidence skipped for scene '+(item.index+1)+':',frameError);
        }
        sceneMotionAnalysisResults.set(item.key,{...result,frameSamples,frameCaptureMessage});
        sceneMotionAnalysisSummary=summarizeSceneMotionResults(sceneMotionAnalysisResults);
      }catch(error){
        sceneMotionAnalysisResults.set(item.key,{status:'skipped',message:String(error?.message||'Analysis unavailable.')});
        sceneMotionAnalysisSummary=summarizeSceneMotionResults(sceneMotionAnalysisResults);
        console.warn('Scene motion analysis skipped for scene '+(item.index+1)+':',error);
      }
      renderSceneMediaReport();
    }
  }finally{
    sceneMotionAnalysisRunning=false;
    renderSceneMediaReport();
  }
}
function renderSceneMediaReport(){
  const target=$('sceneMediaReport');
  if(!target)return;
  const report=buildSceneMediaReport(sceneMetadata,new Set([...sceneVideoCache].filter(([,entry])=>isSceneVideoDecoded(entry?.video)).map(([key])=>key)));
  const russian=uiLang==='ru';
  const videoLabel=russian?'Готовые видеосцены':'Generated video scenes';
  const stillLabel=russian?'Изображения / холст':'Still-image / canvas scenes';
  const completeLabel=russian?'Все сцены имеют декодированные видеоклипы.':'Every scene has a decoded video clip.';
  const partialLabel=russian?'Экспорт WebM не означает, что все сцены анимированы.':'WebM export does not mean every scene is animated.';
  target.replaceChildren();
  const summary=document.createElement('div');
  summary.textContent=videoLabel+': '+report.videoScenes+'/'+report.totalScenes+' · '+stillLabel+': '+report.stillScenes+'. '+(report.complete?completeLabel:partialLabel);
  target.appendChild(summary);
  if(sceneMotionAnalysisSummary){
    const value=sceneMotionAnalysisSummary;
    const motion=document.createElement('div');
    motion.style.marginTop='6px';
    motion.textContent=(russian?'Проверка движения: ':'Motion check: ')+value.checked+' '+(russian?'проверено':'checked')+' · '+value.static+' '+(russian?'почти без изменений':'likely static')+' · '+value.changed+' '+(russian?'есть изменения пикселей':'pixel changes')+' · '+value.skipped+' '+(russian?'пропущено':'skipped')+'. '+(russian?'Это приблизительная проверка пикселей, не оценка качества анимации персонажа.':'Pixel heuristic only; it does not rate character animation quality.');
    target.appendChild(motion);
    const details=document.createElement('div');
    details.style.marginTop='8px';
    details.style.display='grid';
    details.style.gap='5px';
    for(const item of report.items.filter(scene=>scene.mediaType==='video')){
      const result=sceneMotionAnalysisResults.get(item.id);
      if(!result)continue;
      const row=document.createElement('div');
      row.style.padding='6px 8px';
      row.style.border='1px solid var(--border, #343746)';
      row.style.borderRadius='8px';
      const heading=document.createElement('strong');
      heading.textContent=(russian?'Сцена ':'Scene ')+(item.index+1)+': '+item.title;
      const detail=document.createElement('small');
      detail.style.display='block';
      if(result.status==='likely-static'){
        detail.textContent=(russian?'Почти нет изменений пикселей':'Very little pixel change')+' · '+(russian?'среднее изменение: ':'mean change: ')+Number(result.meanPixelChange||0).toFixed(5);
      }else if(result.status==='visible-change'){
        detail.textContent=(russian?'Обнаружены изменения пикселей':'Pixel changes detected')+' · '+(russian?'доля изменившихся пикселей: ':'changed-pixel ratio: ')+(Number(result.changedPixelRatio||0)*100).toFixed(1)+'%';
      }else{
        detail.textContent=(russian?'Проверка пропущена: ':'Analysis skipped: ')+String(result.message||'');
      }
      row.append(heading,detail);
      if(Array.isArray(result.frameSamples)&&result.frameSamples.length){
        const strip=document.createElement('div');
        strip.style.display='flex';
        strip.style.flexWrap='wrap';
        strip.style.gap='6px';
        strip.style.marginTop='7px';
        for(const sample of result.frameSamples){
          const frame=document.createElement('div');
          frame.style.display='grid';
          frame.style.gap='2px';
          const image=document.createElement('img');
          image.src=sample.dataUrl;
          image.alt=(russian?'Кадр сцены ':'Scene frame ')+(item.index+1)+' · '+sample.time+'s';
          image.loading='lazy';
          image.decoding='async';
          image.style.width='min(112px, 28vw)';
          image.style.aspectRatio='16 / 9';
          image.style.objectFit='cover';
          image.style.borderRadius='5px';
          image.style.background='#111';
          const caption=document.createElement('small');
          caption.textContent=sample.time.toFixed(2)+' s';
          caption.style.opacity='.75';
          frame.append(image,caption);
          strip.appendChild(frame);
        }
        row.appendChild(strip);
        const downloadFrames=document.createElement('button');
        downloadFrames.type='button';
        downloadFrames.className='secondary';
        downloadFrames.style.marginTop='7px';
        downloadFrames.textContent=russian?'Скачать контрольные кадры':'Download frame sheet';
        downloadFrames.addEventListener('click',async()=>{
          if(downloadFrames.disabled)return;
          downloadFrames.disabled=true;
          const previousLabel=downloadFrames.textContent;
          downloadFrames.textContent=russian?'Готовим файл…':'Preparing file…';
          try{
            const contactSheet=await createSceneFrameContactSheet(result.frameSamples);
            const url=URL.createObjectURL(contactSheet);
            const link=document.createElement('a');
            link.href=url;
            link.download='dravex-scene-'+String(item.index+1).padStart(2,'0')+'-frames.jpg';
            link.hidden=true;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(()=>URL.revokeObjectURL(url),1500);
            downloadFrames.textContent=russian?'Кадры скачаны':'Frame sheet downloaded';
          }catch(error){
            console.warn('Could not create scene frame contact sheet:',error);
            downloadFrames.textContent=(russian?'Ошибка: ':'Error: ')+String(error?.message||'');
          }finally{
            setTimeout(()=>{
              downloadFrames.disabled=false;
              downloadFrames.textContent=previousLabel;
            },1800);
          }
        });
        row.appendChild(downloadFrames);
      }else if(result.frameCaptureMessage){
        const note=document.createElement('small');
        note.textContent=(russian?'Кадры не получены: ':'Frame samples unavailable: ')+result.frameCaptureMessage;
        note.style.display='block';
        row.appendChild(note);
      }
      details.appendChild(row);
    }
    if(details.childElementCount)target.appendChild(details);
  }
  const button=document.createElement('button');
  button.type='button';
  button.className='secondary';
  button.style.marginTop='8px';
  button.textContent=sceneMotionAnalysisRunning
    ?(russian?'Проверяем движение…':'Analyzing motion…')
    :(russian?'Проверить движение видеосцен':'Analyze scene motion');
  button.disabled=sceneMotionAnalysisRunning||report.videoScenes===0;
  button.addEventListener('click',()=>void runSceneMotionAnalysis());
  target.appendChild(button);
  target.dataset.videoScenes=String(report.videoScenes);
  target.dataset.stillScenes=String(report.stillScenes);
  target.dataset.totalScenes=String(report.totalScenes);
}
function renderScenes(){
  const box=$('scenes');
  box.replaceChildren();
  titles.forEach((title,i)=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='scene';
    button.style.textAlign='left';
    button.style.color='var(--text)';
    button.style.width='100%';
    button.style.background=i===sceneIndex?'#28243f':'#11131e';

    const content=document.createElement('span');
    const heading=document.createElement('strong');
    heading.textContent=tr('sceneLabel')+' '+(i+1)+' · '+String(title??'');
    const description=document.createElement('small');
    description.textContent=String(descriptions[i]??'');
    const actionLabel=document.createElement('small');
    const actionNames={en:{idle:'Action: still moment',run:'Action: running / chase',walk:'Action: walking',jump:'Action: jump',dance:'Action: dancing',turn:'Action: turning',talk:'Action: talking',surprised:'Mood: surprised',float:'Action: floating',vanish:'Action: disappear',magic:'Action: magic effect',sad:'Mood: sad / afraid',happy:'Mood: happy'},ru:{idle:'Действие: спокойный момент',run:'Действие: бег / погоня',walk:'Действие: ходьба',jump:'Действие: прыжок',dance:'Действие: танец',turn:'Действие: поворот',talk:'Действие: разговор',surprised:'Эмоция: удивление',float:'Действие: парение',vanish:'Действие: исчезновение',magic:'Действие: магический эффект',sad:'Эмоция: грусть / страх',happy:'Эмоция: радость'},uk:{idle:'Дія: спокійний момент',run:'Дія: біг / погоня',walk:'Дія: ходьба',jump:'Дія: стрибок',dance:'Дія: танець',turn:'Дія: поворот',talk:'Дія: розмова',surprised:'Емоція: здивування',float:'Дія: ширяння',vanish:'Дія: зникнення',magic:'Дія: магічний ефект',sad:'Емоція: сум / страх',happy:'Емоція: радість'},es:{idle:'Acción: momento tranquilo',run:'Acción: correr / perseguir',walk:'Acción: caminar',jump:'Acción: saltar',dance:'Acción: bailar',turn:'Acción: girar',talk:'Acción: hablar',surprised:'Emoción: sorpresa',float:'Acción: flotar',vanish:'Acción: desaparecer',magic:'Acción: efecto mágico',sad:'Emoción: tristeza / miedo',happy:'Emoción: alegría'}};
    const actionLanguage=actionNames[storyLanguage()]||actionNames.en;
    actionLabel.textContent=actionLanguage[getSceneAction(i)]||actionLanguage.idle;
    actionLabel.style.opacity='.78';
    const cameraLabel=document.createElement('small');
    const cameraPlan=String(sceneMetadata[i]?.camera||'').trim();
    cameraLabel.textContent=cameraPlan?((storyLanguage()==='ru'?'Камера: ':storyLanguage()==='uk'?'Камера: ':storyLanguage()==='es'?'Cámara: ':'Camera: ')+cameraPlan):'';
    cameraLabel.style.opacity='.72';
    const hasDecodedVideo=sceneVideoCache.has(sceneVideoKey(i,sceneMetadata[i]));
    const mediaLabel=document.createElement('small');
    mediaLabel.textContent=hasDecodedVideo
      ?(uiLang==='ru'?'Медиа: готовый видеоклип':'Media: decoded video clip')
      :(uiLang==='ru'?'Медиа: изображение / холст':'Media: still image / canvas');
    mediaLabel.style.opacity='.9';
    content.append(heading,description,actionLabel,cameraLabel,mediaLabel);

    const arrow=document.createElement('span');
    arrow.setAttribute('aria-hidden','true');
    arrow.textContent='›';
    button.append(content,arrow);

    button.setAttribute('aria-pressed',String(i===sceneIndex));
    button.onclick=()=>{
      sceneIndex=i;
      if(playing)void startSceneVoicePreview(i);else void stopSceneVoicePreview();
      $('sceneLabel').textContent=(storyLabels[storyLanguage()]||'Scene')+' '+(i+1)+' · '+String(titles[i]??'');
      renderScenes();
      syncSceneEditor();
      if(!playing)draw();
    };
    box.appendChild(button);
  });
  renderSceneMediaReport();
  updateFaceAnalysisControls();
}
let sceneVoiceStorage=null;
let sceneVoiceEngine=null;
let sceneVoiceRenderToken=0;
let sceneVoiceObjectUrls=[];
function getSceneVoiceEngine(){
 if(!window.indexedDB)throw new Error(uiLang==='ru'?'В этом браузере недоступно локальное хранилище аудио.':'IndexedDB local audio storage is unavailable in this browser.');
 if(!window.crypto?.subtle)throw new Error(uiLang==='ru'?'Недоступна Web Crypto для проверки аудиофайлов.':'Web Crypto is unavailable for audio verification.');
 if(!sceneVoiceStorage)sceneVoiceStorage=createVoiceAudioStorage();
 const timestamped=$('sceneVoiceEngineChoice')?.value==='timestamped';
 const currentTimestamped=sceneVoiceEngine?.status.engine==='headtts-timestamped-kokoro';
 if(sceneVoiceEngine&&timestamped!==currentTimestamped){
  sceneVoiceEngine.dispose?.();
  sceneVoiceEngine=null;
 }
 if(!sceneVoiceEngine){
  sceneVoiceEngine=timestamped
   ?createTimestampedKokoroEngine({storage:sceneVoiceStorage})
   :createBrowserLocalTtsEngine({storage:sceneVoiceStorage});
 }
 return sceneVoiceEngine;
}

function persistCurrentSceneDialogueToMetadata(locale=storyLanguage()){
 const currentSceneId=String(sceneMetadata[sceneIndex]?.id||'');
 const currentIndex=sceneMetadata.findIndex(scene=>scene&&String(scene.id||'')===currentSceneId);
 const currentLines=parseDialogueLines($('sceneDialogue').value,locale);
 if(currentIndex>=0&&currentLines.length)sceneMetadata[currentIndex]={...sceneMetadata[currentIndex],dialogue:currentLines};
 return currentIndex;
}

function isLocalDialogueGenerationReady({step}={}){
 try{
  if(!localTextRuntime.status.loaded||!sceneMetadata.length)return false;
  const locale=storyLanguage();
  const indices=step
   ?resolveUniversalVoiceTargets(step,sceneMetadata,sceneIndex)
   :{ok:true,indices:sceneMetadata.map((_,index)=>index)};
  if(!indices.ok)return false;
  return indices.indices.some(index=>sceneDialogueLinesAt(index,locale).length===0);
 }catch{return false}
}

function isLocalSceneVoiceEngineLoaded(){
 try{
  const selectedTimestamped=$('sceneVoiceEngineChoice')?.value==='timestamped';
  const loadedTimestamped=sceneVoiceEngine?.status.engine==='headtts-timestamped-kokoro';
  return Boolean(sceneVoiceEngine?.status.loaded&&sceneVoiceEngine.status.locale===storyLanguage()&&selectedTimestamped===loadedTimestamped);
 }catch{return false}
}

function sceneDialogueLinesAt(index,locale=storyLanguage(),currentText=$('sceneDialogue').value,currentSceneId=String(sceneMetadata[sceneIndex]?.id||'')){
 const meta=sceneMetadata[index]||{};
 const id=String(meta.id||'');
 const source=id&&id===currentSceneId&&String(currentText||'').trim()?currentText:formatDialogueLines(meta.dialogue);
 return parseDialogueLines(source,locale);
}

function isLocalSceneVoiceReady({step}={}){
 try{
  const locale=storyLanguage();
  const selectedTimestamped=$('sceneVoiceEngineChoice')?.value==='timestamped';
  const loadedTimestamped=sceneVoiceEngine?.status.engine==='headtts-timestamped-kokoro';
  if(!sceneVoiceEngine?.status.loaded||sceneVoiceEngine.status.locale!==locale||selectedTimestamped!==loadedTimestamped||$('generateSceneVoices').dataset.busy==='true')return false;
  if(!step)return sceneMetadata.some((_,index)=>sceneDialogueLinesAt(index,locale).length>0);
  const targets=resolveUniversalVoiceTargets(step,sceneMetadata,sceneIndex);
  if(!targets.ok)return false;
  return targets.allScenes
   ?targets.indices.length>0&&targets.indices.every(index=>sceneDialogueLinesAt(index,locale).length>0)
   :sceneDialogueLinesAt(targets.indices[0],locale).length>0;
 }catch{return false}
}

async function generateSceneVoicesForCurrentScene({signal,onProgress=()=>{},step=null}={}){
 const locale=storyLanguage();
 const currentSceneId=String(sceneMetadata[sceneIndex]?.id||'');
 const currentDialogueText=$('sceneDialogue').value;
 const targetResolution=resolveUniversalVoiceTargets(step,sceneMetadata,sceneIndex);
 if(!targetResolution.ok)throw new Error('Could not resolve voice-generation target: '+targetResolution.reason+'.');
 const allScenes=targetResolution.allScenes;
 const targetIndices=targetResolution.indices;
 if(allScenes){
  const missing=targetIndices.filter(index=>sceneDialogueLinesAt(index,locale,currentDialogueText,currentSceneId).length===0);
  if(missing.length)throw new Error('Cannot generate voices for all scenes: dialogue is missing in scene(s) '+missing.map(index=>index+1).join(', ')+'.');
 }
 if(!targetIndices.length)throw new Error(voiceText('Нет сцен для озвучивания.','There are no scenes to voice.'));
 const targets=targetIndices.map(index=>({sceneId:String(sceneMetadata[index]?.id||''),dialogue:sceneDialogueLinesAt(index,locale,currentDialogueText,currentSceneId)}));
 const engine=getSceneVoiceEngine();
 if(!engine.status.loaded||engine.status.locale!==locale)throw new Error(voiceText('Сначала загрузи модель для выбранного языка.','Load the model for the selected language first.'));
 if(signal?.aborted)throw new DOMException('Voice generation was cancelled.','AbortError');
 let savedMap={};
 try{const parsed=JSON.parse(readLocalStorage('dravex-character-voice-map')||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))savedMap=parsed}catch{}
 const overallTotal=targets.reduce((total,target)=>total+target.dialogue.length,0);
 let overallIndex=0,lineCount=0,totalDurationMs=0,persistedInDraft=true;
 const sceneIds=[];
 for(const target of targets){
  if(signal?.aborted)throw new DOMException('Voice generation was cancelled.','AbortError');
  const targetId=target.sceneId;
  const targetIndex=sceneMetadata.findIndex(item=>item&&String(item.id||'')===targetId);
  if(targetIndex<0)throw new Error('A target scene was removed during voice generation.');
  const targetMeta={...(sceneMetadata[targetIndex]||{})};
  const dialogue=target.dialogue;
  if(!dialogue.length)continue;
  const assignments=assignCharacterVoices({
   speakers:dialogue.map(line=>line.characterId),
   availableVoices:engine.availableVoices,
   existingAssignments:savedMap,
   fallbackVoiceId:engine.availableVoices[0]||null
  });
  savedMap={...assignments};
  writeLocalStorage('dravex-character-voice-map',JSON.stringify(savedMap));
  const voiceIds=dialogue.map(line=>assignments[normalizeSpeakerKey(line.characterId)]||null);
  const checkpointKey='dravex-voice-checkpoint:'+encodeURIComponent(targetId);
  let savedCheckpoint=null;
  try{const raw=readLocalStorage(checkpointKey);if(raw)savedCheckpoint=JSON.parse(raw)}catch{}
  const artifacts=await restoreVoiceGenerationCheckpoint({
   checkpoint:savedCheckpoint,sceneId:targetId,locale,engine:engine.status.engine,
   modelId:engine.status.modelId,dialogue,voiceIds,storage:sceneVoiceStorage
  });
  for(let index=0;index<dialogue.length;index++){
   if(signal?.aborted)throw new DOMException('Voice generation was cancelled.','AbortError');
   const line=dialogue[index];
   const voiceId=voiceIds[index]||undefined;
   if(artifacts[index]){
    overallIndex++;
    onProgress({phase:'reused',sceneIndex:targetIndex,index:index+1,total:dialogue.length,overallIndex,overallTotal,characterId:line.characterId});
    continue;
   }
   if(sceneIndex===targetIndex)$('sceneVoiceStatus').textContent=voiceText('Создаём голос сцены '+(targetIndex+1)+': '+(index+1)+' из '+dialogue.length+'…','Generating scene '+(targetIndex+1)+' voice '+(index+1)+' of '+dialogue.length+'…');
   onProgress({phase:'generating',sceneIndex:targetIndex,index:index+1,total:dialogue.length,overallIndex:overallIndex+1,overallTotal,characterId:line.characterId});
   const result=await engine.synthesize({text:line.text,voiceId,filename:'scene-'+targetId+'-line-'+(index+1)+'.wav',signal});
   artifacts[index]={audioHash:result.audioHash,durationMs:result.durationMs,voiceId:voiceId||null,
    ...(Array.isArray(result.visemeEvents)?{visemeEvents:result.visemeEvents}:{}),
    ...(Array.isArray(result.phonemeChunks)?{phonemeChunks:result.phonemeChunks}:{})};
   const checkpoint=createVoiceGenerationCheckpoint({
    sceneId:targetId,locale,engine:engine.status.engine,modelId:engine.status.modelId,
    dialogue,voiceIds,artifacts
   });
   writeLocalStorage(checkpointKey,JSON.stringify(checkpoint));
   overallIndex++;
  }
  if(signal?.aborted)throw new DOMException('Voice generation was cancelled.','AbortError');
  const resolvedIndex=sceneMetadata.findIndex(item=>item&&String(item.id||'')===targetId);
  if(resolvedIndex<0)throw new Error('The target scene changed during voice generation. Generated audio was not attached to another scene.');
  const liveDialogueText=String(sceneMetadata[sceneIndex]?.id||'')===targetId?$('sceneDialogue').value:formatDialogueLines(sceneMetadata[resolvedIndex]?.dialogue);
  const liveDialogue=parseDialogueLines(liveDialogueText,locale);
  if(JSON.stringify(liveDialogue)!==JSON.stringify(dialogue))throw new Error('Dialogue changed while voice generation was running; the generated audio was not attached to stale scene text.');
  const scheduled=buildSceneVoiceTimeline({sceneId:targetId,dialogue,artifacts,fps:24,gapMs:120});
  sceneMetadata[resolvedIndex]={...sceneMetadata[resolvedIndex],dialogue,voiceCues:scheduled.cues,voiceTimeline:scheduled.timeline};
  const saved=writeLocalStorage('dravex-cartoon-draft',JSON.stringify({
   idea:$('idea').value,character:$('character').value,style:$('style').value,canvasFormat:activeCanvasFormat,imageQuality:$('imageQuality').value,duration:$('duration').value,
   language:$('language').value,uiLanguage:uiLang,titles,descriptions,sceneMetadata,characterBible,sceneIndex
  }));
  persistedInDraft=persistedInDraft&&saved;
  if(saved){try{window.localStorage.removeItem(checkpointKey)}catch{}}
  lineCount+=scheduled.cues.length;
  totalDurationMs+=scheduled.timeline.totalDurationMs;
  sceneIds.push(targetId);
  if(sceneIndex===resolvedIndex){
   await renderSceneVoiceAudio();
   $('sceneVoiceStatus').textContent=voiceText(
    'Готово: '+scheduled.cues.length+' реплик · сцена '+(resolvedIndex+1)+' · '+(scheduled.timeline.totalDurationMs/1000).toFixed(2)+' сек.',
    'Done: '+scheduled.cues.length+' lines · scene '+(resolvedIndex+1)+' · '+(scheduled.timeline.totalDurationMs/1000).toFixed(2)+' sec.'
   );
  }
  onProgress({phase:'scene-completed',sceneIndex:resolvedIndex,sceneCount:targetIndices.length,overallIndex,overallTotal});
 }
 if(allScenes){
  const expectedIds=new Set(targets.map(target=>target.sceneId));
  const currentIds=sceneMetadata.map(meta=>String(meta?.id||''));
  if(currentIds.length!==expectedIds.size||currentIds.some(id=>!expectedIds.has(id)))throw new Error('The storyboard scene set changed during all-scene voice generation; completed scene audio was saved, but the batch must be reviewed before continuing.');
 }
 return {type:'local-voice-artifacts',sceneIds,lineCount,durationMs:totalDurationMs,persistedInDraft,local:true,allScenes:allScenes===true};
}
function voiceText(ru,en){return uiLang==='ru'?ru:en}
function refreshSceneVoiceControls(){
 const locale=storyLanguage();
 const timestamped=$('sceneVoiceEngineChoice')?.value==='timestamped';
 const restricted=locale!=='en'&&!timestamped;
 $('voiceConsentRow').hidden=!restricted;
 $('voiceConsentLabel').textContent=voiceText('Подтверждаю некоммерческое использование этой модели (обязательно для русского, украинского и испанского).','I confirm non-commercial use of this model (required for Russian, Ukrainian and Spanish).');
 $('loadSceneVoiceModel').textContent=voiceText('Загрузить локальную модель голоса','Load local voice model');
 $('generateSceneVoices').textContent=voiceText('Озвучить эту сцену','Generate voices for this scene');
 const expectedEngine=timestamped?'headtts-timestamped-kokoro':null;
 const loaded=Boolean(sceneVoiceEngine?.status.loaded&&sceneVoiceEngine.status.locale===locale
  &&(timestamped?sceneVoiceEngine.status.engine===expectedEngine:sceneVoiceEngine.status.engine!== 'headtts-timestamped-kokoro'));
 $('loadSceneVoiceModel').disabled=Boolean($('loadSceneVoiceModel').dataset.busy==='true')
  ||(timestamped&&locale!=='en')||(restricted&&!$('voiceNonCommercialConsent').checked);
 $('generateSceneVoices').disabled=!loaded||$('generateSceneVoices').dataset.busy==='true';
 if(timestamped&&locale!=='en'){
  $('sceneVoiceStatus').textContent=voiceText('Экспериментальный timestamped Kokoro поддерживает только английский. Выбери стандартный движок для этого языка.','Experimental timestamped Kokoro currently supports English only. Choose the standard engine for this language.');
 }else if(!loaded&&!sceneVoiceEngine?.status.loaded&&!$('sceneVoiceStatus').dataset.touched){
  $('sceneVoiceStatus').textContent=voiceText('Модель не загружена. После согласия загрузка начнётся при нажатии Load или запуске мультфильма с диалогами.','No voice model loaded. After consent, download starts when you press Load or create a film that needs speech.');
 }else if(!loaded&&sceneVoiceEngine?.status.loaded){
  $('sceneVoiceStatus').textContent=voiceText('Загружен другой движок или язык. Нажми Load, чтобы переключить модель.','A different engine or language is loaded. Press Load to switch.');
 }
}
async function renderSceneVoiceAudio(){
 const host=$('sceneVoiceResults');
 if(!host)return;
 const token=++sceneVoiceRenderToken;
 for(const url of sceneVoiceObjectUrls)URL.revokeObjectURL(url);
 sceneVoiceObjectUrls=[];
 host.replaceChildren();
 const cues=Array.isArray(sceneMetadata[sceneIndex]?.voiceCues)?sceneMetadata[sceneIndex].voiceCues:[];
 if(!cues.length){
  const note=document.createElement('small');
  note.className='muted';
  note.textContent=voiceText('У этой сцены пока нет сгенерированных голосовых дорожек.','This scene has no generated voice tracks yet.');
  host.appendChild(note);
  return;
 }
 try{
  const storage=sceneVoiceStorage||(sceneVoiceEngine?sceneVoiceStorage:null)||createVoiceAudioStorage();
  for(let index=0;index<cues.length;index++){
   const cue=cues[index];
   const record=await storage.get(cue.audioHash);
   if(token!==sceneVoiceRenderToken)return;
   if(!record?.blob)continue;
   const wrap=document.createElement('div');wrap.className='voice-result';
   const heading=document.createElement('strong');
   heading.textContent=(cue.characterId||cue.characterName||'Narrator')+' · '+(index+1);
   const spoken=document.createElement('small');spoken.textContent=String(cue.text||'');
   const audio=document.createElement('audio');audio.controls=true;audio.preload='none';
   const url=URL.createObjectURL(record.blob);sceneVoiceObjectUrls.push(url);audio.src=url;
   wrap.append(heading,spoken,audio);host.appendChild(wrap);
  }
  if(!host.childElementCount){
   const note=document.createElement('small');note.className='muted';
   note.textContent=voiceText('Аудиофайлы не найдены в локальном хранилище. Сгенерируй реплики заново.','Audio files are missing from local storage. Generate the dialogue again.');
   host.appendChild(note);
  }
 }catch(error){
  if(token===sceneVoiceRenderToken)$('sceneVoiceStatus').textContent=(error?.message||'Could not restore local voice audio.');
 }
}
$('loadSceneVoiceModel').addEventListener('click',async()=>{
 const button=$('loadSceneVoiceModel');
 if(button.dataset.busy==='true')return;
 const locale=storyLanguage();
 const timestamped=$('sceneVoiceEngineChoice')?.value==='timestamped';
 const allowNonCommercial=$('voiceNonCommercialConsent').checked;
 if(timestamped&&locale!=='en'){
  $('sceneVoiceStatus').textContent=voiceText('Timestamped Kokoro доступен только для английского.','Timestamped Kokoro is available for English only.');
  return;
 }
 if(!timestamped&&locale!=='en'&&!allowNonCommercial){
  $('sceneVoiceStatus').textContent=voiceText('Для этой модели требуется явное подтверждение некоммерческого использования.','This model requires explicit non-commercial-use consent.');
  return;
 }
 button.dataset.busy='true';button.disabled=true;$('sceneVoiceStatus').dataset.touched='true';
 $('sceneVoiceStatus').textContent=voiceText('Загружаем локальную модель речи…','Loading the local speech model…');
 try{
  const engine=getSceneVoiceEngine();
  await engine.load({
   locale,
   allowNonCommercial,
   backend:'wasm',
   onProgress:info=>{
    const percent=Number.isFinite(info.progress)?' '+Math.round(info.progress*100)+'%':'';
    $('sceneVoiceStatus').textContent=voiceText('Загрузка модели: '+info.status+percent,'Model download: '+info.status+percent);
   }
  });
  const count=engine.availableVoices.length;
  $('sceneVoiceStatus').textContent=timestamped
   ?voiceText('Timestamped Kokoro готов. Временные метки viseme берутся из длительностей токенов модели.','Timestamped Kokoro ready. Viseme timings come from model token durations.')
   :locale==='en'
    ?voiceText('Английская локальная модель готова. Доступно голосов: '+count+'.','English local model ready. Available voices: '+count+'.')
    :voiceText('Локальная модель готова. Эта языковая модель использует один голос.','Local model ready. This language model uses a single speaker voice.');
 }catch(error){
  $('sceneVoiceStatus').textContent=(error?.message||'Voice model loading failed.');
 }finally{
  button.dataset.busy='false';button.disabled=false;refreshSceneVoiceControls();
 }
});
$('generateSceneVoices').addEventListener('click',async()=>{
 const button=$('generateSceneVoices');
 if(button.dataset.busy==='true')return;
 button.dataset.busy='true';button.disabled=true;$('sceneVoiceStatus').dataset.touched='true';
 try{
  await generateSceneVoicesForCurrentScene();
 }catch(error){
  console.error('DRAVEX local voice generation failed:',error);
  $('sceneVoiceStatus').textContent=(error?.message||'Voice generation failed.');
 }finally{
  button.dataset.busy='false';refreshSceneVoiceControls();
 }
});
$('sceneVoiceEngineChoice').addEventListener('change',()=>{
 if(sceneVoiceEngine){sceneVoiceEngine.dispose?.();sceneVoiceEngine=null;}
 $('sceneVoiceStatus').dataset.touched='false';
 $('sceneVoiceStatus').textContent=voiceText('Выбран другой движок. Загрузи его отдельно.','Engine selection changed. Load the selected engine.');
 refreshSceneVoiceControls();
});
$('language').addEventListener('change',()=>{
 if(storyLanguage()!=='en'&&$('sceneVoiceEngineChoice').value==='timestamped'){
  $('sceneVoiceEngineChoice').value='standard';
  if(sceneVoiceEngine){sceneVoiceEngine.dispose?.();sceneVoiceEngine=null;}
 }
 refreshSceneVoiceControls();
 $('sceneVoiceStatus').textContent=voiceText('Язык истории изменён. При необходимости загрузи соответствующую модель.','Story language changed. Load the matching voice model if needed.');
});
$('voiceNonCommercialConsent').addEventListener('change',refreshSceneVoiceControls);
$('make').addEventListener('click',()=>createStoryboard());

function runAutomaticDialogueAndVoice(request,signal){
 const locale=storyLanguage();
 persistCurrentSceneDialogueToMetadata(locale);
 const speechPlan=resolveAutomaticSpeechTasks({request,scenes:sceneMetadata,language:storyLanguage()});
 if(!speechPlan.dialogueRequested&&!speechPlan.voiceRequested)return {skipped:true,reason:'speech-not-requested'};
 const report=detail=>{$('status').textContent=detail;};
 const handlers=universalCapabilityRegistry.createHandlers();
 const plan={sourceRequest:request};
 if(speechPlan.dialogueRequested&&speechPlan.scenesMissingDialogue.length){
  if(!localTextRuntime.status.loaded)throw new Error(voiceText('В запросе есть диалоги, но локальная текстовая модель не загружена. Сначала нажми «Загрузить локальную модель ИИ», затем повтори создание.','Dialogue was requested, but the local text model is not loaded. Load the local AI model, then start creation again.'));
  const step={id:'automatic-dialogue',action:'Write dialogue for every scene',purpose:'Create source-grounded dialogue from the storyboard',inputs:['allScenes'],outputs:['dialogue'],dependsOn:[],requiredCapabilities:['dialogue.generate']};
  report(voiceText('Создаём диалоги для всех сцен…','Writing dialogue for all scenes…'));
  return handlers['dialogue.generate']({plan,step,signal,reportProgress:report}).then(async dialogueResult=>{
   syncSceneEditor();renderScenes();
   if(!speechPlan.voiceRequested)return {dialogue:dialogueResult,voice:null};
   return runAutomaticVoiceForMissingScenes(request,signal,handlers,report,dialogueResult);
  });
 }
 if(speechPlan.voiceRequested)return runAutomaticVoiceForMissingScenes(request,signal,handlers,report,null);
 return {dialogue:null,voice:null};
}

async function runAutomaticVoiceForMissingScenes(request,signal,handlers,report,dialogueResult){
 const current=resolveAutomaticSpeechTasks({request,scenes:sceneMetadata,language:storyLanguage()});
 const targets=[...current.scenesMissingVoice];
 // Metadata alone is not proof that the generated WAV still exists on this device.
 // Browser storage can be evicted independently from the saved storyboard draft.
 if(sceneMetadata.some(scene=>Array.isArray(scene?.voiceCues)&&scene.voiceCues.length)){
  if(!sceneVoiceStorage)sceneVoiceStorage=createVoiceAudioStorage();
  const missingAudio=await findScenesWithMissingVoiceAudio(sceneMetadata,sceneVoiceStorage);
  for(const missing of missingAudio){
   if(!targets.some(target=>target.sceneId===missing.sceneId))targets.push(missing);
  }
 }
 if(!targets.length)return {dialogue:dialogueResult,voice:{skipped:true,reason:'voice-already-generated'}};
 if(!isLocalSceneVoiceEngineLoaded())throw new Error(voiceText('В запросе нужна озвучка, но локальная модель голоса не загружена. Загрузи её в разделе «Голоса», подтверди необходимые условия использования и нажми «Создать готовое видео» ещё раз.','Voice audio was requested, but the local voice model is not loaded. Load it in the Voices section, confirm any required usage terms, then press Create film again.'));
 const results=[];
 for(let i=0;i<targets.length;i++){
  if(signal?.aborted)throw new DOMException('Automatic voice generation was cancelled.','AbortError');
  const sceneId=targets[i].sceneId;
  const step={id:'automatic-voice-'+(i+1),action:'Generate local voices for scene '+(i+1),purpose:'Synthesize the requested dialogue for this scene',inputs:['sceneId:'+sceneId],outputs:['voice-audio'],dependsOn:[],requiredCapabilities:['voice.generate']};
  report((uiLang==='ru'?'Озвучиваем сцену ':'Generating voice for scene ')+(i+1)+' / '+targets.length);
  results.push(await handlers['voice.generate']({plan:{sourceRequest:request},step,signal,reportProgress:report}));
 }
 syncSceneEditor();renderScenes();
 return {dialogue:dialogueResult,voice:{scenes:results.length,results}};
}

function prepareAutomaticCharacterMotion(){
 const rigBatch=generateCharacterRigTimelinesForScenes(sceneMetadata,createCharacterRigTimelineFromActionTimeline);
 const spriteBatch=generateCharacterMotionTimelinesForScenes(rigBatch.scenes,planCharacterMotionFromActionTimeline);
 sceneMetadata=spriteBatch.scenes;
 if(currentStoryboardPlan)currentStoryboardPlan={...currentStoryboardPlan,scenes:sceneMetadata};
 syncCharacterRigEditor();
 syncCharacterMotionEditor();
 $('characterRigStatus').textContent='Automatic rig preparation: '+rigBatch.generatedActions+' action(s) across '+rigBatch.generatedScenes+' scene(s); '+rigBatch.scenesWithoutRig+' scene(s) have no segmented rig; '+rigBatch.preservedTimelines+' existing timeline(s) preserved.';
 $('characterMotionStatus').textContent='Automatic sprite motion: '+spriteBatch.generatedActions+' phase(s) across '+spriteBatch.generatedScenes+' scene(s); '+spriteBatch.scenesWithoutSprites+' scene(s) have no sprite layers; '+spriteBatch.preservedTimelines+' existing timeline(s) preserved.';
 sceneMotionSceneIndex=-1;
 if(!playing)draw();
 return {rigBatch,spriteBatch};
}

$('makeFilm').addEventListener('click',async()=>{
 if(fullFilmAbortController||$('export').disabled){
  $('status').textContent=uiLang==='ru'?'Создание или экспорт уже выполняется. Дождись завершения или нажми «Отменить».':'A film generation or export is already running. Wait for it to finish or cancel the current run.';
  return;
 }
 const request=$('idea').value.trim();
 const language=storyLanguage();
 const requestedCharacter=resolveStoryProtagonist(request,$('character').value.trim(),language);
 const canReuseStoryboard=Boolean(
  request&&currentStoryboardPlan&&
  currentStoryboardPlan.sourceText===request&&
  currentStoryboardPlan.sourceLanguage===language&&
  currentStoryboardPlan.sourceCharacter===requestedCharacter&&
  Array.isArray(currentStoryboardPlan.scenes)&&
  currentStoryboardPlan.scenes.length===sceneMetadata.length&&
  sceneMetadata.length>0
 );
 const created=canReuseStoryboard?currentStoryboardPlan:createStoryboard();
 if(!created)return;
 if(localTextRuntime.status.loaded&&created.automaticDirectionApplied!==true){
  const ru=uiLang==='ru';
  const directionController=new AbortController();
  const directionButton=$('makeFilm');
  const cancelButton=$('cancelFullFilmComfy');
  fullFilmAbortController=directionController;
  directionButton.disabled=true;
  cancelButton.hidden=false;
  $('status').textContent=ru?'Локальный AI-режиссёр проверяет сцены. Можно отменить операцию…':'Local AI director is reviewing scenes. You can cancel this operation…';
  try{
   const languageName={ru:'Russian',uk:'Ukrainian',en:'English',es:'Spanish'}[language]||'English';
   const directed=await directStoryboardForFilm({
    runtime:localTextRuntime,
    basePlan:{...created,scenes:sceneMetadata},
    storyText:request,
    language:languageName,
    character:requestedCharacter,
    characterBible,
    signal:directionController.signal
   });
   if(directed.status==='cancelled'||directionController.signal.aborted){
    $('status').textContent=ru?'Подготовка раскадровки отменена. Рендер не запускался.':'Storyboard direction cancelled. Rendering was not started.';
    return;
   }
   if(directed.usedLocalModel){
    const directedScenes=ensureSceneIds(directed.scenes.map(scene=>({...scene,characters:Array.isArray(scene.characters)&&scene.characters.length?scene.characters:[requestedCharacter]})));
    sceneMetadata=directedScenes;
    currentStoryboardPlan={...created,...directed,eventChain:directed.eventChain||buildStoryEventChain(directedScenes),sourceText:request,sourceLanguage:language,sourceCharacter:requestedCharacter,scenes:directedScenes,titles:directedScenes.map(scene=>scene.title),descriptions:directedScenes.map(scene=>scene.visibleAction),automaticDirectionApplied:true};
    titles=currentStoryboardPlan.titles;
    descriptions=currentStoryboardPlan.descriptions;
    sceneIndex=0;
    ensureMainCharacterReference(requestedCharacter);
    $('bibleCharacterId').value=requestedCharacter;
    $('bibleCharacterId').dataset.loaded='';
    $('sceneLabel').textContent=(storyLabels[language]||'Scene')+' 1 · '+titles[0];
    renderScenes();
    syncSceneEditor();
    updateStoryQA();
    $('status').textContent=ru?'AI-режиссёр улучшил раскадровку. Проверка качества пройдена; запускаем рендер.':'AI director improved the storyboard. Quality gate passed; starting render.';
   }else{
    const retryable=String(directed.fallbackReason||'').startsWith('local-inference-failed:');
    currentStoryboardPlan={...created,automaticDirectionApplied:!retryable};
    $('status').textContent=ru?'AI-режиссёр не изменил раскадровку: '+(directed.fallbackReason||'резервный сценарий')+'. Используем проверенный локальный вариант.':'AI director kept the deterministic storyboard: '+(directed.fallbackReason||'fallback')+'. Using the verified local version.';
   }
  }catch(error){
   if(directionController.signal.aborted){
    $('status').textContent=ru?'Подготовка раскадровки отменена. Рендер не запускался.':'Storyboard direction cancelled. Rendering was not started.';
    return;
   }
   currentStoryboardPlan={...created,automaticDirectionApplied:false};
   $('status').textContent=(ru?'AI-режиссёр недоступен, используем базовую раскадровку: ':'AI director unavailable; using baseline storyboard: ')+(error?.message||'Unknown error');
  }finally{
   if(fullFilmAbortController===directionController)fullFilmAbortController=null;
   cancelButton.hidden=true;
   directionButton.disabled=false;
  }
 }else if(!localTextRuntime.status.loaded){
  $('status').textContent=uiLang==='ru'?'Локальная модель не загружена. Используем раскадровку DRAVEX; AI-режиссёр можно включить после загрузки модели.':'Local model is not loaded. Using the DRAVEX storyboard; load the model to enable AI direction.';
 }
 const mode=$('videoGenerationMode').value;
 const missingImageCount=sceneMetadata.filter((scene,index)=>{
  const source=resolveSceneImageSource({mode,sceneIndex:index,activeSceneIndex:sceneIndex,localImage:comfySourceImage,generatedImageUrl:scene?.generatedImageUrl});
  const cachedVideo=sceneVideoCache.get(sceneVideoKey(index,scene));
  return source.kind==='missing'&&!cachedVideo?.video;
 }).length;
 const gate=evaluatePromptToFilmStart({
  mode,
  sceneCount:sceneMetadata.length,
  videoProviderReady:mode==='local-canvas'?true:mode==='huggingface'
   ?hfVideoConnected&&!!hfVideoClient&&typeof hfHandleFile==='function'
   :mode==='comfyui'&&comfyConnected&&Object.keys(comfyWorkflowConfigs()).length>0,
  remoteVideoConsent:$('hfVideoConsent').checked===true,
  missingImageCount,
  imagePromptConsent:$('hordeConsent').checked===true,
  running:Boolean(fullFilmAbortController)
 });
 if(!gate.ok){
  const ru=uiLang==='ru';
  const messages=[];
  if(gate.blockers.includes('video-mode-invalid'))messages.push(ru?'Выбран неизвестный видеодвижок.':'The selected video engine is not recognized.');
  if(gate.blockers.includes('remote-video-consent-required'))messages.push(ru?'Подтверди отправку изображений и промптов в Hugging Face.':'Explicitly allow scene images and prompts to be sent to Hugging Face.');
  if(gate.blockers.includes('video-provider-not-ready'))messages.push(mode==='huggingface'
   ?(ru?'Подключи Hugging Face: открой настройки анимации и добавь токен.':'Connect Hugging Face in the animation settings using your access token.')
   :(ru?'Подключи локальный ComfyUI и выбери API workflow.':'Connect local ComfyUI and select its API workflow.'));
  if(gate.blockers.includes('image-prompt-consent-required'))messages.push(ru
   ?'Для '+gate.missingImageCount+' сцен ещё нет изображений. Отдельно подтверди отправку только текстовых промптов в AI Horde либо добавь изображения вручную.'
   :' '+gate.missingImageCount+' scene image(s) are missing. Separately allow sending text prompts to AI Horde, or add scene images manually.');
  $('status').textContent=messages.join(' ');
  if(mode==='huggingface')$('hfVideoPanel').open=true;
  if(mode==='comfyui')$('comfyPanel').open=true;
  if(gate.blockers.includes('image-prompt-consent-required')){
   const consent=$('hordeConsent');
   consent.closest('details')?.setAttribute('open','');
   consent.scrollIntoView({behavior:'smooth',block:'center'});
  }
  return;
 }
 const speechPlan=resolveAutomaticSpeechTasks({request,scenes:sceneMetadata,language:storyLanguage()});
 if(speechPlan.dialogueRequested||speechPlan.voiceRequested){
  const speechController=new AbortController();
  const createButton=$('makeFilm');
  const cancelButton=$('cancelFullFilmComfy');
  fullFilmAbortController=speechController;
  createButton.disabled=true;
  cancelButton.hidden=false;
  try{
   await runAutomaticDialogueAndVoice(request,speechController.signal);
  }catch(error){
   $('status').textContent=(uiLang==='ru'?'Не удалось подготовить диалоги/озвучку: ':'Could not prepare dialogue/voice: ')+(error?.message||'Unknown error');
   return;
  }finally{
   if(fullFilmAbortController===speechController)fullFilmAbortController=null;
   createButton.disabled=false;
   cancelButton.hidden=true;
  }
  if(speechController.signal.aborted)return;
 }
 const motionPreparation=prepareAutomaticCharacterMotion();
 if(mode==='local-canvas'){
  const controller=new AbortController();
  const button=$('makeFilm');
  const cancel=$('cancelFullFilmComfy');
  fullFilmAbortController=controller;
  button.disabled=true;
  cancel.hidden=false;
  $('fullFilmProgressPanel').hidden=false;
  filmProgressTracking=true;
  setFilmProgress(5,uiLang==='ru'?'Локальный рендер':'Local render',uiLang==='ru'
   ?'Используем существующий предпросмотр, движения камеры, объекты и подключённые риги. Облачная генерация не запускается.'
   :'Rendering the existing canvas preview, camera motion, props, and attached rigs. No cloud generation is started.');
  $('status').textContent=uiLang==='ru'
   ?'Создаём локальное видео из раскадровки. Это WebM-анимация холста, не AI text-to-video. Подготовлено: '+motionPreparation.rigBatch.generatedActions+' действий рига и '+motionPreparation.spriteBatch.generatedActions+' фаз движения спрайтов.'
   :'Rendering a local storyboard video. This is canvas-based WebM animation, not AI text-to-video. Prepared '+motionPreparation.rigBatch.generatedActions+' rig actions and '+motionPreparation.spriteBatch.generatedActions+' sprite motion phases.';
  try{
   const result=await exportFilm({signal:controller.signal,download:true});
   if(result?.status!=='completed'){
    const cancelled=result?.status==='cancelled'||controller.signal.aborted;
    const message=cancelled
     ?(uiLang==='ru'?'Локальный экспорт отменён.':'Local export was cancelled.')
     :(uiLang==='ru'?'Локальный экспорт не завершён: ':'Local export did not complete: ')+(result?.reason||result?.status||'unknown error');
    $('status').textContent=message;
    if(filmProgressTracking)setFilmProgress($('fullFilmProgress').value,uiLang==='ru'?'Экспорт остановлен':'Export stopped',message);
    filmProgressTracking=false;
   }
  }catch(error){
   const message=(uiLang==='ru'?'Ошибка локального экспорта: ':'Local export error: ')+(error?.message||'Unknown error');
   $('status').textContent=message;
   if(filmProgressTracking)setFilmProgress($('fullFilmProgress').value,uiLang==='ru'?'Ошибка':'Error',message);
   filmProgressTracking=false;
  }finally{
   if(fullFilmAbortController===controller)fullFilmAbortController=null;
   cancel.hidden=true;
   button.disabled=false;
   updateComfyAnimateAvailability();
  }
  return;
 }
 const generateButton=$('generateFullFilmComfy');
 if(generateButton.disabled){
  $('status').textContent=uiLang==='ru'?'Видеодвижок пока недоступен. Проверь подключение и согласие.':'The video engine is not ready. Check its connection and consent settings.';
  return;
 }
 $('status').textContent=uiLang==='ru'?'Запускаем полный цикл: изображения сцен → AI-видеосцены → итоговый WebM…':'Starting the full workflow: scene images → AI video clips → final WebM…';
 generateButton.click();
});

function createStoryboard(ideaOverride, {throwOnError=false}={}){
 const status=$('status');
 const idea=(typeof ideaOverride==='string'?ideaOverride:$('idea').value).trim();
 if(!idea){
  status.textContent=tr('emptyIdea');
  $('idea').focus();
  if(throwOnError)throw new Error(tr('emptyIdea'));
  return null;
 }
 const lang=storyLanguage();
 const requestedCharacter=$('character').value.trim();
 const character=resolveStoryProtagonist(idea,requestedCharacter,lang);
 const proceduralDemoCharacter=!requestedCharacter&&['Главный герой','Головний герой','Main character','Personaje principal'].includes(character);
 $('character').value=character;
 try{
  status.textContent=uiLang==='ru'?'Создаём раскадровку локальным движком DRAVEX…':'Creating a storyboard with the local DRAVEX engine…';
  const plan=buildStoryboardFromText(idea,lang,character);
  const storyContext=prepareStoryCharacterContext(plan,characterBible,character,lang);
  characterBible=storyContext.characterBible;
  const preparedScenes=storyContext.scenes;
  const stateChanges=inferStoryboardStateChanges(preparedScenes,lang,character);
  sceneMetadata=ensureSceneIds(preparedScenes.map((scene,index)=>({...scene,stateChanges:stateChanges[index]})));
  currentStoryboardPlan={...plan,eventChain:buildStoryEventChain(sceneMetadata),sourceText:idea,sourceLanguage:lang,sourceCharacter:character,proceduralDemoCharacter,scenes:sceneMetadata};
  titles=plan.titles;
  descriptions=plan.descriptions;
  sceneIndex=0;
  $('bibleCharacterId').value=character;
  $('bibleCharacterId').dataset.loaded='';
  $('sceneLabel').textContent=(storyLabels[lang]||'Scene')+' 1 · '+titles[0];
  renderScenes();
  syncSceneEditor();
  updateStoryQA();
  status.textContent=uiLang==='ru'?'Раскадровка создана локальным движком DRAVEX.':'Storyboard created by the local DRAVEX engine.';
  status.scrollIntoView({behavior:'smooth',block:'nearest'});
  return currentStoryboardPlan;
 }catch(error){
  console.error('DRAVEX storyboard error:',error);
  status.textContent=(uiLang==='ru'?'Не удалось создать раскадровку: ':'Storyboard creation failed: ')+(error?.message||'Unknown error');
  if(throwOnError)throw error;
  return null;
 }
}
$('checkLocalAI').addEventListener('click',async()=>{
const button=$('checkLocalAI'),status=$('localAIStatus'),ru=uiLang==='ru';
if(button.disabled)return;button.disabled=true;status.textContent=ru?'Проверяем возможности браузера и устройства…':'Checking browser and device capabilities…';
try{
const result=await detectDeviceCapabilities();
const yesNo=value=>value?(ru?'да':'yes'):(ru?'нет':'no');
const memory=result.deviceMemoryGB===null?(ru?'неизвестно':'unknown'):result.deviceMemoryGB+' GB';
const cores=result.hardwareConcurrency===null?(ru?'неизвестно':'unknown'):String(result.hardwareConcurrency);
const storage=result.storage.availableBytes===null?(ru?'неизвестно':'unknown'):(result.storage.availableBytes/1024/1024/1024).toFixed(2)+' GB';
const lines=ru
?['HTTPS: '+yesNo(result.secureContext),'WebGPU API: '+yesNo(result.webgpuApiAvailable),'GPU-адаптер: '+yesNo(result.adapterAvailable),'Оценка памяти браузера: '+memory,'Потоки CPU: '+cores,'WASM: '+yesNo(result.wasmAvailable),'Потоки WASM: '+yesNo(result.wasmThreadsAvailable),'Свободное хранилище браузера: '+storage,result.recommendation]
:['Secure HTTPS: '+yesNo(result.secureContext),'WebGPU API: '+yesNo(result.webgpuApiAvailable),'GPU adapter: '+yesNo(result.adapterAvailable),'Browser memory estimate: '+memory,'CPU threads: '+cores,'WASM: '+yesNo(result.wasmAvailable),'Threaded WASM: '+yesNo(result.wasmThreadsAvailable),'Available browser storage: '+storage,result.recommendation];
status.textContent=lines.join(' · ');
}catch(error){status.textContent=(ru?'Не удалось проверить устройство: ':'Device check failed: ')+(error?.message||'Unknown error')}
finally{button.disabled=false}
});
$('localModelConsent').addEventListener('change',()=>{$('loadLocalModel').disabled=!$('localModelConsent').checked});
$('loadLocalModel').addEventListener('click',async()=>{
const button=$('loadLocalModel'),status=$('localModelStatus'),ru=uiLang==='ru';
if(!$('localModelConsent').checked){status.textContent=ru?'Сначала подтверди загрузку весов модели с Hugging Face.':'First confirm the model download from Hugging Face.';return}
if(button.disabled)return;button.disabled=true;$('runLocalModel').disabled=true;$('planUniversalTask').disabled=true;
status.textContent=ru?'Загружаем модель с Hugging Face. Первый запуск требует интернета; генерация будет выполняться на устройстве…':'Downloading model weights from Hugging Face. First load requires internet; generation will run on this device…';
try{
const result=await localTextRuntime.load({backend:'auto',onProgress:event=>{
if(event.total&&event.loaded){const pct=Math.min(100,Math.round(event.loaded/event.total*100));status.textContent=(ru?'Загрузка модели: ':'Downloading model: ')+pct+'%';}
}});
status.textContent=(ru?'Локальная модель загружена. Режим: ':'Local model loaded. Backend: ')+result.backend+'. '+(ru?'Текст запросов остаётся на устройстве.':'Prompt text stays on this device.');
$('runLocalModel').disabled=false;
$('planUniversalTask').disabled=false;
}catch(error){status.textContent=(ru?'Не удалось загрузить локальную модель: ':'Local model loading failed: ')+(error?.message||'Unknown error');}
finally{button.disabled=false;}
});
$('runLocalModel').addEventListener('click',async()=>{
const button=$('runLocalModel'),status=$('localModelStatus'),output=$('localModelOutput'),ru=uiLang==='ru';
const story=$('idea').value.trim();
if(!story){status.textContent=ru?'Сначала введи историю.':'Enter a story first.';return}
if(button.disabled||activeUniversalPlanController)return;button.disabled=true;$('planUniversalTask').disabled=true;status.textContent=ru?'Локальный AI-режиссёр создаёт варианты сцен и проверяет их…':'Local AI director is drafting and evaluating the scenes…';output.hidden=true;
try{
const language=storyLanguage(),languageName={ru:'Russian',uk:'Ukrainian',en:'English',es:'Spanish'}[language]||'English';
const character=resolveStoryProtagonist(story,$('character').value,language);
const rawBasePlan=currentStoryboardPlan?.sourceText===story&&currentStoryboardPlan?.sourceLanguage===language&&currentStoryboardPlan?.sourceCharacter===character?currentStoryboardPlan:buildStoryboardFromText(story,language,character);
const storyContext=prepareStoryCharacterContext(rawBasePlan,characterBible,character,language);characterBible=storyContext.characterBible;const castScenes=storyContext.scenes;const stateChanges=inferStoryboardStateChanges(castScenes,language,character);const preparedScenes=castScenes.map((scene,index)=>({...scene,stateChanges:stateChanges[index]}));const basePlan={...rawBasePlan,scenes:preparedScenes,eventChain:buildStoryEventChain(preparedScenes)};const result=await directStoryboardWithLocalAI({runtime:localTextRuntime,basePlan,storyText:story,language:languageName,character,characterBible});
if(result.usedLocalModel){
currentStoryboardPlan={...basePlan,eventChain:result.eventChain||buildStoryEventChain(result.scenes),sourceText:story,sourceLanguage:language,sourceCharacter:character,scenes:result.scenes,titles:result.scenes.map(scene=>scene.title),descriptions:result.scenes.map(scene=>scene.visibleAction)};
titles=currentStoryboardPlan.titles;descriptions=currentStoryboardPlan.descriptions;sceneMetadata=ensureSceneIds(result.scenes.map(scene=>({...scene,characters:Array.isArray(scene.characters)&&scene.characters.length?scene.characters:[character]})));ensureMainCharacterReference(character);sceneIndex=0;$('bibleCharacterId').value=character;$('bibleCharacterId').dataset.loaded='';$('sceneLabel').textContent=(storyLabels[language]||'Scene')+' 1 · '+titles[0];renderScenes();syncSceneEditor();updateStoryQA();
status.textContent=(ru?'Локальный AI улучшил раскадровку. Оценка качества: ':'Local AI director accepted the storyboard. Quality score: ')+result.evaluation.overallScore+'/100 ('+result.backend+').';
}else{
currentStoryboardPlan={...basePlan,eventChain:buildStoryEventChain(basePlan.scenes),sourceText:story,sourceLanguage:language,sourceCharacter:character};titles=basePlan.titles||basePlan.scenes.map(scene=>scene.title);descriptions=basePlan.descriptions||basePlan.scenes.map(scene=>scene.visibleAction);sceneMetadata=ensureSceneIds(basePlan.scenes.map(scene=>({...scene,characters:Array.isArray(scene.characters)&&scene.characters.length?scene.characters:[character]})));sceneIndex=0;$('sceneLabel').textContent=(storyLabels[language]||'Scene')+' 1 · '+titles[0];renderScenes();syncSceneEditor();updateStoryQA();
status.textContent=(ru?'AI-вариант не прошёл проверку. Оставлена надёжная локальная раскадровка. Причина: ':'AI draft did not pass the quality gate. The deterministic storyboard was kept. Reason: ')+result.fallbackReason;
}
output.textContent=JSON.stringify({usedLocalModel:result.usedLocalModel,score:result.evaluation?.overallScore??null,issues:result.evaluation?.issues||[],fallbackReason:result.fallbackReason},null,2);output.hidden=false;
}catch(error){status.textContent=(ru?'Локальный режиссёр не сработал: ':'Local director failed: ')+(error?.message||'Unknown error');}
finally{button.disabled=false;$('planUniversalTask').disabled=!localTextRuntime.status.loaded;}
});


$('planUniversalTask').addEventListener('click',async()=>{
const button=$('planUniversalTask'),cancel=$('cancelUniversalPlan'),status=$('universalPlannerStatus'),output=$('universalTaskPlanOutput'),ru=uiLang==='ru';
const request=$('idea').value.trim();
if(!request){status.textContent=ru?'Сначала опиши задачу.':'Describe the task first.';return}
if(!localTextRuntime.status.loaded){status.textContent=ru?'Сначала загрузи локальную модель.':'Load the local model first.';return}
if(activeUniversalPlanController)return;
const controller=new AbortController();
activeUniversalPlanController=controller;
button.disabled=true;cancel.disabled=false;$('runLocalModel').disabled=true;output.hidden=true;
status.textContent=ru?'Универсальный ИИ анализирует запрос и строит план на этом устройстве. Это может занять время…':'Universal AI is analysing the request and building a plan on this device. This may take a while…';
try{
const result=await planUniversalTask({runtime:localTextRuntime,request,signal:controller.signal,maxNewTokens:1024,availableCapabilities:universalCapabilityRegistry.list().filter(capability=>capability.available||capability.id==='film.compose'||(capability.id==='voice.generate'&&isLocalSceneVoiceEngineLoaded()&&(isLocalSceneVoiceReady()||isLocalDialogueGenerationReady()))).map(({id,name,privacy,requiresConsent})=>({id,name,privacy,requiresConsent}))});
if(result.status==='cancelled'){
status.textContent=ru?'Отмена запрошена. Генерация модели завершилась без применения устаревшего результата.':'Cancellation requested. The model finished inference; its stale result was discarded.';
return;
}
if(!result.ok){
lastUniversalTaskPlan=null;
$('executeUniversalTask').disabled=true;
status.textContent=(ru?'Не удалось построить проверяемый план: ':'Could not create a valid plan: ')+result.reason;
output.textContent=JSON.stringify({status:result.status,reason:result.reason,modelId:result.modelId||null},null,2);
output.hidden=false;
return;
}
const plan=result.plan;
lastUniversalTaskPlan=plan;
universalTaskCheckpoint=null;
const capabilityBinding=bindUniversalPlanCapabilities(plan,universalCapabilityRegistry);
const executableCount=capabilityBinding.readyCount;
const canStart=capabilityBinding.bindings[0]?.status==='ready';
$('executeUniversalTask').disabled=!canStart;
const lines=[
(ru?'ЦЕЛЬ: ':'GOAL: ')+plan.goal,
(ru?'РЕЗУЛЬТАТ: ':'DELIVERABLE: ')+plan.deliverable.type+' — '+plan.deliverable.description,
'',
ru?'ЭТАПЫ ВЫПОЛНЕНИЯ:':'EXECUTION STEPS:',
...plan.steps.map((step,index)=>(index+1)+'. '+step.action+'\n   '+(ru?'Зачем: ':'Purpose: ')+step.purpose+(step.dependsOn.length?'\n   '+(ru?'Зависит от: ':'Depends on: ')+step.dependsOn.join(', '):'')+(step.requiredCapabilities.length?'\n   '+(ru?'Возможности: ':'Capabilities: ')+step.requiredCapabilities.join(', '):'')),
'',
(ru?'ОГРАНИЧЕНИЯ: ':'CONSTRAINTS: ')+(plan.constraints.join('; ')||'—'),
(ru?'НЕОБХОДИМЫЕ МАТЕРИАЛЫ: ':'REQUIRED ASSETS: ')+(plan.requiredAssets.join('; ')||'—'),
(ru?'НУЖНЫ УТОЧНЕНИЯ: ':'OPEN QUESTIONS: ')+(plan.openQuestions.join('; ')||'—'),
'',
(ru?'Модель: ':'Model: ')+(result.modelId||'local')+' · '+(result.backend||'local'),
(ru?'Доступные реальные операции: ':'Registered executable steps: ')+executableCount+'/'+plan.steps.length,
ru?'Структура проверена, но смысловая правильность не гарантируется. Диалоги создаются локальной моделью по сценам; озвучка требует загруженной локальной модели голоса.':'Structure validated, but semantic correctness is not guaranteed. Dialogue is written by the local text model from each scene; voice synthesis requires the local voice model.'
];
output.textContent=lines.join('\n');output.hidden=false;
status.textContent=canStart?(ru?'План готов. Можно выполнить подключённый локальный этап; неподключённые этапы будут остановлены безопасно.':'Plan ready. The connected local step can run; unsupported steps will be safely blocked.'):(ru?'План создан, но первый этап пока не имеет подключённого инструмента.':'Plan created, but its first step has no connected tool yet.');
}catch(error){
status.textContent=(ru?'Ошибка планировщика: ':'Planner error: ')+(error?.message||'Unknown error');
}finally{
if(activeUniversalPlanController===controller)activeUniversalPlanController=null;
button.disabled=false;cancel.disabled=true;$('runLocalModel').disabled=!localTextRuntime.status.loaded;
}
});
$('executeUniversalTask').addEventListener('click',async()=>{
 const plan=lastUniversalTaskPlan;
 const status=$('universalExecutionStatus');
 const button=$('executeUniversalTask');
 const cancel=$('cancelUniversalExecution');
 const ru=uiLang==='ru';
 if(!plan||activeUniversalExecutionController)return;
 const binding=bindUniversalPlanCapabilities(plan,universalCapabilityRegistry);
 if(binding.bindings[0]?.status!=='ready'){
  status.textContent=ru?'Выполнение остановлено: первый этап сейчас недоступен. Проверь локальную модель и материалы сцены.':'Execution blocked: the first step is not currently available. Check the local model and scene inputs.';
  return;
 }
 const controller=new AbortController();
 activeUniversalExecutionController=controller;
 button.disabled=true;cancel.disabled=false;
 $('planUniversalTask').disabled=true;$('runLocalModel').disabled=true;$('generateSceneVoices').disabled=true;
 status.textContent=ru?'Выполняем подключённые локальные этапы…':'Executing registered local task steps…';
 try{
  const result=await executeUniversalTaskPlan({
   plan,
   handlers:universalCapabilityRegistry.createHandlers(),
   signal:controller.signal,
   checkpoint:universalTaskCheckpoint,
   onCheckpoint:checkpoint=>{universalTaskCheckpoint=checkpoint;},
   onProgress:event=>{
    if(event.status==='step-started')status.textContent=(ru?'Запуск этапа: ':'Starting step: ')+event.stepId;
    else if(event.status==='step-progress')status.textContent=(ru?'Этап ':'Step ')+event.stepId+' · '+event.detail;
    else if(event.status==='step-completed')status.textContent=(ru?'Готово: ':'Completed: ')+event.stepId+' · '+event.percent+'%';
   }
  });
  if(result.checkpoint)universalTaskCheckpoint=result.checkpoint;
  status.textContent=result.ok
   ?(ru?'Подключённые этапы выполнены.':'Registered steps completed.')
   :(ru?'Выполнение остановлено: ':'Execution stopped: ')+result.status+' · '+result.reason+(result.stepId?' · '+result.stepId:'');
  const output=$('universalTaskPlanOutput');
  output.textContent=JSON.stringify({status:result.status,completed:result.completed,total:result.total,results:result.results||{},checkpoint:result.checkpoint||null},null,2);
  output.hidden=false;
 }catch(error){
  status.textContent=(ru?'Ошибка выполнения: ':'Execution error: ')+(error?.message||'Unknown error');
 }finally{
  if(activeUniversalExecutionController===controller)activeUniversalExecutionController=null;
  button.disabled=!lastUniversalTaskPlan||bindUniversalPlanCapabilities(lastUniversalTaskPlan,universalCapabilityRegistry).bindings[0]?.status!=='ready';
  cancel.disabled=true;
  $('planUniversalTask').disabled=!localTextRuntime.status.loaded;
  $('runLocalModel').disabled=!localTextRuntime.status.loaded;
  refreshSceneVoiceControls();
 }
});
$('cancelUniversalExecution').addEventListener('click',()=>{
 if(!activeUniversalExecutionController)return;
 activeUniversalExecutionController.abort();
 $('cancelUniversalExecution').disabled=true;
 $('universalExecutionStatus').textContent=uiLang==='ru'?'Запрошена отмена выполнения. Текущая синхронная операция может завершиться до проверки отмены.':'Execution cancellation requested. A synchronous operation may finish before cancellation is observed.';
});
$('cancelUniversalPlan').addEventListener('click',()=>{
if(!activeUniversalPlanController)return;
activeUniversalPlanController.abort();
$('cancelUniversalPlan').disabled=true;
$('universalPlannerStatus').textContent=uiLang==='ru'?'Запрошена отмена. Текущий расчёт модели нельзя прервать мгновенно; результат не будет применён.':'Cancellation requested. The current model inference cannot be interrupted immediately; its result will be discarded.';
});
$('hordeConsent').addEventListener('change',()=>{$('generateSceneImage').disabled=!$('hordeConsent').checked});
$('spriteHordeConsent').addEventListener('change',()=>{$('generateCharacterSprites').disabled=!$('spriteHordeConsent').checked});
$('generateCharacterSprites').addEventListener('click',async()=>{
 const button=$('generateCharacterSprites'),status=$('characterSpriteStatus');
 if(!$('spriteHordeConsent').checked){status.textContent=uiLang==='ru'?'Сначала подтверди отдельное согласие на отправку промптов персонажей.':'First confirm separate consent to send character prompts.';return}
 if(button.disabled)return;
 const targetIndex=sceneIndex,meta=sceneMetadata[targetIndex]||{};
 const targetId=String(meta.id||('scene_'+(targetIndex+1)));
 const scene={...meta,id:targetId,title:$('sceneTitle').value.trim()||titles[targetIndex],description:$('sceneDescription').value.trim(),imagePrompt:$('sceneImagePrompt').value.trim(),motionPrompt:$('sceneMotionPrompt').value.trim(),visibleAction:$('sceneMotionPrompt').value.trim(),camera:$('sceneCamera').value.trim(),characters:normalizeSceneCast($('sceneCharacters').value,meta.characters),startState:$('sceneStartState').value.trim(),endState:$('sceneEndState').value.trim(),continuityLock:$('sceneContinuityLock').value.trim(),negativePrompt:$('sceneNegativePrompt').value.trim()};
 const plans=buildCharacterSpriteAssetPlan(scene,characterBible);
 const ready=plans.filter(plan=>plan.status==='ready');
 if(!ready.length){status.textContent=uiLang==='ru'?'Нет готовых планов. Проверь состав сцены, справочник внешности и действия персонажей.':'No ready sprite plans. Check the scene cast, character appearance references, and character actions.';return}
 button.disabled=true;
 const existing=Array.isArray(meta.characterSpriteAssets)?[...meta.characterSpriteAssets]:[];
 let completed=0,failed=0;
 try{
  for(const plan of ready){
   status.textContent=uiLang==='ru'?'Генерация '+(completed+failed+1)+' из '+ready.length+': '+plan.characterId+'…':'Generating '+(completed+failed+1)+' of '+ready.length+': '+plan.characterId+'…';
   try{
    const asset=await generateCharacterSpriteAsset({plan,consentAccepted:$('spriteHordeConsent').checked===true,onProgress:progress=>{
     const pos=progress.queuePosition===null?'?':progress.queuePosition;
     status.textContent=(uiLang==='ru'?'AI Horde · ':'AI Horde · ')+plan.characterId+' · очередь: '+pos;
    }});
    const oldIndex=existing.findIndex(item=>item&&item.assetId===asset.assetId);
    if(oldIndex>=0)existing[oldIndex]=asset;else existing.push(asset);
    completed++;
   }catch(error){
    failed++;
    console.error('Character sprite generation failed:',plan.characterId,error);
   }
   const resolvedIndex=sceneMetadata.findIndex(item=>item&&String(item.id)===targetId);
   if(resolvedIndex>=0)sceneMetadata[resolvedIndex]={...sceneMetadata[resolvedIndex],characterSpriteAssets:[...existing]};
   if(sceneIndex===resolvedIndex)renderCharacterSpriteAssets();
  }
  status.textContent=uiLang==='ru'?'Готово: '+completed+' · ошибок: '+failed+'. Сохрани черновик, чтобы сохранить ссылки.':'Finished: '+completed+' generated · '+failed+' failed. Save the draft to keep the links.';
 }finally{
  button.disabled=!$('spriteHordeConsent').checked;
 }
});


function renderCharacterRigPartSets(){
 const host=$('characterRigPartResults');
 if(!host)return;
 host.replaceChildren();
 const sets=sceneMetadata[sceneIndex]?.characterRigPartSets||{};
 const entries=Object.entries(sets);
 if(!entries.length){
  const note=document.createElement('small');note.className='muted';
  note.textContent=uiLang==='ru'?'Пока нет частей скелета.':'No rig-part sets generated yet.';
  host.appendChild(note);return;
 }
 entries.forEach(([characterId,set])=>{
  const targetSceneId=String(sceneMetadata[sceneIndex]?.id||('scene_'+(sceneIndex+1)));
  const heading=document.createElement('strong');heading.textContent=characterId+' · '+(set.status||'unverified');
  host.appendChild(heading);
  const grid=document.createElement('div');grid.className='sprite-results';
  const assets=Array.isArray(set.assets)?set.assets:[];
  assets.forEach(asset=>{
   if(!asset||!/^https:\/\//i.test(String(asset.imageUrl||'')))return;
   const card=document.createElement('div');card.className='sprite-result';
   const image=document.createElement('img');image.src=asset.imageUrl;image.alt=characterId+' · '+String(asset.partId||'rig part');image.loading='lazy';image.referrerPolicy='no-referrer';
   const title=document.createElement('strong');title.textContent=String(asset.partId||'Part');
   const savedReview=set.reviews?.[asset.partId]||null;
   const note=document.createElement('small');note.textContent=savedReview?.approved
    ?(uiLang==='ru'?'Проверено: прозрачность и ручные отметки подтверждены':'Reviewed: alpha and manual checks confirmed')
    :(uiLang==='ru'?'Не проверено: проверь изображение ниже':'Unverified: review the image below');
   const controls=document.createElement('div');controls.className='rig-part-review-controls';
   const decisions={};
   const labels=[
    ['correctPart',uiLang==='ru'?'Это правильная часть тела':'Correct body part'],
    ['characterIdentity',uiLang==='ru'?'Персонаж сохраняет внешний вид':'Character identity matches'],
    ['jointAlignment',uiLang==='ru'?'Стыки подходят для соединения':'Joint edges align']
   ];
   labels.forEach(([key,label])=>{
    const row=document.createElement('label');row.className='consent-row';
    const input=document.createElement('input');input.type='checkbox';input.checked=savedReview?.decisions?.[key]===true;
    input.addEventListener('change',()=>{decisions[key]=input.checked});
    decisions[key]=input.checked;
    const textNode=document.createElement('span');textNode.textContent=label;
    row.append(input,textNode);controls.appendChild(row);
   });
   const reviewButton=document.createElement('button');reviewButton.type='button';reviewButton.className='secondary';
   reviewButton.textContent=uiLang==='ru'?'Проверить прозрачность и сохранить оценку':'Check transparency and save review';
   reviewButton.addEventListener('click',async()=>{
    reviewButton.disabled=true;
    note.textContent=uiLang==='ru'?'Проверяю пиксели изображения…':'Checking image pixels…';
    try{
     const loaded=new Image();loaded.crossOrigin='anonymous';loaded.referrerPolicy='no-referrer';
     await new Promise((resolve,reject)=>{loaded.onload=resolve;loaded.onerror=()=>reject(new Error('Image load failed or provider blocks cross-origin access.'));loaded.src=asset.imageUrl;});
     const canvas=document.createElement('canvas');canvas.width=loaded.naturalWidth;canvas.height=loaded.naturalHeight;
     if(!canvas.width||!canvas.height)throw new Error('Image has invalid dimensions.');
     const context=canvas.getContext('2d',{willReadFrequently:true});
     if(!context)throw new Error('Canvas pixel inspection is unavailable.');
     context.drawImage(loaded,0,0);
     const pixels=context.getImageData(0,0,canvas.width,canvas.height);
     const review=reviewCharacterRigPart(asset,pixels,canvas.width,canvas.height,decisions);
     const targetIndex=sceneMetadata.findIndex(item=>String(item?.id||'')===targetSceneId);
     if(targetIndex<0)throw new Error('The original scene no longer exists; review was not attached elsewhere.');
     const current=sceneMetadata[targetIndex]||{};
     const currentSets={...(current.characterRigPartSets||{})};
     const currentSet={...(currentSets[characterId]||set)};
     currentSet.reviews={...(currentSet.reviews||{}),[asset.partId]:review};
     currentSets[characterId]=currentSet;
     sceneMetadata[targetIndex]={...current,characterRigPartSets:currentSets};
     const saved=writeLocalStorage('dravex-cartoon-draft',JSON.stringify({idea:$('idea').value,character:$('character').value,style:$('style').value,canvasFormat:activeCanvasFormat,imageQuality:$('imageQuality').value,duration:$('duration').value,language:$('language').value,uiLanguage:uiLang,titles,descriptions,sceneMetadata,characterBible,sceneIndex}));
     note.textContent=(review.approved?(uiLang==='ru'?'Часть одобрена. ':'Part approved. '):(uiLang==='ru'?'Не одобрено: ':'Not approved: '))+review.issues.join(', ')+(saved?' · '+(uiLang==='ru'?'сохранено':'saved'):' · '+(uiLang==='ru'?'не сохранено':'not saved'));
     if(sceneMetadata[sceneIndex]?.id===targetSceneId)renderCharacterRigPartSets();
    }catch(error){
     note.textContent=(uiLang==='ru'?'Не удалось проверить пиксели: ':'Pixel review failed: ')+(error?.message||'Unknown error')+(uiLang==='ru'?'. Провайдер должен разрешать CORS.':' Provider must allow CORS.');
    }finally{reviewButton.disabled=false}
   });
   controls.appendChild(reviewButton);
   card.append(image,title,note,controls);grid.appendChild(card);
  });
  host.appendChild(grid);
  if(Array.isArray(set.failures)&&set.failures.length){
   const failures=document.createElement('small');failures.textContent=(uiLang==='ru'?'Ошибки генерации: ':'Generation failures: ')+set.failures.map(item=>item.partId).join(', ');
   host.appendChild(failures);
  }
  const approved=assets.filter(asset=>set.reviews?.[asset.partId]?.approved===true).length;
  const reviewSummary=document.createElement('small');
  reviewSummary.textContent=(uiLang==='ru'?'Одобрено частей: ':'Approved parts: ')+approved+'/10. '+(uiLang==='ru'?'Автопроверка анализирует только alpha-канал; сходство, анатомию и стыки подтверждает человек.':'Automatic inspection checks alpha only; identity, anatomy and joints require human confirmation.');
  host.appendChild(reviewSummary);
  const assembleButton=document.createElement('button');assembleButton.type='button';assembleButton.className='secondary';
  assembleButton.textContent=uiLang==='ru'?'Собрать одобренный скелет':'Assemble approved rig';
  assembleButton.disabled=approved!==10||!set.rig;
  assembleButton.addEventListener('click',()=>{
   const reviews=Object.entries(set.reviews||{}).map(([partId,review])=>({partId,review}));
   const result=assembleApprovedCharacterRig({characterId,rig:set.rig,assets,reviews});
   if(!result.readyForAnimation){
    reviewSummary.textContent=(uiLang==='ru'?'Сборка заблокирована: ':'Assembly blocked: ')+result.issues.join(', ');
    return;
   }
   const targetIndex=sceneMetadata.findIndex(item=>String(item?.id||'')===targetSceneId);
   if(targetIndex<0){reviewSummary.textContent=uiLang==='ru'?'Исходная сцена больше не существует.':'Original scene no longer exists.';return}
   const meta=sceneMetadata[targetIndex]||{};
   const rigs=(meta.characterRigs||[]).filter(item=>String(item.characterId||'').toLowerCase()!==characterId.toLowerCase());
   rigs.push(result.rig);
   const currentSets={...(meta.characterRigPartSets||{})};
   currentSets[characterId]={...(currentSets[characterId]||set),status:'approved',readyForAnimation:true,assembledAt:new Date().toISOString()};
   sceneMetadata[targetIndex]={...meta,characterRigs:rigs,characterRigPartSets:currentSets};
   const saved=writeLocalStorage('dravex-cartoon-draft',JSON.stringify({idea:$('idea').value,character:$('character').value,style:$('style').value,canvasFormat:activeCanvasFormat,imageQuality:$('imageQuality').value,duration:$('duration').value,language:$('language').value,uiLanguage:uiLang,titles,descriptions,sceneMetadata,characterBible,sceneIndex}));
   if($('sceneMotionActor')&&[...$('sceneMotionActor').options].some(option=>option.value.toLowerCase()===characterId.toLowerCase())){
    $('sceneMotionActor').value=characterId;syncCharacterRigEditor();
   }
   reviewSummary.textContent=(uiLang==='ru'?'Скелет собран и прикреплён: 10 частей. ':'Rig assembled and attached: 10 parts. ')+(saved?(uiLang==='ru'?'черновик сохранён':'draft saved'):(uiLang==='ru'?'не удалось сохранить черновик':'draft save failed'))+'.';
   if(!playing)draw();
  });
  host.appendChild(assembleButton);
 });
}
let rigPartsAbortController=null;
$('rigPartsConsent').addEventListener('change',()=>{$('generateCharacterRigParts').disabled=!$('rigPartsConsent').checked});
$('cancelCharacterRigParts').addEventListener('click',()=>rigPartsAbortController?.abort());
$('generateCharacterRigParts').addEventListener('click',async()=>{
 const button=$('generateCharacterRigParts'),status=$('characterRigPartsStatus');
 if(!$('rigPartsConsent').checked){status.textContent=uiLang==='ru'?'Сначала подтверди отдельное согласие на отправку частей персонажа в AI Horde.':'First confirm separate consent to send character-part prompts to AI Horde.';return}
 if(button.disabled)return;
 const characterId=String($('bibleCharacterId').value||'').trim();
 const profile=characterBible.find(item=>String(item.characterId||'').trim().toLowerCase()===characterId.toLowerCase())||{};
 const appearanceReference=[
  $('bibleVisualDescription').value.trim()||profile.visualDescription,
  $('bibleClothing').value.trim()||profile.clothing,
  $('bibleColors').value.trim()||profile.colors,
  $('bibleDistinctiveFeatures').value.trim()||profile.distinctiveFeatures
 ].filter(Boolean).join('; ');
 if(!characterId||!appearanceReference){
  status.textContent=uiLang==='ru'?'Сначала укажи имя и описание внешности персонажа в справочнике, затем сохрани образ.':'Add the character name and appearance details in the character reference first.';
  return;
 }
 const targetIndex=sceneIndex;
 const targetId=String(sceneMetadata[targetIndex]?.id||('scene_'+(targetIndex+1)));
 button.disabled=true;
 rigPartsAbortController=new AbortController();
 $('cancelCharacterRigParts').hidden=false;
 status.textContent=uiLang==='ru'?'Подготовка 10 отдельных частей персонажа…':'Preparing 10 separate character parts…';
 try{
  const result=await generateCharacterRigParts({
   characterId,
   appearanceReference,
   consentAccepted:$('rigPartsConsent').checked===true,
   signal:rigPartsAbortController.signal,
   onProgress:progress=>{
    if(progress.phase==='generating')status.textContent=(uiLang==='ru'?'Создаём часть ':'Generating part ')+progress.index+' / '+progress.total+' · '+progress.partId;
    else if(progress.phase==='queue'){const queue=progress.queue||{};const position=Number.isFinite(queue.queuePosition)?' · '+(uiLang==='ru'?'позиция ':'position ')+queue.queuePosition:'';const waiting=Number.isFinite(queue.waiting)?' · '+(uiLang==='ru'?'ожидают ':'waiting ')+queue.waiting:'';status.textContent='AI Horde · '+progress.partId+position+waiting;}
    else if(progress.phase==='part-complete')status.textContent=(uiLang==='ru'?'Готово ':'Completed ')+progress.completed+' / '+progress.total+' · '+(uiLang==='ru'?'ошибок ':'failed ')+progress.failed;
   }
  });
  const resolvedIndex=sceneMetadata.findIndex(item=>item&&String(item.id||'')===targetId);
  if(resolvedIndex>=0){
   const meta=sceneMetadata[resolvedIndex];
   const sets={...(meta.characterRigPartSets||{})};
   sets[characterId]={status:result.status,identitySeed:result.identitySeed,rig:result.rig,assets:result.assets,failures:result.failures,reviews:{},verificationRequired:result.verificationRequired,readyForAnimation:false,generatedAt:new Date().toISOString()};
   sceneMetadata[resolvedIndex]={...meta,characterRigPartSets:sets};
   if(sceneIndex===resolvedIndex)renderCharacterRigPartSets();
   const saved=writeLocalStorage('dravex-cartoon-draft',JSON.stringify({idea:$('idea').value,character:$('character').value,style:$('style').value,canvasFormat:activeCanvasFormat,imageQuality:$('imageQuality').value,duration:$('duration').value,language:$('language').value,uiLanguage:uiLang,titles,descriptions,sceneMetadata,characterBible,sceneIndex}));
   status.textContent=(result.cancelled?(uiLang==='ru'?'Остановлено. Сохранены готовые части: ':'Cancelled. Saved completed parts: '):'')+(uiLang==='ru'?'Результат: ':'Result: ')+result.assets.length+'/10 · '+(uiLang==='ru'?'ошибок ':'failed ')+result.failures.length+' · '+(saved?(uiLang==='ru'?'сохранено в черновике':'saved to draft'):(uiLang==='ru'?'не удалось сохранить черновик':'draft save failed'))+'. '+(uiLang==='ru'?'Все части пока не проверены и не подключены к анимации.':'All parts remain unverified and are not attached to animation.');
  }else{
   status.textContent=uiLang==='ru'?'Сцена изменилась во время генерации. Результат не привязан к другой сцене.':'The scene changed during generation. Results were not attached to another scene.';
  }
 }catch(error){
  status.textContent=(uiLang==='ru'?'Ошибка генерации частей: ':'Rig-part generation failed: ')+(error?.message||'Unknown error');
 }finally{
  rigPartsAbortController=null;
  $('cancelCharacterRigParts').hidden=true;
  button.disabled=!$('rigPartsConsent').checked;
 }
});

$('generateSceneImage').addEventListener('click',async()=>{
const button=$('generateSceneImage'),status=$('imageGenerationStatus');
if(!$('hordeConsent').checked){status.textContent=uiLang==='ru'?'Сначала подтверди согласие на отправку текстового промпта.':'First confirm consent to send the text prompt.';return}
if(button.disabled)return;
const targetIndex=sceneIndex,meta=sceneMetadata[targetIndex]||{};
const targetId=String(meta.id||('scene_'+(targetIndex+1)+'_'+Date.now()));
const scene={...meta,id:targetId,title:$('sceneTitle').value.trim()||titles[targetIndex],description:$('sceneDescription').value.trim(),imagePrompt:$('sceneImagePrompt').value.trim(),prompt:$('sceneImagePrompt').value.trim(),motionPrompt:$('sceneMotionPrompt').value.trim(),visibleAction:$('sceneMotionPrompt').value.trim(),camera:$('sceneCamera').value.trim(),location:meta.location,timeOfDay:meta.timeOfDay,characters:normalizeSceneCast($('sceneCharacters').value,meta.characters),startState:$('sceneStartState').value.trim(),endState:$('sceneEndState').value.trim(),continuityLock:$('sceneContinuityLock').value.trim(),negativePrompt:$('sceneNegativePrompt').value.trim()};
titles[targetIndex]=scene.title;descriptions[targetIndex]=scene.description;
sceneMetadata[targetIndex]=scene;
const prompt=buildImageGenerationPrompt(scene,characterBible,{includeNegative:false,visualStyle:$('style').value});
const hasSavedPhotoReference=sceneHasSavedCharacterImageReference(scene,characterBible);
const referenceNotice=hasSavedPhotoReference?(uiLang==='ru'?'Фото-референсы не отправляются; AI Horde использует текстовое описание. ':'Photo references are not uploaded; AI Horde uses text descriptions only. '):'';
renderScenes();
button.disabled=true;status.textContent=referenceNotice+(uiLang==='ru'?'Отправляем текстовый промпт в бесплатную очередь AI Horde…':'Submitting the text prompt to the free AI Horde queue…');
try{
const quality=getImageGenerationDimensions(activeCanvasFormat,$('imageQuality').value);const result=await generateImageWithHorde({prompt,negativePrompt:scene.negativePrompt,...quality,seed:buildSceneIdentitySeed(scene,characterBible,$('style').value),onProgress:progress=>{
const position=progress.queuePosition===null?'?':progress.queuePosition;
status.textContent=referenceNotice+(uiLang==='ru'?'Очередь AI Horde · позиция: '+position+' · ожидают: '+progress.waiting+' · обрабатываются: '+progress.processing:'AI Horde queue · position: '+position+' · waiting: '+progress.waiting+' · processing: '+progress.processing);
}});
const resolvedIndex=sceneMetadata.findIndex(item=>item&&item.id===targetId);
if(resolvedIndex>=0)sceneMetadata[resolvedIndex]={...sceneMetadata[resolvedIndex],generatedImageUrl:result.imageUrl,generatedImageSeed:result.seed,generatedImageModel:result.model,generatedImageWorker:result.workerName};
if(sceneIndex===resolvedIndex)renderGeneratedSceneImage();
getLoadedSceneImage(result.imageUrl);
if(!playing)draw();
updateStoryQA();
status.textContent=uiLang==='ru'?'Изображение сцены '+(targetIndex+1)+' создано. Сохрани черновик, чтобы запомнить ссылку.':'Image for scene '+(targetIndex+1)+' generated. Save the draft to keep its result link.';
}catch(error){
status.textContent=(uiLang==='ru'?'Не удалось создать изображение: ':'Image generation failed: ')+(error?.message||'Unknown error');
}finally{button.disabled=!$('hordeConsent').checked}
});

let comfyWorkflows={textToVideo:null,imageToVideo:null},comfyConnected=false,comfySourceImage=null,fullFilmAbortController=null;
let comfyCharacterReferenceFiles=[];
let hfVideoClient=null,hfHandleFile=null,hfVideoConnected=false;
let filmProgressTracking=false;
let filmProgressSceneStates=[];

function filmProgressText(ru,en){return uiLang==='ru'?ru:en}
function setFilmProgress(percent,stage,detail=''){
 const safePercent=Math.max(0,Math.min(100,Math.floor(Number(percent)||0)));
 $('fullFilmProgress').value=safePercent;
 $('fullFilmPercent').textContent=safePercent+'%';
 $('fullFilmStage').textContent=stage;
 $('fullFilmProgressMeta').textContent=detail;
}
function renderFilmSceneProgress(){
 const root=$('fullFilmSceneList');
 root.replaceChildren();
 filmProgressSceneStates.forEach((scene,index)=>{
  const row=document.createElement('div');
  row.className='film-progress__scene'+(scene.status==='completed'||scene.status==='skipped'?' film-progress__scene--completed':'')+(scene.status==='failed'?' film-progress__scene--failed':'');
  const name=document.createElement('span');
  name.className='film-progress__scene-name';
  name.textContent=(index+1)+'. '+scene.title;
  const state=document.createElement('span');
  state.className='film-progress__scene-state';
  state.textContent=scene.label;
  const bar=document.createElement('progress');
  bar.max=100;
  if(Number.isFinite(scene.progress))bar.value=scene.progress;
  else bar.removeAttribute('value');
  row.append(name,state,bar);
  root.append(row);
 });
}
function updateFilmSceneProgress(index,patch){
 if(!filmProgressSceneStates[index])return;
 filmProgressSceneStates[index]={...filmProgressSceneStates[index],...patch};
 renderFilmSceneProgress();
}
function updateFilmVideoProgress(activeProgress=null,stageLabel){
 const total=filmProgressSceneStates.length;
 if(!total)return;
 const completed=filmProgressSceneStates.filter(scene=>scene.status==='completed'||scene.status==='skipped').length;
 const current=Number.isFinite(activeProgress)?Math.max(0,Math.min(100,activeProgress)):0;
 const percent=Math.floor(((completed+current/100)/total)*85);
 const label=stageLabel||filmProgressText('Генерация видеосцен','Generating video scenes');
 setFilmProgress(percent,label,filmProgressText('Готово сцен: ','Scenes ready: ')+completed+'/'+total);
}

function sceneVideoKey(index,meta=sceneMetadata[index]||{}){ensureSceneIds([meta]);return String(meta.id)}
function renderComfySceneVideo(){
 const entry=sceneVideoCache.get(sceneVideoKey(sceneIndex));
 const preview=$('comfySceneVideo'),download=$('comfyDownloadVideo');
 if(!entry){preview.pause();preview.removeAttribute('src');preview.hidden=true;download.removeAttribute('href');download.hidden=true;return}
 if(preview.src!==entry.url){preview.src=entry.url;preview.load()}
 preview.hidden=false;download.href=entry.url;download.hidden=false;download.download=entry.filename;
}
function comfyText(id){return $(id).value.trim()}
function comfyBindings(){
 const binding=(nodeId,input)=>nodeId&&input?{nodeId,input}:null;
 const result={prompt:binding(comfyText('comfyPromptNode'),comfyText('comfyPromptInput')),image:binding(comfyText('comfyImageNode'),comfyText('comfyImageInput'))};
 const optional={negativePrompt:['comfyNegativeNode','comfyNegativeInput'],frameCount:['comfyFramesNode','comfyFramesInput'],fps:['comfyFpsNode','comfyFpsInput'],seed:['comfySeedNode','comfySeedInput'],referenceImage1:['comfyReference1Node','comfyReference1Input'],referenceImage2:['comfyReference2Node','comfyReference2Input']};
 Object.entries(optional).forEach(([key,ids])=>{const value=binding(comfyText(ids[0]),comfyText(ids[1]));if(value)result[key]=value});
 return result;
}
function comfyTextBindings(){
 const binding=(nodeId,input)=>nodeId&&input?{nodeId,input}:null;
 const result={prompt:binding(comfyText('comfyTextPromptNode'),comfyText('comfyTextPromptInput'))};
 const optional={negativePrompt:['comfyTextNegativeNode','comfyTextNegativeInput'],frameCount:['comfyTextFramesNode','comfyTextFramesInput'],fps:['comfyTextFpsNode','comfyTextFpsInput'],seed:['comfyTextSeedNode','comfyTextSeedInput']};
 Object.entries(optional).forEach(([key,ids])=>{const value=binding(comfyText(ids[0]),comfyText(ids[1]));if(value)result[key]=value});
 return result;
}
function comfyWorkflowConfigs(){
 const configs={};
 if(comfyWorkflows.textToVideo)configs['text-to-video']={workflow:comfyWorkflows.textToVideo,nodeBindings:comfyTextBindings(),outputNodeIds:comfyText('comfyTextOutputNodes').split(',').map(value=>value.trim()).filter(Boolean),frameCountStep:Number(comfyText('comfyTextFrameStep'))||1,frameCountOffset:1};
 if(comfyWorkflows.imageToVideo)configs['image-to-video']={workflow:comfyWorkflows.imageToVideo,nodeBindings:comfyBindings(),outputNodeIds:comfyText('comfyOutputNodes').split(',').map(value=>value.trim()).filter(Boolean),frameCountStep:Number(comfyText('comfyFrameStep'))||1,frameCountOffset:1};
 return configs;
}
function comfyProviderOptions(){return {baseUrl:comfyText('comfyBaseUrl'),workflows:comfyWorkflowConfigs()};}
function isLocalVideoGenerationReady({step}={}){
 const target=resolveRemoteScene(step);
 if(!target.ok)return false;
 const imageReady=target.index===sceneIndex?!!comfySourceImage||!!String(target.scene.generatedImageUrl||'').trim():!!String(target.scene.generatedImageUrl||'').trim();
 const taskType=resolveSceneVideoTaskType({mode:'comfyui',imageSourceKind:imageReady?'url':'missing'});
 const motion=target.index===sceneIndex?$('sceneMotionPrompt').value:target.scene.motionPrompt||target.scene.visibleAction;
 return comfyConnected&&!!comfyWorkflowConfigs()[taskType]&&!fullFilmAbortController&&!!String(motion||'').trim();
}
function resolveRemoteScene(step){return resolveUniversalSceneTarget(step,sceneMetadata,sceneIndex);}
function isRemoteVideoGenerationReady({step}={}){
 const target=resolveRemoteScene(step);
 if(!target.ok)return false;
 const meta=target.scene;
 const imageReady=target.index===sceneIndex?!!comfySourceImage||!!String(meta.generatedImageUrl||'').trim():!!String(meta.generatedImageUrl||'').trim();
 const motion=target.index===sceneIndex?$('sceneMotionPrompt').value:meta.motionPrompt||meta.visibleAction;
 return universalCapabilityRegistry.remoteConsent&&$('hfVideoConsent').checked===true&&
  hfVideoConnected&&!!hfVideoClient&&typeof hfHandleFile==='function'&&imageReady&&!!String(motion||'').trim();
}
async function generateRemoteSceneVideoForUniversal({signal,reportProgress,hasConsent=()=>false,step}={}){
 const assertConsent=()=>{
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  if(!universalCapabilityRegistry.remoteConsent||$('hfVideoConsent').checked!==true||!hasConsent()){
   const error=new Error('Remote upload stopped because explicit Hugging Face consent is no longer active.');
   error.code='REMOTE_CONSENT_REQUIRED';throw error;
  }
 };
 assertConsent();
 await sceneVideoRestorePromise;
 const target=resolveRemoteScene(step);
 if(!target.ok)throw new Error('Cannot resolve the requested scene: '+target.reason);
 const index=target.index,originalMeta=target.scene,sceneId=String(originalMeta.id||'');
 const generationToken=sceneGenerationGuard.capture(sceneId);
 const assertGenerationCurrent=()=>{if(!sceneGenerationGuard.isCurrent(generationToken))throw new Error('Scene settings changed while video generation was running. The stale clip was discarded; generate the updated scene again.');};
 const isCurrent=index===sceneIndex;
 const readField=(id,key)=>isCurrent?$(id).value.trim():String(originalMeta[key]||'').trim();
 const motionText=readField('sceneMotionPrompt','motionPrompt')||String(originalMeta.visibleAction||'');
 const motionScene={...originalMeta,title:readField('sceneTitle','title')||titles[index],description:readField('sceneDescription','description')||descriptions[index],motionPrompt:motionText,visibleAction:motionText,camera:readField('sceneCamera','camera'),startState:readField('sceneStartState','startState'),endState:readField('sceneEndState','endState'),negativePrompt:readField('sceneNegativePrompt','negativePrompt'),continuityLock:readField('sceneContinuityLock','continuityLock'),characters:isCurrent?normalizeSceneCast($('sceneCharacters').value,originalMeta.characters):(Array.isArray(originalMeta.characters)?originalMeta.characters:[])};
 const prompt=buildMotionGenerationPrompt(motionScene,characterBible);
 if(!prompt.trim())throw new Error('Add a motion instruction before remote video generation.');
 let imageBlob=isCurrent?comfySourceImage:null;
 if(!imageBlob){
  const imageUrl=String(originalMeta.generatedImageUrl||'').trim();
  if(!imageUrl)throw new Error('Create or load a still image for the selected scene first.');
  assertConsent();
  const response=await fetch(imageUrl,{signal});
  if(!response.ok)throw new Error('Cannot read the selected scene image (HTTP '+response.status+').');
  imageBlob=await response.blob();
 }
 assertGenerationCurrent();
 if(!imageBlob?.size)throw new Error('The selected scene image is empty.');
 assertConsent();
 const provider=createHuggingFaceZeroGPUVideoProvider({client:hfVideoClient,handleFile:hfHandleFile});
 const registry=createVideoProviderRegistry();registry.register(provider);
 const duration=Math.max(0.5,Math.min(5,Number(originalMeta.durationSeconds??originalMeta.duration??$('duration').value)||3));
 reportProgress?.('Submitting the selected scene to Hugging Face Wan 2.2 (0.5–5 seconds)');
 assertConsent();
 const result=await generateVideoWithProvider(registry,provider.id,{taskType:'image-to-video',prompt,negativePrompt:motionScene.negativePrompt,durationSeconds:duration,fps:16,aspectRatio:'source',image:imageBlob,seed:buildSceneIdentitySeed(motionScene,characterBible,$('style').value),referenceImages:[]},{signal,onProgress:job=>reportProgress?.('Wan 2.2 '+String(job.stage||'processing')+(Number.isFinite(job.queuePosition)?' · queue '+job.queuePosition:''))});
 assertConsent();
 if(result.status!=='completed'||!result.video)throw new Error(result.error||'Hugging Face Wan 2.2 did not return a completed video.');
 assertGenerationCurrent();
 if(String(sceneMetadata[index]?.id||'')!==sceneId)throw new Error('The selected scene changed during remote generation; the clip was not attached elsewhere.');
 const key=sceneVideoKey(index,motionScene);
 const extension=result.video.type.includes('webm')?'.webm':result.video.type.includes('quicktime')?'.mov':'.mp4';
 const filename='dravex-scene-'+(index+1)+'-wan22'+extension;
 const entry=attachSceneVideo(index,motionScene,result.video,filename);
 try{await waitForSceneVideoReady(entry.video,{timeoutMs:20000,signal});assertGenerationCurrent();}
 catch(error){if(sceneVideoCache.get(key)===entry)sceneVideoCache.delete(key);disposeSceneVideoEntry(entry);throw new Error('Wan 2.2 returned a clip the browser could not decode or the scene changed: '+(error.message||'decode error'));}
 const persistence=await persistSceneVideoBestEffort(sceneVideoStorage,key,result.video,filename,{generationRevision:generationToken.storageRevision});
 if(!sceneGenerationGuard.isCurrent(generationToken)){await sceneVideoStorage.deleteIfRevision(key,generationToken.storageRevision);if(sceneVideoCache.get(key)===entry){sceneVideoCache.delete(key);disposeSceneVideoEntry(entry);}throw new Error('Scene settings changed while the clip was being saved. The stale clip was discarded.');}
 if(sceneIndex===index){renderComfySceneVideo();renderScenes();if(!playing)draw();}
 return {status:'completed',sceneId:key,filename,mimeType:result.video.type,size:result.video.size,persisted:persistence.persisted};
}
async function generateLocalSceneVideoForUniversal({signal,reportProgress,step}={}){
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
 await sceneVideoRestorePromise;
 const target=resolveRemoteScene(step);
 if(!target.ok)throw new Error('Cannot resolve the requested scene: '+target.reason);
 const index=target.index,originalMeta=target.scene,sceneId=String(originalMeta.id||'');
 const generationToken=sceneGenerationGuard.capture(sceneId);
 const assertGenerationCurrent=()=>{if(!sceneGenerationGuard.isCurrent(generationToken))throw new Error('Scene settings changed while video generation was running. The stale clip was discarded; generate the updated scene again.');};
 const isCurrent=index===sceneIndex;
 const readField=(id,key)=>isCurrent?$(id).value.trim():String(originalMeta[key]||'').trim();
 const motionText=readField('sceneMotionPrompt','motionPrompt')||String(originalMeta.visibleAction||'');
 const motionScene={
  ...originalMeta,title:readField('sceneTitle','title')||titles[index],
  description:readField('sceneDescription','description')||descriptions[index],
  motionPrompt:motionText,visibleAction:motionText,
  camera:readField('sceneCamera','camera'),startState:readField('sceneStartState','startState'),
  endState:readField('sceneEndState','endState'),negativePrompt:readField('sceneNegativePrompt','negativePrompt'),
  continuityLock:readField('sceneContinuityLock','continuityLock'),
  characters:isCurrent?normalizeSceneCast($('sceneCharacters').value,originalMeta.characters):(Array.isArray(originalMeta.characters)?originalMeta.characters:[])
 };
 let imageBlob=isCurrent?comfySourceImage:null;
 if(!imageBlob){
  const imageUrl=String(originalMeta.generatedImageUrl||'').trim();
  if(imageUrl){
   const response=await fetch(imageUrl,{signal});
   if(!response.ok)throw new Error('Не удалось получить изображение сцены (HTTP '+response.status+'). Проверь CORS или выбери локальный файл.');
   imageBlob=await response.blob();
  }
 }
 if(imageBlob&&!imageBlob.size)throw new Error('Исходное изображение сцены пустое.');
 const taskType=resolveSceneVideoTaskType({mode:'comfyui',imageSourceKind:imageBlob?'blob':'missing'});
 const prompt=taskType==='text-to-video'
  ?[buildImageGenerationPrompt(motionScene,characterBible,{includeNegative:false,visualStyle:$('style').value}),buildMotionGenerationPrompt(motionScene,characterBible)].filter(Boolean).join('\n\nMotion direction: ')
  :buildMotionGenerationPrompt(motionScene,characterBible);
 if(!prompt.trim())throw new Error('Добавь описание движения сцены перед генерацией.');
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
 const provider=createComfyUIVideoProvider(comfyProviderOptions());
 const registry=createVideoProviderRegistry();registry.register(provider);
 const duration=Math.max(0.25,Math.min(30,Number(originalMeta.durationSeconds??originalMeta.duration??$('duration').value)||3));
 const profileReferences=await loadCharacterReferenceImagesForScene(motionScene);
 assertGenerationCurrent();
 const referenceImages=profileReferences.concat(comfyCharacterReferenceFiles.filter(Boolean)).slice(0,2);
 reportProgress?.('Submitting scene to local ComfyUI');
 const result=await generateVideoWithProvider(registry,provider.id,{
  taskType,prompt,negativePrompt:motionScene.negativePrompt,
  durationSeconds:duration,fps:16,aspectRatio:'source',...(taskType==='image-to-video'?{image:imageBlob}:{}),
  seed:buildSceneIdentitySeed(motionScene,characterBible,$('style').value),referenceImages
 },{signal,onProgress:job=>{
  const percent=readVideoProgressPercent(job);
  reportProgress?.('ComfyUI '+String(job.stage||'processing')+(percent===null?'':' '+percent+'%'));
 }});
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
 if(result.status!=='completed'||!result.video)throw new Error(result.error||'ComfyUI не вернул готовое видео.');
 assertGenerationCurrent();
 if(String(sceneMetadata[index]?.id||'')!==sceneId)throw new Error('Выбранная сцена изменилась во время генерации. Результат не прикреплён к другой сцене.');
 const key=sceneVideoKey(index,motionScene);
 const extension=result.video.type.includes('webm')?'.webm':result.video.type.includes('quicktime')?'.mov':'.mp4';
 const filename='dravex-scene-'+(index+1)+extension;
 const entry=attachSceneVideo(index,motionScene,result.video,filename);
 try{await waitForSceneVideoReady(entry.video,{timeoutMs:20000,signal});assertGenerationCurrent();}
 catch(error){
  if(sceneVideoCache.get(key)===entry)sceneVideoCache.delete(key);
  disposeSceneVideoEntry(entry);
  throw new Error('Полученный клип не удалось декодировать или сцена изменилась: '+(error.message||'ошибка декодирования'));
 }
 const persistence=await persistSceneVideoBestEffort(sceneVideoStorage,key,result.video,filename,{generationRevision:generationToken.storageRevision});
 if(!sceneGenerationGuard.isCurrent(generationToken)){await sceneVideoStorage.deleteIfRevision(key,generationToken.storageRevision);if(sceneVideoCache.get(key)===entry){sceneVideoCache.delete(key);disposeSceneVideoEntry(entry);}throw new Error('Настройки сцены изменились во время сохранения. Устаревший клип удалён.');}
 if(sceneIndex===index){renderComfySceneVideo();renderScenes();if(!playing)draw();}
 return {status:'completed',sceneId:key,filename,mimeType:result.video.type,size:result.video.size,persisted:persistence.persisted};
}
function setComfyStatus(message){$('comfyStatus').textContent=message}
function updateComfyAnimateAvailability(){
 const configs=comfyWorkflowConfigs();
 const currentMeta=sceneMetadata[sceneIndex]||{};
 const currentImageSource=resolveSceneImageSource({mode:'comfyui',sceneIndex,activeSceneIndex:sceneIndex,localImage:comfySourceImage,generatedImageUrl:currentMeta.generatedImageUrl});
 const currentTask=resolveSceneVideoTaskType({mode:'comfyui',imageSourceKind:currentImageSource.kind});
 $('animateSceneComfy').disabled=!comfyConnected||!configs[currentTask];
 const mode=$('videoGenerationMode')?.value||'huggingface';
 const neededFilmTasks=new Set(sceneMetadata.map((meta,index)=>{
  const source=resolveSceneImageSource({mode:'comfyui',sceneIndex:index,activeSceneIndex:sceneIndex,localImage:comfySourceImage,generatedImageUrl:meta.generatedImageUrl});
  return resolveSceneVideoTaskType({mode:'comfyui',imageSourceKind:source.kind});
 }));
 const filmWorkflowsReady=[...neededFilmTasks].every(taskType=>!!configs[taskType]);
 const ready=mode==='huggingface'?hfVideoConnected&&$('hfVideoConsent').checked:mode==='comfyui'&&comfyConnected&&filmWorkflowsReady;
 $('generateFullFilmComfy').hidden=mode==='local-canvas';
 $('generateFullFilmComfy').disabled=!ready||!!fullFilmAbortController;
}
['comfyCharacterReference1','comfyCharacterReference2'].forEach((id,index)=>{
 $(id).addEventListener('change',()=>{
  const file=$(id).files?.[0]||null;
  comfyCharacterReferenceFiles[index]=file;
  const count=comfyCharacterReferenceFiles.filter(Boolean).length;
  setComfyStatus(count
   ? (uiLang==='ru'?'Выбрано референсов: '+count+'. Они будут отправлены только в локальный ComfyUI при запуске анимации.':'Selected character references: '+count+'. They are sent only to local ComfyUI when animation starts.')
   : (uiLang==='ru'?'Референсы персонажей не выбраны.':'No character references selected.'));
 });
});
$('comfySourceImageFile').addEventListener('change',()=>{
 const file=$('comfySourceImageFile').files?.[0]||null;
 comfySourceImage=file;
 $('comfySourceImageStatus').textContent=file?'Selected local image: '+file.name+' · '+Math.round(file.size/1024)+' KB. It stays in this tab until you start generation.':'No local image selected; the generated scene image will be used if available.';
});
[
 ['comfyTextWorkflowFile','textToVideo','comfyTextWorkflowStatus'],
 ['comfyImageWorkflowFile','imageToVideo','comfyImageWorkflowStatus']
].forEach(([inputId,key,statusId])=>{
 $(inputId).addEventListener('change',async()=>{
  const file=$(inputId).files?.[0]||null;
  comfyWorkflows[key]=null;comfyConnected=false;updateComfyAnimateAvailability();
  if(!file){$(statusId).textContent='No workflow selected.';return}
  try{
   const parsed=JSON.parse(await file.text());
   if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||!Object.keys(parsed).length)throw new Error('The JSON is empty or is not an API-format workflow object.');
   comfyWorkflows[key]=parsed;
   $(statusId).textContent='Loaded '+file.name+' · '+Object.keys(parsed).length+' nodes. Bindings will be validated on connection.';
   setComfyStatus('Workflow loaded in this browser tab. Check the local ComfyUI connection.');
  }catch(error){$(statusId).textContent='Workflow error: '+(error.message||'Invalid JSON');}
 });
});
$('checkComfyConnection').addEventListener('click',async()=>{
 const button=$('checkComfyConnection');button.disabled=true;comfyConnected=false;updateComfyAnimateAvailability();
 try{
  const result=await checkComfyUIConnection({baseUrl:comfyText('comfyBaseUrl')});
  if(Object.keys(comfyWorkflowConfigs()).length){
   const provider=createComfyUIVideoProvider(comfyProviderOptions());
   comfyConnected=true;
   setComfyStatus('Connected to ComfyUI'+(result.system?.system?.comfyui_version?' · '+result.system.system.comfyui_version:'')+'. Validated: '+provider.taskTypes.join(' + ')+'. No image has been uploaded.');
  }else{
   setComfyStatus('ComfyUI is reachable, but select at least one API workflow JSON before animation.');
  } }catch(error){setComfyStatus((error.code||'CONNECTION_ERROR')+': '+(error.message||'Connection failed'));}
 finally{button.disabled=false;updateComfyAnimateAvailability();}
});
$('animateSceneComfy').addEventListener('click',async()=>{
 const button=$('animateSceneComfy'),status=$('comfyStatus');
 if(button.disabled)return;
 const index=sceneIndex,meta=sceneMetadata[index]||{},imageUrl=String(meta.generatedImageUrl||'').trim();
 const generationToken=sceneGenerationGuard.capture(String(meta.id||''));
 const assertGenerationCurrent=()=>{if(!sceneGenerationGuard.isCurrent(generationToken))throw new Error('Scene settings changed during generation. The stale clip was discarded; generate this scene again.');};
 const motionScene={...meta,title:$('sceneTitle').value.trim()||titles[index],description:$('sceneDescription').value.trim()||descriptions[index],motionPrompt:$('sceneMotionPrompt').value.trim(),visibleAction:$('sceneMotionPrompt').value.trim(),camera:$('sceneCamera').value.trim(),startState:$('sceneStartState').value.trim(),endState:$('sceneEndState').value.trim(),negativePrompt:$('sceneNegativePrompt').value.trim(),continuityLock:$('sceneContinuityLock').value.trim(),characters:normalizeSceneCast($('sceneCharacters').value,meta.characters)};
 const imageSourceKind=comfySourceImage?'blob':imageUrl?'url':'missing';
 const taskType=resolveSceneVideoTaskType({mode:'comfyui',imageSourceKind});
 const prompt=taskType==='text-to-video'
  ?[buildImageGenerationPrompt(motionScene,characterBible,{includeNegative:false,visualStyle:$('style').value}),buildMotionGenerationPrompt(motionScene,characterBible)].filter(Boolean).join('\n\nMotion direction: ')
  :buildMotionGenerationPrompt(motionScene,characterBible);
 if(!prompt.trim()){setComfyStatus('This scene has no usable visual or motion prompt. Add a scene description or motion instruction first.');return}
 button.disabled=true;$('checkComfyConnection').disabled=true;
 try{
  let imageBlob=comfySourceImage;
  if(!imageBlob&&taskType==='image-to-video'){
   status.textContent=uiLang==='ru'?'Получаем изображение сцены локально…':'Reading the generated scene image…';
   const imageResponse=await fetch(imageUrl);
   if(!imageResponse.ok)throw new Error('Cannot read the scene image (HTTP '+imageResponse.status+'). Select a local image instead if the image host blocks browser CORS.');
   imageBlob=await imageResponse.blob();
  }
  assertGenerationCurrent();
  if(taskType==='image-to-video'&&!imageBlob?.size)throw new Error('The scene image is empty.');
  const provider=createComfyUIVideoProvider(comfyProviderOptions());
  const registry=createVideoProviderRegistry();registry.register(provider);
  const duration=Math.max(0.25,Math.min(30,Number($('duration').value)||3));
  let referenceWarning='';
  const profileReferences=await loadCharacterReferenceImagesForScene(motionScene);
  assertGenerationCurrent();
  const referenceImages=profileReferences.concat(comfyCharacterReferenceFiles.filter(Boolean)).slice(0,2);
  const result=await generateVideoWithProvider(registry,provider.id,{taskType,prompt,negativePrompt:motionScene.negativePrompt,durationSeconds:duration,fps:16,aspectRatio:'source',...(taskType==='image-to-video'?{image:imageBlob}:{}),seed:buildSceneIdentitySeed(motionScene,characterBible,$('style').value),referenceImages},{onProgress:progress=>{
   if(progress.stage==='warning'&&progress.message){referenceWarning=String(progress.message);status.textContent='ComfyUI · Внимание: '+referenceWarning;return;}
   const elapsed=Math.round((progress.elapsedMs||0)/1000);
   status.textContent='ComfyUI · '+progress.stage+' · '+elapsed+'s'+(progress.promptId?' · '+progress.promptId:'')+(referenceWarning?' · Внимание: '+referenceWarning:'');
  }});
  if(result.status!=='completed'||!result.video)throw new Error(result.error||'ComfyUI did not return a completed video.');
  assertGenerationCurrent();
  const key=sceneVideoKey(index,motionScene);
  const extension=result.video.type.includes('webm')?'.webm':result.video.type.includes('quicktime')?'.mov':'.mp4';
  const filename='dravex-scene-'+(index+1)+extension;
  const videoEntry=attachSceneVideo(index,motionScene,result.video,filename);
  try{
   await waitForSceneVideoReady(videoEntry.video,{timeoutMs:20000});
   assertGenerationCurrent();
  }catch(readinessError){
   if(sceneVideoCache.get(key)===videoEntry)sceneVideoCache.delete(key);
   disposeSceneVideoEntry(videoEntry);
   throw new Error('Сцена '+(index+1)+' вернула видео, которое браузер не смог декодировать: '+(readinessError.message||'unknown decode error'));
  }
  const persistence=await persistSceneVideoBestEffort(sceneVideoStorage,key,result.video,filename,{generationRevision:generationToken.storageRevision});
  if(!sceneGenerationGuard.isCurrent(generationToken)){await sceneVideoStorage.deleteIfRevision(key,generationToken.storageRevision);if(sceneVideoCache.get(key)===videoEntry){sceneVideoCache.delete(key);disposeSceneVideoEntry(videoEntry);}throw new Error('Scene settings changed while saving. The stale clip was discarded.');}
  const persistenceNote=persistence.persisted?'':(uiLang==='ru'
   ?' Видео доступно в этой вкладке, но не сохранено для следующего запуска: '+(persistence.error||'ошибка хранилища')
   :' The video is available in this tab but could not be saved for the next visit: '+(persistence.error||'storage error'));
  if(sceneIndex===index)renderComfySceneVideo();
  if(!playing)draw();
  status.textContent=(uiLang==='ru'?'Готово: видео сцены декодировано и подключено к предпросмотру и экспорту.':'Completed: scene video decoded and connected to preview and storyboard export.')+persistenceNote;
 }catch(error){status.textContent=(error.name==='AbortError'?'Cancelled: ':'Generation failed: ')+(error.code?error.code+' · ':'')+(error.message||'Unknown error');}
 finally{button.disabled=false;$('checkComfyConnection').disabled=false;updateComfyAnimateAvailability();}
});


$('videoGenerationMode').addEventListener('change',updateComfyAnimateAvailability);
$('hfVideoConsent').addEventListener('change',()=>{
 const granted=$('hfVideoConsent').checked===true;
 universalCapabilityRegistry.setRemoteConsent(granted);
 if(!granted&&activeUniversalExecutionController)activeUniversalExecutionController.abort();
 if(!granted&&fullFilmAbortController&&$('videoGenerationMode').value==='huggingface')fullFilmAbortController.abort();
 if(lastUniversalTaskPlan){
  const binding=bindUniversalPlanCapabilities(lastUniversalTaskPlan,universalCapabilityRegistry);
  $('executeUniversalTask').disabled=binding.bindings[0]?.status!=='ready';
 }
 updateComfyAnimateAvailability();
});
$('clearHfVideoToken').addEventListener('click',()=>{
 if(fullFilmAbortController&&$('videoGenerationMode').value==='huggingface')fullFilmAbortController.abort();
 $('hfVideoConsent').checked=false;
 universalCapabilityRegistry.setRemoteConsent(false);
 if(activeUniversalExecutionController)activeUniversalExecutionController.abort();
 $('hfVideoToken').value='';hfVideoClient=null;hfHandleFile=null;hfVideoConnected=false;
 $('hfVideoStatus').textContent='Токен очищен. Подключись заново при необходимости.';
 updateComfyAnimateAvailability();
});
$('connectHfVideo').addEventListener('click',async()=>{
 const button=$('connectHfVideo'),status=$('hfVideoStatus'),token=$('hfVideoToken').value.trim();
 if(!/^hf_[A-Za-z0-9]{10,}$/.test(token)){status.textContent='Введи действительный Hugging Face access token с правом read.';return}
 button.disabled=true;hfVideoConnected=false;updateComfyAnimateAvailability();
 try{
  status.textContent='Подключаемся к публичному видеодвижку Hugging Face…';
  const {Client,handle_file}=await import('https://cdn.jsdelivr.net/npm/@gradio/client@2.7.2/dist/index.min.js');
  const client=await Client.connect(HUGGING_FACE_ZERO_GPU_SPACE_ID,{token,events:['data','status'],space_status:spaceStatus=>{
   status.textContent='Hugging Face Space · '+(spaceStatus.status||'подключение')+' · '+(spaceStatus.message||'');
  }});
  const api=await client.view_api();
  if(!api?.named_endpoints?.['/generate_video'])throw new Error('Публичный Space не предоставил ожидаемый endpoint /generate_video.');
  hfVideoClient=client;hfHandleFile=handle_file;hfVideoConnected=true;
  status.textContent='Подключено: Wan 2.2 14B Fast. Токен остаётся только в этой вкладке; квота GPU зависит от аккаунта Hugging Face.';
 }catch(error){
  hfVideoClient=null;hfHandleFile=null;hfVideoConnected=false;
  status.textContent='Не удалось подключить Hugging Face: '+(error.message||'проверь токен, очередь и доступность Space.');
 }finally{button.disabled=false;updateComfyAnimateAvailability();}
});

$('cancelFullFilmComfy').addEventListener('click',()=>{
 if(fullFilmAbortController)fullFilmAbortController.abort();
});
$('generateFullFilmComfy').addEventListener('click',async()=>{
 const button=$('generateFullFilmComfy'),cancel=$('cancelFullFilmComfy'),progress=$('fullFilmProgress'),progressPanel=$('fullFilmProgressPanel'),status=$('fullFilmStatus');
 const mode=$('videoGenerationMode').value;
 if(button.disabled)return;
 if(mode==='huggingface'&&(!hfVideoConnected||!hfVideoClient||!hfHandleFile||!$('hfVideoConsent').checked))return;
 if(mode==='comfyui'&&(!comfyConnected||!Object.keys(comfyWorkflowConfigs()).length))return;
 const controller=new AbortController();
 fullFilmAbortController=controller;
 button.disabled=true;cancel.hidden=false;progressPanel.hidden=false;progress.value=0;
 filmProgressTracking=true;
 await sceneVideoRestorePromise;
 $('animateSceneComfy').disabled=true;$('checkComfyConnection').disabled=true;
 const quality=getImageGenerationDimensions(activeCanvasFormat,$('imageQuality').value);
 try{
  const provider=mode==='huggingface'
   ?createHuggingFaceZeroGPUVideoProvider({client:hfVideoClient,handleFile:hfHandleFile})
   :createComfyUIVideoProvider(comfyProviderOptions());
  const registry=createVideoProviderRegistry();registry.register(provider);
  const scenes=titles.map((title,index)=>({...sceneMetadata[index],title,description:descriptions[index]||sceneMetadata[index]?.description||''}));
  // Prepare requested dialogue and speech before spending time/quota on video generation.
  // Existing user dialogue and matching voice artifacts are preserved by the workflow.
  const speechTasks=resolveAutomaticSpeechTasks({request:$('idea').value,scenes:sceneMetadata});
  const needsDialogue=(speechTasks.dialogueRequested||speechTasks.voiceRequested)
   &&selectScenesMissingDialogue(sceneMetadata).length>0;
  if(needsDialogue){
   if(!localTextRuntime.status.loaded){
    if(!$('localModelConsent')?.checked){
     throw new Error(uiLang==='ru'
      ?'Для создания реплик нужно разрешить загрузку локальной текстовой модели (~117 МБ). Отметь согласие в разделе «Дополнительный локальный ИИ» и запусти создание снова.'
      :'Dialogue generation needs the local text model (~117 MB). Confirm its download in Optional local AI tools, then start creation again.');
    }
    status.textContent=uiLang==='ru'?'Загружаем локальную текстовую модель…':'Loading the local text model…';
    setFilmProgress(1,filmProgressText('Загрузка локального ИИ','Loading local AI'),filmProgressText('Модель загружается на устройство. Текст запроса не отправляется в облачный inference API.','The model is downloading to this device. Your prompt is not sent to a cloud inference API.'));
    await localTextRuntime.load({
     backend:'auto',
     signal:controller.signal,
     onProgress:event=>{
      const percent=Number.isFinite(event?.progress)?' '+Math.round(event.progress*100)+'%':'';
      status.textContent=uiLang==='ru'?'Загрузка локального ИИ: '+String(event?.status||'загрузка')+percent:'Local AI download: '+String(event?.status||'loading')+percent;
     }
    });
   }
   status.textContent=uiLang==='ru'?'Создаём реплики для всех сцен…':'Writing dialogue for all scenes…';
   setFilmProgress(1,filmProgressText('Создание реплик','Writing dialogue'),filmProgressText('Локальная модель обрабатывает сцены по очереди.','The local model is processing scenes sequentially.'));
   const handlers=universalCapabilityRegistry.createHandlers();
   await handlers['dialogue.generate']({
    plan:{sourceRequest:$('idea').value},
    step:{id:'prompt-film-dialogue',action:'Write dialogue for all scenes',purpose:'Prepare requested spoken lines',inputs:['allScenes'],outputs:['scene-dialogue'],dependsOn:[],requiredCapabilities:['dialogue.generate']},
    signal:controller.signal,
    reportProgress:detail=>{status.textContent=String(detail||'Writing scene dialogue…');}
   });
  }
  const refreshedSpeechTasks=resolveAutomaticSpeechTasks({request:$('idea').value,scenes:sceneMetadata});
  if(refreshedSpeechTasks.voiceRequested&&refreshedSpeechTasks.scenesMissingVoice.length){
   const voiceStep={id:'prompt-film-voice',action:'Generate voices for all scenes',purpose:'Synthesize requested spoken dialogue',inputs:['allScenes'],outputs:['voice-audio'],dependsOn:['prompt-film-dialogue'],requiredCapabilities:['voice.generate']};
   if(!isLocalSceneVoiceEngineLoaded()){
    const loadPlan=resolvePromptVoiceModelLoad({
     locale:storyLanguage(),
     engineChoice:$('sceneVoiceEngineChoice')?.value||'standard',
     nonCommercialConsent:$('voiceNonCommercialConsent')?.checked===true
    });
    if(!loadPlan.ok){
     const reason=loadPlan.reason==='non-commercial-consent-required'
      ?(uiLang==='ru'?'Для выбранного языка отметь подтверждение некоммерческого использования локальной модели голоса в разделе «Диалоги».':'Confirm non-commercial use of the local voice model in the Dialogue section before continuing.')
      :loadPlan.reason==='timestamped-english-only'
       ?(uiLang==='ru'?'Timestamped Kokoro поддерживает только английский. Выбери стандартный движок голоса.':'Timestamped Kokoro supports English only. Choose the standard voice engine.')
       :(uiLang==='ru'?'Не удалось определить язык или движок локального голоса.':'Could not resolve the local voice language or engine.');
     throw new Error(reason);
    }
    status.textContent=uiLang==='ru'?'Загружаем локальную модель голоса…':'Loading the local voice model…';
    setFilmProgress(2,filmProgressText('Загрузка модели голоса','Loading voice model'),filmProgressText('Модель загружается на устройство. Обработка речи останется локальной.','The model is downloading to this device. Speech inference stays local.'));
    const voiceEngine=getSceneVoiceEngine();
    await voiceEngine.load({
     locale:loadPlan.locale,
     allowNonCommercial:loadPlan.allowNonCommercial,
     backend:loadPlan.backend,
     signal:controller.signal,
     onProgress:info=>{
      const percent=Number.isFinite(info?.progress)?' '+Math.round(info.progress*100)+'%':'';
      status.textContent=uiLang==='ru'?'Загрузка модели голоса: '+String(info?.status||'обработка')+percent:'Voice model download: '+String(info?.status||'loading')+percent;
     }
    });
    refreshSceneVoiceControls();
   }
   if(!isLocalSceneVoiceReady({step:voiceStep}))throw new Error(uiLang==='ru'
    ?'Не все сцены готовы к озвучке. Проверь реплики и выбранный язык.'
    :'Not all scenes are ready for voice synthesis. Check dialogue and the selected language.');
   status.textContent=uiLang==='ru'?'Создаём голоса для всех сцен…':'Generating voices for all scenes…';
   setFilmProgress(3,filmProgressText('Озвучивание','Generating voices'),filmProgressText('Озвучка выполняется локально на устройстве.','Voice synthesis runs locally on this device.'));
   const handlers=universalCapabilityRegistry.createHandlers();
   await handlers['voice.generate']({
    plan:{sourceRequest:$('idea').value},
    step:voiceStep,
    signal:controller.signal,
    reportProgress:detail=>{status.textContent=String(detail||'Generating scene voices…');}
   });
  }
  if(mode==='huggingface'){
   const tooShortIndex=scenes.findIndex(scene=>{
    const seconds=Number(scene.durationSeconds??scene.duration??$('duration').value)||3;
    return seconds<0.5;
   });
   if(tooShortIndex>=0){
    const seconds=Number(scenes[tooShortIndex].durationSeconds??scenes[tooShortIndex].duration??$('duration').value)||3;
    throw new RangeError('Hugging Face Wan 2.2 requires at least 0.5 seconds per scene. Scene '+(tooShortIndex+1)+' is set to '+seconds+' seconds.');
   }
  }
  filmProgressSceneStates=scenes.map((scene,index)=>{
   const ready=sceneVideoCache.has(sceneVideoKey(index,scene));
   return {title:String(scene.title||('Scene '+(index+1))),status:ready?'skipped':'pending',progress:ready?100:0,label:ready?filmProgressText('Уже готово','Already ready'):filmProgressText('Ожидает','Waiting')};
  });
  renderFilmSceneProgress();
  setFilmProgress(0,filmProgressText('Подготовка сцен','Preparing scenes'),filmProgressText('Сцен: ','Scenes: ')+scenes.length);
  status.textContent='Подготовка '+scenes.length+' сцен к генерации…';
  const report=await generateStoryboardVideos({
   scenes,
   signal:controller.signal,
   hasVideo:(scene,index)=>sceneVideoCache.has(sceneVideoKey(index,scene)),
   onProgress:state=>{
    const index=state.currentIndex;
    if(Number.isInteger(index)&&filmProgressSceneStates[index]){
     if(state.stage==='completed')updateFilmSceneProgress(index,{status:'completed',progress:100,label:filmProgressText('Готово','Ready')});
     else if(state.stage==='failed')updateFilmSceneProgress(index,{status:'failed',progress:0,label:filmProgressText('Ошибка','Failed')});
     else if(state.stage==='skipped')updateFilmSceneProgress(index,{status:'skipped',progress:100,label:filmProgressText('Уже готово','Already ready')});
     else if(state.stage==='starting')updateFilmSceneProgress(index,{status:'generating',progress:null,label:filmProgressText('Запуск','Starting')});
    }
    const active=Number.isInteger(index)?filmProgressSceneStates[index]:null;
    updateFilmVideoProgress(active&&active.status==='generating'?active.progress:null,
      state.stage==='failed'?filmProgressText('Ошибка генерации сцены','Scene generation failed'):filmProgressText('Генерация видеосцен','Generating video scenes'));
    const finished=state.completed+state.skipped+state.failed;
    const current=Number.isInteger(index)?' · сцена '+(index+1)+'/'+state.total:'';
    const stage=state.stage==='completed'?'Готово':state.stage==='failed'?'Ошибка':state.stage==='skipped'?'Уже готово':state.stage==='starting'?'Запуск':'Обработка';
    status.textContent=stage+current+' · '+finished+'/'+state.total;
   },
   generateScene:async(scene,index,{signal})=>{
    const generationSceneId=String(scene.id||sceneMetadata[index]?.id||('scene_'+(index+1)));
    const generationToken=sceneGenerationGuard.capture(generationSceneId);
    const assertGenerationCurrent=()=>{if(!sceneGenerationGuard.isCurrent(generationToken))throw new Error('Параметры сцены изменились во время генерации. Устаревший результат отброшен — запусти создание этой сцены повторно.');};
    const assertSceneIdentityCurrent=()=>{assertGenerationCurrent();if(String(sceneMetadata[index]?.id||'')!==generationSceneId)throw new Error('Состав раскадровки изменился во время генерации. Устаревшая сцена отброшена.');};
    const meta={...scene,id:String(scene.id||sceneMetadata[index]?.id||('scene_'+(index+1)))};
    meta.imagePrompt=String(meta.imagePrompt||meta.prompt||meta.description||descriptions[index]||meta.title);
    meta.motionPrompt=String(meta.motionPrompt||meta.visibleAction||meta.description||descriptions[index]||meta.title);
    meta.visibleAction=String(meta.visibleAction||meta.motionPrompt);
    meta.camera=String(meta.camera||'Cinematic anime composition with clear subject movement');
    meta.characters=normalizeSceneCast('',meta.characters);
    let imageSource=resolveSceneImageSource({mode,sceneIndex:index,activeSceneIndex:sceneIndex,localImage:comfySourceImage,generatedImageUrl:meta.generatedImageUrl});
    if(imageSource.kind==='missing'&&mode!=='comfyui'){
     if(!$('hordeConsent').checked)throw new Error('Для отсутствующего изображения сцены '+(index+1)+' нужно отдельно подтвердить отправку текстового промпта в AI Horde.');
     updateFilmSceneProgress(index,{status:'generating',progress:null,label:filmProgressText('Создание изображения','Creating scene image')});
     updateFilmVideoProgress(null,filmProgressText('Подготовка изображений сцен','Preparing scene images'));
     status.textContent='Создаём изображение сцены '+(index+1)+' из '+scenes.length+' в AI Horde…';
     const imagePrompt=buildImageGenerationPrompt(meta,characterBible,{includeNegative:false,visualStyle:$('style').value});
     const referenceNotice=sceneHasSavedCharacterImageReference(meta,characterBible)?(uiLang==='ru'?'Фото-референсы не отправляются; AI Horde использует текстовые описания. ':'Photo references are not uploaded; AI Horde uses text descriptions only. '):'';
     status.textContent=referenceNotice+'Создаём изображение сцены '+(index+1)+' из '+scenes.length+' в AI Horde…';
     const imageResult=await generateImageWithHorde({prompt:imagePrompt,negativePrompt:meta.negativePrompt||'',...quality,seed:buildSceneIdentitySeed(meta,characterBible,$('style').value),signal,onProgress:queue=>{
      updateFilmSceneProgress(index,{status:'generating',progress:null,label:filmProgressText('Очередь AI Horde','AI Horde queue')});
      status.textContent=referenceNotice+'AI Horde · сцена '+(index+1)+' · очередь '+(queue.queuePosition===null?'?':queue.queuePosition);
     }});
     assertSceneIdentityCurrent();
     meta.generatedImageUrl=imageResult.imageUrl;meta.generatedImageSeed=imageResult.seed;meta.generatedImageModel=imageResult.model;meta.generatedImageWorker=imageResult.workerName;
     sceneMetadata[index]={...sceneMetadata[index],...meta};
     if(sceneIndex===index)renderGeneratedSceneImage();
     updateStoryQA();
     imageSource=resolveSceneImageSource({mode,sceneIndex:index,activeSceneIndex:sceneIndex,localImage:comfySourceImage,generatedImageUrl:meta.generatedImageUrl});
    }
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    assertSceneIdentityCurrent();
    updateFilmSceneProgress(index,{status:'generating',progress:null,label:filmProgressText('Подготовка к анимации','Preparing animation')});
    status.textContent=imageSource.kind==='missing'&&mode==='comfyui'?'Подготавливаем генерацию видео из текста для сцены '+(index+1)+'…':'Подготавливаем изображение сцены '+(index+1)+' для анимации…';
    let imageInput=imageSource.kind==='blob'?imageSource.image:imageSource.url;
    if(mode==='comfyui'&&imageSource.kind==='url'){
     const imageResponse=await fetch(imageSource.url,{signal});
     if(!imageResponse.ok)throw new Error('Не удалось получить изображение сцены (HTTP '+imageResponse.status+'). Проверь CORS или загрузи изображение вручную.');
     imageInput=await imageResponse.blob();
     if(!imageInput.size)throw new Error('Изображение сцены пустое.');
    }
    assertSceneIdentityCurrent();
    const taskType=resolveSceneVideoTaskType({mode,imageSourceKind:imageSource.kind});
    const prompt=taskType==='text-to-video'
     ?[buildImageGenerationPrompt(meta,characterBible,{includeNegative:false,visualStyle:$('style').value}),buildMotionGenerationPrompt(meta,characterBible)].filter(Boolean).join('\n\nMotion direction: ')
     :buildMotionGenerationPrompt(meta,characterBible);
    const requestedDuration=Math.max(0.25,Math.min(30,Number(meta.durationSeconds??meta.duration??$('duration').value)||3));
    // Wan 2.2 generates at most five seconds. Retiming fills the storyboard scene.
    const duration=mode==='huggingface'?Math.max(0.5,Math.min(5,requestedDuration)):requestedDuration;
    updateFilmSceneProgress(index,{status:'generating',progress:null,label:filmProgressText('Отправка в видеодвижок','Submitting to video engine')});
    const profileReferenceImages=mode==='comfyui'?await loadCharacterReferenceImagesForScene(meta):[];
    const referenceImages=mode==='comfyui'?profileReferenceImages.concat(comfyCharacterReferenceFiles.filter(Boolean)).slice(0,2):[];
    assertSceneIdentityCurrent();
    let referenceWarning='';
    const result=await generateVideoWithProvider(registry,provider.id,{taskType,prompt,negativePrompt:meta.negativePrompt||'',durationSeconds:duration,fps:16,aspectRatio:'source',...(taskType==='image-to-video'?{image:imageInput}:{}),seed:buildSceneIdentitySeed(meta,characterBible,$('style').value),referenceImages},{signal,onProgress:job=>{
     const providerPercent=readVideoProgressPercent(job);
     const providerStage=String(job.stage||'processing');
     if(providerStage==='warning'&&job.message){
      referenceWarning=String(job.message);
      status.textContent=(mode==='huggingface'?'Wan 2.2':'ComfyUI')+' · Внимание: '+referenceWarning;
      return;
     }
     const sceneLabel=providerStage==='queued'||providerStage==='pending'?filmProgressText('В очереди','Queued'):providerStage==='completed'?filmProgressText('Готово','Ready'):filmProgressText('Генерируется','Generating');
     updateFilmSceneProgress(index,{status:'generating',progress:providerPercent,label:sceneLabel+(providerPercent===null?' · '+providerStage:' · '+providerPercent+'%')});
     updateFilmVideoProgress(providerPercent,filmProgressText('Генерация видеосцен','Generating video scenes'));
     status.textContent=(mode==='huggingface'?'Hugging Face · ':'ComfyUI · ')+'сцена '+(index+1)+'/'+scenes.length+' · '+providerStage+(providerPercent===null?'': ' · '+providerPercent+'%')+(Number.isFinite(job.etaSeconds)?' · ETA '+Math.round(job.etaSeconds)+' сек.':'')+(Number.isFinite(job.queuePosition)?' · очередь '+job.queuePosition:'')+(referenceWarning?' · Внимание: '+referenceWarning:'');
    }});
    if(result.status!=='completed'||!result.video)throw new Error(result.error||'ComfyUI не вернул готовый видеофайл.');
    assertSceneIdentityCurrent();
    const key=sceneVideoKey(index,meta);
    const extension=result.video.type.includes('webm')?'.webm':result.video.type.includes('quicktime')?'.mov':'.mp4';
    const filename='dravex-scene-'+(index+1)+extension;
    const videoEntry=attachSceneVideo(index,meta,result.video,filename);
    try{
     await waitForSceneVideoReady(videoEntry.video,{timeoutMs:20000,signal});
     assertSceneIdentityCurrent();
    }catch(readinessError){
     if(sceneVideoCache.get(key)===videoEntry)sceneVideoCache.delete(key);
     disposeSceneVideoEntry(videoEntry);
     throw new Error('Сцена '+(index+1)+' вернула видео, которое браузер не смог декодировать: '+(readinessError.message||'unknown decode error'));
    }
    const persistence=await persistSceneVideoBestEffort(sceneVideoStorage,key,result.video,filename,{generationRevision:generationToken.storageRevision});
    if(!sceneGenerationGuard.isCurrent(generationToken)){await sceneVideoStorage.deleteIfRevision(key,generationToken.storageRevision);if(sceneVideoCache.get(key)===videoEntry){sceneVideoCache.delete(key);disposeSceneVideoEntry(videoEntry);}throw new Error('Параметры сцены изменились во время сохранения. Устаревший клип удалён.');}
    if(!persistence.persisted)console.warn('Generated scene video is kept in memory but could not be saved for reload:',persistence.error);
    if(sceneIndex===index)renderComfySceneVideo();
    renderScenes();
    if(!playing)draw();
    return persistence.persisted?result:{...result,storageWarning:persistence.error};
   }
  });
  if(report.cancelled){
   filmProgressTracking=false;
   setFilmProgress(Math.floor(((report.completed+report.skipped)/report.total)*85),filmProgressText('Создание остановлено','Generation cancelled'),filmProgressText('Готовые сцены сохранены. Можно продолжить позже.','Completed scenes are saved. You can resume later.'));
   status.textContent='Создание остановлено. Уже готовые сцены сохранены; можно продолжить позже.';return;
  }
  const persistenceWarnings=report.results.filter(item=>item.status==='completed'&&item.result?.storageWarning).map(item=>'сцена '+(item.index+1)+': '+item.result.storageWarning);
  const persistenceNote=persistenceWarnings.length?' Видео останутся доступны только в этой вкладке до закрытия: '+persistenceWarnings.join(' · ')+'.':'';
  if(report.failed){
   filmProgressTracking=false;
   const failed=report.results.filter(item=>item.status==='failed').map(item=>'сцена '+(item.index+1)+': '+item.error).join(' · ');
   status.textContent='Готово '+(report.completed+report.skipped)+' из '+report.total+'. Не удалось создать '+report.failed+' сцен: '+failed+'. Исправь ошибки и запусти повторно — готовые сцены будут пропущены.'+persistenceNote;
   setFilmProgress(Math.floor(((report.completed+report.skipped)/report.total)*85),filmProgressText('Есть ошибки сцен','Scene errors'),status.textContent);
   return;
  }
  setFilmProgress(85,filmProgressText('Сцены готовы · сборка WebM','Scenes ready · assembling WebM'),filmProgressText('Все видеосцены созданы. Начинается запись итогового мультфильма.','All scene videos are ready. Final film recording is starting.'));
  status.textContent='Все '+report.total+' видеосцен готовы. Собираем итоговый мультфильм…'+persistenceNote;
  const exportResult=await exportFilm({signal:controller.signal,requireAllVideos:true,download:true});
  if(exportResult?.status!=='completed')throw new Error(exportResult?.reason||'Final WebM export did not complete.');
 }catch(error){
  filmProgressTracking=false;
  setFilmProgress($('fullFilmProgress').value,filmProgressText('Ошибка генерации','Generation failed'),error.message||'Неизвестная ошибка');
  status.textContent=(error.name==='AbortError'?'Создание отменено: ':'Не удалось создать мультфильм: ')+(error.message||'Неизвестная ошибка');
 }finally{
  fullFilmAbortController=null;cancel.hidden=true;button.disabled=false;
  $('checkComfyConnection').disabled=false;updateComfyAnimateAvailability();
 }
});

$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?tr('pauseButton'):tr('playButton');syncSceneVideoPlayback({cache:sceneVideoCache,activeKey:String(sceneMetadata[sceneIndex]?.id||('scene-index-'+sceneIndex)),shouldPlay:playing});if(playing){if(!raf)draw();void startSceneVoicePreview(sceneIndex)}else{void stopSceneVoicePreview()}};
$('downloadCharacterMotionEvidence').onclick=async()=>{
 const button=$('downloadCharacterMotionEvidence');
 if(button.disabled||!lastCharacterMotionAuditEvidence.length)return;
 button.disabled=true;
 const previousLabel=button.textContent;
 button.textContent=uiLang==='ru'?'Готовим таблицу кадров…':'Preparing frame sheet…';
 try{
  const blob=await createCharacterBodyPartContactSheet(lastCharacterMotionAuditEvidence);
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download='dravex-character-motion-evidence.jpg';
  link.hidden=true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
  button.textContent=uiLang==='ru'?'Таблица кадров скачана':'Evidence sheet downloaded';
 }catch(error){
  console.warn('Could not create character motion evidence:',error);
  button.textContent=(uiLang==='ru'?'Ошибка: ':'Error: ')+String(error?.message||'');
 }finally{
  setTimeout(()=>{
   button.disabled=lastCharacterMotionAuditEvidence.length===0;
   button.textContent=previousLabel;
  },1800);
 }
};
$('auditAllAnimations').addEventListener('click',()=>{
 const button=$('auditAllAnimations');
 const status=$('animationCompatibilityStatus');
 button.disabled=true;
 status.textContent=uiLang==='ru'?'Проверяем совместимость анимаций во всех сценах…':'Checking animation compatibility across all scenes…';
 try{
  const report=auditAnimationCompatibility(sceneMetadata);
  const label=report.status==='compatible'
   ?(uiLang==='ru'?'Совместимость подтверждена':'Compatibility passed')
   :report.status==='compatible-with-warnings'
    ?(uiLang==='ru'?'Совместимо с предупреждениями':'Compatible with warnings')
    :(uiLang==='ru'?'Обнаружены несовместимости':'Compatibility issues found');
  const details=report.issues.slice(0,12).map(item=>
   'Scene '+(item.sceneIndex+1)+' · '+item.severity+' · '+item.code+': '+item.message
  );
  status.textContent=label+'. '+(uiLang==='ru'
   ?'Сцен: ':'Scenes: ')+report.sceneCount+' · '+(uiLang==='ru'?'скелетов: ':'body rigs: ')+report.rigCount
   +' · '+(uiLang==='ru'?'лицевых ригов: ':'facial rigs: ')+report.facialRigCount
   +' · '+(uiLang==='ru'?'проверок пресетов: ':'preset checks: ')+report.presetCount
   +' · '+(uiLang==='ru'?'ошибок: ':'errors: ')+report.errorCount
   +' · '+(uiLang==='ru'?'предупреждений: ':'warnings: ')+report.warningCount
   +(details.length?'\n'+details.join('\n'):'')
   +'\n'+(uiLang==='ru'
    ?'Проверены связи персонажей, костей, лицевых ригов и временные шкалы. Визуальное качество кадров этой проверкой не подтверждается.'
    :'Character, bone, facial-rig and timeline references were checked. This does not certify visual frame quality.');
 }catch(error){
  status.textContent=(uiLang==='ru'?'Ошибка глобальной проверки: ':'Global audit failed: ')+String(error?.message||error);
 }finally{
  button.disabled=false;
 }
});
$('analyzeCharacterMotion').onclick=()=>{
 if(characterMotionAudit){
  characterMotionAudit=null;
  $('characterMotionAuditStatus').textContent=uiLang==='ru'?'Проверка движения отменена.':'Character motion check cancelled.';
  return;
 }
 const meta=sceneMetadata[sceneIndex]||{};
 if(!(Array.isArray(meta.characterLayers)&&meta.characterLayers.length)&&!(Array.isArray(meta.characterRigs)&&meta.characterRigs.length)){
  $('characterMotionAuditStatus').textContent=uiLang==='ru'
   ?'Сначала добавь к сцене слой персонажа или проверенный скелет. Процедурный демонстрационный герой пока не входит в эту проверку.'
   :'Attach a character sprite layer or validated rig to this scene first. The procedural demo character is not included in this check yet.';
  return;
 }
 lastCharacterMotionAuditEvidence = [];
 $('downloadCharacterMotionEvidence').disabled = true;
 characterMotionAudit={sceneIndex,startProgress:null,targets:[],nextSample:0,frames:new Map(),backgroundFrames:new Map(),backgroundControlIds:null,blockedBackgroundControlIds:new Set(),bodyPartFrames:new Map()};
 sceneMotionSceneIndex=-1;
 $('characterMotionAuditStatus').textContent=uiLang==='ru'
  ?'Проверка подготовлена. Запусти предпросмотр сцены — будут собраны 5 кадров итоговой композиции.'
  :'Audit armed. Play this scene to capture five frames of the final composition.';
 if(!playing)draw();
};
$('save').onclick=()=>{const saved=writeLocalStorage('dravex-cartoon-draft',JSON.stringify({idea:$('idea').value,character:$('character').value,style:$('style').value,canvasFormat:activeCanvasFormat,imageQuality:$('imageQuality').value,duration:$('duration').value,language:$('language').value,uiLanguage:uiLang,titles,descriptions,sceneMetadata,characterBible,sceneIndex}));$('status').textContent=saved?tr('saved'):tr('storageError')};
async function exportFilm({signal=null,requireAllVideos=false,download=true,onProgress=null}={}){
  if(!canvas.captureStream||!window.MediaRecorder){
    $('status').textContent=tr('unsupported');
    if(filmProgressTracking){setFilmProgress($('fullFilmProgress').value,filmProgressText('Экспорт не поддерживается','Export unsupported'),tr('unsupported'));filmProgressTracking=false;}
    return {status:'unsupported',reason:'MediaRecorder or canvas capture is unavailable.'};
  }
  const button=$('export');
  if(button.disabled)return {status:'busy',reason:'Another film export is already running.'};
  const exportScenes=titles.map((title,index)=>{const meta=sceneMetadata[index]||{title};const voiceDuration=Number(meta.voiceTimeline?.totalDurationMs)||0;if(voiceDuration>30000)throw new RangeError('Dialogue in scene '+(index+1)+' exceeds the 30-second scene export limit.');const requested=Number(meta.durationSeconds??meta.duration??$('duration').value)||3;return {...meta,durationSeconds:Math.max(requested,voiceDuration/1000)};});
  const timeline=buildExportTimeline(exportScenes,$('duration').value);
  if(!timeline.segments.length){
    $('status').textContent=uiLang==='ru'?'Сначала создай раскадровку.':'Create a storyboard before exporting.';
    if(filmProgressTracking){setFilmProgress($('fullFilmProgress').value,filmProgressText('Нет сцен для экспорта','No scenes to export'),$('status').textContent);filmProgressTracking=false;}
    return {status:'failed',reason:'There are no storyboard scenes to export.'};
  }
  button.disabled=true;
  $('audioFile').disabled=true;
  $('audioVolume').disabled=true;
  const wasPlaying=playing;
  const originalSceneIndex=sceneIndex;
  const sceneTimers=[];
  let stream=null,recorder=null,stopTimer=null,cleaned=false,recorderFailed=false,audioSession=null,exportProgressTimer=null,exportStartedAtMs=null;
  const chunks=[];
  let audioScheduledStartAtMs=null;
  let requiredSceneSnapshot=null;
  let resolveCompletion,rejectCompletion,completionSettled=false;
  const completion=new Promise((resolve,reject)=>{resolveCompletion=resolve;rejectCompletion=reject;});
  const settleCompletion=(handler,value)=>{if(completionSettled)return;completionSettled=true;handler(value);};
  const checkAbort=()=>{if(signal?.aborted){const error=new Error('Full-film composition was cancelled.');error.name='AbortError';throw error;}};
  const exportSceneMetadata=()=>timeline.segments.map(segment=>sceneMetadata[segment.sceneIndex]||{});
  const getExportSceneVideo=(meta,index)=>{
    const sceneIndex=timeline.segments[index]?.sceneIndex??index;
    const key=String(meta?.id||('scene-index-'+sceneIndex));
    return sceneVideoCache.get(key)?.video||null;
  };
  const assertRequiredSceneSnapshot=()=>{
    if(requireAllVideos&&(!requiredSceneSnapshot||!matchesFilmSceneSnapshot(requiredSceneSnapshot,exportSceneMetadata(),getExportSceneVideo,isSceneVideoDecoded))){
      throw new Error('Scene videos or scene order changed during film export. Restore the original clips and try again.');
    }
  };
  const onSignalAbort=()=>{if(recorder&&recorder.state!=='inactive'){recorderFailed=true;try{recorder.stop();}catch{}}};
  signal?.addEventListener('abort',onSignalAbort,{once:true});
  let lipSyncSkippedTracks=0;
  const cleanup=()=>{
    if(cleaned)return;
    cleaned=true;
    signal?.removeEventListener('abort',onSignalAbort);
    if(stopTimer!==null)clearTimeout(stopTimer);
    if(exportProgressTimer!==null)clearInterval(exportProgressTimer);
    sceneTimers.forEach(timer=>clearTimeout(timer));
    if(stream)stream.getTracks().forEach(track=>track.stop());
    if(audioSession)void audioSession.cleanup();
    exportMouthTracks=[];exportMouthOriginTimeMs=null;
    sceneIndex=originalSceneIndex;
    playing=wasPlaying;
    syncSceneVideoPlayback({cache:sceneVideoCache,activeKey:String(sceneMetadata[sceneIndex]?.id||('scene-index-'+sceneIndex)),shouldPlay:playing});
    $('play').textContent=playing?tr('pauseButton'):tr('playButton');
    renderScenes();
    syncSceneEditor();
    if(playing&&!raf)draw();
    if(playing)void startSceneVoicePreview(sceneIndex);
    button.disabled=false;
    $('audioFile').disabled=false;
    $('audioVolume').disabled=false;
  };
  try{
    checkAbort();
    await stopSceneVoicePreview();
    checkAbort();
    await sceneVideoRestorePromise;
    checkAbort();
    if(requireAllVideos){
      requiredSceneSnapshot=captureFilmSceneSnapshot(exportSceneMetadata(),getExportSceneVideo);
      assertRequiredSceneSnapshot();
    }
    // Freeze preview while export assets/audio are prepared. Otherwise async setup
    // time advances the scene clock before the recorder has even started.
    playing=false;
    if(raf)cancelAnimationFrame(raf);
    raf=0;
    animationClock.advance(performance.now(),false);
    syncSceneVideoPlayback({cache:sceneVideoCache,activeKey:String(sceneMetadata[sceneIndex]?.id||('scene-index-'+sceneIndex)),shouldPlay:false});
    $('status').textContent=uiLang==='ru'?'Ожидание готовности медиа сцен…':'Waiting for scene media to become ready…';
    const readinessTasks=[];
    for(const segment of timeline.segments){
      const meta=sceneMetadata[segment.sceneIndex]||{};
      const key=String(meta.id||('scene-index-'+segment.sceneIndex));
      const entry=sceneVideoCache.get(key);
      if(entry?.video){
        readinessTasks.push(rewindSceneVideoAndWait(entry.video,{timeoutMs:12000,signal}));
      }
      const imageUrl=String(meta.generatedImageUrl||'').trim();
      if(imageUrl&&!entry?.video){
        getLoadedSceneImage(imageUrl);
        const imageEntry=sceneImageCache.get(imageUrl);
        if(!imageEntry)throw new Error('Could not initialize generated image for scene '+(segment.sceneIndex+1)+'.');
        readinessTasks.push(waitForSceneImageReady(imageEntry.image,{timeoutMs:12000}));
      }
    }
    await Promise.all(readinessTasks);
    checkAbort();
    assertRequiredSceneSnapshot();
    sceneIndex=timeline.segments[0].sceneIndex;
    sceneMotionSceneIndex=-1;
    stream=canvas.captureStream(24);
    const musicFile=$('audioFile').files?.[0]||null;
    const voiceTracks=[];
    let voiceStorage=null;
    for(const segment of timeline.segments){
      const meta=sceneMetadata[segment.sceneIndex]||{};
      const cues=Array.isArray(meta.voiceCues)?meta.voiceCues:[];
      if(!cues.length)continue;
      if(!meta.voiceTimeline||!Array.isArray(meta.voiceTimeline.tracks))throw new Error('Scene '+(segment.sceneIndex+1)+' has voice files but no valid voice timeline. Regenerate its dialogue.');
      if(!voiceStorage)voiceStorage=createVoiceAudioStorage();
      for(const cue of cues){
        if(cue.language&&cue.language!==storyLanguage())throw new Error('Scene '+(segment.sceneIndex+1)+' has dialogue generated for a different story language. Regenerate its voices first.');
        if(!/^[a-f0-9]{64}$/i.test(String(cue.audioHash||'')))throw new Error('Scene '+(segment.sceneIndex+1)+' contains an invalid dialogue audio reference.');
        const record=await voiceStorage.get(cue.audioHash);
        checkAbort();
        if(!record?.blob)throw new Error('A generated voice file is missing from this device. Regenerate the dialogue before exporting.');
        const startMs=segment.startMs+(Number(cue.startFrame)||0)*(1000/24);
        if(startMs+Number(cue.durationMs||0)>segment.endMs+35)throw new Error('Dialogue exceeds its scene export interval. Regenerate the scene voice timeline.');
        voiceTracks.push({cueId:cue.cueId,blob:record.blob,startMs,durationMs:Number(cue.durationMs),sceneIndex:segment.sceneIndex,characterId:String(cue.characterId||cue.characterName||"Narrator"),characterName:String(cue.characterName||cue.characterId||"Narrator"),text:String(cue.text||""),language:String(cue.language||storyLanguage()),phonemeChunks:Array.isArray(cue.phonemeChunks)?cue.phonemeChunks:[],visemeEvents:Array.isArray(cue.visemeEvents)?cue.visemeEvents:[]});
      }
    }
    exportMouthTracks=[];
    let lipSyncEligibleTrackCount=0;
    if(voiceTracks.length){
      const mainCharacterKey=String($("character").value||"").trim().toLowerCase();
      const mainCharacterVoiceTracks=voiceTracks.filter(track=>{const meta=sceneMetadata[track.sceneIndex]||{};const hasFacialRig=sceneHasFacialRigForSpeaker(meta.characterFacialRigs,track.characterId,track.characterName);return track.characterName.trim().toLowerCase()===mainCharacterKey||hasFacialRig;});
      // Generated images/videos are valid lip-sync backgrounds too. The facial
      // rig compositor overlays mouth parts on top of the scene during canvas export.
      const lipSyncRenderableTracks=mainCharacterVoiceTracks;
      lipSyncEligibleTrackCount=lipSyncRenderableTracks.length;
      const AudioContextClass=window.AudioContext||window.webkitAudioContext;
      if(AudioContextClass&&lipSyncRenderableTracks.length){
        const decodeContext=new AudioContextClass();
        try{
          for(const track of lipSyncRenderableTracks){
            try{
              const decoded=await decodeContext.decodeAudioData(await track.blob.arrayBuffer());
              checkAbort();
              const channels=Array.from({length:decoded.numberOfChannels},(_,channel)=>decoded.getChannelData(channel));
              const envelope=buildAudioMouthEnvelope({channels,sampleRate:decoded.sampleRate,fps:24});
              const visemes=buildVisemeTimeline({text:track.text,durationMs:envelope.durationMs,language:track.language,fps:24,phonemeChunks:track.phonemeChunks,visemeEvents:track.visemeEvents});
              exportMouthTracks.push({cueId:track.cueId,sceneIndex:track.sceneIndex,characterId:track.characterId,characterName:track.characterName,startMs:track.startMs,envelope,visemes});
            }catch(decodeError){lipSyncSkippedTracks++;console.warn("DRAVEX lip-sync analysis skipped a dialogue track:",decodeError);}
          }
        }finally{await decodeContext.close().catch(()=>{});}
      }else if(lipSyncRenderableTracks.length){
        lipSyncSkippedTracks=lipSyncRenderableTracks.length;
      }
    }
    if(musicFile||voiceTracks.length){
      const audioElement=musicFile?new Audio(selectedMusicUrl):null;
      if(audioElement){audioElement.loop=true;audioElement.preload='auto';}
      audioSession=await createAudioExportSession({videoStream:stream,audioElement,volume:Number($('audioVolume').value)/100,voiceTracks,voiceVolume:0.9});
      checkAbort();
      stream=audioSession.stream;
      const audioStartInfo=await audioSession.start();
      checkAbort();
      audioScheduledStartAtMs=Number.isFinite(audioStartInfo?.scheduledStartAtMs)?audioStartInfo.scheduledStartAtMs:null;
    }
    const mimeTypes=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
    const mimeType=mimeTypes.find(type=>MediaRecorder.isTypeSupported(type));
    if(!mimeType)throw new Error('No supported WebM codec');
    validateExportTracks(stream,{audioRequired:Boolean(musicFile||voiceTracks.length)});
    recorder=new MediaRecorder(stream,{mimeType});
    recorder.ondataavailable=event=>{if(event.data&&event.data.size>0)chunks.push(event.data)};
    recorder.onerror=()=>{
      recorderFailed=true;
      const error=new Error('MediaRecorder failed before producing a complete video.');
      settleCompletion(rejectCompletion,error);
      cleanup();
      $('status').textContent=tr('exportFailed');
      if(filmProgressTracking){setFilmProgress($('fullFilmProgress').value,filmProgressText('Ошибка сборки WebM','WebM assembly failed'),tr('exportFailed'));filmProgressTracking=false;}
    };
    recorder.onstop=async()=>{
      try{
        if(signal?.aborted){const error=new Error('Full-film composition was cancelled.');error.name='AbortError';throw error;}
        if(recorderFailed)throw new Error('MediaRecorder failed before producing a complete video.');
        assertRequiredSceneSnapshot();
        const blob=new Blob(chunks,{type:recorder.mimeType||'video/webm'});
        if(!blob.size)throw new Error('Recorder produced an empty file');
        const decoded=await waitForExportVideoReady(blob);
        if(signal?.aborted){const error=new Error('Full-film composition was cancelled.');error.name='AbortError';throw error;}
        assertRequiredSceneSnapshot();
        const url=URL.createObjectURL(blob);
        if(finalFilmObjectUrl)URL.revokeObjectURL(finalFilmObjectUrl);
        finalFilmObjectUrl=url;
        $('finalFilmPlayer').src=url;$('finalFilmPlayer').hidden=false;$('finalFilmResult').hidden=false;$('finalFilmDownload').href=url;
        const anchor=document.createElement('a');
        anchor.href=url;
        anchor.download=$('finalFilmDownload').download||'dravex-cartoon-film.webm';
        if(download){document.body.appendChild(anchor);anchor.click();anchor.remove();}
        const lipSyncReport=buildLipSyncQualityReport({voiceTracks,eligibleTrackCount:lipSyncEligibleTrackCount,analyzedTracks:exportMouthTracks,skippedTracks:lipSyncSkippedTracks});
        const lipSyncWarnings=[];
        if(lipSyncReport.skippedTrackCount)lipSyncWarnings.push(uiLang==='ru'
          ?'Анализ аудио пропущен для '+lipSyncReport.skippedTrackCount+' реплик.'
          :'Audio analysis was skipped for '+lipSyncReport.skippedTrackCount+' dialogue line(s).');
        if(lipSyncReport.approximateTrackCount)lipSyncWarnings.push(uiLang==='ru'
          ?'Приблизительная синхронизация по тексту: '+lipSyncReport.approximateTrackCount+' реплик.'
          :'Approximate text-based lip-sync: '+lipSyncReport.approximateTrackCount+' dialogue line(s).');
        if(lipSyncReport.notSelectedTrackCount)lipSyncWarnings.push(uiLang==='ru'
          ?'Липсинк не анализировался для '+lipSyncReport.notSelectedTrackCount+' реплик: персонажи не входят в текущую область обработки.'
          :'Lip-sync was not analyzed for '+lipSyncReport.notSelectedTrackCount+' dialogue line(s): those speakers are outside the current processing scope.');
        const lipSyncWarning=lipSyncWarnings.length?' · '+lipSyncWarnings.join(' '):'';
        $('status').textContent=uiLang==='ru'
          ?'Экспортировано '+timeline.segments.length+' сцен · '+timeline.totalDurationSeconds.toFixed(2)+' сек.'+(voiceTracks.length?' · реплик: '+voiceTracks.length:'')+lipSyncWarning
          :'Exported '+timeline.segments.length+' scenes · '+timeline.totalDurationSeconds.toFixed(2)+' sec.'+(voiceTracks.length?' · dialogue lines: '+voiceTracks.length:'')+lipSyncWarning;
        if(filmProgressTracking){setFilmProgress(100,filmProgressText('Мультфильм готов','Film ready'),filmProgressText('WebM создан и добавлен в предпросмотр.','WebM was created and added to the preview.'));filmProgressTracking=false;}
        settleCompletion(resolveCompletion,{status:'completed',filename:anchor.download,mimeType:blob.type||'video/webm',size:blob.size,sceneCount:timeline.segments.length,durationMs:timeline.totalDurationMs,decoded:true,width:decoded.width,height:decoded.height});
      }catch(error){
        console.error('DRAVEX export failed:',error);
        settleCompletion(rejectCompletion,error);
        $('status').textContent=tr('exportFailed');
        if(filmProgressTracking){setFilmProgress($('fullFilmProgress').value,filmProgressText('Ошибка сборки WebM','WebM assembly failed'),error.message||tr('exportFailed'));filmProgressTracking=false;}
      }finally{
        cleanup();
      }
    };
    // Start the animation clock and canvas recording together, after every
    // asynchronous preparation step has completed. The first captured frame is
    // therefore scene time zero, not the time spent preparing audio/assets.
    sceneMotionSceneIndex=-1;
    sceneMotionStartTimeMs=0;
    rigPreviewProgress=null;
    animationClock.reset(0);
    frame=0;
    playing=true;
    // Mark export mode before the first draw. draw() must not restart/seek the
    // active clip after preflight has decoded its first frame, or the snapshot
    // can become temporarily undecoded and abort an otherwise valid export.
    exportMouthOriginTimeMs=performance.now();
    syncSceneVideoPlayback({cache:sceneVideoCache,activeKey:String(sceneMetadata[sceneIndex]?.id||('scene-index-'+sceneIndex)),shouldPlay:true});
    $('play').textContent=tr('pauseButton');
    if(raf)cancelAnimationFrame(raf);
    raf=0;
    draw();
    assertRequiredSceneSnapshot();
    recorder.start(250);
    if(audioScheduledStartAtMs!==null){
      const mouthStartOffsetMs=getAudioTimelineOffsetMs(audioScheduledStartAtMs,exportMouthOriginTimeMs);
      exportMouthTracks=exportMouthTracks.map(track=>({...track,startMs:track.startMs+mouthStartOffsetMs}));
    }
    $('status').textContent=uiLang==='ru'
      ?'Записываем '+timeline.segments.length+' сцен'+(voiceTracks.length?' · реплик: '+voiceTracks.length:'')+'…'
      :'Recording '+timeline.segments.length+' scenes'+(voiceTracks.length?' · dialogue lines: '+voiceTracks.length:'')+'…';
    if(filmProgressTracking||typeof onProgress==='function'){
      exportStartedAtMs=performance.now();
      if(filmProgressTracking)setFilmProgress(85,filmProgressText('Сборка WebM','Assembling WebM'),filmProgressText('Запись итогового видео…','Recording the final video…'));
      exportProgressTimer=setInterval(()=>{
        const fraction=Math.max(0,Math.min(1,(performance.now()-exportStartedAtMs)/Math.max(1,timeline.totalDurationMs)));
        const percent=85+Math.min(14,Math.floor(fraction*14));
        if(filmProgressTracking)setFilmProgress(percent,filmProgressText('Сборка WebM','Assembling WebM'),filmProgressText('Записано примерно ','Recorded approximately ')+Math.round(fraction*100)+'%');
        onProgress?.({phase:'recording',percent,elapsedMs:Math.round(fraction*timeline.totalDurationMs),totalDurationMs:timeline.totalDurationMs});
      },250);
    }
    timeline.segments.slice(1).forEach(segment=>{
      const timer=setTimeout(()=>{
        sceneIndex=segment.sceneIndex;
        onProgress?.({phase:'scene',sceneIndex:segment.sceneIndex,sceneCount:timeline.segments.length,percent:Math.round(segment.startMs/Math.max(1,timeline.totalDurationMs)*100)});
        $('status').textContent=uiLang==='ru'
          ?'Записываем сцену '+(segment.sceneIndex+1)+' из '+timeline.segments.length+'…'
          :'Recording scene '+(segment.sceneIndex+1)+' of '+timeline.segments.length+'…';
      },segment.startMs);
      sceneTimers.push(timer);
    });
    stopTimer=setTimeout(()=>{
      if(recorder&&recorder.state!=='inactive')recorder.stop();
    },timeline.totalDurationMs+250);
    return await completion;
  }catch(error){
    console.error('DRAVEX export failed:',error);
    settleCompletion(rejectCompletion,error);
    cleanup();
    $('status').textContent=tr('exportFailed');
    if(filmProgressTracking){setFilmProgress($('fullFilmProgress').value,filmProgressText('Ошибка подготовки WebM','WebM preparation failed'),error.message||tr('exportFailed'));filmProgressTracking=false;}
    return {status:signal?.aborted?'cancelled':'failed',reason:String(error?.message||'Film export failed').slice(0,500)};
  }
}
$('export').onclick=()=>{void exportFilm().catch(error=>{console.error('DRAVEX export failed:',error);$('status').textContent=tr('exportFailed');})};
try{const saved=JSON.parse(readLocalStorage('dravex-cartoon-draft')||'null');if(saved){$('idea').value=saved.idea||$('idea').value;activeCanvasFormat=normalizeCanvasFormat(saved.canvasFormat||activeCanvasFormat);$('uiLanguage').value=saved.uiLanguage||uiLang;uiLang=saved.uiLanguage||uiLang;$('character').value=saved.character||'';$('style').value=saved.style||'Storybook';$('imageQuality').value=saved.imageQuality||'standard';$('duration').value=saved.duration||'3';$('language').value=saved.language||'en';if(Array.isArray(saved.titles)&&Array.isArray(saved.descriptions)&&saved.titles.length===saved.descriptions.length&&saved.titles.length>0&&saved.titles.length<=12){titles=saved.titles.map(v=>String(v).slice(0,80));descriptions=saved.descriptions.map(v=>String(v).slice(0,500));sceneMetadata=ensureSceneIds(Array.isArray(saved.sceneMetadata)&&saved.sceneMetadata.length===titles.length?saved.sceneMetadata.map(item=>item&&typeof item==='object'?{...item}:{}):titles.map((title,index)=>({title,description:descriptions[index],prompt:descriptions[index],visibleAction:descriptions[index],camera:''})));characterBible=Array.isArray(saved.characterBible)?saved.characterBible.filter(entry=>entry&&typeof entry==='object').slice(0,20).map(entry=>({characterId:String(entry.characterId||'').slice(0,120),visualDescription:String(entry.visualDescription||'').slice(0,700),clothing:String(entry.clothing||'').slice(0,400),colors:String(entry.colors||'').slice(0,200),distinctiveFeatures:String(entry.distinctiveFeatures||'').slice(0,400)})):[];if(!characterBible.length)characterBible=upsertCharacterReference([],{characterId:$('character').value.trim()||''});sceneIndex=Math.min(Math.max(0,Number(saved.sceneIndex)||0),titles.length-1)}$('status').textContent=tr('restored')}}catch(e){}
applyCanvasFormat();applyLanguage();renderScenes();applySceneEditorLanguage();syncSceneEditor();draw();sceneVideoRestorePromise=restorePersistedSceneVideos();
