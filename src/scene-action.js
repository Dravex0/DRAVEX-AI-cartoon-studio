const ACTION_PATTERNS = [
  { action: 'vanish', patterns: [/исчез|пропад|растворя|тает на глазах|исчезает/, /\bvanish\w*|disappear\w*|fade\s*out|dissolve\w*/, /зника|щез|розчиня/, /desaparec\w*|se desvanece/] },
  { action: 'wave', patterns: [/машет(?: рукой)?|помахива|приветственно машет/, /\bwave\w*|\bwaves? hello|\bgreet\w* with a wave/, /махає(?: рукою)?|привітально махає/, /saluda con la mano|\bagita\w* la mano/] },
  { action: 'jump', patterns: [/прыга|подпрыг|перепрыг|скачет/, /\bjump\w*|leap\w*|bounce\w*/, /стриба|підстрибу|перестрибу/, /salt\w*|brinca\w*/] },
  { action: 'run', patterns: [/беж|побеж|убега|мчится|гонится/, /\brun\w*|sprint\w*|chase\w*|runn?ing\b/, /біж|тіка|мчить|пересліду/, /corr\w*|persigue\w*|huye\w*/] },
  { action: 'dance', patterns: [/танцу|пляш|ритмично двига|кружится в танце/, /\bdanc\w*|twirl\w*|groove\w*/, /танцю|ритмічно руха|крутиться в танці/, /bail\w*|gira bailando/] },
  { action: 'walk', patterns: [/ид[её]т|шагает|прогулива|подходит|отходит/, /\bwalk\w*|stroll\w*|approach\w*|step\s+(?:forward|back)/, /йде|крокує|підходить|відходить/, /camin\w*|se acerc\w*|se aleja/] },
  { action: 'float', patterns: [/парит|взлет|летит|плыв[её]т по воздуху/, /\bfloat\w*|fly\w*|soar\w*|hover\w*/, /ширя|зліта|летить|пливе в повітрі/, /vuela|flot\w*|planea/] },
  { action: 'surprised', patterns: [/удивл|изумл|ошараш|вскрикива|широко раскрывает глаза/, /\bsurpris\w*|astonish\w*|gasp\w*|wide[- ]eyed/, /здив|враж|ошелеш|широко розплющує очі/, /sorprend\w*|asombr\w*|abre mucho los ojos/] },
  { action: 'sad', patterns: [/плак|груст|страх|боится|расстро|слез/, /\bcry\w*|sad\w*|afraid|fearful|scared|sorrow\w*/, /плак|сум|боїться|злякав|сльоз/, /llor\w*|triste|asustad\w*|teme/] },
  { action: 'happy', patterns: [/радост|улыб|счаст|весел|довол/, /\bhappy|smil\w*|joy\w*|cheerful|laugh\w*/, /радіс|усміх|щаслив|весел|задовол/, /feliz|sonrí\w*|alegr\w*|ríe/] },
  { action: 'talk', patterns: [/говорит|разговари|произносит|рассказыва|шепчет/, /\btalk\w*|speak\w*|say\w*|whisper\w*|dialog\w*/, /говорить|розмовля|вимовля|розповіда|шепоче/, /habl\w*|dice|susurr\w*|convers\w*/] },
  { action: 'turn', patterns: [/поворачива|оборачива|разворачива|крутится вокруг себя/, /\bturn\w*|look\s+back|rotate\w*|spin\w*/, /поверта|озира|розверта|обертається/, /gir\w*|se vuelve|mira atrás/] },
  { action: 'magic', patterns: [/свет|сия|вспыш|маг|волшеб|искрится|сверкает/, /\bglow\w*|shine\w*|flash\w*|magic\w*|spark\w*|illuminat\w*/, /світ|сяй|спалах|магі|чарів|іскриться|виблискує/, /brill\w*|magia|destell\w*|resplandec\w*/] },
];

// Ignore an action only when a nearby negation governs that exact match.
 // Contrast words start a new clause: "does not walk, but runs" still detects run.
