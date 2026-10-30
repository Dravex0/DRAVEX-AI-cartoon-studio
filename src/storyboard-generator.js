/**
 * Deterministic five-beat storyboard planner.
 * This creates an editable outline; it does not claim to understand images or generate AI art.
 */
export const STORYBOARD_BEAT_COUNT = 5;

const BEATS = {
  ru: [
    { title: 'Завязка', action: 'Герой появляется в месте действия, осматривает окружение и занимает исходную позицию.', camera: 'Общий план; медленное приближение камеры.' },
    { title: 'Событие', action: 'Герой замечает важную деталь, меняет направление взгляда и явно реагирует.', camera: 'Средний план; акцент на лице и реакции.' },
    { title: 'Препятствие', action: 'Герой перемещается к цели, пробует взаимодействовать с ней и сталкивается с препятствием.', camera: 'Следящий план; камера движется вместе с героем.' },
    { title: 'Кульминация', action: 'Герой выполняет решающее физическое действие; покажи движение, реакцию окружения и последствие.', camera: 'Крупный план действия; короткий динамичный акцент.' },
    { title: 'Развязка', action: 'Покажи итог: герой реагирует на произошедшее, а финальный кадр раскрывает новое состояние истории.', camera: 'Отдельный спокойный финальный план; не повторяй кульминацию.' }
  ],
  uk: [
    { title: 'Зав’язка', action: 'Герой з’являється в місці подій, оглядає оточення та займає початкову позицію.', camera: 'Загальний план; повільне наближення камери.' },
    { title: 'Подія', action: 'Герой помічає важливу деталь, змінює напрямок погляду та виразно реагує.', camera: 'Середній план; акцент на обличчі й реакції.' },
    { title: 'Перешкода', action: 'Герой рухається до мети, намагається взаємодіяти з нею та стикається з перешкодою.', camera: 'Камера рухається слідом за героєм.' },
    { title: 'Кульмінація', action: 'Герой виконує вирішальну фізичну дію; покажи рух, реакцію оточення та наслідок.', camera: 'Крупний план дії; короткий динамічний акцент.' },
    { title: 'Розв’язка', action: 'Покажи результат: герой реагує на подію, а фінальний кадр відкриває новий стан історії.', camera: 'Окремий спокійний фінальний план; не повторюй кульмінацію.' }
  ],
  en: [
    { title: 'Introduction', action: 'The character enters the setting, surveys the surroundings, and establishes a clear starting position.', camera: 'Wide establishing shot with a slow camera push-in.' },
    { title: 'Inciting event', action: 'The character notices an important detail, shifts attention toward it, and reacts visibly.', camera: 'Medium shot emphasizing the character’s face and reaction.' },
    { title: 'Obstacle', action: 'The character moves toward the goal, attempts to interact with it, and encounters an obstacle.', camera: 'Tracking shot that follows the character’s movement.' },
    { title: 'Climax', action: 'The character performs the decisive physical action; show the movement, environmental reaction, and consequence.', camera: 'Close-up on the action with a brief dynamic accent.' },
    { title: 'Resolution', action: 'Show the outcome and the character’s response; end on a new story image rather than repeating the climax.', camera: 'A separate, quieter final shot.' }
  ],
  es: [
    { title: 'Inicio', action: 'El personaje entra en el lugar, observa el entorno y establece una posición inicial clara.', camera: 'Plano general con un acercamiento lento.' },
    { title: 'Incidente', action: 'El personaje descubre un detalle importante, dirige la mirada hacia él y reacciona visiblemente.', camera: 'Plano medio centrado en el rostro y la reacción.' },
    { title: 'Obstáculo', action: 'El personaje avanza hacia su objetivo, intenta interactuar con él y encuentra un obstáculo.', camera: 'Plano de seguimiento que acompaña el movimiento.' },
    { title: 'Clímax', action: 'El personaje realiza la acción física decisiva; muestra el movimiento, la reacción del entorno y la consecuencia.', camera: 'Primer plano de la acción con un acento dinámico breve.' },
    { title: 'Desenlace', action: 'Muestra el resultado y la reacción del personaje; termina con una imagen nueva, sin repetir el clímax.', camera: 'Un plano final separado y más tranquilo.' }
  ]
};

const CHARACTER_LABEL = {
  ru: 'Главный персонаж',
  uk: 'Головний персонаж',
  en: 'Main character',
  es: 'Personaje principal'
};
const STORY_LABEL = {
  ru: 'Деталь исходной истории',
  uk: 'Деталь початкової історії',
  en: 'Story detail to preserve',
  es: 'Detalle que conservar de la historia'
};
const FALLBACK = {
  ru: 'Начинается новое приключение.',
  uk: 'Починається нова пригода.',
  en: 'A new adventure begins.',
  es: 'Comienza una nueva aventura.'
};

function splitStorySentences(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 12_000);
  if (!text) return [];
  return (text.match(/[^.!?。！？]+[.!?。！？]?/gu) || [])
    .map((part) => part.trim())
    .filter(Boolean);
}

function distributeStoryDetails(sentences, beatCount) {
  const buckets = Array.from({ length: beatCount }, () => []);
  sentences.forEach((sentence, index) => {
    const bucketIndex = Math.min(beatCount - 1, Math.floor(index * beatCount / sentences.length));
    buckets[bucketIndex].push(sentence);
  });
  return buckets.map((bucket) => bucket.join(' ').slice(0, 1_200));
}

/**
 * Build five distinct editable story beats while preserving every source sentence once.
 * With a one-sentence premise, later beats are clearly scaffolded suggestions, not inferred plot facts.
 */
export function buildStoryboardFromText(idea, lang = 'ru', character = 'Foxy') {
  const locale = Object.hasOwn(BEATS, lang) ? lang : 'en';
  const subject = String(character ?? '').trim().slice(0, 120)
    || (locale === 'ru' || locale === 'uk' ? 'Персонаж' : locale === 'es' ? 'Personaje' : 'Character');
  const source = splitStorySentences(idea);
  const sentences = source.length ? source : [FALLBACK[locale]];
  const beats = BEATS[locale];
  const storyDetails = distributeStoryDetails(sentences, STORYBOARD_BEAT_COUNT);

  const scenes = beats.map((beat, index) => {
    const storyDetail = storyDetails[index];
    const description = [
      `${CHARACTER_LABEL[locale]}: ${subject}.`,
      beat.action,
      beat.camera,
      storyDetail ? `${STORY_LABEL[locale]}: ${storyDetail}` : ''
    ].filter(Boolean).join(' ');
    return {
      id: `scene_${index + 1}`,
      order: index + 1,
      title: beat.title,
      visibleAction: beat.action,
      camera: beat.camera,
      storyDetail,
      prompt: description,
      description
    };
  });

  return {
    titles: scenes.map((scene) => scene.title),
    descriptions: scenes.map((scene) => scene.description),
    scenes
  };
}
