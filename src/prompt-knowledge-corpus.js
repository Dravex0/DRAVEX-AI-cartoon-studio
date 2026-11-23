const ACTORS = ['Arin','Elira','Nox','Foxy','Bird','Mira','Kiro','Luna','Rex','Nova'];
const TARGETS = ['Nox','Bird','the guard','the robot','the child','the dragon','the friend','the stranger','the rival','the teammate'];
const OBJECTS = ['door','key','sword','shield','ball','box','book','rope','ladder','map'];
const SETTINGS = ['near the old bridge','inside the castle hall','beside the river','in the forest clearing','at the market square','on the mountain path','inside the workshop','beside the garden gate','in the city street','near the lighthouse'];

const TEMPLATES = {
  en: [
    ['team_magic','{actor} and {target} combine their powers and energy.'], ['energy_clash','Their blue energy collide in a powerful clash.'],
    ['defend','{actor} blocks an incoming strike from {target}.'], ['dodge','{actor} dodges left from the incoming strike.'],
    ['chase','{actor} chases {target}.'], ['attack','{actor} attacks {target}.'],
    ['power_up','{actor} powers up as energy surges around their hands.'], ['reveal','{target} appears from behind the doorway.'],
    ['warning','{actor} warns {target} about the danger.'], ['restrain','{actor} restrains {target}.'],
    ['rescue','{actor} rescues {target}.'], ['freeze','{actor} freezes and stands still.'],
    ['take_cover','{actor} takes cover behind the wall.'], ['call_for_backup','{actor} calls for backup on the radio.'],
    ['drop_weapon','{actor} drops the weapon.'], ['hands_up','{actor} raises both hands.'],
    ['pick_up','{actor} picks up the {object}.'], ['throw','{actor} throws the {object}.'],
    ['catch','{actor} catches the {object}.'], ['open','{actor} opens the door.'],
    ['close','{actor} closes the door.'], ['climb','{actor} climbs the ladder.'],
    ['swim','{actor} swims across the river.'], ['fall','{actor} falls from the platform.'],
    ['land','{actor} lands on the ground.'], ['hug','{actor} hugs {target}.'],
    ['sit','{actor} sits down beside the wall.'], ['crawl','{actor} crawls under the table.'],
    ['eat_drink','{actor} drinks from the bottle.'], ['sleep_wake','{actor} wakes up from sleep.'],
    ['point','{actor} points at the {object}.'], ['write_draw','{actor} draws a map.']
  ],
  ru: [
    ['team_magic','{actor} и {target} объединяют свои силы и магию.'], ['energy_clash','Столкновение энергии и магии вызывает яркую вспышку.'],
    ['defend','{actor} блокирует удар {target}.'], ['dodge','{actor} уклоняется влево от удара.'],
    ['chase','{actor} гонится за {target}.'], ['attack','{actor} атакует {target}.'],
    ['power_up','{actor} пробуждает силу, энергия вспыхивает вокруг рук.'], ['reveal','{target} появляется из-за двери.'],
    ['warning','{actor} предупреждает {target} об опасности.'], ['restrain','{actor} задерживает {target}.'],
    ['rescue','{actor} спасает {target}.'], ['freeze','{actor} замирает на месте.'],
    ['take_cover','{actor} прячется за стеной.'], ['call_for_backup','{actor} вызывает подкрепление по рации.'],
    ['drop_weapon','{actor} бросает оружие.'], ['hands_up','{actor} поднимает обе руки.'],
    ['pick_up','{actor} подбирает {object}.'], ['throw','{actor} бросает {object}.'],
    ['catch','{actor} ловит {object}.'], ['open','{actor} открывает дверь.'],
    ['close','{actor} закрывает дверь.'], ['climb','{actor} взбирается по лестнице.'],
    ['swim','{actor} плывёт через реку.'], ['fall','{actor} падает с платформы.'],
    ['land','{actor} приземляется на землю.'], ['hug','{actor} обнимает {target}.'],
    ['sit','{actor} садится у стены.'], ['crawl','{actor} ползёт под столом.'],
    ['eat_drink','{actor} пьёт из бутылки.'], ['sleep_wake','{actor} просыпается ото сна.'],
    ['point','{actor} указывает на {object}.'], ['write_draw','{actor} рисует карту.']
  ],
  uk: [
    ['team_magic','{actor} та {target} поєднують свої сили й магію.'], ['energy_clash','Зіткнення енергії та магії викликає яскравий спалах.'],
    ['defend','{actor} блокує удар {target}.'], ['dodge','{actor} ухиляється ліворуч від удару.'],
    ['chase','{actor} переслідує {target}.'], ['attack','{actor} атакує {target}.'],
    ['power_up','{actor} пробуджує силу, енергія спалахує навколо рук.'], ['reveal','{target} з’являється з-за дверей.'],
    ['warning','{actor} попереджає {target} про небезпеку.'], ['restrain','{actor} затримує {target}.'],
    ['rescue','{actor} рятує {target}.'], ['freeze','{actor} завмирає на місці.'],
    ['take_cover','{actor} ховається за стіною.'], ['call_for_backup','{actor} викликає підкріплення по рації.'],
    ['drop_weapon','{actor} кидає зброю.'], ['hands_up','{actor} піднімає руки.'],
    ['pick_up','{actor} підбирає {object}.'], ['throw','{actor} кидає {object}.'],
    ['catch','{actor} ловить {object}.'], ['open','{actor} відчиняє двері.'],
    ['close','{actor} зачиняє двері.'], ['climb','{actor} дереться по драбині.'],
    ['swim','{actor} пливе через річку.'], ['fall','{actor} падає з платформи.'],
    ['land','{actor} приземляється на землю.'], ['hug','{actor} обіймає {target}.'],
    ['sit','{actor} сідає біля стіни.'], ['crawl','{actor} повзе під столом.'],
    ['eat_drink','{actor} п’є з пляшки.'], ['sleep_wake','{actor} прокидається після сну.'],
    ['point','{actor} вказує на {object}.'], ['write_draw','{actor} малює карту.']
  ],
  es: [
    ['team_magic','{actor} y {target} combinan sus poderes y energía.'], ['energy_clash','Choque de energía y magia en un impacto poderoso.'],
    ['defend','{actor} bloquea el golpe de {target}.'], ['dodge','{actor} esquiva hacia la izquierda el golpe.'],
    ['chase','{actor} persigue a {target}.'], ['attack','{actor} ataca a {target}.'],
    ['power_up','{actor} despierta su poder y la energía surge alrededor de sus manos.'], ['reveal','{target} aparece detrás de la puerta.'],
    ['warning','{actor} advierte a {target} del peligro.'], ['restrain','{actor} inmoviliza a {target}.'],
    ['rescue','{actor} rescata a {target}.'], ['freeze','{actor} se queda inmóvil.'],
    ['take_cover','{actor} se cubre detrás de la pared.'], ['call_for_backup','{actor} pide refuerzos por radio.'],
    ['drop_weapon','{actor} deja caer el arma.'], ['hands_up','{actor} levanta las manos.'],
    ['pick_up','{actor} recoge la {object}.'], ['throw','{actor} lanza la {object}.'],
    ['catch','{actor} atrapa la {object}.'], ['open','{actor} abre la puerta.'],
    ['close','{actor} cierra la puerta.'], ['climb','{actor} trepa por la escalera.'],
    ['swim','{actor} nada por el río.'], ['fall','{actor} cae de la plataforma.'],
    ['land','{actor} aterriza en el suelo.'], ['hug','{actor} abraza a {target}.'],
    ['sit','{actor} se sienta junto a la pared.'], ['crawl','{actor} gatea debajo de la mesa.'],
    ['eat_drink','{actor} bebe de la botella.'], ['sleep_wake','{actor} despierta del sueño.'],
    ['point','{actor} señala la {object}.'], ['write_draw','{actor} dibuja un mapa.']
  ]
};

