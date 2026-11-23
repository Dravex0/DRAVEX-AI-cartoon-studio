const STRATEGIES = Object.freeze({
  combat: {
    label: 'combat choreography',
    priorities: ['readable actor-versus-target geography', 'anticipation, strike or dodge, contact only when stated, and visible consequence', 'distinct silhouettes and safe screen spacing'],
    camera: 'Use clear wide geography before medium action coverage, then a brief close-up only for a story-relevant impact or reaction.'
  },
  chase: {
    label: 'chase and pursuit',
    priorities: ['clear pursuer and pursued identities', 'continuous travel direction and screen-space geography', 'obstacles, evasions, acceleration and changing distance only when supported by the source'],
    camera: 'Favor tracking and lateral follow shots; preserve travel direction across cuts and show obstacles before characters pass them.'
  },
  dialogue: {
    label: 'character dialogue',
    priorities: ['identify the current speaker from source dialogue', 'readable listening reactions without inventing new lines', 'speaker/listener eyelines and stable conversational positions'],
    camera: 'Use over-the-shoulder and alternating medium close-ups; hold on the listener only when a reaction is supported.'
  },
  dance: {
    label: 'dance and performance',
    priorities: ['repeatable rhythmic movement phrases', 'whole-body readable poses and grounded foot placement', 'clear transitions between steps without changing identity or costume'],
    camera: 'Use full-body framing for choreography; avoid cutting off feet or hands during important moves.'
  },
  sports: {
    label: 'sports action',
    priorities: ['track the ball or game object and the active player', 'preserve field/court orientation and player positions', 'show setup, attempt, outcome and reaction only where the prompt supports them'],
    camera: 'Use wide coverage for play geography and tighter tracking for the decisive play; keep the game object visible.'
  },
  discovery: {
    label: 'discovery and investigation',
    priorities: ['direct the character attention toward the exact discovered object or clue', 'show approach, inspection and evidence-based reaction', 'keep the clue visible and spatially consistent'],
    camera: 'Use an establishing view, a character point-of-view or insert of the clue, then a reaction shot.'
  },
  emotional: {
    label: 'emotional character acting',
    priorities: ['express emotion through face, gaze, posture and restrained gestures', 'preserve the emotional cause from the source', 'avoid adding physical events to a quiet moment'],
    camera: 'Prefer steady medium close-ups and patient reaction shots; keep camera movement subtle.'
  },
  horror: {
    label: 'suspense and horror',
    priorities: ['control what is visible and when it is revealed', 'preserve spatial continuity and the source of danger', 'build tension with pauses and character reactions, not invented threats'],
    camera: 'Use controlled negative space, deliberate reveals and restrained camera movement; do not hide required story information.'
  },
  transformation: {
    label: 'transformation and magical change',
    priorities: ['preserve the subject before, during and after the change', 'make the transformation progressive and temporally continuous', 'show environmental effects only when specified'],
    camera: 'Keep the transforming subject readable in a stable frame; use a detail shot for the changing feature when useful.'
  },
  travel: {
    label: 'travel and exploration',
    priorities: ['maintain route and direction of travel', 'show meaningful landmarks and changes of location', 'preserve character and carried-object continuity'],
    camera: 'Establish each new location with a wide shot, then follow the character through the space.'
  },
  comedy: {
    label: 'physical comedy',
    priorities: ['make setup, comic action and visible result easy to read', 'use precise timing and clear cause-and-effect', 'preserve physical safety and object continuity'],
    camera: 'Keep the full action readable; hold briefly on the result or reaction rather than cutting too quickly.'
  },
  fantasy: {
    label: 'fantasy and supernatural action',
    priorities: ['make the source and target of unusual effects explicit', 'preserve the rules and visual identity of magical elements', 'show character reactions and consequences grounded in the prompt'],
    camera: 'Use a clear view of caster, effect and target; avoid effects obscuring the essential action.'
  }
});

