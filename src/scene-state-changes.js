/**
 * Conservative, source-grounded scene state changes.
 * Tracks only explicit object possession/open state and named-character location.
 * This is lexical extraction, not general semantic understanding.
 */
const VERBS = {
  en: [
    { re: /(?:picks up|takes|grabs|holds)/iu, property: 'holder', value: 'actor' },
    { re: /(?:drops|puts down|leaves behind)/iu, property: 'holder', value: null },
    { re: /opens/iu, property: 'openState', value: 'open' },
    { re: /closes/iu, property: 'openState', value: 'closed' }
  ],
  ru: [
    { re: /(?:поднимает|бер[её]т|забирает|держит)/iu, property: 'holder', value: 'actor' },
    { re: /(?:роняет|клад[её]т|оставляет)/iu, property: 'holder', value: null },
    { re: /открывает/iu, property: 'openState', value: 'open' },
    { re: /закрывает/iu, property: 'openState', value: 'closed' }
  ],
  uk: [
    { re: /(?:піднімає|бере|забирає|тримає)/iu, property: 'holder', value: 'actor' },
    { re: /(?:роняє|кладе|залишає)/iu, property: 'holder', value: null },
    { re: /відкриває/iu, property: 'openState', value: 'open' },
    { re: /закриває/iu, property: 'openState', value: 'closed' }
  ],
  es: [
    { re: /(?:recoge|toma|agarra|sostiene)/iu, property: 'holder', value: 'actor' },
    { re: /(?:suelta|deja caer|deja)/iu, property: 'holder', value: null },
    { re: /abre/iu, property: 'openState', value: 'open' },
    { re: /cierra/iu, property: 'openState', value: 'closed' }
  ]
};

const LOCATION_VERBS = {
  en: [
    { re: /(?:enters|goes into|walks into)/iu, value: 'inside' },
    { re: /(?:leaves|exits|walks out of)/iu, value: 'outside' }
  ],
  ru: [
    { re: /(?:входит в|заходит в)/iu, value: 'inside' },
    { re: /(?:выходит из|покидает)/iu, value: 'outside' }
  ],
  uk: [
    { re: /(?:входить у|входить до|заходить у|заходить до|заходить в)/iu, value: 'inside' },
    { re: /(?:виходить з|виходить із|покидає)/iu, value: 'outside' }
  ],
  es: [
    { re: /(?:entra en|entra a)/iu, value: 'inside' },
    { re: /(?:sale de|abandona)/iu, value: 'outside' }
  ]
};

const clean = (value, max = 160) => String(value ?? '').trim()
  .replace(/^[\s"'«»“”‘’]+|[\s"'«»“”‘’]+$/gu, '').slice(0, max);
const escapeRegExp = value => [...String(value)].map(char => '.*+?^$|{}()[]'.includes(char) || char === String.fromCharCode(92) ? String.fromCharCode(92) + char : char).join('');
const boundary = '(?<![\\p{L}\\p{N}])';
const tailBoundary = '(?![\\p{L}\\p{N}])';
const cutTail = value => clean(String(value ?? '')
  .split(/\s+(?:and|then|while|и|а|та|потім|і|y|luego|mientras)\s+|[.!?,;:]/iu)[0]
  .replace(/^(?:the|a|an|этот|эта|это|эту|этого|этой|цей|ця|це|цю|el|la|los|las|un|una)\s+/iu, ''));

function findEntity(source, actorId, verb) {
  const actor = new RegExp(boundary + escapeRegExp(actorId) + tailBoundary, 'iu');
  const actorMatch = actor.exec(source);
  if (!actorMatch) return null;
  const afterActor = source.slice(actorMatch.index + actorMatch[0].length);
  const verbMatch = verb.re.exec(afterActor);
  if (!verbMatch) return null;
  const entity = cutTail(afterActor.slice(verbMatch.index + verbMatch[0].length));
  if (!entity || entity.length > 100 || /^(?:it|them|him|her|его|её|ее|их|його|її|їх)$/iu.test(entity)) return null;
  return { entity, evidence: clean(source, 1_200) };
}

export function inferStoryboardStateChanges(scenes = [], language = 'en', fallbackCharacter = '') {
  const locale = Object.hasOwn(VERBS, language) ? language : 'en';
  const list = Array.isArray(scenes) ? scenes : [];
  const knownStates = new Map();
  return list.map(scene => {
    const source = clean(scene?.storyDetail, 1_200);
    const cast = Array.isArray(scene?.characters) && scene.characters.length
      ? scene.characters.map(value => clean(value, 120)).filter(Boolean)
      : [clean(fallbackCharacter, 120)].filter(Boolean);
    if (!source || !cast.length) return [];
    const changes = [];
    for (const actorId of cast) {
      for (const verb of VERBS[locale]) {
        const found = findEntity(source, actorId, verb);
        if (!found) continue;
        const entityId = found.entity;
        const property = verb.property;
        const key = 'prop:' + entityId.toLocaleLowerCase() + ':' + property;
        const previousValue = knownStates.has(key) ? knownStates.get(key) : null;
        const value = verb.value === 'actor' ? actorId : verb.value;
        if (previousValue === value) continue;
        changes.push({ entityType: 'prop', entityId, property, previousValue, value, actorId, evidence: found.evidence });
        knownStates.set(key, value);
      }
      const actor = new RegExp(boundary + escapeRegExp(actorId) + tailBoundary, 'iu');
      const actorMatch = actor.exec(source);
      if (!actorMatch) continue;
      const afterActor = source.slice(actorMatch.index + actorMatch[0].length);
      for (const verb of LOCATION_VERBS[locale]) {
        const verbMatch = verb.re.exec(afterActor);
        if (!verbMatch) continue;
        const place = cutTail(afterActor.slice(verbMatch.index + verbMatch[0].length));
        if (!place || place.length > 100) continue;
        const value = verb.value + ':' + place;
        const key = 'character:' + actorId.toLocaleLowerCase() + ':location';
        const previousValue = knownStates.has(key) ? knownStates.get(key) : null;
        if (previousValue === value) continue;
        changes.push({
          entityType: 'character', entityId: actorId, property: 'location',
          previousValue, value, actorId, evidence: clean(source, 1_200)
        });
        knownStates.set(key, value);
      }
    }
    return changes;
  });
}
