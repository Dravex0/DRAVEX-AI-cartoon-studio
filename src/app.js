import { validateStoryScenes } from "./story-qa.js";
import { buildStoryboardFromText } from "./storyboard-generator.js";
import { resolveStoryProtagonist } from "./story-protagonist.js";
import { calculateCinematicShot } from "./director-engine.js";
import { detectDeviceCapabilities } from "./device-capabilities.js";
import { createLocalTransformersRuntime } from "./transformers-local-runtime.js";
import { directStoryboardWithLocalAI } from "./local-story-director.js";
import { generateImageWithHorde } from "./ai-horde-image-provider.js";
import { getCanvasDimensions, getImageGenerationDimensions, normalizeCanvasFormat } from "./canvas-format.js";
import { getSceneComposition } from "./scene-layout.js";
import { drawImageCover } from "./image-frame.js";
import { drawCharacterLayers } from "./scene-character-layers.js";
import { validateCharacterRigTimeline, sampleCharacterRigTimeline } from "./character-rig-timeline.js";
import { createCharacterRigMotionPreset, listCharacterRigMotionPresets } from "./character-rig-motion-presets.js";
import { validateCharacterRig, normalizeCharacterRigPoses, characterRigPosesFor } from "./character-rig.js";
import { upsertCharacterMotionPhase } from "./character-motion-editor.js";
import { planCharacterMotionFromActionTimeline } from "./character-motion-planner.js";
import { attachCharacterSpriteToSceneLayers } from "./scene-character-layers.js";
import { createSceneId, ensureSceneIds } from "./scene-identity.js";
import { formatDialogueLines, parseDialogueLines } from "./dialogue-lines.js";
import { createBrowserLocalTtsEngine } from "./browser-local-tts-engine.js";
import { createTimestampedKokoroEngine } from "./timestamped-kokoro-engine.js";
import { createVoiceAudioStorage } from "./voice-audio-storage.js";
import { assignCharacterVoices, buildSceneVoiceTimeline, normalizeSpeakerKey } from "./scene-voice-workflow.js";
import { createSceneVideoStorage } from "./scene-video-storage.js";
import { createFacialAssetStorage } from "./facial-asset-storage.js";
import { generateStoryboardVideos, readVideoProgressPercent } from "./scene-video-batch.js";
import { createHuggingFaceZeroGPUVideoProvider, HUGGING_FACE_ZERO_GPU_SPACE_ID } from "./huggingface-zerogpu-video-provider.js";
import { syncSceneVideoPlayback } from "./scene-video-transport.js";
import { waitForSceneVideoReady, waitForSceneImageReady } from "./scene-video-readiness.js";
import { createAnimationClock } from "./animation-clock.js";
import { getPromptCameraTransform } from "./prompt-camera-motion.js";
import { detectSceneActionForScene } from "./scene-action.js";
import { buildExportTimeline } from "./export-timeline.js";
import { buildAudioMouthEnvelope, sampleAudioMouthEnvelope } from "./audio-mouth-envelope.js";
import { sampleCharacterFacialLipSync } from "./facial-lipsync-runtime.js";
import { getAudioTimelineOffsetMs } from "./audio-clock-alignment.js";
import { buildVisemeTimeline, sampleVisemeTimeline } from "./viseme-timeline.js";
import { createAudioExportSession } from "./audio-export.js";
import { createVoicePreviewSession } from "./audio-preview.js";
import { upsertCharacterFacialPart, applyCharacterFacialExpressionToScene } from "./character-facial-editor.js";
import { checkComfyUIConnection, createComfyUIVideoProvider } from "./comfyui-video-provider.js";
import { createVideoProviderRegistry, generateVideoWithProvider } from "./video-provider-contract.js";
import { buildImageGenerationPrompt, buildMotionGenerationPrompt, validateSceneProductionReadiness } from "./scene-production.js";
import { buildCharacterSpriteAssetPlan } from "./character-sprite-asset-plan.js";
import { generateCharacterSpriteAsset } from "./character-sprite-generation.js";
import { verifySpriteTransparency } from "./character-sprite-verification.js";
import { upsertCharacterReference, mergeCharacterReferences } from "./character-reference.js";
import { prepareStoryCharacterContext } from "./story-character-context.js";
import { normalizeSceneCast } from "./scene-cast.js";
import { inferStoryboardStateChanges } from "./scene-state-changes.js";
import { buildStoryEventChain } from "./story-event-chain.js";
const localTextRuntime = createLocalTransformersRuntime();
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
const animationClock=createAnimationClock();let exportMouthTracks=[],exportMouthOriginTimeMs=null;let previewMouthTracks=[],previewMouthOriginTimeMs=null,previewVoiceSession=null,previewVoiceRequestToken=0;let sceneMotionSceneIndex=-1,sceneMotionStartTimeMs=0,rigPreviewProgress=null;let titles=[...translations[uiLang].sceneTitles];let descriptions=[...translations[uiLang].sceneDescriptions];let sceneMetadata=titles.map((title,index)=>({title,description:descriptions[index],prompt:descriptions[index],visibleAction:descriptions[index],camera:''}));let characterBible=[];let currentStoryboardPlan=null;
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
const magicParticles=new ParticleEmitter();
const sceneImageCache=new Map();
const sceneVideoCache=new Map();
let finalFilmObjectUrl=null;
let sceneVideoRestorePromise=Promise.resolve();
const sceneVideoStorage=createSceneVideoStorage();
const facialAssetStorage=createFacialAssetStorage();
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
 video.muted=true;video.loop=true;video.playsInline=true;video.preload="auto";video.src=url;
 video.addEventListener("loadeddata",()=>{if(sceneIndex===index)draw()},{once:true});
 const entry={video,url,filename};
 sceneVideoCache.set(key,entry);
 if(index===sceneIndex)syncSceneVideoPlayback({cache:sceneVideoCache,activeKey:key,shouldPlay:playing,restart:true});
 return entry;
}
function releaseSceneVideo(meta,index){
 const key=sceneVideoKey(index,meta);
 disposeSceneVideoEntry(sceneVideoCache.get(key));
 sceneVideoCache.delete(key);
 void sceneVideoStorage.delete(key).catch(error=>console.warn("Could not delete persisted scene video:",error));
}
async function restorePersistedSceneVideos(){
 let restored=0;
 for(let index=0;index<sceneMetadata.length;index++){
  const meta=sceneMetadata[index];
  try{
   const record=await sceneVideoStorage.get(meta.id);
   if(record?.blob instanceof Blob){attachSceneVideo(index,meta,record.blob,record.filename||("dravex-scene-"+(index+1)+".webm"));restored++;}
  }catch(error){console.warn("Could not restore scene video:",error);}
 }
 if(restored){renderComfySceneVideo();if(!playing)draw();$('status').textContent=uiLang==='ru'?'Восстановлено видео сцен: '+restored+'.':'Restored scene videos: '+restored+'.';}
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
  previewMouthOriginTimeMs=await pendingSession.start();
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
function draw(){const animationTimeMs=animationClock.advance(performance.now(),playing),dimensions=getCanvasDimensions(activeCanvasFormat),w=dimensions.logicalWidth,h=dimensions.logicalHeight,t=animationTimeMs/1000;ctx.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);ctx.clearRect(0,0,w,h);const g=ctx.createLinearGradient(0,0,0,h);const paletteSets={ 'Storybook':[['#29274d','#132b3b'],['#49304e','#192b46'],['#193f45','#102735'],['#4b3440','#20243c'],['#243c55','#102c38']], 'Anime-inspired':[['#40265f','#132b4c'],['#702f62','#172d52'],['#124e67','#172044'],['#713b48','#211c46'],['#3b3978','#12394a']], 'Flat 2D':[['#83c5be','#277da1'],['#ffafcc','#6d597a'],['#90be6d','#277da1'],['#f9c74f','#577590'],['#bde0fe','#5e548e']], 'Pixel art':[['#312e2e','#1d3557'],['#6a4c93','#1982c4'],['#386641','#1d3557'],['#bc4749','#283618'],['#3a506b','#0b132b']]};const scenePalettes=paletteSets[$('style').value]||paletteSets['Storybook'];const palette=scenePalettes[sceneIndex%scenePalettes.length];g.addColorStop(0,palette[0]);g.addColorStop(1,palette[1]);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);for(let i=0;i<45;i++){let x=(i*97+25)%w,y=(i*53+17)%(h*.61);ctx.fillStyle='rgba(255,255,255,'+(0.25+0.45*Math.abs(Math.sin(t+i)))+')';ctx.fillRect(x,y,2,2)}ctx.fillStyle=sceneIndex===1?'#25434a':sceneIndex===2?'#244c3b':'#183b38';ctx.beginPath();ctx.ellipse(w/2,h*1.03,w*.453,h*.278,0,0,Math.PI*2);ctx.fill();for(let i=0;i<7;i++){let x=(i+.25)*w/7,baseY=h*.86,peakY=h*.43+(i%3)*h*.0694;ctx.fillStyle='#172d36';ctx.beginPath();ctx.moveTo(x,baseY);ctx.lineTo(x+w*.07,peakY);ctx.lineTo(x+w*.14,baseY);ctx.fill()}const currentSceneData=sceneMetadata[sceneIndex]||{title:titles[sceneIndex],visibleAction:descriptions[sceneIndex],prompt:descriptions[sceneIndex]};if(sceneMotionSceneIndex!==sceneIndex){sceneMotionSceneIndex=sceneIndex;sceneMotionStartTimeMs=animationTimeMs;rigPreviewProgress=null;if($('characterRigScrubber')){$('characterRigScrubber').value='0';$('characterRigScrubberValue').textContent='Scene clock'}syncSceneVideoPlayback({cache:sceneVideoCache,activeKey:String(currentSceneData.id||('scene-index-'+sceneIndex)),shouldPlay:playing,restart:true})}const sceneDurationRaw=Number(currentSceneData.durationSeconds??$('duration').value);const sceneDuration=Number.isFinite(sceneDurationRaw)&&sceneDurationRaw>=0.25&&sceneDurationRaw<=30?sceneDurationRaw:3;const sceneMotionProgress=Math.max(0,Math.min(1,(animationTimeMs-sceneMotionStartTimeMs)/(sceneDuration*1000)));const rigAnimationProgress=rigPreviewProgress===null?sceneMotionProgress:rigPreviewProgress;const previousSceneData=sceneIndex>0?(sceneMetadata[sceneIndex-1]||{title:titles[sceneIndex-1],visibleAction:descriptions[sceneIndex-1],prompt:descriptions[sceneIndex-1]}):null;const previousScale=previousSceneData?calculateCinematicShot({...previousSceneData,beatIndex:sceneIndex-1}).shotScale:null;const directorShot=calculateCinematicShot({...currentSceneData,beatIndex:sceneIndex},previousScale);const cameraPlan=directorShot.cameraTransform;const composition=getSceneComposition(activeCanvasFormat,sceneIndex);const starBase=[composition.star.x*w,composition.star.y*h];const foxBase=[composition.character.x*w,composition.character.y*h];const showDemoFox=!String($('character').value||'').trim();const focusX=showDemoFox&&directorShot.focusTarget==='prop'?starBase[0]:showDemoFox?foxBase[0]:w/2;const focusY=showDemoFox&&directorShot.focusTarget==='prop'?starBase[1]:showDemoFox?foxBase[1]:h*.65;ctx.save();ctx.translate(w/2,h/2+cameraPlan.offsetY);ctx.scale(cameraPlan.zoom,cameraPlan.zoom);ctx.translate(-focusX,-focusY);const action=getSceneAction(sceneIndex);const activeMouthTracks=exportMouthOriginTimeMs!==null?exportMouthTracks:previewMouthTracks;const mouthClockOrigin=exportMouthOriginTimeMs!==null?exportMouthOriginTimeMs:previewMouthOriginTimeMs;const exportElapsedMs=mouthClockOrigin===null?-1:performance.now()-mouthClockOrigin;const facialLipSync=sampleCharacterFacialLipSync(activeMouthTracks,sceneIndex,exportElapsedMs);const activeMouthTrack=activeMouthTracks.find(track=>track.sceneIndex===sceneIndex&&exportElapsedMs>=track.startMs&&exportElapsedMs<track.startMs+track.envelope.durationMs);const mouthTrackTimeMs=activeMouthTrack?exportElapsedMs-activeMouthTrack.startMs:-1;const exportMouthOpenness=activeMouthTrack?sampleAudioMouthEnvelope(activeMouthTrack.envelope,mouthTrackTimeMs):0;const exportViseme=activeMouthTrack?sampleVisemeTimeline(activeMouthTrack.visemes,mouthTrackTimeMs):"neutral";let sx=320,sy=300;if(showDemoFox){sx=starBase[0]+Math.sin(t*1.5)*15;sy=starBase[1]+Math.cos(t*2)*12;if(action==='run'){sx+=Math.sin(t*2)*36;sy-=Math.abs(Math.sin(t*3))*10}else if(action==='float'){sy-=Math.abs(Math.sin(t*1.4))*24}else if(action==='vanish'){sx+=Math.sin(t)*4}const starPulse=1+Math.sin(t*3)*.08;const starScale=action==='magic'?1.35:action==='vanish'?Math.max(.08,1-((frame%45)/45)):action==='float'?.88:sceneIndex===1?1.18:sceneIndex===3?1.35:sceneIndex===4?.88:1; if(sceneIndex===3){ctx.save();ctx.translate(sx,sy);ctx.strokeStyle='rgba(255,229,138,'+(.35+.25*Math.abs(Math.sin(t*3)))+')';ctx.lineWidth=3;for(let ray=0;ray<8;ray++){const a=ray*Math.PI/4+t*.08;ctx.beginPath();ctx.moveTo(Math.cos(a)*34,Math.sin(a)*34);ctx.lineTo(Math.cos(a)*48,Math.sin(a)*48);ctx.stroke()}ctx.restore()}if(sceneIndex===4){for(let spark=0;spark<7;spark++){const a=spark*Math.PI*2/7+t*.35;const px=sx+Math.cos(a)*(24+Math.sin(t*2+spark)*5),py=sy+Math.sin(a)*(24+Math.sin(t*2+spark)*5);ctx.fillStyle='rgba(255,229,138,.8)';ctx.beginPath();ctx.arc(px,py,2.5,0,Math.PI*2);ctx.fill()}}ctx.save();ctx.translate(sx,sy);ctx.scale(starScale*starPulse,starScale*starPulse);ctx.rotate(t*.25);ctx.shadowBlur=sceneIndex===3?38:25;ctx.shadowColor='#ffe58a';ctx.fillStyle='#ffe58a';ctx.beginPath();for(let i=0;i<10;i++){let a=-Math.PI/2+i*Math.PI/5,r=i%2?13:30;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r)}ctx.closePath();ctx.fill();ctx.restore();}if(showDemoFox){const poses=[[0,0,0],[18,0,-.08],[48,-12,.16],[12,-34,-.18],[-8,0,0]];const pose=poses[sceneIndex%poses.length];const actionPulse=Math.sin(t*2.4);let fx=foxBase[0]+pose[0]+Math.sin(t)*6,fy=foxBase[1]+pose[1]+Math.sin(t*2)*3+(sceneIndex===3?Math.abs(actionPulse)*7:0);if(action==='run'){fx+=Math.sin(t*4)*22;fy-=Math.abs(Math.sin(t*4))*8}else if(action==='jump'){fy-=Math.abs(Math.sin(t*3))*28}else if(action==='walk'){fx+=Math.sin(t*2.2)*13;fy-=Math.abs(Math.sin(t*2.2))*4}else if(action==='dance'){fx+=Math.sin(t*3.4)*12;fy-=Math.abs(Math.sin(t*3.4))*12}else if(action==='talk'){fy+=Math.sin(t*5)*2}else if(action==='surprised'){fy-=Math.abs(Math.sin(t*2))*5}else if(action==='sad'){fy+=Math.abs(Math.sin(t*1.5))*3}ctx.save();ctx.translate(fx,fy);ctx.rotate(pose[2]+(sceneIndex===2?Math.sin(t*1.8)*.04:0)+(action==='dance'?Math.sin(t*3.4)*.2:action==='turn'?Math.sin(t*2)*.5:0));ctx.fillStyle='#f18a48';ctx.beginPath();ctx.ellipse(0,10,55,42,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(-38,-10);ctx.lineTo(-48,-68);ctx.lineTo(-10,-38);ctx.fill();ctx.beginPath();ctx.moveTo(5,-36);ctx.lineTo(32,-72);ctx.lineTo(42,-17);ctx.fill();ctx.fillStyle='#ffd0a1';ctx.beginPath();ctx.ellipse(8,17,31,23,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(4,-5,9,12,0,0,Math.PI*2);ctx.ellipse(28,-5,9,12,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#242033';ctx.beginPath();ctx.arc(7,-4,4,0,Math.PI*2);ctx.arc(29,-4,4,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(17,13,5,0,Math.PI*2);ctx.fill();if(exportMouthOpenness>0.035){ctx.fillStyle='#242033';if(exportViseme==='closed'){ctx.strokeStyle='#242033';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(12,20);ctx.lineTo(22,20);ctx.stroke()}else{ctx.beginPath();const mouthWidth=exportViseme==='wide'?5.5:exportViseme==='round'?2.7:exportViseme==='teeth'?4.8:3.8;const mouthHeight=exportViseme==='wide'?1.8+exportMouthOpenness*2:exportViseme==='round'?2.5+exportMouthOpenness*4:exportViseme==='teeth'?1.8+exportMouthOpenness*2:exportViseme==='open'?2+exportMouthOpenness*7:1.8+exportMouthOpenness*2;ctx.ellipse(17,20,mouthWidth,mouthHeight,0,0,Math.PI*2);ctx.fill()}}else if(action==='happy'||action==='sad'){ctx.strokeStyle='#242033';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(17,20,action==='happy'?8:7,action==='happy'?0:Math.PI,action==='happy'?Math.PI:Math.PI*2);ctx.stroke()}else if(action==='talk'||action==='surprised'){ctx.fillStyle='#242033';ctx.beginPath();const mouthOpen=action==='surprised'?1:Math.max(0.2,(Math.sin(t*8)+1)*0.35);ctx.ellipse(17,20,action==='surprised'?6:4,Math.max(1.5,2+mouthOpen*7),0,0,Math.PI*2);ctx.fill()}if(action==='sad'){ctx.fillStyle='rgba(130,220,255,.85)';ctx.beginPath();ctx.ellipse(34,8,3,6,-.25,0,Math.PI*2);ctx.fill()}if(sceneIndex===2||sceneIndex===3){ctx.strokeStyle='#242033';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-1,-20);ctx.lineTo(10,-17);ctx.stroke()}ctx.restore();}ctx.restore();const generatedFrame=getLoadedSceneImage(currentSceneData.generatedImageUrl);
const generatedVideo=sceneVideoCache.get(String(currentSceneData.id||('scene-index-'+sceneIndex)));
const hasGeneratedVideo=Boolean(generatedVideo&&generatedVideo.readyState>=2&&generatedVideo.videoWidth>0);
const hasGeneratedMedia=hasGeneratedVideo||Boolean(generatedFrame);
if(hasGeneratedVideo){const motionTransform=getPromptCameraTransform(currentSceneData.motionPrompt||currentSceneData.visibleAction,sceneMotionProgress);drawImageCover(ctx,generatedVideo,w,h,motionTransform)}
else if(generatedFrame){const motionTransform=getPromptCameraTransform(currentSceneData.motionPrompt||currentSceneData.visibleAction,sceneMotionProgress);drawImageCover(ctx,generatedFrame,w,h,motionTransform)}
const sampledRigPoses=currentSceneData.characterRigTimeline?.keyframes?.length
 ? sampleCharacterRigTimeline(currentSceneData.characterRigTimeline,rigAnimationProgress)
 : currentSceneData.characterRigPoses;
drawCharacterLayers(ctx,currentSceneData.characterLayers,getLoadedSceneImage,w,h,{motionTimeline:currentSceneData.characterMotionTimeline||currentSceneData.actionTimeline,progress:rigAnimationProgress,drawRigParts:true,preferRigParts:true,characterRigs:currentSceneData.characterRigs,rigPoses:sampledRigPoses,drawFacialRigs:true,characterFacialRigs:currentSceneData.characterFacialRigs,facialExpressions:currentSceneData.characterFacialExpressions,facialVisemes:facialLipSync.facialVisemes,facialMouthOpenness:facialLipSync.facialMouthOpenness});
ctx.fillStyle='#fff';ctx.font='bold 21px system-ui';ctx.fillText($('character').value||(uiLang==='ru'?'Главный герой':'Main character'),24,38);if(showDemoFox&&!hasGeneratedMedia&&playing&&frame%7===0&&(action==='magic'||sceneIndex===3))magicParticles.emit(sx,sy,4,sceneIndex===3?'#fff1a8':'#ffe58a');if(!showDemoFox||hasGeneratedMedia)magicParticles.particles.length=0;else magicParticles.updateAndDraw(ctx);if(playing){frame++;raf=requestAnimationFrame(draw)}else{raf=0}}
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
      distinctiveFeatures:$('bibleDistinctiveFeatures').value
    });
    $('bibleCharacterId').dataset.loaded=String(sceneIndex);
    $('characterReferenceStatus').textContent=uiLang==='ru'?'Образ сохранён. Он будет добавляться в промпты сцен с этим персонажем. Нажми «Сохранить черновик», чтобы сохранить его в браузере.':'Reference saved. It will be included in prompts for scenes featuring this character. Save the draft to persist it in this browser.';
    updateProductionPreview();
    renderCharacterBible();
  }catch(error){
    $('characterReferenceStatus').textContent=error.message;
  }
});
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
  note.textContent=uiLang==='ru'?'Прозрачность: '+initialTransparency+' · сходство персонажа не проверено':'Transparency: '+initialTransparency+' · character identity not verified';
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
 $("facialPartId").value=part?.id||"";$("facialPartRole").value=part?.role||"eye-left";$("facialPartImageUrl").value=part?.imageUrl||"";
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
syncCharacterMotionEditor();
syncCharacterRigEditor();
renderComfySceneVideo();
renderSceneVoiceAudio();
refreshSceneVoiceControls();
syncFacialRigEditor();
}
['sceneCamera','sceneImagePrompt','sceneMotionPrompt','sceneStartState','sceneEndState','sceneNegativePrompt','sceneContinuityLock','sceneCharacters'].forEach(id=>$(id).addEventListener('input',updateProductionPreview));
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
 const result=upsertCharacterFacialPart(sceneMetadata[sceneIndex]||{},{characterId:$("facialCharacterId").value,headBoneId:$("facialHeadBoneId").value,partId:$("facialPartId").value,role:$("facialPartRole").value,imageUrl:$("facialPartImageUrl").value,x:Number($("facialPartX").value),y:Number($("facialPartY").value),width:Number($("facialPartWidth").value),height:Number($("facialPartHeight").value),rotation:Number($("facialPartRotation").value)*Math.PI/180,zIndex:Number($("facialPartZIndex").value)});
 if(result.status==="invalid"){$("facialEditorStatus").textContent=result.issues.map(issue=>issue.message).join(" ");return;}
 sceneMetadata[sceneIndex]=result.scene;
 if(currentStoryboardPlan)currentStoryboardPlan={...currentStoryboardPlan,scenes:sceneMetadata,eventChain:buildStoryEventChain(sceneMetadata)};
 syncFacialRigEditor();if(!playing)draw();
 $("facialEditorStatus").textContent=result.status==="updated"?"Facial part updated. / Часть лица обновлена.":"Facial part added. / Часть лица добавлена.";
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
    content.append(heading,description,actionLabel,cameraLabel);

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
  $('sceneVoiceStatus').textContent=voiceText('Модель не загружена. Загрузка начнётся только после нажатия кнопки.','No voice model loaded. Download starts only after you press Load.');
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
 const locale=storyLanguage();
 let dialogue=parseDialogueLines($('sceneDialogue').value,locale);
 if(!dialogue.length){
  $('sceneVoiceStatus').textContent=voiceText('Сначала добавь реплики в формате «Персонаж: текст».','Add dialogue lines first using “Character: text”.');
  return;
 }
 let engine;
 try{engine=getSceneVoiceEngine()}catch(error){$('sceneVoiceStatus').textContent=error.message;return}
 if(!engine.status.loaded||engine.status.locale!==locale){
  $('sceneVoiceStatus').textContent=voiceText('Сначала загрузи модель для выбранного языка.','Load the model for the selected language first.');
  refreshSceneVoiceControls();return;
 }
 button.dataset.busy='true';button.disabled=true;$('sceneVoiceStatus').dataset.touched='true';
 try{
  let savedMap={};
  try{const parsed=JSON.parse(readLocalStorage('dravex-character-voice-map')||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))savedMap=parsed}catch{}

  const assignments=assignCharacterVoices({
   speakers:dialogue.map(line=>line.characterId),
   availableVoices:engine.availableVoices,
   existingAssignments:savedMap,
   fallbackVoiceId:engine.availableVoices[0]||null
  });
  writeLocalStorage('dravex-character-voice-map',JSON.stringify(assignments));
  const artifacts=[];
  for(let index=0;index<dialogue.length;index++){
   const line=dialogue[index];
   const voiceId=assignments[normalizeSpeakerKey(line.characterId)]||undefined;
   $('sceneVoiceStatus').textContent=voiceText('Создаём голос '+(index+1)+' из '+dialogue.length+'…','Generating voice '+(index+1)+' of '+dialogue.length+'…');
   const result=await engine.synthesize({
    text:line.text,
    voiceId,
    filename:'scene-'+String(sceneMetadata[sceneIndex]?.id||sceneIndex+1)+'-line-'+(index+1)+'.wav'
   });
   artifacts.push({...result,voiceId:voiceId||null});
  }
  const meta=sceneMetadata[sceneIndex]||{};
  const scheduled=buildSceneVoiceTimeline({
   sceneId:meta.id||('scene-'+(sceneIndex+1)),
   dialogue,
   artifacts,
   fps:24,
   gapMs:120
  });
  meta.dialogue=dialogue;
  meta.voiceCues=scheduled.cues;
  meta.voiceTimeline=scheduled.timeline;
  sceneMetadata[sceneIndex]=meta;
  const saved=writeLocalStorage('dravex-cartoon-draft',JSON.stringify({
   idea:$('idea').value,character:$('character').value,style:$('style').value,canvasFormat:activeCanvasFormat,imageQuality:$('imageQuality').value,duration:$('duration').value,
   language:$('language').value,uiLanguage:uiLang,titles,descriptions,sceneMetadata,characterBible,sceneIndex
  }));
  await renderSceneVoiceAudio();
  $('sceneVoiceStatus').textContent=voiceText(
   'Готово: '+scheduled.cues.length+' реплик · '+(scheduled.timeline.totalDurationMs/1000).toFixed(2)+' сек. '+(saved?'Черновик сохранён.':'Не удалось сохранить черновик.'),
   'Done: '+scheduled.cues.length+' lines · '+(scheduled.timeline.totalDurationMs/1000).toFixed(2)+' sec. '+(saved?'Draft saved.':'Draft could not be saved.')
  );
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
$('make').addEventListener('click',()=>createStoryboard(false));
function createStoryboard(){const status=$('status');const idea=$('idea').value.trim();if(!idea){status.textContent=tr('emptyIdea');$('idea').focus();return}const lang=storyLanguage();const character=resolveStoryProtagonist(idea,$('character').value,lang);$('character').value=character;try{status.textContent=uiLang==='ru'?'Создаём раскадровку локальным движком DRAVEX…':'Creating a storyboard with the local DRAVEX engine…';const plan=buildStoryboardFromText(idea,lang,character);const storyContext=prepareStoryCharacterContext(plan,characterBible,character,lang);characterBible=storyContext.characterBible;const preparedScenes=storyContext.scenes;const stateChanges=inferStoryboardStateChanges(preparedScenes,lang,character);sceneMetadata=ensureSceneIds(preparedScenes.map((scene,index)=>({...scene,stateChanges:stateChanges[index]})));currentStoryboardPlan={...plan,eventChain:buildStoryEventChain(sceneMetadata),sourceText:idea,sourceLanguage:lang,sourceCharacter:character,scenes:sceneMetadata};titles=plan.titles;descriptions=plan.descriptions;sceneIndex=0;$('bibleCharacterId').value=character;$('bibleCharacterId').dataset.loaded='';$('sceneLabel').textContent=(storyLabels[lang]||'Scene')+' 1 · '+titles[0];renderScenes();syncSceneEditor();updateStoryQA();status.textContent=uiLang==='ru'?'Раскадровка создана локальным движком DRAVEX.':'Storyboard created by the local DRAVEX engine.';status.scrollIntoView({behavior:'smooth',block:'nearest'});}catch(error){console.error('DRAVEX storyboard error:',error);status.textContent=(uiLang==='ru'?'Не удалось создать раскадровку: ':'Storyboard creation failed: ')+(error?.message||'Unknown error');}}
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
if(button.disabled)return;button.disabled=true;$('runLocalModel').disabled=true;
status.textContent=ru?'Загружаем модель с Hugging Face. Первый запуск требует интернета; генерация будет выполняться на устройстве…':'Downloading model weights from Hugging Face. First load requires internet; generation will run on this device…';
try{
const result=await localTextRuntime.load({backend:'auto',onProgress:event=>{
if(event.total&&event.loaded){const pct=Math.min(100,Math.round(event.loaded/event.total*100));status.textContent=(ru?'Загрузка модели: ':'Downloading model: ')+pct+'%';}
}});
status.textContent=(ru?'Локальная модель загружена. Режим: ':'Local model loaded. Backend: ')+result.backend+'. '+(ru?'Текст запросов остаётся на устройстве.':'Prompt text stays on this device.');
$('runLocalModel').disabled=false;
}catch(error){status.textContent=(ru?'Не удалось загрузить локальную модель: ':'Local model loading failed: ')+(error?.message||'Unknown error');}
finally{button.disabled=false;}
});
$('runLocalModel').addEventListener('click',async()=>{
const button=$('runLocalModel'),status=$('localModelStatus'),output=$('localModelOutput'),ru=uiLang==='ru';
const story=$('idea').value.trim();
if(!story){status.textContent=ru?'Сначала введи историю.':'Enter a story first.';return}
if(button.disabled)return;button.disabled=true;status.textContent=ru?'Локальный AI-режиссёр создаёт варианты сцен и проверяет их…':'Local AI director is drafting and evaluating the scenes…';output.hidden=true;
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
finally{button.disabled=false;}
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
    const asset=await generateCharacterSpriteAsset({plan,consentAccepted:true,onProgress:progress=>{
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
renderScenes();
button.disabled=true;status.textContent=uiLang==='ru'?'Отправляем текстовый промпт в бесплатную очередь AI Horde…':'Submitting the text prompt to the free AI Horde queue…';
try{
const quality=getImageGenerationDimensions(activeCanvasFormat,$('imageQuality').value);const result=await generateImageWithHorde({prompt,negativePrompt:scene.negativePrompt,...quality,onProgress:progress=>{
const position=progress.queuePosition===null?'?':progress.queuePosition;
status.textContent=uiLang==='ru'?'Очередь AI Horde · позиция: '+position+' · ожидают: '+progress.waiting+' · обрабатываются: '+progress.processing:'AI Horde queue · position: '+position+' · waiting: '+progress.waiting+' · processing: '+progress.processing;
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

let comfyWorkflow=null,comfyConnected=false,comfySourceImage=null,fullFilmAbortController=null;
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
 const optional={negativePrompt:['comfyNegativeNode','comfyNegativeInput'],frameCount:['comfyFramesNode','comfyFramesInput'],fps:['comfyFpsNode','comfyFpsInput']};
 Object.entries(optional).forEach(([key,ids])=>{const value=binding(comfyText(ids[0]),comfyText(ids[1]));if(value)result[key]=value});
 return result;
}
function setComfyStatus(message){$('comfyStatus').textContent=message}
function updateComfyAnimateAvailability(){$('animateSceneComfy').disabled=!comfyConnected||!comfyWorkflow;const mode=$('videoGenerationMode')?.value||'huggingface';const ready=mode==='huggingface'?hfVideoConnected&&$('hfVideoConsent').checked:comfyConnected&&!!comfyWorkflow;$('generateFullFilmComfy').disabled=!ready||!!fullFilmAbortController}
$('comfySourceImageFile').addEventListener('change',()=>{
 const file=$('comfySourceImageFile').files?.[0]||null;
 comfySourceImage=file;
 $('comfySourceImageStatus').textContent=file?'Selected local image: '+file.name+' · '+Math.round(file.size/1024)+' KB. It stays in this tab until you start generation.':'No local image selected; the generated scene image will be used if available.';
});
$('comfyWorkflowFile').addEventListener('change',async()=>{
 const file=$('comfyWorkflowFile').files?.[0]||null;
 comfyWorkflow=null;comfyConnected=false;updateComfyAnimateAvailability();
 if(!file){$('comfyWorkflowStatus').textContent='No workflow selected.';return}
 try{
  const parsed=JSON.parse(await file.text());
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||!Object.keys(parsed).length)throw new Error('The JSON is empty or is not an API-format workflow object.');
  comfyWorkflow=parsed;
  $('comfyWorkflowStatus').textContent='Loaded '+file.name+' · '+Object.keys(parsed).length+' nodes. Node bindings will be validated when connecting.';
  setComfyStatus('Workflow loaded in this browser tab. Check the local ComfyUI connection.');
 }catch(error){$('comfyWorkflowStatus').textContent='Workflow error: '+(error.message||'Invalid JSON');}
});
$('checkComfyConnection').addEventListener('click',async()=>{
 const button=$('checkComfyConnection');button.disabled=true;comfyConnected=false;updateComfyAnimateAvailability();
 try{
  const result=await checkComfyUIConnection({baseUrl:comfyText('comfyBaseUrl')});
  if(comfyWorkflow){
   const provider=createComfyUIVideoProvider({baseUrl:comfyText('comfyBaseUrl'),workflow:comfyWorkflow,nodeBindings:comfyBindings(),outputNodeIds:comfyText('comfyOutputNodes').split(',').map(value=>value.trim()).filter(Boolean),frameCountStep:Number(comfyText('comfyFrameStep'))||1,frameCountOffset:1});
   comfyConnected=true;
   setComfyStatus('Connected to ComfyUI'+(result.system?.system?.comfyui_version?' · '+result.system.system.comfyui_version:'')+'. Workflow bindings validated. No image has been uploaded.');
  }else{
   setComfyStatus('ComfyUI is reachable, but select an API workflow JSON before animation.');
  }
 }catch(error){setComfyStatus((error.code||'CONNECTION_ERROR')+': '+(error.message||'Connection failed'));}
 finally{button.disabled=false;updateComfyAnimateAvailability();}
});
$('animateSceneComfy').addEventListener('click',async()=>{
 const button=$('animateSceneComfy'),status=$('comfyStatus');
 if(button.disabled)return;
 const index=sceneIndex,meta=sceneMetadata[index]||{},imageUrl=String(meta.generatedImageUrl||'').trim();
 if(!imageUrl){setComfyStatus(uiLang==='ru'?'Сначала создай или загрузи изображение этой сцены.':'Generate or load a still image for this scene first.');return}
 const motionScene={...meta,title:$('sceneTitle').value.trim()||titles[index],description:$('sceneDescription').value.trim()||descriptions[index],motionPrompt:$('sceneMotionPrompt').value.trim(),visibleAction:$('sceneMotionPrompt').value.trim(),camera:$('sceneCamera').value.trim(),startState:$('sceneStartState').value.trim(),endState:$('sceneEndState').value.trim(),negativePrompt:$('sceneNegativePrompt').value.trim(),continuityLock:$('sceneContinuityLock').value.trim(),characters:normalizeSceneCast($('sceneCharacters').value,meta.characters)};
 const prompt=buildMotionGenerationPrompt(motionScene,characterBible);
 if(!prompt.trim()){setComfyStatus('This scene has no motion instruction. Add a motion prompt first.');return}
 button.disabled=true;$('checkComfyConnection').disabled=true;
 try{
  let imageBlob=comfySourceImage;
  if(!imageBlob){
   status.textContent=uiLang==='ru'?'Получаем изображение сцены локально…':'Reading the generated scene image…';
   const imageResponse=await fetch(imageUrl);
   if(!imageResponse.ok)throw new Error('Cannot read the scene image (HTTP '+imageResponse.status+'). Select a local image instead if the image host blocks browser CORS.');
   imageBlob=await imageResponse.blob();
  }
  if(!imageBlob?.size)throw new Error('The scene image is empty.');
  const provider=createComfyUIVideoProvider({baseUrl:comfyText('comfyBaseUrl'),workflow:comfyWorkflow,nodeBindings:comfyBindings(),outputNodeIds:comfyText('comfyOutputNodes').split(',').map(value=>value.trim()).filter(Boolean),frameCountStep:Number(comfyText('comfyFrameStep'))||1,frameCountOffset:1});
  const registry=createVideoProviderRegistry();registry.register(provider);
  const duration=Math.max(0.25,Math.min(30,Number($('duration').value)||3));
  const result=await generateVideoWithProvider(registry,provider.id,{taskType:'image-to-video',prompt,negativePrompt:motionScene.negativePrompt,durationSeconds:duration,fps:16,aspectRatio:'source',image:imageBlob},{onProgress:progress=>{
   const elapsed=Math.round((progress.elapsedMs||0)/1000);
   status.textContent=(uiLang==='ru'?'ComfyUI · ':'ComfyUI · ')+progress.stage+' · '+elapsed+'s'+(progress.promptId?' · '+progress.promptId:'');
  }});
  if(result.status!=='completed'||!result.video)throw new Error(result.error||'ComfyUI did not return a completed video.');
  const key=sceneVideoKey(index,motionScene);
  const extension=result.video.type.includes('webm')?'.webm':result.video.type.includes('quicktime')?'.mov':'.mp4';
  const filename='dravex-scene-'+(index+1)+extension;
  attachSceneVideo(index,motionScene,result.video,filename);
  let persistenceNote='';
  try{await sceneVideoStorage.put(key,result.video,filename);}
  catch(storageError){console.warn('Scene video remains available only until this tab is closed:',storageError);persistenceNote=uiLang==='ru'?' Не удалось сохранить видео в памяти браузера; скачай его отдельно.':' Browser storage was unavailable; download the video before closing this tab.';}
  if(sceneIndex===index)renderComfySceneVideo();
  if(!playing)draw();
  status.textContent=(uiLang==='ru'?'Готово: видео сцены подключено к предпросмотру и экспорту.':'Completed: scene video is now used in preview and storyboard export.')+persistenceNote;
 }catch(error){status.textContent=(error.name==='AbortError'?'Cancelled: ':'Generation failed: ')+(error.code?error.code+' · ':'')+(error.message||'Unknown error');}
 finally{button.disabled=false;$('checkComfyConnection').disabled=false;updateComfyAnimateAvailability();}
});


$('videoGenerationMode').addEventListener('change',updateComfyAnimateAvailability);
$('hfVideoConsent').addEventListener('change',()=>{if(!$('hfVideoConsent').checked&&fullFilmAbortController&&$('videoGenerationMode').value==='huggingface')fullFilmAbortController.abort();updateComfyAnimateAvailability()});
$('clearHfVideoToken').addEventListener('click',()=>{
 if(fullFilmAbortController&&$('videoGenerationMode').value==='huggingface')fullFilmAbortController.abort();
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
 if(mode==='comfyui'&&(!comfyConnected||!comfyWorkflow))return;
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
   :createComfyUIVideoProvider({baseUrl:comfyText('comfyBaseUrl'),workflow:comfyWorkflow,nodeBindings:comfyBindings(),outputNodeIds:comfyText('comfyOutputNodes').split(',').map(value=>value.trim()).filter(Boolean),frameCountStep:Number(comfyText('comfyFrameStep'))||1,frameCountOffset:1});
  const registry=createVideoProviderRegistry();registry.register(provider);
  const scenes=titles.map((title,index)=>({...sceneMetadata[index],title,description:descriptions[index]||sceneMetadata[index]?.description||''}));
  if(mode==='huggingface'){
   const unsupportedIndex=scenes.findIndex(scene=>{
    const seconds=Number(scene.durationSeconds??scene.duration??$('duration').value)||3;
    return seconds<0.5||seconds>5;
   });
   if(unsupportedIndex>=0){
    const seconds=Number(scenes[unsupportedIndex].durationSeconds??scenes[unsupportedIndex].duration??$('duration').value)||3;
    throw new RangeError('Hugging Face Wan 2.2 supports scene clips from 0.5 to 5 seconds. Scene '+(unsupportedIndex+1)+' is set to '+seconds+' seconds. Shorten this scene or choose local ComfyUI.');
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
    const meta={...scene,id:String(scene.id||sceneMetadata[index]?.id||('scene_'+(index+1)))};
    meta.imagePrompt=String(meta.imagePrompt||meta.prompt||meta.description||descriptions[index]||meta.title);
    meta.motionPrompt=String(meta.motionPrompt||meta.visibleAction||meta.description||descriptions[index]||meta.title);
    meta.visibleAction=String(meta.visibleAction||meta.motionPrompt);
    meta.camera=String(meta.camera||'Cinematic anime composition with clear subject movement');
    meta.characters=normalizeSceneCast('',meta.characters);
    if(!meta.generatedImageUrl){
     if(!$('hordeConsent').checked)throw new Error('Для отсутствующего изображения сцены '+(index+1)+' нужно отдельно подтвердить отправку текстового промпта в AI Horde.');
     updateFilmSceneProgress(index,{status:'generating',progress:null,label:filmProgressText('Создание изображения','Creating scene image')});
     updateFilmVideoProgress(null,filmProgressText('Подготовка изображений сцен','Preparing scene images'));
     status.textContent='Создаём изображение сцены '+(index+1)+' из '+scenes.length+' в AI Horde…';
     const imagePrompt=buildImageGenerationPrompt(meta,characterBible,{includeNegative:false,visualStyle:$('style').value});
     const imageResult=await generateImageWithHorde({prompt:imagePrompt,negativePrompt:meta.negativePrompt||'',...quality,signal,onProgress:queue=>{
      updateFilmSceneProgress(index,{status:'generating',progress:null,label:filmProgressText('Очередь AI Horde','AI Horde queue')});
      status.textContent='AI Horde · сцена '+(index+1)+' · очередь '+(queue.queuePosition===null?'?':queue.queuePosition);
     }});
     meta.generatedImageUrl=imageResult.imageUrl;meta.generatedImageSeed=imageResult.seed;meta.generatedImageModel=imageResult.model;meta.generatedImageWorker=imageResult.workerName;
     sceneMetadata[index]={...sceneMetadata[index],...meta};
     if(sceneIndex===index)renderGeneratedSceneImage();
     updateStoryQA();
    }
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    updateFilmSceneProgress(index,{status:'generating',progress:null,label:filmProgressText('Подготовка к анимации','Preparing animation')});
    status.textContent='Подготавливаем изображение сцены '+(index+1)+' для анимации…';
    let imageInput=meta.generatedImageUrl;
    if(mode==='comfyui'){
     const imageResponse=await fetch(meta.generatedImageUrl,{signal});
     if(!imageResponse.ok)throw new Error('Не удалось получить изображение сцены (HTTP '+imageResponse.status+'). Проверь CORS или загрузи изображение вручную.');
     imageInput=await imageResponse.blob();
     if(!imageInput.size)throw new Error('Изображение сцены пустое.');
    }
    const prompt=buildMotionGenerationPrompt(meta,characterBible);
    const duration=Math.max(0.25,Math.min(30,Number(meta.durationSeconds??meta.duration??$('duration').value)||3));
    updateFilmSceneProgress(index,{status:'generating',progress:null,label:filmProgressText('Отправка в видеодвижок','Submitting to video engine')});
    const result=await generateVideoWithProvider(registry,provider.id,{taskType:'image-to-video',prompt,negativePrompt:meta.negativePrompt||'',durationSeconds:duration,fps:16,aspectRatio:'source',image:imageInput},{signal,onProgress:job=>{
     const providerPercent=readVideoProgressPercent(job);
     const providerStage=String(job.stage||'processing');
     const sceneLabel=providerStage==='queued'||providerStage==='pending'?filmProgressText('В очереди','Queued'):providerStage==='completed'?filmProgressText('Готово','Ready'):filmProgressText('Генерируется','Generating');
     updateFilmSceneProgress(index,{status:'generating',progress:providerPercent,label:sceneLabel+(providerPercent===null?' · '+providerStage:' · '+providerPercent+'%')});
     updateFilmVideoProgress(providerPercent,filmProgressText('Генерация видеосцен','Generating video scenes'));
     status.textContent=(mode==='huggingface'?'Hugging Face · ':'ComfyUI · ')+'сцена '+(index+1)+'/'+scenes.length+' · '+providerStage+(providerPercent===null?'': ' · '+providerPercent+'%')+(Number.isFinite(job.etaSeconds)?' · ETA '+Math.round(job.etaSeconds)+' сек.':'')+(Number.isFinite(job.queuePosition)?' · очередь '+job.queuePosition:'');
    }});
    if(result.status!=='completed'||!result.video)throw new Error(result.error||'ComfyUI не вернул готовый видеофайл.');
    const key=sceneVideoKey(index,meta);
    const extension=result.video.type.includes('webm')?'.webm':result.video.type.includes('quicktime')?'.mov':'.mp4';
    const filename='dravex-scene-'+(index+1)+extension;
    attachSceneVideo(index,meta,result.video,filename);
    await sceneVideoStorage.put(key,result.video,filename);
    if(sceneIndex===index)renderComfySceneVideo();
    if(!playing)draw();
    return result;
   }
  });
  if(report.cancelled){
   filmProgressTracking=false;
   setFilmProgress(Math.floor(((report.completed+report.skipped)/report.total)*85),filmProgressText('Создание остановлено','Generation cancelled'),filmProgressText('Готовые сцены сохранены. Можно продолжить позже.','Completed scenes are saved. You can resume later.'));
   status.textContent='Создание остановлено. Уже готовые сцены сохранены; можно продолжить позже.';return;
  }
  if(report.failed){
   filmProgressTracking=false;
   const failed=report.results.filter(item=>item.status==='failed').map(item=>'сцена '+(item.index+1)+': '+item.error).join(' · ');
   status.textContent='Готово '+(report.completed+report.skipped)+' из '+report.total+'. Не удалось создать '+report.failed+' сцен: '+failed+'. Исправь ошибки и запусти повторно — готовые сцены будут пропущены.';
   setFilmProgress(Math.floor(((report.completed+report.skipped)/report.total)*85),filmProgressText('Есть ошибки сцен','Scene errors'),status.textContent);
   return;
  }
  setFilmProgress(85,filmProgressText('Сцены готовы · сборка WebM','Scenes ready · assembling WebM'),filmProgressText('Все видеосцены созданы. Начинается запись итогового мультфильма.','All scene videos are ready. Final film recording is starting.'));
  status.textContent='Все '+report.total+' видеосцен готовы. Собираем итоговый мультфильм…';
  $('export').click();
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
$('save').onclick=()=>{const saved=writeLocalStorage('dravex-cartoon-draft',JSON.stringify({idea:$('idea').value,character:$('character').value,style:$('style').value,canvasFormat:activeCanvasFormat,imageQuality:$('imageQuality').value,duration:$('duration').value,language:$('language').value,uiLanguage:uiLang,titles,descriptions,sceneMetadata,characterBible,sceneIndex}));$('status').textContent=saved?tr('saved'):tr('storageError')};
$('export').onclick=async()=>{
  if(!canvas.captureStream||!window.MediaRecorder){
    $('status').textContent=tr('unsupported');
    if(filmProgressTracking){setFilmProgress($('fullFilmProgress').value,filmProgressText('Экспорт не поддерживается','Export unsupported'),tr('unsupported'));filmProgressTracking=false;}
    return;
  }
  const button=$('export');
  if(button.disabled)return;
  const exportScenes=titles.map((title,index)=>{const meta=sceneMetadata[index]||{title};const voiceDuration=Number(meta.voiceTimeline?.totalDurationMs)||0;if(voiceDuration>30000)throw new RangeError('Dialogue in scene '+(index+1)+' exceeds the 30-second scene export limit.');const requested=Number(meta.durationSeconds??meta.duration??$('duration').value)||3;return {...meta,durationSeconds:Math.max(requested,voiceDuration/1000)};});
  const timeline=buildExportTimeline(exportScenes,$('duration').value);
  if(!timeline.segments.length){
    $('status').textContent=uiLang==='ru'?'Сначала создай раскадровку.':'Create a storyboard before exporting.';
    if(filmProgressTracking){setFilmProgress($('fullFilmProgress').value,filmProgressText('Нет сцен для экспорта','No scenes to export'),$('status').textContent);filmProgressTracking=false;}
    return;
  }
  button.disabled=true;
  $('audioFile').disabled=true;
  $('audioVolume').disabled=true;
  const wasPlaying=playing;
  const originalSceneIndex=sceneIndex;
  const sceneTimers=[];
  let stream=null,recorder=null,stopTimer=null,cleaned=false,audioSession=null,exportProgressTimer=null,exportStartedAtMs=null;
  const chunks=[];
  let audioScheduledStartAtMs=null;
  let lipSyncSkippedTracks=0;
  const cleanup=()=>{
    if(cleaned)return;
    cleaned=true;
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
    await stopSceneVoicePreview();
    await sceneVideoRestorePromise;
    $('status').textContent=uiLang==='ru'?'Ожидание готовности медиа сцен…':'Waiting for scene media to become ready…';
    const readinessTasks=[];
    for(const segment of timeline.segments){
      const meta=sceneMetadata[segment.sceneIndex]||{};
      const key=String(meta.id||('scene-index-'+segment.sceneIndex));
      const entry=sceneVideoCache.get(key);
      if(entry?.video){
        readinessTasks.push(waitForSceneVideoReady(entry.video,{timeoutMs:12000}).then(()=>{
          try{entry.video.currentTime=0;}catch{}
        }));
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
    sceneIndex=timeline.segments[0].sceneIndex;
    sceneMotionSceneIndex=-1;
    playing=true;
    syncSceneVideoPlayback({cache:sceneVideoCache,activeKey:String(sceneMetadata[sceneIndex]?.id||('scene-index-'+sceneIndex)),shouldPlay:true,restart:true});
    $('play').textContent=tr('pauseButton');
    if(!raf)draw();
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
        if(!record?.blob)throw new Error('A generated voice file is missing from this device. Regenerate the dialogue before exporting.');
        const startMs=segment.startMs+(Number(cue.startFrame)||0)*(1000/24);
        if(startMs+Number(cue.durationMs||0)>segment.endMs+35)throw new Error('Dialogue exceeds its scene export interval. Regenerate the scene voice timeline.');
        voiceTracks.push({cueId:cue.cueId,blob:record.blob,startMs,durationMs:Number(cue.durationMs),sceneIndex:segment.sceneIndex,characterId:String(cue.characterId||cue.characterName||"Narrator"),characterName:String(cue.characterName||cue.characterId||"Narrator"),text:String(cue.text||""),language:String(cue.language||storyLanguage()),phonemeChunks:Array.isArray(cue.phonemeChunks)?cue.phonemeChunks:[],visemeEvents:Array.isArray(cue.visemeEvents)?cue.visemeEvents:[]});
      }
    }
    exportMouthTracks=[];
    if(voiceTracks.length){
      const mainCharacterKey=String($("character").value||"").trim().toLowerCase();
      const mainCharacterVoiceTracks=voiceTracks.filter(track=>{const meta=sceneMetadata[track.sceneIndex]||{};const speakerKey=String(track.characterId||track.characterName||"").trim().toLowerCase();const hasFacialRig=Array.isArray(meta.characterFacialRigs)&&meta.characterFacialRigs.some(rig=>Boolean(speakerKey)&&[rig?.characterId,track.characterName].some(value=>String(value||"").trim().toLowerCase()===String(rig?.characterId||"").trim().toLowerCase()));return track.characterName.trim().toLowerCase()===mainCharacterKey||hasFacialRig;});
      // Generated images/videos are valid lip-sync backgrounds too. The facial
      // rig compositor overlays mouth parts on top of the scene during canvas export.
      const lipSyncRenderableTracks=mainCharacterVoiceTracks;
      const AudioContextClass=window.AudioContext||window.webkitAudioContext;
      if(AudioContextClass&&lipSyncRenderableTracks.length){
        const decodeContext=new AudioContextClass();
        try{
          for(const track of lipSyncRenderableTracks){
            try{
              const decoded=await decodeContext.decodeAudioData(await track.blob.arrayBuffer());
              const channels=Array.from({length:decoded.numberOfChannels},(_,channel)=>decoded.getChannelData(channel));
              const envelope=buildAudioMouthEnvelope({channels,sampleRate:decoded.sampleRate,fps:24});
              const visemes=buildVisemeTimeline({text:track.text,durationMs:envelope.durationMs,language:track.language,fps:24,phonemeChunks:track.phonemeChunks,visemeEvents:track.visemeEvents});
              exportMouthTracks.push({sceneIndex:track.sceneIndex,characterId:track.characterId,characterName:track.characterName,startMs:track.startMs,envelope,visemes});
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
      stream=audioSession.stream;
      const audioStartInfo=await audioSession.start();
      audioScheduledStartAtMs=Number.isFinite(audioStartInfo?.scheduledStartAtMs)?audioStartInfo.scheduledStartAtMs:null;
    }
    const mimeTypes=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
    const mimeType=mimeTypes.find(type=>MediaRecorder.isTypeSupported(type));
    if(!mimeType)throw new Error('No supported WebM codec');
    recorder=new MediaRecorder(stream,{mimeType});
    recorder.ondataavailable=event=>{if(event.data&&event.data.size>0)chunks.push(event.data)};
    recorder.onerror=()=>{
      cleanup();
      $('status').textContent=tr('exportFailed');
      if(filmProgressTracking){setFilmProgress($('fullFilmProgress').value,filmProgressText('Ошибка сборки WebM','WebM assembly failed'),tr('exportFailed'));filmProgressTracking=false;}
    };
    recorder.onstop=()=>{
      try{
        const blob=new Blob(chunks,{type:recorder.mimeType||'video/webm'});
        if(!blob.size)throw new Error('Recorder produced an empty file');
        const url=URL.createObjectURL(blob);
        if(finalFilmObjectUrl)URL.revokeObjectURL(finalFilmObjectUrl);
        finalFilmObjectUrl=url;
        $('finalFilmPlayer').src=url;$('finalFilmPlayer').hidden=false;$('finalFilmResult').hidden=false;$('finalFilmDownload').href=url;
        const anchor=document.createElement('a');
        anchor.href=url;
        anchor.download='dravex-cartoon-storyboard.webm';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        const lipSyncWarnings=[];
        if(lipSyncSkippedTracks)lipSyncWarnings.push(uiLang==='ru'
          ?'Анализ синхронизации губ пропущен для '+lipSyncSkippedTracks+' реплик.'
          :'Lip-sync analysis was skipped for '+lipSyncSkippedTracks+' dialogue line(s).');
        const lipSyncWarning=lipSyncWarnings.length?' · '+lipSyncWarnings.join(' '):'';
        $('status').textContent=uiLang==='ru'
          ?'Экспортировано '+timeline.segments.length+' сцен · '+timeline.totalDurationSeconds.toFixed(2)+' сек.'+(voiceTracks.length?' · реплик: '+voiceTracks.length:'')+lipSyncWarning
          :'Exported '+timeline.segments.length+' scenes · '+timeline.totalDurationSeconds.toFixed(2)+' sec.'+(voiceTracks.length?' · dialogue lines: '+voiceTracks.length:'')+lipSyncWarning;
        if(filmProgressTracking){setFilmProgress(100,filmProgressText('Мультфильм готов','Film ready'),filmProgressText('WebM создан и добавлен в предпросмотр.','WebM was created and added to the preview.'));filmProgressTracking=false;}
      }catch(error){
        console.error('DRAVEX export failed:',error);
        $('status').textContent=tr('exportFailed');
        if(filmProgressTracking){setFilmProgress($('fullFilmProgress').value,filmProgressText('Ошибка сборки WebM','WebM assembly failed'),error.message||tr('exportFailed'));filmProgressTracking=false;}
      }finally{
        cleanup();
      }
    };
    recorder.start(250);
    exportMouthOriginTimeMs=performance.now();
    if(audioScheduledStartAtMs!==null){
      const mouthStartOffsetMs=getAudioTimelineOffsetMs(audioScheduledStartAtMs,exportMouthOriginTimeMs);
      exportMouthTracks=exportMouthTracks.map(track=>({...track,startMs:track.startMs+mouthStartOffsetMs}));
    }
    $('status').textContent=uiLang==='ru'
      ?'Записываем '+timeline.segments.length+' сцен'+(voiceTracks.length?' · реплик: '+voiceTracks.length:'')+'…'
      :'Recording '+timeline.segments.length+' scenes'+(voiceTracks.length?' · dialogue lines: '+voiceTracks.length:'')+'…';
    if(filmProgressTracking){
      exportStartedAtMs=performance.now();
      setFilmProgress(85,filmProgressText('Сборка WebM','Assembling WebM'),filmProgressText('Запись итогового видео…','Recording the final video…'));
      exportProgressTimer=setInterval(()=>{
        const fraction=Math.max(0,Math.min(1,(performance.now()-exportStartedAtMs)/Math.max(1,timeline.totalDurationMs)));
        const percent=85+Math.min(14,Math.floor(fraction*14));
        setFilmProgress(percent,filmProgressText('Сборка WebM','Assembling WebM'),filmProgressText('Записано примерно ','Recorded approximately ')+Math.round(fraction*100)+'%');
      },250);
    }
    timeline.segments.slice(1).forEach(segment=>{
      const timer=setTimeout(()=>{
        sceneIndex=segment.sceneIndex;
        $('status').textContent=uiLang==='ru'
          ?'Записываем сцену '+(segment.sceneIndex+1)+' из '+timeline.segments.length+'…'
          :'Recording scene '+(segment.sceneIndex+1)+' of '+timeline.segments.length+'…';
      },segment.startMs);
      sceneTimers.push(timer);
    });
    stopTimer=setTimeout(()=>{
      if(recorder&&recorder.state!=='inactive')recorder.stop();
    },timeline.totalDurationMs);
  }catch(error){
    console.error('DRAVEX export failed:',error);
    cleanup();
    $('status').textContent=tr('exportFailed');
    if(filmProgressTracking){setFilmProgress($('fullFilmProgress').value,filmProgressText('Ошибка подготовки WebM','WebM preparation failed'),error.message||tr('exportFailed'));filmProgressTracking=false;}
  }
};
try{const saved=JSON.parse(readLocalStorage('dravex-cartoon-draft')||'null');if(saved){$('idea').value=saved.idea||$('idea').value;activeCanvasFormat=normalizeCanvasFormat(saved.canvasFormat||activeCanvasFormat);$('uiLanguage').value=saved.uiLanguage||uiLang;uiLang=saved.uiLanguage||uiLang;$('character').value=saved.character||'';$('style').value=saved.style||'Storybook';$('imageQuality').value=saved.imageQuality||'standard';$('duration').value=saved.duration||'3';$('language').value=saved.language||'en';if(Array.isArray(saved.titles)&&Array.isArray(saved.descriptions)&&saved.titles.length===saved.descriptions.length&&saved.titles.length>0&&saved.titles.length<=12){titles=saved.titles.map(v=>String(v).slice(0,80));descriptions=saved.descriptions.map(v=>String(v).slice(0,500));sceneMetadata=ensureSceneIds(Array.isArray(saved.sceneMetadata)&&saved.sceneMetadata.length===titles.length?saved.sceneMetadata.map(item=>item&&typeof item==='object'?{...item}:{}):titles.map((title,index)=>({title,description:descriptions[index],prompt:descriptions[index],visibleAction:descriptions[index],camera:''})));characterBible=Array.isArray(saved.characterBible)?saved.characterBible.filter(entry=>entry&&typeof entry==='object').slice(0,20).map(entry=>({characterId:String(entry.characterId||'').slice(0,120),visualDescription:String(entry.visualDescription||'').slice(0,700),clothing:String(entry.clothing||'').slice(0,400),colors:String(entry.colors||'').slice(0,200),distinctiveFeatures:String(entry.distinctiveFeatures||'').slice(0,400)})):[];if(!characterBible.length)characterBible=upsertCharacterReference([],{characterId:$('character').value.trim()||''});sceneIndex=Math.min(Math.max(0,Number(saved.sceneIndex)||0),titles.length-1)}$('status').textContent=tr('restored')}}catch(e){}
applyCanvasFormat();applyLanguage();renderScenes();applySceneEditorLanguage();syncSceneEditor();draw();sceneVideoRestorePromise=restorePersistedSceneVideos();