function isNegatedMatch(text, matchIndex) {
  const prefix = text.slice(0, matchIndex);
  const clauseStart = Math.max(
    prefix.lastIndexOf(';'), prefix.lastIndexOf('.'), prefix.lastIndexOf(','),
    prefix.lastIndexOf(' but '), prefix.lastIndexOf(' но '), prefix.lastIndexOf(' а '),
    prefix.lastIndexOf(' але '), prefix.lastIndexOf(' проте '), prefix.lastIndexOf(' pero ')
  );
  const clause = prefix.slice(clauseStart + 1).trimEnd();
  if (/\bnot\s+only\s*$/i.test(clause)) return false;
  return /(?:\b(?:doesn't|don't|didn't|isn't|aren't|wasn't|weren't|can't|cannot|won't|shouldn't|not|never|without|no|nunca|sin)\b|\b(?:does|do|did|is|are|was|were|can|will|should)\s+not\b|(?:^|\s)(?:не|ні|без))\s*$/i.test(clause);
}

function hasPositiveMatch(text, pattern) {
  try {
    const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
    const scanner = new RegExp(pattern.source, flags);
    let match;
    while ((match = scanner.exec(text))) {
      if (!isNegatedMatch(text, match.index)) return true;
      if (match[0] === '') scanner.lastIndex++;
    }
    return false;
  } catch {
    return false;
  }
}

function matches(text, pattern) {
  try { return pattern.test(text); } catch { return false; }
}

/** Detect the strongest explicit scene action across Russian, Ukrainian, English and Spanish. */
export function detectSceneAction(input) {
  const text = String(input ?? '').normalize('NFKC').toLocaleLowerCase();
  if (!text.trim()) return 'idle';
  for (const entry of ACTION_PATTERNS) {
    if (entry.patterns.some(pattern => hasPositiveMatch(text, pattern))) return entry.action;
  }
  return 'idle';
}


