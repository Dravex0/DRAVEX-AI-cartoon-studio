const LABELS = Object.freeze({
  ru: { style: 'style', genre: 'genre', mood: 'mood', format: 'format', sceneCount: 'sceneCount', duration: 'duration', camera: 'camera', voice: 'voice', music: 'music', language: 'language', characters: 'characters', avoid: 'avoid', audience: 'audience', action: 'action' },
  uk: { style: 'style', genre: 'genre', mood: 'mood', format: 'format', sceneCount: 'sceneCount', duration: 'duration', camera: 'camera', voice: 'voice', music: 'music', language: 'language', characters: 'characters', avoid: 'avoid', audience: 'audience', action: 'action' },
  en: { style: 'style', genre: 'genre', mood: 'mood', format: 'format', sceneCount: 'sceneCount', duration: 'duration', camera: 'camera', voice: 'voice', music: 'music', language: 'language', characters: 'characters', avoid: 'avoid', audience: 'audience', action: 'action' },
  es: { style: 'style', genre: 'genre', mood: 'mood', format: 'format', sceneCount: 'sceneCount', duration: 'duration', camera: 'camera', voice: 'voice', music: 'music', language: 'language', characters: 'characters', avoid: 'avoid', audience: 'audience', action: 'action' }
});

const ALIASES = new Map([
  ['style', 'style'], ['visual style', 'style'], ['стиль', 'style'], ['стиль мультфильма', 'style'], ['візуальний стиль', 'style'], ['estilo', 'style'],
  ['genre', 'genre'], ['жанр', 'genre'], ['género', 'genre'],
  ['mood', 'mood'], ['тон', 'mood'], ['настроение', 'mood'], ['настрій', 'mood'], ['ambiente', 'mood'],
  ['format', 'format'], ['aspect ratio', 'format'], ['формат', 'format'], ['соотношение сторон', 'format'], ['співвідношення сторін', 'format'],
  ['scenes', 'sceneCount'], ['scene count', 'sceneCount'], ['количество сцен', 'sceneCount'], ['сцен', 'sceneCount'], ['кількість сцен', 'sceneCount'],
  ['duration', 'duration'], ['длительность', 'duration'], ['тривалість', 'duration'],
  ['camera', 'camera'], ['camera plan', 'camera'], ['камера', 'camera'], ['ракурсы', 'camera'], ['ракурси', 'camera'],
  ['voice', 'voice'], ['voiceover', 'voice'], ['озвучка', 'voice'], ['голос', 'voice'], ['озвучення', 'voice'],
  ['music', 'music'], ['музыка', 'music'], ['музика', 'music'],
  ['language', 'language'], ['язык', 'language'], ['мова', 'language'],
  ['characters', 'characters'], ['персонажи', 'characters'], ['персонажі', 'characters'],
  ['avoid', 'avoid'], ['do not', 'avoid'], ['не добавлять', 'avoid'], ['не добавляй', 'avoid'], ['избегать', 'avoid'], ['не додавати', 'avoid'], ['уникати', 'avoid'],
  ['audience', 'audience'], ['для кого', 'audience'], ['аудитория', 'audience'], ['аудиторія', 'audience'],
  ['animation', 'action'], ['movement', 'action'], ['действия', 'action'], ['движения', 'action'], ['рухи', 'action'], ['анімація', 'action']
]);

const clean = (value, max = 12000) => String(value ?? '').replace(/\r/g, '').slice(0, max).trim();
const normalizeLabel = value => clean(value, 60).toLocaleLowerCase().replace(/[.!?]+$/u, '').replace(/\s+/g, ' ');

/**
 * Separates explicit production directions from the story while retaining the complete original brief.
 * Only recognized "Label: value" lines are extracted; ordinary narrative text is never discarded.
 */
export function parseStoryBrief(input) {
  const rawText = clean(input);
  const directives = {};
  const storyLines = [];
  const instructionLines = [];

  for (const line of rawText.split('\n')) {
    const match = line.match(/^\s*(?:[-*•]\s*)?([^:：]{2,60})\s*[:：]\s*(.{1,1000})\s*$/u);
    const key = match ? ALIASES.get(normalizeLabel(match[1])) : null;
    if (key && match[2].trim()) {
      directives[key] = directives[key] ? `${directives[key]}\n${match[2].trim()}` : match[2].trim();
      instructionLines.push(line.trim());
    } else if (line.trim()) {
      storyLines.push(line.trim());
    }
  }

  const storyText = storyLines.join('\n').trim() || rawText;
  const sentences = (storyText.match(/[^.!?。！？]+[.!?。！？]?/gu) || [])
    .map(part => part.trim()).filter(Boolean);
  const sceneCountMatch = directives.sceneCount?.match(/\d{1,2}/);
  const requestedSceneCount = sceneCountMatch ? Math.max(3, Math.min(8, Number(sceneCountMatch[0]))) : null;

  return {
    rawText,
    storyText,
    instructionText: instructionLines.join('\n'),
    directives,
    keyEvents: sentences.slice(0, 24),
    requestedSceneCount
  };
}

/** Build a compact, explicit production brief suitable for downstream AI prompts. */
export function formatProductionDirectives(directives = {}) {
  return Object.entries(directives)
    .filter(([, value]) => String(value ?? '').trim())
    .map(([key, value]) => `- ${key}: ${String(value).trim()}`)
    .join('\n');
}
