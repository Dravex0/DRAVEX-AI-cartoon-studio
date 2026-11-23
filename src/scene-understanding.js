import { extractSceneActionSequence, inferSceneActionIntent } from './scene-action.js';

const OBJECTS = Object.freeze({
  en: ['door','key','sword','shield','ball','apple','box','book','rope','ladder','stone','star','map','cup','bottle','phone','radio','bag','flower','car'],
  ru: ['дверь','ключ','меч','щит','мяч','яблоко','коробка','книга','верёвка','лестница','камень','звезда','карта','чашка','бутылка','телефон','рация','сумка','цветок','машина'],
  uk: ['двері','ключ','меч','щит','м’яч','яблуко','коробка','книга','мотузка','драбина','камінь','зірка','мапа','чашка','пляшка','телефон','рація','сумка','квітка','машина'],
  es: ['puerta','llave','espada','escudo','pelota','manzana','caja','libro','cuerda','escalera','piedra','estrella','mapa','taza','botella','teléfono','radio','bolsa','flor','coche']
});
const PERCEPTION_PATTERNS = [
  { type: 'visual_attention', patterns: [/\b(?:sees?|spots?|notices?|observes?|looks? at|stares? at)\b/iu, /видит|замеча[ею]т|смотрит на|наблюда[ею]т/iu, /бачить|поміча[єе]|дивиться на|спостеріга[єе]/iu, /ve|observa|mira a|nota/iu] },
  { type: 'auditory_attention', patterns: [/\b(?:hears?|listens? to|overhears?)\b/iu, /слышит|прислушива[ею]тся|услышал/iu, /чує|прислуха[єе]ться|почув/iu, /oye|escucha/iu] },
  { type: 'touch_contact', patterns: [/\b(?:touches?|feels?|grabs?|picks? up|catches?)\b/iu, /трога[ею]т|касается|хвата[ею]т|подбира[ею]т|ловит/iu, /торка[єе]ться|доторка[єе]ться|хапа[єе]|підбира[єе]|ловить/iu, /toca|agarra|recoge|atrapa/iu] },
  { type: 'object_possession', patterns: [/\b(?:holds?|carries?|wears?|keeps?)\b/iu, /держит|нес[её]т|носит/iu, /трима[єе]|несе|носить/iu, /sostiene|lleva|porta/iu] },
  { type: 'spatial_entry', patterns: [/\b(?:enters?|exits?|leaves?|approaches?|moves away from)\b/iu, /входит|выходит|покида[ею]т|подходит к|отходит от/iu, /входить|виходить|залиша[єе]|підходить до|відходить від/iu, /entra|sale|se acerca a|se aleja de/iu] },
  { type: 'speech', patterns: [/\b(?:says?|asks?|replies?|shouts?|whispers?|tells?)\b/iu, /говорит|спрашива[ею]т|отвеча[ею]т|кричит|шепчет/iu, /каже|запитує|відповіда[єе]|кричить|шепоче/iu, /dice|pregunta|responde|grita|susurra/iu] }
];
const escapeRegex = value => String(value).replace(/[.*+?^|[\]\\]/g, '\\$&');
function containsName(source, name) {
  return new RegExp('(?<![\\p{L}\\p{N}])' + escapeRegex(name) + '(?![\\p{L}\\p{N}])', 'iu').test(source);
}
function evidenceMatches(source, patterns, type) {
  const found = [];
  for (const pattern of patterns) {
    const scanner = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    let match;
    while ((match = scanner.exec(source))) {
      const prefix = source.slice(Math.max(0, match.index - 24), match.index);
      if (!/(?:\\b(?:not|never|no|without|doesn't|don't|didn't)\\s*|не\\s*|ні\\s*)$/iu.test(prefix)) {
        found.push({ type, evidence: match[0], startIndex: match.index, endIndex: match.index + match[0].length, confidence: 0.85 });
      }
      if (!match[0]) scanner.lastIndex++;
    }
  }
  return found;
}

/** Text-grounded scene interpretation, not visual computer vision. */
export function understandScenePrompt(input = '', { characters = [], interactions = [], locale = 'en' } = {}) {
  const source = String(input ?? '').normalize('NFKC').slice(0, 12000);
  const language = Object.hasOwn(OBJECTS, locale) ? locale : 'en';
  const characterEntities = [...new Set((Array.isArray(characters) ? characters : []).map(v => String(v ?? '').trim()).filter(Boolean))]
    .filter(name => containsName(source, name))
    .map(name => ({ id: name, type: 'character', evidence: name, confidence: 1 }));
  const objectEntities = OBJECTS[language].filter(name => containsName(source, name))
    .map(name => ({ id: name, type: 'object', evidence: name, confidence: 0.9 }));
  const perception = PERCEPTION_PATTERNS.flatMap(entry => evidenceMatches(source, entry.patterns, entry.type))
    .sort((a, b) => a.startIndex - b.startIndex);
  const actions = extractSceneActionSequence(source).map(event => ({
    intent: event.intent, motionCue: event.motionCue, evidence: event.evidence,
    startIndex: event.startIndex, endIndex: event.endIndex, confidence: event.confidence
  }));
  const directedInteractions = (Array.isArray(interactions) ? interactions : []).map(item => ({
    type: String(item?.type ?? 'interaction'), actorId: String(item?.actorId ?? ''),
    targetId: String(item?.targetId ?? ''), evidence: String(item?.evidence ?? ''), confidence: 0.9
  })).filter(item => item.actorId && item.targetId && item.evidence);
  const primaryIntent = inferSceneActionIntent(source);
  const unresolved = actions.filter(action => ['attack','chase','hug','rescue','restrain','catch','throw'].includes(action.intent))
    .filter(action => !directedInteractions.some(item => item.evidence && source.includes(item.evidence)))
    .map(action => ({ type: 'unresolved-interaction-target', intent: action.intent, evidence: action.evidence }));
  return {
    schemaVersion: 1, source: source.slice(0, 1200), primaryIntent,
    entities: [...characterEntities, ...objectEntities], perception, actions,
    interactions: directedInteractions, unresolved,
    constraints: [
      'Only source-mentioned entities and events are considered known.',
      'Textual perception cues do not prove visual detection in an image or video.',
      'Unknown targets, object states, contact, and outcomes must remain unresolved rather than guessed.'
    ]
  };
}

export function formatSceneUnderstandingForMotion(understanding = {}) {
  if (!understanding || understanding.schemaVersion !== 1) return '';
  const entities = (understanding.entities || []).map(item => item.id + ' (' + item.type + ')');
  const interactions = (understanding.interactions || []).map(item => item.actorId + ' -> ' + item.targetId + ' (' + item.type + ')');
  const actions = (understanding.actions || []).map(item => item.intent + ': ' + item.evidence);
  const perception = (understanding.perception || []).map(item => item.type + ': ' + item.evidence);
  return [
    'Source-grounded scene understanding:',
    entities.length ? 'Known entities: ' + entities.join(', ') : 'Known entities: none explicitly resolved.',
    actions.length ? 'Ordered events: ' + actions.join(' | ') : 'Ordered events: none confidently detected.',
    interactions.length ? 'Directed interactions: ' + interactions.join(' | ') : 'Directed interactions: none explicitly resolved.',
    perception.length ? 'Perception cues: ' + perception.join(' | ') : 'Perception cues: none explicitly stated.',
    (understanding.unresolved || []).length ? 'Unresolved details (do not guess): ' + understanding.unresolved.map(item => item.intent + ' target unresolved').join('; ') : '',
    'Do not invent visual observations, participants, object ownership, physical contact, or consequences.'
  ].filter(Boolean).join('\n');
}
