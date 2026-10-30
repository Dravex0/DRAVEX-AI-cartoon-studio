/**
 * Deterministic storyboard planner with a five-beat default and optional 3–8 beat layouts.
 * This is a local fallback, not a generative model or visual scene-understanding system.
 */
import { parseStoryBrief, formatProductionDirectives } from './story-brief.js';
import { directStoryEvent } from './story-event-director.js';
import { inferCharacterInteraction } from './character-interaction.js';
import { inferSceneCausalLinks } from './scene-causality.js';
import { inferStoryboardStateChanges } from './scene-state-changes.js';
import { buildStoryEventChain } from './story-event-chain.js';
import { buildProductionScene } from './scene-production.js';

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

const EXTENDED_BEATS = {
  ru: [
    { title: 'Подготовка', action: 'Герой меняет план, собирает нужные предметы и готовится преодолеть препятствие.', camera: 'Средний боковой план; плавное движение камеры вслед за подготовкой.' },
    { title: 'Поворот истории', action: 'Неожиданная деталь меняет ситуацию, и герой принимает новое решение.', camera: 'Камера переводит фокус с важной детали на реакцию героя.' },
    { title: 'Последствия', action: 'Покажи непосредственные последствия решающего действия и изменения в окружении.', camera: 'Широкий план с заметным изменением пространства.' }
  ],
  uk: [
    { title: 'Підготовка', action: 'Герой змінює план, збирає потрібні предмети та готується подолати перешкоду.', camera: 'Середній боковий план; плавний рух камери за підготовкою.' },
    { title: 'Поворот історії', action: 'Неочікувана деталь змінює ситуацію, і герой ухвалює нове рішення.', camera: 'Камера переводить фокус із важливої деталі на реакцію героя.' },
    { title: 'Наслідки', action: 'Покажи безпосередні наслідки вирішальної дії та зміни в оточенні.', camera: 'Загальний план із помітною зміною простору.' }
  ],
  en: [
    { title: 'Preparation', action: 'The character changes the plan, gathers what is needed, and prepares to overcome the obstacle.', camera: 'Medium side shot with a smooth camera move following the preparation.' },
    { title: 'Turning point', action: 'An unexpected detail changes the situation, forcing the character to make a new decision.', camera: 'Rack focus from the revealing detail to the character’s reaction.' },
    { title: 'Aftermath', action: 'Show the immediate consequences of the decisive action and how the surroundings have changed.', camera: 'Wide shot that clearly reveals the changed environment.' }
  ],
  es: [
    { title: 'Preparación', action: 'El personaje cambia el plan, reúne lo necesario y se prepara para superar el obstáculo.', camera: 'Plano medio lateral con un movimiento suave que sigue la preparación.' },
    { title: 'Giro', action: 'Un detalle inesperado cambia la situación y obliga al personaje a tomar una nueva decisión.', camera: 'Cambio de enfoque desde el detalle revelador hasta la reacción del personaje.' },
    { title: 'Consecuencias', action: 'Muestra las consecuencias inmediatas de la acción decisiva y los cambios en el entorno.', camera: 'Plano general que revela claramente el entorno transformado.' }
  ]
};

function selectBeats(locale, requestedCount) {
  const base = BEATS[locale];
  const extras = EXTENDED_BEATS[locale];
  const count = requestedCount ?? STORYBOARD_BEAT_COUNT;
  if (count === 3) return [base[0], base[2], base[4]];
  if (count === 4) return [base[0], base[1], base[3], base[4]];
  if (count === 5) return base;
  if (count === 6) return [base[0], base[1], base[2], extras[0], base[3], base[4]];
  if (count === 7) return [base[0], base[1], base[2], extras[0], extras[1], base[3], base[4]];
  return [base[0], base[1], base[2], extras[0], extras[1], base[3], extras[2], base[4]];
}

const CHARACTER_LABEL = { ru: 'Главный персонаж', uk: 'Головний персонаж', en: 'Main character', es: 'Personaje principal' };
const STORY_LABEL = { ru: 'Деталь исходной истории', uk: 'Деталь початкової історії', en: 'Story detail to preserve', es: 'Detalle que conservar de la historia' };
const FALLBACK = { ru: 'Начинается новое приключение.', uk: 'Починається нова пригода.', en: 'A new adventure begins.', es: 'Comienza una nueva aventura.' };

