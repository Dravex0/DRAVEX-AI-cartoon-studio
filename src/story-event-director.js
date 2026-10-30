const EVENT_PATTERNS = {
  discovery: {
    ru: /наход|обнаруж|замеча|открыва|выявля/iu,
    uk: /знаход|виявля|поміча|відкрива/iu,
    en: /\\b(find|finds|found|discover|discovers|discovered|notice|notices|uncover|uncovers)\\b/iu,
    es: /\\b(encuentra|descubre|descubren|halla|nota|descubre)\\b/iu
  },
  repair_build: {
    ru: /чинит|ремонтир|строит|собирает|созда[её]т|мастерит/iu,
    uk: /лагод|ремонту|буду|збира|створю|майстру/iu,
    en: /\\b(repair|repairs|fix|fixes|build|builds|construct|constructs|assemble|assembles|create|creates)\\b/iu,
    es: /\\b(repara|arregla|construye|construir|ensambla|crea)\\b/iu
  },
  guidance_help: {
    ru: /показыва|вед[её]т|помога|направля|указывает путь/iu,
    uk: /показу|веде|допомага|спрямову|вказує шлях/iu,
    en: /\\b(guide|guides|guided|help|helps|lead|leads|show|shows|direct|directs)\\b/iu,
    es: /\\b(guía|guia|ayuda|ayudan|dirige|muestra|conduce)\\b/iu
  },
  threat_conflict: {
    ru: /атак|преслед|преграж|угрожа|напада|напад|запирает путь/iu,
    uk: /атак|пересліду|блоку|загрож|напада|перекриває шлях/iu,
    en: /\\b(attack|attacks|chase|chases|block|blocks|threaten|threatens|ambush|ambushes|fight|fights)\\b/iu,
    es: /\\b(ataca|persigue|bloquea|amenaza|embosca|lucha)\\b/iu
  },
  transformation: {
    ru: /превращ|станов|расцвет|зажига|гасн|ожива|меняет форму/iu,
    uk: /перетвор|стає|розквіта|засвіч|згаса|ожива|змінює форму/iu,
    en: /\\b(transform|transforms|become|becomes|turns into|grow|grows|bloom|blooms|light up|lights up|fade)\\b/iu,
    es: /\\b(transforma|convierte|crece|florece|ilumina|se apaga|cobra vida)\\b/iu
  },
  travel_movement: {
    ru: /ид[её]т|бежит|поднима|летит|входит|выходит|пересека|прибыва|убегает|плыв[её]т/iu,
    uk: /йде|біжить|підійма|летить|входить|виходить|перетина|прибува|тікає|пливе/iu,
    en: /\\b(walk|walks|run|runs|climb|climbs|fly|flies|enter|enters|leave|leaves|cross|crosses|arrive|arrives|escape|escapes|swim|swims)\\b/iu,
    es: /\\b(caminar|camina|corre|correr|sube|vuela|entra|sale|cruza|llega|escapa|nada)\\b/iu
  },
  emotional_reaction: {
    ru: /плачет|улыба|сме[её]тся|испуг|удив|радуется|сердится|волнуется/iu,
    uk: /плаче|усміха|смі[єе]ться|ляка|диву|радіє|сердиться|хвилюється/iu,
    en: /\\b(cry|cries|smile|smiles|laugh|laughs|afraid|frightened|surprised|rejoices|angry|worries)\\b/iu,
    es: /\\b(llora|sonríe|sonrie|ríe|rie|asusta|sorprende|alegra|enfada|preocupa)\\b/iu
  }
};

