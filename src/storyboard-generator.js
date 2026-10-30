/**
 * Deterministic local storyboard planner.
 * It structures supplied story content and production directions; it is not a generative model.
 */
import { parseStoryBrief, formatProductionDirectives } from './story-brief.js';

export const STORYBOARD_BEAT_COUNT = 5;
export const STORYBOARD_SCENE_LIMIT = 8;

const BEATS = {
  ru: [
    { title: 'Завязка', action: 'Герой появляется в месте действия и осматривает окружение.', camera: 'Общий план; медленное приближение камеры.' },
    { title: 'Событие', action: 'Герой замечает важную деталь и явно реагирует.', camera: 'Средний план; акцент на лице и реакции.' },
    { title: 'Препятствие', action: 'Герой движется к цели и сталкивается с препятствием.', camera: 'Следящий план; камера движется вместе с героем.' },
    { title: 'Кульминация', action: 'Герой выполняет решающее действие; покажи движение и его последствие.', camera: 'Крупный план действия; короткий динамичный акцент.' },
    { title: 'Развязка', action: 'Покажи итог и реакцию героя в отдельном спокойном финальном кадре.', camera: 'Спокойный финальный план.' }
  ],
  uk: [
    { title: 'Зав’язка', action: 'Герой з’являється в місці подій та оглядає оточення.', camera: 'Загальний план; повільне наближення камери.' },
    { title: 'Подія', action: 'Герой помічає важливу деталь і виразно реагує.', camera: 'Середній план; акцент на обличчі й реакції.' },
    { title: 'Перешкода', action: 'Герой рухається до мети та стикається з перешкодою.', camera: 'Камера рухається слідом за героєм.' },
    { title: 'Кульмінація', action: 'Герой виконує вирішальну дію; покажи рух і наслідок.', camera: 'Крупний план дії; короткий динамічний акцент.' },
    { title: 'Розв’язка', action: 'Покажи результат і реакцію героя в окремому спокійному фінальному кадрі.', camera: 'Спокійний фінальний план.' }
  ],
  en: [
    { title: 'Introduction', action: 'The character enters the setting and surveys the surroundings.', camera: 'Wide establishing shot with a slow camera push-in.' },
    { title: 'Inciting event', action: 'The character notices an important detail and reacts visibly.', camera: 'Medium shot emphasizing the character’s reaction.' },
    { title: 'Obstacle', action: 'The character moves toward the goal and encounters an obstacle.', camera: 'Tracking shot that follows the character.' },
    { title: 'Climax', action: 'The character performs the decisive action; show movement and consequence.', camera: 'Close-up on the action with a brief dynamic accent.' },
    { title: 'Resolution', action: 'Show the outcome and the character’s response in a quieter final shot.', camera: 'A separate, quieter final shot.' }
  ],
  es: [
    { title: 'Inicio', action: 'El personaje entra en el lugar y observa el entorno.', camera: 'Plano general con un acercamiento lento.' },
    { title: 'Incidente', action: 'El personaje descubre un detalle importante y reacciona.', camera: 'Plano medio centrado en la reacción.' },
    { title: 'Obstáculo', action: 'El personaje avanza hacia su objetivo y encuentra un obstáculo.', camera: 'Plano de seguimiento.' },
    { title: 'Clímax', action: 'El personaje realiza la acción decisiva y muestra sus consecuencias.', camera: 'Primer plano de la acción.' },
    { title: 'Desenlace', action: 'Muestra el resultado y la reacción en un plano final tranquilo.', camera: 'Plano final separado y tranquilo.' }
  ]
};