function distributeStoryDetails(sentences, beatCount) {
  const buckets = Array.from({ length: beatCount }, () => []);
  sentences.forEach((sentence, index) => {
    const bucketIndex = Math.min(beatCount - 1, Math.floor(index * beatCount / sentences.length));
    buckets[bucketIndex].push(sentence);
  });
  return buckets.map(bucket => bucket.join(' ').slice(0, 1200));
}

/**
 * Build the requested number of editable beats. Explicit labeled instructions are retained as production metadata.
 * A one-sentence premise still uses clearly scaffolded local suggestions rather than invented plot facts.
 */
export function buildStoryboardFromText(idea, lang = 'ru', character = 'Foxy') {
  const locale = Object.hasOwn(BEATS, lang) ? lang : 'en';
  const subject = String(character ?? '').trim().slice(0, 120) || (locale === 'ru' || locale === 'uk' ? 'Персонаж' : locale === 'es' ? 'Personaje' : 'Character');
  const brief = parseStoryBrief(idea);
  const source = brief.storyText;
  const explicitScenes = Array.isArray(brief.sceneBlocks) ? brief.sceneBlocks : [];
  const sentences = source ? (source.match(/[^.!?。！？]+[.!?。！？]?/gu) || []).map(part => part.trim()).filter(Boolean) : [FALLBACK[locale]];
  const beatCount = brief.requestedSceneCount ?? STORYBOARD_BEAT_COUNT;
  const storyDetails = explicitScenes.length
    ? explicitScenes.map(scene => String(scene.text ?? '').trim())
    : distributeStoryDetails(sentences.length ? sentences : [FALLBACK[locale]], beatCount);
  const beats = selectBeats(locale, beatCount);
  const directiveText = formatProductionDirectives(brief.directives);

  const scenes = beats.map((beat, index) => {
    const explicitScene = explicitScenes[index] || null;
    const storyDetail = explicitScene ? String(explicitScene.text ?? '').trim() : storyDetails[index];
    const eventDirection = storyDetail ? directStoryEvent(storyDetail, locale, subject) : null;
    // Explicit scene blocks are source material: do not append a generic beat action that
    // could contradict or duplicate the action the user actually wrote.
    const visibleAction = eventDirection
      ? (explicitScene ? eventDirection.visibleAction : `${eventDirection.visibleAction} ${beat.action}`)
      : beat.action;
    const camera = eventDirection
      ? (explicitScene ? eventDirection.camera : `${eventDirection.camera} ${beat.camera}`)
      : beat.camera;
    const instruction = directiveText ? ` Production directions: ${directiveText}` : '';
    const title = explicitScene?.title || beat.title;
    const description = [
      `${CHARACTER_LABEL[locale]}: ${subject}.`,
      visibleAction,
      camera,
      storyDetail ? `${STORY_LABEL[locale]}: ${storyDetail}` : '',
      instruction
    ].filter(Boolean).join(' ');
    return {
      id: `scene_${index + 1}`, order: index + 1, title,
      visibleAction, camera, storyEventType: eventDirection?.eventType ?? 'scaffolded-beat', storyDetail,
      prompt: description, description,
      productionDirectives: brief.directives, sourceStoryText: source,
      sourceEvents: explicitScene ? [storyDetail].filter(Boolean) : brief.keyEvents
    };
  });

  const causalLinks = inferSceneCausalLinks(scenes, locale);
  const stateChanges = inferStoryboardStateChanges(scenes, locale, subject);
  const knownCharacters = brief.characters.length ? brief.characters : [subject];
  const characterMention = (name, sourceText) => {
    const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, character => `\\${character}`);
    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu').test(sourceText);
  };
  scenes.forEach((scene, index) => {
    scene.causalLink = causalLinks[index];
    scene.stateChanges = stateChanges[index];
    scene.characters = knownCharacters.filter(name => scene.storyDetail
      ? characterMention(name, scene.storyDetail)
      : name.toLocaleLowerCase() === subject.toLocaleLowerCase());
    // Keep interaction inference source-grounded and limited to characters assigned to this scene.
    scene.interaction = scene.storyDetail
      ? inferCharacterInteraction(scene.storyDetail, scene.characters, locale)
      : null;
    scene.durationSeconds = brief.requestedDurationSeconds ?? 3;
    scene.negativePrompt = brief.directives.avoid || '';
  });
  const productionScenes = scenes.map((scene, index) => buildProductionScene(scene, brief.characterProfiles, { index }));
  const eventChain = buildStoryEventChain(productionScenes);

  return {
    titles: scenes.map(scene => scene.title),
    descriptions: scenes.map(scene => scene.description),
    scenes: productionScenes,
    eventChain,
    brief,
    requestedSceneCount: beatCount
  };
}