const DIRECTIONS = {
  ru: {
    discovery: (name) => `${name} замечает важный объект, приближается к нему и явно взаимодействует с ним; покажи момент обнаружения и результат действия.`,
    repair_build: (name) => `${name} выполняет понятный этап ремонта или сборки: использует руки и инструменты, меняет состояние предмета и показывает результат.`,
    guidance_help: (name) => `${name} замечает помощника или указание, поворачивается к нему и следует за ним; оба участника должны оставаться понятными в кадре.`,
    threat_conflict: (name) => `Покажи, как угроза перекрывает путь ${name}; персонаж реагирует физически — уклоняется, защищается или меняет направление, а причина опасности остаётся видимой.`,
    transformation: (name) => `Покажи постепенное изменение объекта или окружения рядом с ${name}: исходное состояние, само превращение и заметный результат.`,
    travel_movement: (name) => `Покажи непрерывное перемещение ${name} к цели: понятную траекторию тела, изменение положения в пространстве и точку прибытия.`,
    emotional_reaction: (name) => `Покажи реакцию ${name} через выражение лица, взгляд и позу; эмоция должна быть вызвана событием сцены, а не выглядеть случайной.`,
    general: (name) => `Поставь событие истории как одно видимое действие с причиной и последствием; сохрани названных участников и предметы, покажи изменение состояния в кадре. ${name} должен быть частью действия, если он участвует в событии.`
  },
  uk: {
    discovery: (name) => `${name} помічає важливий об’єкт, наближається до нього та виразно взаємодіє з ним; покажи момент знахідки й результат дії.`,
    repair_build: (name) => `${name} виконує зрозумілий етап ремонту або складання: використовує руки й інструменти, змінює стан предмета та показує результат.`,
    guidance_help: (name) => `${name} помічає помічника або підказку, повертається до нього та йде за ним; обидва учасники мають бути зрозумілими в кадрі.`,
    threat_conflict: (name) => `Покажи, як загроза перекриває шлях ${name}; персонаж фізично реагує — ухиляється, захищається або змінює напрямок, а причина небезпеки залишається видимою.`,
    transformation: (name) => `Покажи поступову зміну предмета чи оточення поруч із ${name}: початковий стан, саме перетворення та помітний результат.`,
    travel_movement: (name) => `Покажи безперервне переміщення ${name} до мети: зрозумілу траєкторію тіла, зміну положення в просторі та точку прибуття.`,
    emotional_reaction: (name) => `Покажи реакцію ${name} через вираз обличчя, погляд і позу; емоція має бути спричинена подією сцени.`,
    general: (name) => `Побудуй подію історії як одну видиму дію з причиною та наслідком; збережи названих учасників і предмети, покажи зміну стану в кадрі. ${name} має бути частиною дії, якщо бере участь у події.`
  },
  en: {
    discovery: (name) => `Show ${name} noticing an important object, approaching it, and making clear physical contact; reveal the discovery and its immediate result.`,
    repair_build: (name) => `Show ${name} completing one readable repair or construction step: hands or tools interact with the object, its state visibly changes, and the result is clear.`,
    guidance_help: (name) => `Show ${name} noticing a helper or signal, turning toward it, and following the guidance; keep both participants readable in frame.`,
    threat_conflict: (name) => `Show the threat obstructing ${name}; the character reacts physically by evading, defending, or changing direction while the source of danger stays visible.`,
    transformation: (name) => `Show a gradual change to the object or environment near ${name}: establish the before state, show the transformation, and reveal the result.`,
    travel_movement: (name) => `Show ${name} moving continuously toward the goal with a readable body trajectory, clear spatial change, and a visible arrival point.`,
    emotional_reaction: (name) => `Show ${name}'s reaction through facial expression, gaze, and posture; the emotion must be caused by the scene event, not added randomly.`,
    general: (name) => `Stage the story event as one visible cause-and-effect action; preserve its named participants and objects, and show a clear state change. Keep ${name} involved when the story calls for it.`
  },
  es: {
    discovery: (name) => `Muestra a ${name} descubriendo un objeto importante, acercándose y tocándolo claramente; revela el hallazgo y su resultado inmediato.`,
    repair_build: (name) => `Muestra a ${name} realizando un paso claro de reparación o construcción: las manos o herramientas interactúan con el objeto y su estado cambia visiblemente.`,
    guidance_help: (name) => `Muestra a ${name} viendo una señal o ayudante, girándose y siguiendo la guía; ambos participantes deben ser visibles.`,
    threat_conflict: (name) => `Muestra la amenaza bloqueando el camino de ${name}; el personaje esquiva, se defiende o cambia de dirección mientras el peligro permanece visible.`,
    transformation: (name) => `Muestra un cambio gradual en el objeto o entorno cerca de ${name}: estado inicial, transformación y resultado visible.`,
    travel_movement: (name) => `Muestra a ${name} avanzando continuamente hacia su objetivo, con una trayectoria corporal clara y un punto de llegada visible.`,
    emotional_reaction: (name) => `Muestra la reacción de ${name} mediante expresión facial, mirada y postura; la emoción debe surgir del evento de la escena.`,
    general: (name) => `Representa el evento como una acción visible de causa y efecto; conserva a los participantes y objetos nombrados y muestra un cambio claro. ${name} participa si corresponde.`
  }
};