const PATTERNS = Object.freeze({
  combat: /\b(fight|fighting|battle|attack|attacks|punch|punches|kick|kicks|duel|clash| удар|дер[её]тся|дерется|дерётся|драка|бой|сражени|сражается|сражаются|атакует|бь[её]т|бьется|бьётся|ударяет|уклоняется|бій|б'ється|атакує|сутичк)\b/iu,
  chase: /\b(chase|chases|chasing|pursue|pursuit|escape|escapes|run away|runs away|runs after|гонк|погон|убегает|преследует|догоняет|втікає|переслідує|наздоганяє)\b/iu,
  dialogue: /\b(says|said|asks|replies|answers|whispers|shouts|conversation|talks|speaks|говорит|сказал|спрашивает|отвечает|шепчет|кричит|разговор|диалог|каже|запитує|відповідає|розмов)\b/iu,
  dance: /\b(dance|dances|dancing|dancer|choreography|танцует|танцуют|танец|танцев|хореограф|танцює|танцюють|танець)\b/iu,
  sports: /\b(football|soccer|basketball|tennis|volleyball|match|goal|scores|dribbles|играет в футбол|футбол|баскетбол|теннис|волейбол|матч|забивает гол|мяч|грає у футбол|забиває гол)\b/iu,
  discovery: /\b(discover|discovers|finds|find|notices|investigates|examines|searches|находит|обнаруживает|замечает|исследует|осматривает|ищет|знаходит|виявляє|помічає|досліджує|шукає)\b/iu,
  emotional: /\b(cries|cries|sad|lonely|comforts|hugs|reunites|misses|grieves|радуется|грустит|плачет|обнимает|скучает|утешает|воссоедин|печалится|смеется|смеётся|сумує|плаче|обіймає|радіє|втішає)\b/iu,
  horror: /\b(ghost|monster|haunted|terrified|creepy|scary|horror|suspense|страш|ужас|призрак|монстр|преследует тень|боится|испуган|жутк|привид|лякає|жах|моторош)\b/iu,
  transformation: /\b(transform|transforms|turns into|changes into|morphs|magically changes|превращается|превращение|меняет форму|преобразуется|перетворюється|перевтілюється|змінює форму)\b/iu,
  travel: /\b(travels|journey|explores|exploration|walks through|visits|arrives at|leaves for|путешествует|путешествие|исследует мир|идет через|идёт через|прибывает|отправляется|мандр|подорож|досліджує світ|прибуває)\b/iu,
  comedy: /\b(funny|comedy|slips|slips on|falls over|prank|joke|hilarious|смешн|комеди|поскальзывается|падает|розыгрыш|шутка|забавн|кумедн|жарт|падає)\b/iu,
  fantasy: /\b(magic|magical|spell|wizard|witch|dragon|fairy|portal|superpower|мгновенн|магия|волшеб|заклинани|волшебник|ведьма|дракон|фея|портал|сверхспособност|магія|заклят|чарівник|відьма|надздібност)\b/iu
});

function matchesUnicodeWordPattern(pattern, source) {
  const unicodeBoundaries = pattern.source
    .replace(/^\\b/u, '(?<![\\p{L}\\p{N}])')
    .replace(/\\b$/u, '(?![\\p{L}\\p{N}])');
  return new RegExp(unicodeBoundaries, pattern.flags).test(source);
}

const FALLBACK = Object.freeze({
  label: 'source-faithful general direction',
  priorities: ['preserve the exact events and characters from the prompt', 'make the described action visually readable', 'do not invent dialogue, props, interactions or plot events'],
  camera: 'Choose shot size and movement to serve the specific action; keep geography and character continuity clear.'
});

/**
 * Deterministic offline strategy routing. Multiple approaches may be selected when
 * the prompt genuinely combines them; no category is inferred from a character name.
 */
export function classifyPromptApproach(input = '') {
  const source = String(input ?? '').slice(0, 12000);
  const matches = Object.entries(PATTERNS)
    .filter(([, pattern]) => matchesUnicodeWordPattern(pattern, source))
    .map(([key]) => key);
  const primary = matches[0] || 'general';
  const selected = matches.length ? matches : ['general'];
  const rules = selected.map(key => key === 'general' ? FALLBACK : STRATEGIES[key]);
  return {
    schemaVersion: 1,
    primary,
    secondary: selected.slice(1),
    strategies: selected,
    labels: rules.map(rule => rule.label),
    priorities: [...new Set(rules.flatMap(rule => rule.priorities))],
    cameraGuidance: rules.map(rule => rule.camera).join(' '),
    evidence: source.slice(0, 1200)
  };
}

/** Apply prompt-specific direction without changing source story events or cast. */
export function applyPromptApproach(scene = {}, approach = null) {
  if (!approach || !Array.isArray(approach.priorities)) return { ...scene };
  const strategyText = [
    'Prompt-specific directing approach: ' + approach.labels.join(' + ') + '.',
    'Execution priorities: ' + approach.priorities.join('; ') + '.',
    'Camera strategy: ' + approach.cameraGuidance,
    'Source fidelity: do not add actions, characters, props, dialogue, causes, or outcomes absent from the source scene.'
  ].join(' ');
  return {
    ...scene,
    promptApproach: approach,
    camera: [scene.camera, approach.cameraGuidance].filter(Boolean).join(' '),
    motionPrompt: [scene.motionPrompt || scene.visibleAction, strategyText].filter(Boolean).join('\n')
  };
}