const EXTRA_BEATS = {
  ru: [
    { title: 'Новый поворот', camera: 'Средний план; плавное движение камеры.' },
    { title: 'Последний штрих', camera: 'Общий план; плавное завершение.' },
    { title: 'Эпилог', camera: 'Статичный финальный кадр.' }
  ],
  uk: [
    { title: 'Новий поворот', camera: 'Середній план; плавний рух камери.' },
    { title: 'Останній штрих', camera: 'Загальний план; плавне завершення.' },
    { title: 'Епілог', camera: 'Статичний фінальний кадр.' }
  ],
  en: [
    { title: 'A new turn', camera: 'Medium shot with a gentle camera move.' },
    { title: 'Final detail', camera: 'Wide shot with a gentle settle.' },
    { title: 'Epilogue', camera: 'Still final composition.' }
  ],
  es: [
    { title: 'Un nuevo giro', camera: 'Plano medio con movimiento suave.' },
    { title: 'Detalle final', camera: 'Plano general con cierre suave.' },
    { title: 'Epílogo', camera: 'Composición final estática.' }
  ]
};

const CHARACTER_LABEL = { ru: 'Персонажи', uk: 'Персонажі', en: 'Characters', es: 'Personajes' };
const FALLBACK = { ru: 'Начинается новое приключение.', uk: 'Починається нова пригода.', en: 'A new adventure begins.', es: 'Comienza una nueva aventura.' };
const DEFAULT_NEGATIVE = 'No extra characters, no character redesign, no duplicate body parts, no text or watermark.';

function distributeStoryDetails(sentences, beatCount) {
  const buckets = Array.from({ length: beatCount }, () => []);
  if (!sentences.length) return buckets.map(() => '');
  sentences.forEach((sentence, index) => {
    const bucketIndex = Math.min(beatCount - 1, Math.floor(index * beatCount / sentences.length));
    buckets[bucketIndex].push(sentence);
  });
  return buckets.map(bucket => bucket.join(' ').slice(0, 1600));
}

function splitSentences(text) {
  return (String(text ?? '').match(/[^.!?。！？]+[.!?。！？]?/gu) || []).map(part => part.trim()).filter(Boolean);
}

function sceneCharacters(sceneText, characterIds, fallback) {
  const source = String(sceneText ?? '').toLocaleLowerCase();
  const matched = characterIds.filter(id => {
    const name = id.toLocaleLowerCase();
    const variants = new Set([name, name + 'а', name + 'у', name + 'ом']);
    if (/(?:ок|ёк)$/u.test(name)) variants.add(name.replace(/(?:ок|ёк)$/u, 'ка'));
    return [...variants].some(variant => variant && source.includes(variant));
  });
  return matched.length ? matched : [fallback];
}

/** Infer only explicit, high-confidence emotion words from scene text. */
export function inferSceneEmotion(sceneText = '') {
  const source = String(sceneText ?? '').toLocaleLowerCase().slice(0, 4000);
  if (!source.trim()) return 'neutral';
  const cues = [
    ['fear', /(?:боится|испугал|испугал(?:ся|ась|ись)?|страшно|ужас|в ужасе|панику|тревож|пуга|боїться|злякався|злякалася|налякан|fearful|afraid|scared|terrified|frightened|miedo|asustad[oa]|teme|temor)/iu],
    ['anger', /(?:злится|разозлил|разгневан|сердит|ярост|гнев|злий|сердиться|розлютився|кричит от злости|angry|furious|annoyed|怒|enojad[oa]|furios[oa])/iu],
    ['sad', /(?:груст|печал|плачет|сл[её]зы|расстроен|одинок|сумує|сумний|сумна|плаче|sad|sorrow|crying|tears|unhappy|triste|llora|lágrimas)/iu],
    ['happy', /(?:радост|счастлив|улыбается|сме[её]тся|весел|доволен|щаслив|радіє|усміхається|happy|joyful|delighted|laughs?|smiles?|excited|feliz|alegr[еí]a|sonr[ií]e|ríe)/iu],
    ['surprised', /(?:удивил|удивл[её]н|изумл[её]н|ошеломл[её]н|здивован|здивувал|неожиданно|воскликнул|surprised|astonished|amazed|shocked|sorprendid[oa]|asombrad[oa])/iu]
  ];
  for (const [emotion, pattern] of cues) if (pattern.test(source)) return emotion;
  return 'neutral';
}