const SEMANTIC_ACTIONS = [
  { intent: 'team_magic', motionCue: 'magic', patterns: [
    /(?:unite|combine|join|merge|channel|synchronize).{0,55}(?:power|energy|magic|light)|(?:power|energy|magic|light).{0,55}(?:unite|combine|join|merge|together)/i,
    /объединя\w*.{0,55}(?:сил|энерг|маг)|соединя\w*.{0,55}(?:сил|энерг|маг)|слива\w*.{0,55}(?:сил|энерг|маг)/i,
    /об'єдну\w*.{0,55}(?:сил|енерг|маг)|поєдну\w*.{0,55}(?:сил|енерг|маг)/i,
    /un(?:en|en)\w*.{0,55}(?:poder|energ|magia)|combin\w*.{0,55}(?:poder|energ|magia)/i
  ] },
  { intent: 'energy_clash', motionCue: 'magic', patterns: [
    /(?:energy|power|magic|light).{0,45}(?:clash|collid|collid|crash|impact)|(?:clash|collid|crash).{0,45}(?:energy|power|magic)/i,
    /столкнов\w*.{0,35}(?:энерг|сил|маг)|схлест\w*.{0,35}(?:энерг|сил)|удар\w*.{0,35}энерг/i,
    /зіткнен\w*.{0,35}(?:енерг|сил|маг)|зштовх\w*.{0,35}(?:енерг|сил)/i,
    /choque.{0,35}(?:energ|poder|magia)|energ\w*.{0,35}choque/i
  ] },
  { intent: 'defend', motionCue: 'turn', patterns: [
    /\b(?:blocks?|parries|deflects?|raises? a shield|protects?)\b|\bshield\b/i,
    /блокиру\w*|отража\w* удар|поднима\w* щит|защища\w*/i,
    /блоку\w*|відбива\w* удар|підніма\w* щит|захища\w*/i,
    /bloque\w*|protege\w*|escudo/i
  ] },
  { intent: 'dodge', motionCue: 'jump', patterns: [
    /\b(?:dodges?|evades?|sidesteps?|ducks?)\b/i,
    /уклоня\w*|уворачива\w*|отскакива\w*/i,
    /ухиля\w*|відскаку\w*|пригина\w*/i,
    /esquiva\w*|evita el golpe/i
  ] },
  { intent: 'attack', motionCue: 'run', patterns: [
    /\b(?:attacks?|strikes?|slashes?|swings? (?:a|the) (?:sword|blade)|fires? at)\b/i,
    /атаку\w*|наносит удар|рубит|бь[её]т мечом|стреляет в/i,
    /атаку\w*|завдає удар|рубає|б'є мечем|стріляє в/i,
    /ataca\w*|golpea\w*|lanza un ataque/i
  ] },
  { intent: 'power_up', motionCue: 'magic', patterns: [
    /\b(?:awakens?|powers? up|energy surges?|aura ignites?|eyes? (?:begin to )?glow)\b/i,
    /пробужда\w*|энергия вспыхива\w*|сила пробужда\w*|глаза загора\w*/i,
    /пробуджу\w*|енергія спалаху\w*|сила пробуджу\w*|очі спалахую\w*/i,
    /despierta\w*|energía despierta|aura se enciende/i
  ] },
  { intent: 'reveal', motionCue: 'surprised', patterns: [
    /\b(?:appears?|emerges?|materializes?|steps out of the shadows|is revealed)\b/i,
    /появля\w*|возника\w*|выходит из тен|возникает среди руин/i,
    /з[’'ʼ]?явля\w*|постає|виходить із тін|виникає серед руїн/i,
    /aparece\w*|emerge\w*|sale de las sombras/i
  ] },
  { intent: 'warning', motionCue: 'talk', patterns: [
    /\b(?:warns?|alerts?|cautions?)\b/i,
    /предупрежда\w*|предостерега\w*/i,
    /попереджа\w*|застеріга\w*/i,
    /advierte\w*|alerta/i
  ] },
  { intent: 'pick_up', motionCue: 'turn', patterns: [
    /\b(?:picks? up|picks? .* up|grabs?|lifts?|takes? .* from the ground)\b/i,
    /поднима\w*|подбира\w*|бер[её]т в руки|хвата\w*|вздыма\w*/i,
    /підніма\w*|підбира\w*|бере в руки|хапа\w*/i,
    /recoge\w*|levanta\w*|agarra\w*/
  ] },
  { intent: 'throw', motionCue: 'run', patterns: [
    /\b(?:throws?|tosses?|hurls?|launches? .* into)\b/i,
    /броса\w*|кида\w*|швыря\w*|мета\w*/i,
    /кида\w*|жбурля\w*|мета\w*/i,
    /lanza\w*|arroja\w*/
  ] },
  { intent: 'catch', motionCue: 'jump', patterns: [
    /\b(?:catches?|grabs? .* in (?:the )?air|snatches?)\b/i,
    /ловит|поймал|перехватыва\w*/i,
    /ловить|спійма\w*|перехоплю\w*/i,
    /atrapa\w*|captura\w*/
  ] },
  { intent: 'open', motionCue: 'turn', patterns: [
    /\b(?:opens?|unlocks?|pulls? .* open)\b/i,
    /открыва\w*|распахива\w*|отпира\w*/i,
    /відчиня\w*|відкрива\w*|розблокову\w*/i,
    /abre\w*|desbloquea\w*/
  ] },
  { intent: 'close', motionCue: 'turn', patterns: [
    /\b(?:closes?|shuts?|locks? .* door)\b/i,
    /закрыва\w*|захлопыва\w*|запира\w*/i,
    /зачиня\w*|закрива\w*|замика\w*/i,
    /cierra\w*|bloquea\w*/
  ] },
  { intent: 'climb', motionCue: 'jump', patterns: [
    /\b(?:climbs?|scrambles? up|scales? (?:the|a))\b/i,
    /взбира\w*|карабка\w*|лезет на|поднимается по лестниц/i,
    /видира\w*|дереться|підіймається по драбин/i,
    /trepa\w*|escala\w*/
  ] },
  { intent: 'swim', motionCue: 'float', patterns: [
    /\b(?:swims?|dives?|paddles?)\b/i,
    /плыв[её]т|ныря\w*|плавает/iu,
    /пливе|пірна\w*|плаває/iu,
    /nada\w*|bucea\w*/
  ] },
  { intent: 'fall', motionCue: 'jump', patterns: [
    /\b(?:falls?|tumbles?|topples?|plunges?)\b/i,
    /пада\w*|срыва\w* вниз|валится/iu,
    /пада\w*|зрива\w* вниз|перекидається/iu,
    /cae\w*|se desploma|tropieza\w*/
  ] },
  { intent: 'land', motionCue: 'jump', patterns: [
    /\b(?:lands?|touches? down|alights?)\b/i,
    /приземля\w*|опускается на землю/iu,
    /приземля\w*|сідає на землю/iu,
    /aterriza\w*/
  ] },
  { intent: 'hug', motionCue: 'happy', patterns: [
    /\b(?:hugs?|embraces?|cuddles?)\b/i,
    /обнима\w*|прижимает к себе/iu,
    /обійма\w*|притискає до себе/iu,
    /abraza\w*|acurruca\w*/
  ] },
  { intent: 'sit', motionCue: 'turn', patterns: [
    /\b(?:sits? down|sits? on|takes? a seat)\b/i,
    /садится|присажива\w*|усажива\w*/iu,
    /сідає|присіда\w*/iu,
    /se sienta|toma asiento/i
  ] },
  { intent: 'crawl', motionCue: 'walk', patterns: [
    /\b(?:crawls?|creeps? along the ground)\b/i,
    /полз[её]т|прополза\w*/iu,
    /повзе|проповза\w*/iu,
    /gatea\w*/
  ] },
  { intent: 'eat_drink', motionCue: 'talk', patterns: [
    /\b(?:eats?|bites?|chews?|drinks?|sips?)\b/i,
    /ест|кусает|ж[уё]в[её]т|пь[её]т|отпивает/iu,
    /їсть|кусає|жує|п'є|відпиває/iu,
    /come\w*|bebe\w*|mastica\w*/
  ] },
  { intent: 'sleep_wake', motionCue: 'idle', patterns: [
    /\b(?:falls? asleep|wakes? up|dozes?|snoozes?)\b/i,
    /засыпа\w*|просыпа\w*|дремлет/iu,
    /засина\w*|прокида\w*|дрімає/iu,
    /se duerme|despierta\w*/
  ] },
  { intent: 'point', motionCue: 'turn', patterns: [
    /\b(?:points? (?:at|to)|gestures? toward|signals? toward)\b/i,
    /указывает на|показывает пальцем|жестом указывает/iu,
    /вказує на|показує пальцем|жестом показує/iu,
    /señala\w*/
  ] },
  { intent: 'write_draw', motionCue: 'talk', patterns: [
    /\b(?:writes?|draws?|sketches?|paints?)\b/i,
    /пишет|рисует|чертит|раскрашива\w*/iu,
    /пише|малює|креслить|розфарбову\w*/iu,
    /escribe\w*|dibuja\w*|pinta\w*/
  ] },
];

/**
 * Classifies the story's semantic event separately from the renderer's supported
 * movement cue. This prevents story labels such as team_magic or energy_clash
 * from being mistaken for animation preset IDs.
 */
export function inferSceneActionIntent(input) {
  const text = String(input ?? '').normalize('NFKC').trim();
  if (!text) return { intent: 'unknown', motionCue: 'idle', confidence: 0, evidence: '' };
  for (const entry of SEMANTIC_ACTIONS) {
    const matched = entry.patterns.find(pattern => hasPositiveMatch(text, pattern));
    if (matched) return {
      intent: entry.intent,
      motionCue: entry.motionCue,
      confidence: 0.9,
      evidence: text.slice(0, 500)
    };
  }
  const motionCue = detectSceneAction(text);
  return {
    intent: motionCue === 'idle' ? 'descriptive' : motionCue,
    motionCue,
    confidence: motionCue === 'idle' ? 0 : 0.65,
    evidence: text.slice(0, 500)
  };
}


/**
 * Resolve the preview action from explicit scene motion fields first.
 * This is a lexical preview cue, not generative character animation.
 */
export function detectSceneActionForScene(scene = {}, fallbackTitle = '', fallbackDescription = '') {
  // A source-grounded semantic event is more reliable than scanning every word in
  // a long scene description. For example, a portal may disappear after a monster
  // appears; the main visible action is the reveal, not the later disappearance.
  const semanticCue = String(scene?.semanticActionIntent?.motionCue ?? '').trim();
  if (semanticCue && semanticCue !== 'idle' && ACTION_PATTERNS.some(entry => entry.action === semanticCue)) {
    return semanticCue;
  }
  const candidates = [
    scene?.motionPrompt,
    scene?.visibleAction,
    scene?.storyDetail,
    scene?.description,
    fallbackDescription,
    fallbackTitle
  ];
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (!value) continue;
    const action = detectSceneAction(value);
    if (action !== 'idle') return action;
  }
  return 'idle';
}
