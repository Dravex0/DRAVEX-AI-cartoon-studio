const ALIASES = new Map([
  ['style', 'style'], ['visual style', 'style'], ['стиль', 'style'], ['стиль мультфильма', 'style'], ['візуальний стиль', 'style'], ['estilo', 'style'],
  ['genre', 'genre'], ['жанр', 'genre'], ['género', 'genre'],
  ['mood', 'mood'], ['тон', 'mood'], ['настроение', 'mood'], ['настрій', 'mood'], ['ambiente', 'mood'],
  ['format', 'format'], ['aspect ratio', 'format'], ['формат', 'format'], ['соотношение сторон', 'format'], ['співвідношення сторін', 'format'],
  ['scenes', 'sceneCount'], ['scene count', 'sceneCount'], ['количество сцен', 'sceneCount'], ['сцен', 'sceneCount'], ['кількість сцен', 'sceneCount'],
  ['duration', 'duration'], ['scene duration', 'duration'], ['длительность', 'duration'], ['длительность сцены', 'duration'], ['тривалість', 'duration'],
  ['camera', 'camera'], ['camera plan', 'camera'], ['камера', 'camera'], ['ракурсы', 'camera'], ['ракурси', 'camera'],
  ['voice', 'voice'], ['voiceover', 'voice'], ['озвучка', 'voice'], ['голос', 'voice'], ['озвучення', 'voice'],
  ['music', 'music'], ['музыка', 'music'], ['музика', 'music'],
  ['language', 'language'], ['язык', 'language'], ['мова', 'language'],
  ['characters', 'characters'], ['персонажи', 'characters'], ['персонажі', 'characters'], ['главные герои', 'characters'], ['главные персонажи', 'characters'], ['головні герої', 'characters'],
  ['avoid', 'avoid'], ['do not', 'avoid'], ['не добавлять', 'avoid'], ['не добавляй', 'avoid'], ['избегать', 'avoid'], ['не додавати', 'avoid'], ['уникати', 'avoid'],
  ['audience', 'audience'], ['для кого', 'audience'], ['аудитория', 'audience'], ['аудиторія', 'audience'],
  ['animation', 'action'], ['movement', 'action'], ['действия', 'action'], ['движения', 'action'], ['рухи', 'action'], ['анімація', 'action']
]);

const clean = (value, max = 12000) => String(value ?? '').replace(/\r/g, '').slice(0, max).trim();
const normalizeLabel = value => clean(value, 60).toLocaleLowerCase().replace(/[.!?]+$/u, '').replace(/\s+/g, ' ');
const clampSceneCount = value => Math.max(3, Math.min(8, Number(value) || 5));

function parseDurationSeconds(value) {
  const source = clean(value, 80).replace(',', '.');
  const match = source.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(?:s|sec(?:onds?)?|seconds?|сек(?:унд(?:ы|у|у)?|\.)?|с)?\s*$/iu);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? Math.max(0.25, Math.min(30, seconds)) : null;
}

function appendDirective(directives, key, value) {
  const normalized = clean(value, 1000);
  if (!normalized) return;
  directives[key] = directives[key] ? `${directives[key]}\n${normalized}` : normalized;
}

function sceneHeading(line) {
  const match = clean(line, 3000).match(/^\s*(?:сцена|scene|escena)\s*(\d{1,2})\s*(?:[.·:)-]|[—–])?\s*(.*)$/iu);
  return match ? { number: Number(match[1]), title: clean(match[2], 200) } : null;
}

function parseCharacterLine(line) {
  const match = clean(line, 1800).match(/^\s*([^—–-]{1,80}?)\s*[—–-]\s*(.{3,})$/u);
  if (!match) return null;
  const characterId = clean(match[1], 80).replace(/[.:]+$/u, '');
  return characterId ? { characterId, visualDescription: clean(match[2], 1200), clothing: '', colors: '', distinctiveFeatures: '' } : null;
}

/**
 * Separates narrative, numbered scene blocks and production directions.
 * Supports both one-direction-per-line and compact directions separated by middle dots.
 */
