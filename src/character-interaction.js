const clean = value => String(value ?? '').trim().slice(0, 120);
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const RELATIONS = {
  en: [
    ['rescue', /\\b(rescues?|saves?)\\b/iu],
    ['attack', /\\b(attacks?|hits?|strikes?|pushes?)\\b/iu],
    ['chase', /\\b(chases?|pursues?|follows?)\\b/iu],
    ['help', /\\b(helps?|assists?|supports?)\\b/iu],
    ['guide', /\\b(guides?|leads?|shows)\\b/iu],
    ['give', /\\b(gives?|hands?|offers?)\\b/iu],
    ['warn', /\\b(warns?|alerts?)\\b/iu],
    ['talk', /\\b(tells?|asks?|answers?|speaks?\\s+to|talks?\\s+to)\\b/iu]
  ],
  ru: [
    ['rescue', /спаса(?:ет|ют)|выруча(?:ет|ют)/iu],
    ['attack', /атаку(?:ет|ют)|бь[её]т|ударя(?:ет|ют)|толка(?:ет|ют)/iu],
    ['chase', /преследу(?:ет|ют)|гонится\s+за|следу(?:ет|ют)\s+за/iu],
    ['help', /помога(?:ет|ют)|помог(?:ает|ают)|поддержива(?:ет|ют)/iu],
    ['guide', /вед[её]т|направля(?:ет|ют)|показыва(?:ет|ют)\s+(?:путь|дорогу)/iu],
    ['give', /да[её]т|переда[её]т|вруча(?:ет|ют)/iu],
    ['warn', /предупрежда(?:ет|ют)|предостерега(?:ет|ют)/iu],
    ['talk', /говорит\s+с|рассказыва(?:ет|ют)|спрашива(?:ет|ют)|отвеча(?:ет|ют)/iu]
  ],
  uk: [
    ['rescue', /ряту[єе]|визволя[єе]/iu],
    ['attack', /атаку[єе]|б[’']?є|б'є|штовха[єе]|б'ють/iu],
    ['chase', /пересліду[єе]|женеться\s+за|йде\s+за/iu],
    ['help', /допомага[єе]|підтриму[єе]/iu],
    ['guide', /веде|спрямову[єе]|показу[єе]\s+(?:шлях|дорогу)/iu],
    ['give', /да[єе]|переда[єе]|вруча[єе]/iu],
    ['warn', /попереджа[єе]|застеріга[єе]/iu],
    ['talk', /говорить\s+з|розповіда[єе]|запиту[єе]|відповіда[єе]/iu]
  ],
  es: [
    ['rescue', /\\b(rescata|salva)\\b/iu],
    ['attack', /\\b(ataca|golpea|empuja)\\b/iu],
    ['chase', /\\b(persigue|sigue)\\b/iu],
    ['help', /\\b(ayuda|apoya)\\b/iu],
    ['guide', /\\b(guía|guia|dirige|conduce)\\b/iu],
    ['give', /\\b(da|entrega|ofrece)\\b/iu],
    ['warn', /\\b(avisa|advierte)\\b/iu],
    ['talk', /\\b(dice|pregunta|responde|habla\\s+a)\\b/iu]
  ]
};

function occurrences(source, name) {
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])(${escapeRegExp(name)})(?=$|[^\\p{L}\\p{N}_])`, 'giu');
  const result = [];
  for (const match of source.matchAll(pattern)) {
    const offset = match.index + match[1].length;
    result.push({ start: offset, end: offset + match[2].length, name });
  }
  return result;
}

/**
 * Infer a directed character-to-character action only when one known character
 * appears unambiguously on each side of an explicit interaction verb.
 * This intentionally avoids guessing from pronouns or implied roles.
 */
export function inferCharacterInteraction(detail, characterIds = [], language = 'en') {
  const source = String(detail ?? '').trim();
  const locale = Object.hasOwn(RELATIONS, language) ? language : 'en';
  const names = [...new Set((Array.isArray(characterIds) ? characterIds : [])
    .map(clean).filter(Boolean))].slice(0, 12);
  if (!source || names.length < 2) return null;

  for (const [type, verbPattern] of RELATIONS[locale]) {
    const verb = verbPattern.exec(source);
    if (!verb) continue;
    const before = names.flatMap(name => occurrences(source.slice(0, verb.index), name))
      .sort((a, b) => b.end - a.end);
    const after = names.flatMap(name => occurrences(source.slice(verb.index + verb[0].length), name))
      .map(item => ({ ...item, start: item.start + verb.index + verb[0].length, end: item.end + verb.index + verb[0].length }))
      .sort((a, b) => a.start - b.start);
    if (!before.length || !after.length) continue;
    const actor = before[0].name;
    const target = after[0].name;
    if (actor.toLocaleLowerCase() === target.toLocaleLowerCase()) continue;
    // If the nearest side has a tie, the source does not establish a unique role.
    if (before.length > 1 && before[0].end === before[1].end && before[0].name !== before[1].name) continue;
    if (after.length > 1 && after[0].start === after[1].start && after[0].name !== after[1].name) continue;
    return {
      type,
      actorId: actor,
      targetId: target,
      evidence: source.slice(Math.max(0, before[0].start), Math.min(source.length, after[0].end)).slice(0, 500)
    };
  }
  return null;
}
