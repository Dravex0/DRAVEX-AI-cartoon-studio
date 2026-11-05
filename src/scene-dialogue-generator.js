const clean = (value, max = 500) => String(value ?? '').trim().replace(/\s+/gu, ' ').slice(0, max);
const SUPPORTED_LANGUAGES = new Set(['en', 'ru', 'uk', 'es']);

function extractBalancedJson(source) {
  for (let start = 0; start < source.length; start += 1) {
    if (source[start] !== '{' && source[start] !== '[') continue;
    const stack = [];
    let inString = false;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') { inString = true; continue; }
      if (char === '{' || char === '[') stack.push(char);
      else if (char === '}' || char === ']') {
        const opening = stack.pop();
        if ((char === '}' && opening !== '{') || (char === ']' && opening !== '[')) break;
        if (!stack.length) return source.slice(start, index + 1);
      }
    }
  }
  return '';
}

function parseJsonWithTrailingCommaRepair(source) {
  try { return JSON.parse(source); } catch { /* Apply only a string-aware trailing-comma repair. */ }
  let output = '';
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === '\\\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; output += char; continue; }
    if (char === ',') {
      let next = index + 1;
      while (/\\s/u.test(source[next] || '')) next += 1;
      if (source[next] === '}' || source[next] === ']') continue;
    }
    output += char;
  }
  try { return JSON.parse(output); } catch { return null; }
}

function parseDialoguePayload(raw) {
  const source = String(raw ?? '').trim()
    .replace(/^\\s*```(?:json)?\\s*/i, '')
    .replace(/\\s*```\\s*$/i, '')
    .trim();
  if (!source) return null;
  const candidates = [source, extractBalancedJson(source)].filter(Boolean);
  for (const candidate of candidates) {
    const parsed = parseJsonWithTrailingCommaRepair(candidate);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.dialogue)) return parsed.dialogue;
    if (Array.isArray(parsed?.lines)) return parsed.lines;
  }
  return null;
}

function speakerKey(value) {
  return clean(value, 120).toLocaleLowerCase();
}

/** Build a source-grounded, single-scene dialogue prompt for the local model. */
export function buildSceneDialoguePrompt({
  sourceRequest = '',
  scene = {},
  sceneNumber = 1,
  sceneCount = 1,
  language = 'en',
  mainCharacter = '',
  characterBible = []
} = {}) {
  const locale = SUPPORTED_LANGUAGES.has(String(language)) ? String(language) : 'en';
  const allowedCharacters = Array.isArray(scene.characters) && scene.characters.length
    ? scene.characters.map(value => clean(value, 120)).filter(Boolean)
    : [clean(mainCharacter, 120)].filter(Boolean);
  const allowedKeys = new Set(allowedCharacters.map(value => value.toLocaleLowerCase()));
  const relevantBible = (Array.isArray(characterBible) ? characterBible : [])
    .filter(profile => profile && allowedKeys.has(clean(profile.characterId, 120).toLocaleLowerCase()))
    .slice(0, 4)
    .map(profile => ({
      characterId: clean(profile.characterId, 120),
      visualDescription: clean(profile.visualDescription, 220),
      clothing: clean(profile.clothing, 140),
      distinctiveFeatures: clean(profile.distinctiveFeatures, 140)
    }));
  return [
    'You are DRAVEX, a careful dialogue writer for an animated film.',
    'Write short, natural spoken lines for exactly one storyboard scene. Do not rewrite the scene or add new events.',
    'Return ONLY valid JSON in this exact shape: {"dialogue":[{"characterId":"...","text":"..."}]}.',
    'Write 1 to 4 concise lines. Each line must be speakable aloud and must fit the visible action.',
    'Use only these assigned character IDs: ' + JSON.stringify(allowedCharacters) + '. Use "Narrator" only when no assigned character can naturally speak.',
    'Do not invent characters, locations, objects, backstory, causes, or outcomes. Dialogue may express a reaction to facts already stated, but must not introduce new plot facts.',
    'Do not include stage directions, camera directions, sound effects, markdown, or speaker prefixes inside text.',
    'Write every line in this language: ' + locale + '.',
    'CHARACTER BIBLE: ' + JSON.stringify(relevantBible),
    'USER REQUEST: ' + clean(sourceRequest, 1800),
    'SCENE ' + sceneNumber + ' OF ' + sceneCount + ': ' + JSON.stringify({
      id: clean(scene.id, 120),
      title: clean(scene.title, 200),
      storyDetail: clean(scene.storyDetail, 1200),
      visibleAction: clean(scene.visibleAction, 1000),
      description: clean(scene.description || scene.prompt, 800),
      characters: allowedCharacters
    })
  ].join('\n\n');
}

/** Validate model dialogue against the scene's assigned cast and language. */
export function validateSceneDialogueResponse(raw, {
  scene = {},
  language = 'en',
  mainCharacter = '',
  maxLines = 4
} = {}) {
  const locale = SUPPORTED_LANGUAGES.has(String(language)) ? String(language) : 'en';
  const parsed = parseDialoguePayload(typeof raw === 'string' ? raw : raw?.text);
  if (!parsed) return { ok: false, reason: 'invalid-json' };
  if (parsed.length < 1 || parsed.length > Math.max(1, Math.min(8, Number(maxLines) || 4))) {
    return { ok: false, reason: 'invalid-line-count' };
  }
  const allowed = Array.isArray(scene.characters) && scene.characters.length
    ? scene.characters.map(value => clean(value, 120)).filter(Boolean)
    : [clean(mainCharacter, 120)].filter(Boolean);
  const allowedByKey = new Map(allowed.map(value => [speakerKey(value), value]));
  allowedByKey.set('narrator', 'Narrator');
  const dialogue = [];
  for (let index = 0; index < parsed.length; index += 1) {
    const line = parsed[index];
    if (!line || typeof line !== 'object' || Array.isArray(line)) {
      return { ok: false, reason: 'invalid-line-' + (index + 1) };
    }
    const requestedSpeaker = clean(line.characterId || (allowed.length === 1 ? allowed[0] : 'Narrator'), 120);
    const characterId = allowedByKey.get(speakerKey(requestedSpeaker));
    const text = clean(line.text, 500);
    if (!characterId) return { ok: false, reason: 'unknown-speaker-' + (index + 1) };
    if (text.length < 2) return { ok: false, reason: 'empty-line-' + (index + 1) };
    if (/^(?:[^:]{1,120}:)\s*/u.test(text)) return { ok: false, reason: 'speaker-prefix-in-text-' + (index + 1) };
    dialogue.push({ characterId, text, language: locale });
  }
  return { ok: true, dialogue };
}