const CAMERA = {
  discovery: 'Over-the-shoulder medium shot, then a close-up on the discovered object.',
  repair_build: 'Medium shot on the character and object, followed by a close-up of the hands or tool interaction.',
  guidance_help: 'Tracking two-shot that keeps the guide and the following character visible.',
  threat_conflict: 'Dynamic wide shot with a low angle; keep the threat and the character in the same spatial layout.',
  transformation: 'Locked wide composition that reveals the before-and-after change, then a slow push-in.',
  travel_movement: 'Wide tracking shot that preserves screen direction and shows the destination.',
  emotional_reaction: 'Close-up on the face with enough context to understand the triggering event.',
  general: 'Medium shot with a clear view of the acting character, the important object, and the result.'
};

const CAMERA_LOCALIZED = {
  ru: {
    discovery: 'Средний план через плечо, затем крупный план найденного объекта.',
    repair_build: 'Средний план персонажа и предмета, затем крупный план рук или инструмента.',
    guidance_help: 'Следящий двухплановый кадр, в котором видны проводник и следующий за ним персонаж.',
    threat_conflict: 'Динамичный общий план с нижнего ракурса; угроза и персонаж должны оставаться в одной пространственной схеме.',
    transformation: 'Неподвижный общий план, показывающий изменение до и после, затем медленное приближение.',
    travel_movement: 'Широкий следящий план, сохраняющий направление движения и показывающий цель.',
    emotional_reaction: 'Крупный план лица с достаточным контекстом события, вызвавшего реакцию.',
    general: 'Средний план с понятным обзором персонажа, важного предмета и результата действия.'
  },
  uk: {
    discovery: 'Середній план через плече, потім крупний план знайденого предмета.',
    repair_build: 'Середній план персонажа й предмета, потім крупний план рук або інструмента.',
    guidance_help: 'Рухомий двоплановий кадр, у якому видно провідника та персонажа, що йде за ним.',
    threat_conflict: 'Динамічний загальний план із нижнього ракурсу; загроза й персонаж залишаються в одній просторовій схемі.',
    transformation: 'Нерухомий загальний план, що показує зміну до і після, потім повільне наближення.',
    travel_movement: 'Широкий кадр із супроводом руху, що зберігає напрямок і показує мету.',
    emotional_reaction: 'Крупний план обличчя з достатнім контекстом події, що викликала реакцію.',
    general: 'Середній план із чітким оглядом персонажа, важливого предмета та результату дії.'
  },
  es: {
    discovery: 'Plano medio sobre el hombro y después primer plano del objeto descubierto.',
    repair_build: 'Plano medio del personaje y el objeto, seguido de un primer plano de las manos o herramientas.',
    guidance_help: 'Plano de seguimiento de dos personajes que mantiene visibles al guía y al personaje que lo sigue.',
    threat_conflict: 'Plano general dinámico desde un ángulo bajo; la amenaza y el personaje comparten el espacio.',
    transformation: 'Plano general fijo que revela el antes y el después, seguido de un acercamiento lento.',
    travel_movement: 'Plano general de seguimiento que conserva la dirección del movimiento y muestra el destino.',
    emotional_reaction: 'Primer plano del rostro con contexto suficiente para entender el motivo de la reacción.',
    general: 'Plano medio que muestra claramente al personaje, el objeto importante y el resultado de la acción.'
  }
};

/** Classify one source sentence using a small, explicit multilingual event lexicon. */
export function classifyStoryEvent(detail, language = 'en') {
  const locale = Object.hasOwn(EVENT_PATTERNS.discovery, language) ? language : 'en';
  const text = String(detail ?? '').trim();
  if (!text) return 'general';
  for (const type of ['threat_conflict', 'transformation', 'repair_build', 'guidance_help', 'discovery', 'travel_movement', 'emotional_reaction']) {
    if (EVENT_PATTERNS[type][locale].test(text)) return type;
  }
  return 'general';
}

/** Turn a source-story event into a visible action and camera instruction. */
export function directStoryEvent(detail, language = 'en', character = '') {
  const locale = Object.hasOwn(DIRECTIONS, language) ? language : 'en';
  const eventType = classifyStoryEvent(detail, locale);
  const name = String(character ?? '').trim() || (locale === 'ru' ? 'Персонаж' : locale === 'uk' ? 'Персонаж' : locale === 'es' ? 'el personaje' : 'the character');
  return {
    eventType,
    visibleAction: DIRECTIONS[locale][eventType](name),
    camera: CAMERA_LOCALIZED[locale]?.[eventType] ?? CAMERA[eventType],
    sourceDetail: String(detail ?? '').trim()
  };
}