export const PROMPT_KNOWLEDGE_INTENTS = Object.freeze(TEMPLATES.en.map(([intent]) => intent));

const STOP_WORDS = new Set(['the','and','for','from','with','into','near','beside','inside','their','this','that','scene','present','en','la','el','los','las','de','del','y','и','та','в','у','на','за','из','от','по','для','свої','свои','сцене','сцені']);
let cachedCorpus = null;
function terms(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
}

/** Retrieve few-shot examples from the 10k corpus for the same detected action. */
export function retrievePromptKnowledgeExamples(input, { intent = '', locale = 'en', limit = 2 } = {}) {
  if (!PROMPT_KNOWLEDGE_INTENTS.includes(intent)) return [];
  if (!cachedCorpus) cachedCorpus = generatePromptKnowledgeCorpus(10000);
  const query = new Set(terms(input).filter(term => term.length > 2 && !STOP_WORDS.has(term)));
  const selectedLocale = Object.hasOwn(TEMPLATES, locale) ? locale : 'en';
  const candidates = cachedCorpus.filter(item => item.expectedIntent === intent && item.locale === selectedLocale);
  const ranked = candidates.map(item => {
    const exampleTerms = new Set(terms(item.prompt).filter(term => term.length > 2 && !STOP_WORDS.has(term)));
    let overlap = 0;
    for (const term of query) if (exampleTerms.has(term)) overlap += 1;
    return { item, score: overlap / Math.max(1, Math.sqrt(query.size * exampleTerms.size)) };
  }).sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
  return ranked.slice(0, Math.max(1, Math.min(3, Number(limit) || 2))).map(({ item, score }) => ({
    id: item.id, locale: item.locale, intent: item.expectedIntent,
    prompt: item.prompt, similarity: Number(score.toFixed(3))
  }));
}