/** Build a deterministic, scene-local emotion timeline from sentence order. */
export function inferSceneEmotionTimeline(sceneText = '', durationSeconds = 3) {
  const duration = Number.isFinite(Number(durationSeconds)) && Number(durationSeconds) >= 0.25 && Number(durationSeconds) <= 30
    ? Number(durationSeconds) : 3;
  const sentences = splitSentences(String(sceneText ?? '').slice(0, 4000));
  if (!sentences.length) return [{ startSeconds: 0, endSeconds: duration, emotion: 'neutral' }];
  const sliceDuration = duration / sentences.length;
  return sentences.map((sentence, index) => ({
    startSeconds: Number((index * sliceDuration).toFixed(3)),
    endSeconds: Number(((index + 1) * sliceDuration).toFixed(3)),
    emotion: inferSceneEmotion(sentence)
  }));
}

/** Return the emotion active at a scene-local playback time. */
export function sampleSceneEmotion(timeline, timeSeconds = 0, fallback = 'neutral') {
  if (!Array.isArray(timeline) || !timeline.length) return fallback;
  const time = Number.isFinite(Number(timeSeconds)) ? Math.max(0, Number(timeSeconds)) : 0;
  const valid = timeline.filter(item =>
    item && Number.isFinite(Number(item.startSeconds)) &&
    Number.isFinite(Number(item.endSeconds)) &&
    Number(item.endSeconds) > Number(item.startSeconds) &&
    ['neutral', 'happy', 'sad', 'fear', 'anger', 'surprised'].includes(item.emotion)
  ).sort((a, b) => Number(a.startSeconds) - Number(b.startSeconds));
  if (!valid.length) return fallback;
  const active = valid.find(item => time >= Number(item.startSeconds) && time < Number(item.endSeconds));
  if (active) return active.emotion;
  if (time >= Number(valid[valid.length - 1].endSeconds)) return valid[valid.length - 1].emotion;
  return valid[0].emotion;
}

