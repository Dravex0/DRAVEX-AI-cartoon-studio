const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max);
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);

function extractObject(source) {
  const text = clean(source, 30000).replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try {
    const parsed = JSON.parse(text);
    if (isRecord(parsed)) return parsed;
  } catch { /* Try to extract one balanced JSON object. */ }
  let depth = 0, inString = false, escaped = false, start = -1;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; continue; }
    if (char === '{') { if (depth === 0) start = index; depth += 1; }
    else if (char === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        try {
          const parsed = JSON.parse(text.slice(start, index + 1));
          if (isRecord(parsed)) return parsed;
        } catch { return null; }
      }
      if (depth < 0) return null;
    }
  }
  return null;
}

const LANGUAGE_NAMES = { en: 'English', ru: 'Russian', uk: 'Ukrainian', es: 'Spanish' };

export function buildSceneDialoguePrompt({ scene, language = 'en', request = '', characterBible = [] } = {}) {
  if (!isRecord(scene) || !clean(scene.id, 120)) throw new TypeError('A scene with a stable ID is required.');
  const locale = Object.hasOwn(LANGUAGE_NAMES, language) ? language : 'en';
  const characters = Array.isArray(scene.characters)
    ? scene.characters.map(value => clean(value, 120)).filter(Boolean).slice(0, 12)
    : [];
  const source = {
    sceneId: clean(scene.id, 120),
    title: clean(scene.title, 200),
    storyDetail: clean(scene.storyDetail, 1200),
    visibleAction: clean(scene.visibleAction, 1000),
    description: clean(scene.description || scene.prompt, 1600),
    assignedCharacters: characters
  };
  const relevantBible = Array.isArray(characterBible)
    ? characterBible.filter(entry => characters.some(name => name.toLowerCase() === clean(entry?.characterId || entry?.name, 120).toLowerCase())).slice(0, 12)
    : [];
  return [
    'You are writing short, filmable dialogue for one scene in a storyboard.',
    'Return ONLY JSON with this exact shape: {"sceneId":"...","lines":[{"speaker":"...","text":"..."}]}.',
    'Use ' + LANGUAGE_NAMES[locale] + ' only.',
    'Write 1 or 2 concise spoken lines, each no longer than 240 characters.',
    'Use only the exact speaker IDs in assignedCharacters, or "Narrator" for voice-over. Do not invent or rename speakers.',
    'The words must fit the visible action and source story detail. Do not add new plot events, props, locations, or outcomes.',
    'Avoid describing an action that is not visible in this scene. Do not add stage directions, sound effects, markdown, or explanations.',
    'If a character is visibly acting, prefer a natural short line from that character; use Narrator only when narration is requested or the scene has no assigned speaking character.',
    'USER REQUEST: ' + clean(request, 1200),
    'LOCKED SCENE SOURCE: ' + JSON.stringify(source),
    'LOCKED CHARACTER REFERENCES: ' + JSON.stringify(relevantBible)
  ].join('\n\n');
}

export function parseSceneDialogueResponse(response, scene, language = 'en') {
  if (!isRecord(scene) || !clean(scene.id, 120)) return { ok: false, reason: 'invalid-scene' };
  const parsed = extractObject(response);
  if (!parsed) return { ok: false, reason: 'invalid-json' };
  if (clean(parsed.sceneId, 120) !== clean(scene.id, 120)) return { ok: false, reason: 'scene-id-mismatch' };
  if (!Array.isArray(parsed.lines) || parsed.lines.length < 1 || parsed.lines.length > 2) {
    return { ok: false, reason: 'invalid-line-count' };
  }
  const allowed = new Set((Array.isArray(scene.characters) ? scene.characters : [])
    .map(value => clean(value, 120).toLowerCase()).filter(Boolean));
  allowed.add('narrator');
  const locale = Object.hasOwn(LANGUAGE_NAMES, language) ? language : 'en';
  const lines = [];
  for (const item of parsed.lines) {
    if (!isRecord(item)) return { ok: false, reason: 'invalid-line' };
    const speaker = clean(item.speaker, 120);
    const text = clean(item.text, 240);
    if (!speaker || !text) return { ok: false, reason: 'empty-speaker-or-text' };
    if (!allowed.has(speaker.toLowerCase())) return { ok: false, reason: 'unknown-speaker' };
    lines.push({ characterId: speaker, text, language: locale });
  }
  return { ok: true, sceneId: clean(scene.id, 120), lines };
}

export function selectScenesMissingDialogue(scenes) {
  if (!Array.isArray(scenes)) return [];
  return scenes.map((scene, index) => ({ scene, index }))
    .filter(({ scene }) => !Array.isArray(scene?.dialogue) || scene.dialogue.length === 0);
}

export async function generateSceneDialogue({ runtime, scene, language = 'en', request = '', characterBible = [], signal } = {}) {
  if (!runtime || typeof runtime.generate !== 'function') return { ok: false, reason: 'local-runtime-unavailable' };
  if (signal?.aborted) return { ok: false, reason: 'cancelled' };
  let generated;
  try {
    generated = await runtime.generate(buildSceneDialoguePrompt({ scene, language, request, characterBible }), {
      maxNewTokens: 256,
      temperature: 0.35,
      signal
    });
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') return { ok: false, reason: 'cancelled' };
    return { ok: false, reason: clean(error?.message, 300) || 'inference-failed' };
  }
  if (signal?.aborted) return { ok: false, reason: 'cancelled' };
  let result = parseSceneDialogueResponse(generated?.text, scene, language);
  if (!result.ok && !signal?.aborted) {
    try {
      generated = await runtime.generate(buildSceneDialoguePrompt({ scene, language, request, characterBible }) + '\n\nYour previous response failed validation: ' + result.reason + '. Return only the exact JSON object with this sceneId and 1 or 2 short lines from the assigned speakers.', {
        maxNewTokens: 256,
        temperature: 0.2,
        signal
      });
      if (signal?.aborted) return { ok: false, reason: 'cancelled' };
      result = parseSceneDialogueResponse(generated?.text, scene, language);
    } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') return { ok: false, reason: 'cancelled' };
      return { ok: false, reason: clean(error?.message, 300) || 'retry-inference-failed' };
    }
  }
  return result.ok
    ? { ...result, modelId: generated?.modelId || runtime.status?.modelId || null, backend: generated?.backend || runtime.status?.backend || null }
    : result;
}