/** Build a reproducible corpus of exactly 10,000 unique multilingual prompt examples. */
export function generatePromptKnowledgeCorpus(count = 10000) {
  const total = Math.max(1, Math.min(10000, Math.floor(Number(count) || 10000)));
  const locales = Object.keys(TEMPLATES);
  const examples = [];
  for (let index = 0; index < total; index += 1) {
    const intentIndex = index % PROMPT_KNOWLEDGE_INTENTS.length;
    const localeIndex = Math.floor(index / PROMPT_KNOWLEDGE_INTENTS.length) % locales.length;
    const actorIndex = Math.floor(index / (PROMPT_KNOWLEDGE_INTENTS.length * locales.length)) % ACTORS.length;
    const variation = Math.floor(index / (PROMPT_KNOWLEDGE_INTENTS.length * locales.length * ACTORS.length));
    const locale = locales[localeIndex];
    const [intent, template] = TEMPLATES[locale][intentIndex];
    const prompt = template.replaceAll('{actor}', ACTORS[actorIndex])
      .replaceAll('{target}', TARGETS[(actorIndex + variation) % TARGETS.length])
      .replaceAll('{object}', OBJECTS[(actorIndex + variation) % OBJECTS.length]);
    const setting = SETTINGS[(actorIndex + variation + intentIndex) % SETTINGS.length];
    const sceneLead = {
      en: ACTORS[actorIndex] + ' is present in the scene.',
      ru: ACTORS[actorIndex] + ' присутствует в сцене.',
      uk: ACTORS[actorIndex] + ' присутній у сцені.',
      es: ACTORS[actorIndex] + ' está presente en la escena.'
    }[locale];
    examples.push({
      id: 'dxk-' + String(index + 1).padStart(5, '0'),
      locale, prompt: sceneLead + ' ' + prompt + ' ' + setting + '.',
      expectedIntent: intent, actor: ACTORS[actorIndex],
      target: TARGETS[(actorIndex + variation) % TARGETS.length],
      object: OBJECTS[(actorIndex + variation) % OBJECTS.length]
    });
  }
  return examples;
}