function inferSceneInteractions(sceneText, characters) {
  if (!Array.isArray(characters) || characters.length < 2) return [];
  const source = String(sceneText ?? '').toLocaleLowerCase();
  const participants = characters.slice(0, 2);
  let type = 'look_at';
  let objectDescription = '';
  const handoff = /(?:переда[её]т|передал|передала|да[её]т|дал|дала|отда[её]т|отдал|отдала|вручает|вручил|вручила|hands?\s+over|passes?\s+to|gives?\s+to)/iu.test(source);
  const quotedObject = source.match(/[«“"]([^»”"]{1,60})[»”"]/u);
  if (handoff) {
    type = 'give_object';
    objectDescription = quotedObject?.[1]?.trim() || '';
  } else if (/(?:подход|приближа|ид[её]т к|approach|walks? toward)/iu.test(source)) type = 'approach';
  else if (/(?:отступ|уход|убега|move away|walks? away)/iu.test(source)) type = 'move_away';
  else if (/(?:говорит|сказал|сказала|ответил|ответила|спросил|спросила|диалог|говорят|says?|said|replies?|asks?|dialogue)/iu.test(source) || /[«“"][^»”"]{2,}[»”"]/u.test(source)) type = 'talk_to';
  return [{
    id: 'interaction_1',
    type,
    participants,
    ...(objectDescription ? { objectDescription } : {}),
    startSeconds: 0.2,
    endSeconds: 2.8,
    description: type === 'give_object' ? 'The first character hands the explicitly described object to the second.' : type === 'talk_to' ? 'The characters face each other during dialogue.' : type === 'approach' ? 'The first character gradually approaches the second.' : type === 'move_away' ? 'The first character gradually moves away from the second.' : 'The characters notice and look toward each other.'
  }];
}

/** Extract only explicitly attributed quoted dialogue; narration is never converted into speech. */
export function inferSceneDialogueTimeline(sceneText = '', characters = [], durationSeconds = 3) {
  const source = String(sceneText ?? '').slice(0, 4000);
  const cast = (Array.isArray(characters) ? characters : []).map(value => String(value ?? '').trim()).filter(Boolean);
  const duration = Number.isFinite(Number(durationSeconds)) && Number(durationSeconds) >= 0.25 && Number(durationSeconds) <= 30
    ? Number(durationSeconds) : 3;
  if (!source || !cast.length) return [];
  const quotePattern = /(?:^|[.!?。！？\n]\s*|\s)([\p{L}][\p{L}\p{M}'’-]{0,39})\s*(?:(?:говорит|сказал(?:а)?|спросил(?:а)?|ответил(?:а)?|шепчет|кричит|прошептал(?:а)?|says?|said|asks?|asked|replies?|whispers?|shouts?)\s*:\s*|:\s*)[«“"]([^»”"]{1,500})[»”"]/giu;
  const found = [];
  let match;
  while ((match = quotePattern.exec(source)) !== null) {
    const rawSpeaker = match[1].toLocaleLowerCase();
    const speaker = cast.find(id => id.toLocaleLowerCase() === rawSpeaker);
    if (!speaker) continue;
    const line = match[2].trim();
    if (!line) continue;
    found.push({ characterId: speaker, text: line });
    if (found.length >= 20) break;
  }
  if (!found.length) return [];
  const weights = found.map(item => Math.max(1, item.text.length));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  return found.map((item, index) => {
    const startSeconds = Number(cursor.toFixed(3));
    cursor += duration * weights[index] / totalWeight;
    return {
      id: `dialogue_${index + 1}`,
      characterId: item.characterId,
      text: item.text,
      startSeconds,
      endSeconds: Number((index === found.length - 1 ? duration : cursor).toFixed(3))
    };
  });
}

function buildCharacterBible(brief, fallbackCharacter) {
  const profiles = Array.isArray(brief.characterProfiles) ? brief.characterProfiles : [];
  if (profiles.length) return profiles.slice(0, 20);
  const ids = brief.characters.length ? brief.characters : [fallbackCharacter];
  return ids.slice(0, 20).map(characterId => ({
    characterId,
    visualDescription: '',
    clothing: '',
    colors: '',
    distinctiveFeatures: ''
  }));
}

function sceneState(text, kind, locale) {
  const sentences = splitSentences(text);
  if (kind === 'start') {
    if (sentences.length > 1) return sentences[0].slice(0, 700);
    return locale === 'ru' || locale === 'uk'
      ? 'Персонажи и окружение находятся в исходном положении перед описанным действием.'
      : 'Characters and setting are in their initial positions before the described action.';
  }
  if (sentences.length > 1) return sentences[sentences.length - 1].slice(0, 700);
  return locale === 'ru' || locale === 'uk'
    ? 'Покажи непосредственный результат описанного действия, не добавляя нового события.'
    : 'Show the immediate result of the described action without adding a new event.';
}

function sceneCamera(index, locale, directiveCamera) {
  if (directiveCamera) return directiveCamera;
  const beats = BEATS[locale];
  if (index < beats.length) return beats[index].camera;
  return EXTRA_BEATS[locale][Math.min(index - beats.length, EXTRA_BEATS[locale].length - 1)].camera;
}

/**
 * Creates scene-ready production fields from one plain-language story.
 * Explicit numbered scene blocks take priority over generic five-beat scaffolding.
 */
export function buildStoryboardFromText(idea, lang = 'ru', character = 'Foxy') {
  const locale = Object.hasOwn(BEATS, lang) ? lang : 'en';
  const subject = String(character ?? '').trim().slice(0, 120) || (locale === 'ru' || locale === 'uk' ? 'Персонаж' : locale === 'es' ? 'Personaje' : 'Character');
  const brief = parseStoryBrief(idea);
  const fallback = brief.characters[0] || subject;
  const characterIds = brief.characters.length ? brief.characters : [fallback];
  const characterBible = buildCharacterBible(brief, fallback);
  const explicitScenes = brief.sceneBlocks;
  const sentences = splitSentences(brief.storyText);
  const fallbackSentences = sentences.length ? sentences : [FALLBACK[locale]];
  const sceneCount = Math.max(3, Math.min(STORYBOARD_SCENE_LIMIT,
    explicitScenes.length || brief.requestedSceneCount || STORYBOARD_BEAT_COUNT));
  const distributed = distributeStoryDetails(fallbackSentences, sceneCount);
  const directiveText = formatProductionDirectives(brief.directives);
  const sceneInputs = explicitScenes.length
    ? Array.from({ length: sceneCount }, (_, index) => {
        const source = explicitScenes[index];
        return source ? { title: source.title, text: source.text } : { title: '', text: distributed[index] };
      })
    : Array.from({ length: sceneCount }, (_, index) => ({ title: '', text: distributed[index] }));

  const scenes = sceneInputs.map((input, index) => {
    const beat = BEATS[locale][Math.min(index, BEATS[locale].length - 1)];
    const title = input.title || beat.title || EXTRA_BEATS[locale][Math.min(index - BEATS[locale].length, EXTRA_BEATS[locale].length - 1)]?.title || `Scene ${index + 1}`;
    const storyDetail = String(input.text || '').trim().slice(0, 1600);
    const characters = sceneCharacters(storyDetail, characterIds, fallback);
    const camera = sceneCamera(index, locale, brief.directives.camera);
    const action = storyDetail
      ? (locale === 'ru' || locale === 'uk' ? `Анимируй только действия, описанные в этой сцене: ${storyDetail}` : `Animate only the actions described in this scene: ${storyDetail}`)
      : beat.action;
    const style = brief.directives.style ? `Visual style: ${brief.directives.style}.` : '';
    const genre = brief.directives.genre ? `Genre: ${brief.directives.genre}.` : '';
    const mood = brief.directives.mood ? `Mood: ${brief.directives.mood}.` : '';
    const format = brief.directives.format ? `Frame format: ${brief.directives.format}.` : '';
    const characterLock = characterBible
      .filter(profile => characters.some(id => id.toLowerCase() === profile.characterId.toLowerCase()))
      .map(profile => [profile.characterId, profile.visualDescription, profile.clothing, profile.colors, profile.distinctiveFeatures].filter(Boolean).join(' — '))
      .filter(Boolean).join(' | ');
    const continuityLock = [
      characterLock,
      brief.directives.avoid ? `Avoid: ${brief.directives.avoid}` : '',
      locale === 'ru' || locale === 'uk' ? 'Сохраняй одинаковую внешность и пропорции персонажей между сценами.' : 'Keep character appearance and proportions consistent across scenes.'
    ].filter(Boolean).join('\n');
    const imagePrompt = [title, storyDetail, style, genre, mood, format, characterLock].filter(Boolean).join('\n');
    const motionPrompt = [action, mood].filter(Boolean).join('\n');
    const description = [storyDetail || beat.action, style, genre, mood, format].filter(Boolean).join('\n');
    const startState = sceneState(storyDetail, 'start', locale);
    const endState = sceneState(storyDetail, 'end', locale);
    const visibleAction = storyDetail || beat.action;
    const negativePrompt = [DEFAULT_NEGATIVE, brief.directives.avoid ? `User constraints: ${brief.directives.avoid}` : ''].filter(Boolean).join(' ');
    return {
      id: `scene_${index + 1}`,
      order: index + 1,
      title,
      description,
      purpose: title,
      characters,
      interactions: inferSceneInteractions(storyDetail, characters),
      emotion: inferSceneEmotion(storyDetail),
      emotionTimeline: inferSceneEmotionTimeline(storyDetail, brief.requestedDurationSeconds || 3),
      visibleAction,
      camera,
      imagePrompt,
      motionPrompt,
      startState,
      endState,
      continuityLock,
      negativePrompt,
      prompt: imagePrompt,
      storyDetail,
      productionDirectives: brief.directives,
      sourceStoryText: brief.storyText,
      sourceEvents: storyDetail ? splitSentences(storyDetail) : brief.keyEvents,
      durationSeconds: brief.requestedDurationSeconds || null,
      dialogue: [],
      dialogueTimeline: inferSceneDialogueTimeline(storyDetail, characters, brief.requestedDurationSeconds || 3),
      sound: '',
      transition: index === 0 ? 'fade-in' : 'crossfade'
    };
  });

  return {
    titles: scenes.map(scene => scene.title),
    descriptions: scenes.map(scene => scene.description),
    scenes,
    brief,
    mainCharacter: fallback,
    characterBible
  };
}