export function parseStoryBrief(input) {
  const rawText = clean(input);
  const directives = {};
  const storyLines = [];
  const instructionLines = [];
  const sceneBlocks = [];
  const characterProfiles = [];
  let activeScene = null;
  let readingCharacterProfiles = false;

  const addStoryText = value => {
    const text = clean(value, 3000);
    if (!text) return;
    if (activeScene) activeScene.lines.push(text);
    else storyLines.push(text);
  };

  for (const rawLine of rawText.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      readingCharacterProfiles = false;
      continue;
    }

    const heading = sceneHeading(line);
    if (heading) {
      activeScene = { number: heading.number, title: heading.title || `Scene ${heading.number}`, lines: [] };
      sceneBlocks.push(activeScene);
      readingCharacterProfiles = false;
      continue;
    }

    const parts = line.split(/\s+[·•]\s+/u);
    const remaining = [];
    let foundDirective = false;
    for (const part of parts) {
      const match = part.match(/^\s*([^:：]{2,60})\s*[:：]\s*(.{0,1000})\s*$/u);
      const key = match ? ALIASES.get(normalizeLabel(match[1])) : null;
      if (key && (match[2].trim() || key === 'characters')) {
        appendDirective(directives, key, match[2]);
        instructionLines.push(part.trim());
        foundDirective = true;
        readingCharacterProfiles = key === 'characters';
      } else {
        remaining.push(part.trim());
      }
    }

    if (readingCharacterProfiles && !foundDirective) {
      const profile = parseCharacterLine(line);
      if (profile) {
        characterProfiles.push(profile);
        appendDirective(directives, 'characters', profile.characterId);
        continue;
      }
    }

    const remainder = remaining.join(' · ').trim();
    if (remainder) {
      const profile = readingCharacterProfiles ? parseCharacterLine(remainder) : null;
      if (profile) {
        characterProfiles.push(profile);
        appendDirective(directives, 'characters', profile.characterId);
      } else {
        addStoryText(remainder);
      }
    }
  }

  // A second pass makes multi-line character sections reliable.
  const extractedProfiles = [];
  let inCharacterSection = false;
  for (const rawLine of rawText.split('\n')) {
    const line = rawLine.trim();
    if (!line) { inCharacterSection = false; continue; }
    if (/^(?:главные герои|главные персонажи|персонажи|головні герої|персонажі|characters)\s*[:：]\s*$/iu.test(line)) {
      inCharacterSection = true;
      continue;
    }
    if (sceneHeading(line) || /^\s*[^:：]{2,60}\s*[:：]/u.test(line)) {
      inCharacterSection = false;
      continue;
    }
    if (inCharacterSection) {
      const profile = parseCharacterLine(line);
      if (profile) extractedProfiles.push(profile);
    }
  }
  for (const profile of extractedProfiles) {
    if (!characterProfiles.some(item => item.characterId.toLowerCase() === profile.characterId.toLowerCase())) {
      characterProfiles.push(profile);
      appendDirective(directives, 'characters', profile.characterId);
    }
  }

  // Also recognize natural-language introductions such as "лисёнок по имени Рыжик"
  // and "a rabbit named Snowball", so users do not need a separate cast section.
  const namedCharacterPattern = /([^.!?。！？\n]{0,140}?)(?:по имени|на имя|на ім'я|named)\s+([\p{L}][\p{L}'’-]{1,39})/giu;
  for (const match of rawText.matchAll(namedCharacterPattern)) {
    const characterId = clean(match[2], 80);
    if (!characterId || characterProfiles.some(item => item.characterId.toLowerCase() === characterId.toLowerCase())) continue;
    const visualDescription = clean(match[1], 500).replace(/^(?:утром|однажды|вдруг|then|one day|in the morning)\s+/iu, '');
    characterProfiles.push({ characterId, visualDescription, clothing: '', colors: '', distinctiveFeatures: '' });
    appendDirective(directives, 'characters', characterId);
  }

  const parsedSceneData = sceneBlocks.map((scene, index) => ({
    number: scene.number || index + 1,
    title: scene.title,
    text: scene.lines.join('\n').trim()
  }));
  // The storyboard engine supports up to eight generated scenes. Preserve overflow text
  // by appending it to scene eight instead of silently dropping user-authored scenes.
  const sceneData = parsedSceneData.length > 8
    ? [
        ...parsedSceneData.slice(0, 7),
        {
          ...parsedSceneData[7],
          text: [parsedSceneData[7].text, ...parsedSceneData.slice(8).map(scene => [scene.title, scene.text].filter(Boolean).join('\n'))].filter(Boolean).join('\n\n')
        }
      ]
    : parsedSceneData;
  const preamble = storyLines.join('\n').trim();
  const storyText = sceneData.length
    ? [preamble, ...sceneData.map(scene => [scene.title, scene.text].filter(Boolean).join('\n'))].filter(Boolean).join('\n\n')
    : preamble || rawText;

  const eventText = sceneData.length
    ? [preamble, ...sceneData.map(scene => scene.text)].filter(Boolean).join('\n')
    : storyText;
  const sentences = (eventText.match(/[^.!?。！？]+[.!?。！？]?/gu) || []).map(part => part.trim()).filter(Boolean);
  const sceneCountMatch = directives.sceneCount?.match(/\d{1,2}/);
  const requestedSceneCount = sceneData.length
    ? clampSceneCount(sceneData.length)
    : sceneCountMatch ? clampSceneCount(sceneCountMatch[0]) : null;
  const issues = [];
  if (sceneData.length && sceneCountMatch && Number(sceneCountMatch[0]) !== parsedSceneData.length) {
    issues.push({ code: 'scene-count-mismatch', explicitCount: parsedSceneData.length, requestedCount: Number(sceneCountMatch[0]), message: 'Explicit scene headings take precedence over the scene-count directive.' });
  }
  if (parsedSceneData.length > 8) {
    issues.push({ code: 'scene-count-limit', explicitCount: parsedSceneData.length, supportedCount: 8, message: 'Scenes after number eight were preserved in the final scene.' });
  }
  const requestedDurationSeconds = directives.duration ? parseDurationSeconds(directives.duration) : null;

  const namesFromDirective = clean(directives.characters, 1000)
    .split(/[,;\n]/u).map(value => clean(value, 80)).filter(Boolean);
  const characters = [...new Set([...characterProfiles.map(profile => profile.characterId), ...namesFromDirective])];

  return {
    rawText,
    storyText,
    instructionText: instructionLines.join('\n'),
    directives,
    requestedSceneCount,
    requestedDurationSeconds,
    issues,
    keyEvents: sentences.slice(0, 48),
    sceneBlocks: sceneData,
    characters,
    characterProfiles
  };
}

/** Build a compact, explicit production brief suitable for downstream AI prompts. */
export function formatProductionDirectives(directives = {}) {
  return Object.entries(directives)
    .filter(([, value]) => String(value ?? '').trim())
    .map(([key, value]) => `- ${key}: ${String(value).trim()}`)
    .join('\n');
}
