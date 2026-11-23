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
  { action: 'turn', patterns: [/поворачива|оборачива|разворачива|крутится вокруг себя/, /\bturn\w*|look\s+back|rotate\w*|spin\w*/, /поверта|озира|розверта|обертається/, /\bgira\w*|\bgiró\w*|\bgiro\w*|se vuelve|mira atrás/] },
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
  { intent: 'chase', motionCue: 'run', patterns: [
    /\\b(?:chases?|pursues?|follows?|runs? after)\\b/i,
    /преследу[\\p{L}]*|гонится\\s+за|догоня[\\p{L}]*/iu,
    /пересліду[\\p{L}]*|женеться\\s+за|наздоганя[\\p{L}]*/iu,
    /persigue|va\\s+tras|persigue a/i
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
  { intent: 'enter_location', motionCue: 'walk', patterns: [
    /\b(?:enters?|steps? into|goes? inside|walks? into)\s+(?:the\s+)?(?:building|room|house|hall|warehouse|office)\b/i,
    /заходи[\p{L}]*\s+(?:в|во)\s+(?:здани[\p{L}]*|дом|комнат[\p{L}]*|зал|склад|офис)|входи[\p{L}]*\s+(?:в|во)\s+(?:здани[\p{L}]*|дом|комнат[\p{L}]*|зал|склад|офис)/iu,
    /заходить[\p{L}]*\s+(?:у|в)\s+(?:будівл[\p{L}]*|будинок|кімнат[\p{L}]*|зал|склад|офіс)/iu,
    /entra\s+en\s+(?:el\s+)?(?:edificio|edificios|habitación|casa|almacén|oficina)/i
  ] },
  { intent: 'hear_sound', motionCue: 'turn', patterns: [
    /\b(?:hears?|hearing)\s+(?:a\s+)?(?:screams?|shouts?|cries?|voices?|gunshots?|footsteps?|noise|sounds?)\b/i,
    /слышит?\s+(?:крик[\p{L}]*|голос[\p{L}]*|выстрел[\p{L}]*|шаг[\p{L}]*|шум[\p{L}]*|зву[\p{L}]*)|услыш[\p{L}]*\s+(?:крик[\p{L}]*|голос[\p{L}]*|выстрел[\p{L}]*|шаг[\p{L}]*)/iu,
    /чує\s+(?:крик[\p{L}]*|голос[\p{L}]*|постріл[\p{L}]*|крок[\p{L}]*|шум[\p{L}]*)/iu,
    /oye\s+(?:gritos?|voces?|disparos?|pasos?|ruidos?)/i
  ] },
  { intent: 'listen_carefully', motionCue: 'turn', patterns: [
    /\b(?:listens?\s+(?:carefully|closely|intently)|pauses?\s+to\s+listen|strains?\s+to\s+hear)\b/i,
    /прислушива[\p{L}]*|вслушива[\p{L}]*|замира[\p{L}]*.{0,24}слуша[\p{L}]*/iu,
    /прислуха[\p{L}]*|вслухає[\p{L}]*|завмира[\p{L}]*.{0,24}слуха[\p{L}]*/iu,
    /escucha\s+(?:atentamente|con\s+atención)|agudiza\s+el\s+oído/i
  ] },
  { intent: 'advance', motionCue: 'walk', patterns: [
    /\b(?:continues?\s+(?:forward|ahead)|advances?\s+(?:further|forward|deeper)|moves?\s+deeper)\b/i,
    /(?:ид[её]т|движется|продвигается)\s+(?:дальше|впер[её]д|глубже)|продолжа[\p{L}]*\s+движени[\p{L}]*/iu,
    /(?:йде|рухається|просувається)\s+(?:далі|вперед|глибше)|продовжу[\p{L}]*\s+рух/iu,
    /continúa\s+(?:avanzando|adelante)|avanza\s+(?:más|hacia)/i
  ] },
  { intent: 'stealth_advance', motionCue: 'walk', patterns: [
    /\b(?:sneaks?|creeps?|moves?|walks?|advances?)\b.{0,35}\b(?:quietly|silently|slowly|stealthily|cautiously)\b|\b(?:quietly|silently|stealthily)\b.{0,25}\b(?:moves?|walks?|advances?)\b/i,
    /(?:ид[её]т|шагает|продвигается|крад[её]тся|подкрадыва[\p{L}]*).{0,40}(?:медленно|тихо|бесшумно|осторожно)|(?:тихо|бесшумно|осторожно).{0,30}(?:ид[её]т|шагает|продвигается|крад[её]тся)/iu,
    /(?:йде|крокує|просувається|підкрадається).{0,40}(?:повільно|тихо|безшумно|обережно)/iu,
    /(?:avanza|camina|se mueve).{0,35}(?:despacio|lentamente|en silencio|con cuidado)/i
  ] },
  { intent: 'draw_weapon', motionCue: 'turn', patterns: [
    /\b(?:draws?|pulls? out|takes? out|unsheathes?)\s+(?:his|her|their|a|the)?\s*(?:pistol|gun|rifle|weapon|sidearm|revolver|sword|blade)\b/i,
    /доста[её]т\s+(?:свой\s+|из\s+кобуры\s+)?(?:пистолет|оружие|револьвер|винтовк[\p{L}]*|автомат[\p{L}]*|нож|меч)|вынима[\p{L}]*\s+(?:пистолет|оружие|револьвер|нож|меч)|выхватыва[\p{L}]*\s+(?:пистолет|оружие|нож|меч)/iu,
    /діста[єе]\s+(?:пістолет|зброю|револьвер|гвинтівк[\p{L}]*|ніж|меч)|вийма[\p{L}]*\s+(?:пістолет|зброю|ніж|меч)/iu,
    /saca\s+(?:su\s+)?(?:pistola|arma|revólver|rifle|cuchillo|espada)/i
  ] },
  { intent: 'aim_weapon', motionCue: 'turn', patterns: [
    /\b(?:aims?|points?)\s+(?:his|her|their|the)?\s*(?:gun|pistol|rifle|weapon|revolver)\s+(?:at|toward|towards)\b|\b(?:raises?|levels?)\s+(?:his|her|their|the)?\s*(?:gun|pistol|rifle|weapon)\b/i,
    /наводит[\p{L}]*\s+(?:пистолет|оружие|ствол|винтовк[\p{L}]*)|направля[\p{L}]*\s+(?:пистолет|оружие|ствол)\s+на|наставля[\p{L}]*\s+(?:пистолет|оружие|ствол)|поднима[\p{L}]*\s+(?:пистолет|оружие)\s+и\s+целится/iu,
    /наводить[\p{L}]*\s+(?:пістолет|зброю|гвинтівк[\p{L}]*)|спрямову[\p{L}]*\s+(?:пістолет|зброю)\s+на|цілиться\s+(?:у|в)/iu,
    /apunta\s+(?:con\s+)?(?:su\s+)?(?:pistola|arma|rifle)\s+(?:a|hacia)|encañona/i
  ] },
  { intent: 'shout_command', motionCue: 'talk', patterns: [
    /\b(?:shouts?|yells?|screams?|barks?)\s+(?:["“][^"”]{1,80}["”]|\b(?:hands?\s+up|freeze|drop\s+(?:the\s+)?weapon|stop|stay\s+back)\b)/i,
    /кричит[\p{L}]*.{0,45}(?:руки\s+вверх|стой|не\s+двигаться|брось\s+оружие|лежать|назад)|громко\s+команду[\p{L}]*|приказыва[\p{L}]*.{0,35}(?:стоять|руки\s+вверх|не\s+двигаться)/iu,
    /кричить[\p{L}]*.{0,45}(?:руки\s+вгору|не\s+рухатися|кинути\s+зброю|стояти)|наказу[\p{L}]*.{0,35}(?:стояти|руки\s+вгору|не\s+рухатися)/iu,
    /grita[\p{L}]*.{0,40}(?:manos\s+arriba|quieto|no\s+te\s+muevas|suelta\s+el\s+arma)/i
  ] },
  { intent: 'discover_threat', motionCue: 'surprised', patterns: [
    /\b(?:spots?|notices?|discovers?|finds?|sees?)\b.{0,65}\b(?:attacker|intruder|robber|thief|criminal|hostage|victim|torturer|abuser|someone\s+being\s+(?:attacked|beaten|tortured)|a\s+person\s+being\s+(?:beaten|tortured))\b/i,
    /видит[\p{L}]*.{0,45}(?:преступник[\p{L}]*|напада[\p{L}]*|грабител[\p{L}]*|вор[\p{L}]*|заложник[\p{L}]*|жертв[\p{L}]*|избива[\p{L}]*|пыта[\p{L}]*|муча[\p{L}]*|истяза[\p{L}]*|пострадавш[\p{L}]*)|обнаружива[\p{L}]*.{0,45}(?:человек[\p{L}]*|преступник[\p{L}]*|напада[\p{L}]*)/iu,
    /бачить[\p{L}]*.{0,45}(?:злочин[\p{L}]*|нападник[\p{L}]*|грабіжник[\p{L}]*|заручник[\p{L}]*|жертв[\p{L}]*|потерпіл[\p{L}]*|катува[\p{L}]*|муча[\p{L}]*)/iu,
    /ve\s+(?:a\s+)?(?:atacante|intruso|ladrón|criminal|rehén|víctima)/i
  ] },
  { intent: 'intervene', motionCue: 'run', patterns: [
    /\b(?:rushes?|bursts?|leaps?|jumps?)\s+(?:forward|out|in|into the room)|\bintervenes?\b/i,
    /врыва[\p{L}]*|выскакива[\p{L}]*|выпрыгива[\p{L}]*|броса[\p{L}]*ся\s+впер[её]д|вмешива[\p{L}]*|резко\s+вбега[\p{L}]*/iu,
    /врива[\p{L}]*|вистрибу[\p{L}]*|втруча[\p{L}]*|різко\s+вбіга[\p{L}]*/iu,
    /irrumpe|interviene|salta\s+al\s+interior/i
  ] },
  { intent: 'restrain', motionCue: 'attack', patterns: [
    /\b(?:restrains?|handcuffs?|pins?\s+down|subdues?|disarms?)\b/i,
    /задержива[\p{L}]*|скручива[\p{L}]*|надева[\p{L}]*.{0,20}наручник[\p{L}]*|обезоружива[\p{L}]*|прижимает[\p{L}]*.{0,20}к\s+полу/iu,
    /затриму[\p{L}]*|знерухомлю[\p{L}]*|одяга[\p{L}]*.{0,20}кайданк[\p{L}]*|роззброю[\p{L}]*/iu,
    /esposa[\p{L}]*|inmoviliza[\p{L}]*|desarma[\p{L}]*/
  ] },
  { intent: 'rescue', motionCue: 'run', patterns: [
    /\b(?:rescues?|frees?|helps?\s+(?:the\s+)?(?:victim|hostage|person))\b/i,
    /спаса[\p{L}]*|освобожда[\p{L}]*.{0,25}(?:человек[\p{L}]*|заложник[\p{L}]*|жертв[\p{L}]*)|помога[\p{L}]*.{0,25}(?:пострадавш[\p{L}]*|ранен[\p{L}]*)/iu,
    /ряту[\p{L}]*|звільня[\p{L}]*.{0,25}(?:людин[\p{L}]*|заручник[\p{L}]*|жертв[\p{L}]*)|допомага[\p{L}]*.{0,25}(?:потерпіл[\p{L}]*|поранен[\p{L}]*)/iu,
    /rescata[\p{L}]*|libera[\p{L}]*.{0,25}(?:rehén|víctima)/i
  ] },
  { intent: 'freeze', motionCue: 'idle', patterns: [
    /\b(?:freezes?|stops? dead|stands? still|holds? still|comes? to a halt)\b/i,
    /замира[\p{L}]*|застыва[\p{L}]*|останавлива[\p{L}]*\s+(?:как вкопанн|на месте)|замирает на месте/iu,
    /завмира[\p{L}]*|застига[\p{L}]*|зупиня[\p{L}]*\s+(?:на місці)/iu,
    /se queda inmóvil|se congela|se detiene en seco/i
  ] },
  { intent: 'take_cover', motionCue: 'jump', patterns: [
    /\b(?:takes? cover|ducks? behind|dives? behind|hides? behind|shelters? behind)\b/i,
    /прячется\s+за|ныряет\s+за|укрыва[\p{L}]*|занима[\p{L}]*\s+укрыти[\p{L}]*|падает\s+за\s+укрыти[\p{L}]*/iu,
    /хова[\p{L}]*\s+за|пірна[\p{L}]*\s+за|шука[\p{L}]*\s+укритт[\p{L}]*/iu,
    /se cubre detrás|se refugia|se esconde detrás/i
  ] },
  { intent: 'call_for_backup', motionCue: 'talk', patterns: [
    /\b(?:calls?|radios?|calls? in)\s+(?:for\s+)?(?:backup|reinforcements|support)\b|\brequests?\s+backup\b/i,
    /вызывает\s+(?:подкрепление|подмогу|поддержку)|запрашива[\p{L}]*\s+(?:подкреплени[\p{L}]*|подмог[\p{L}]*)|говорит\s+по\s+рации/iu,
    /виклика[\p{L}]*\s+(?:підкріпленн[\p{L}]*|підмогу)|запитує\s+підкріпленн[\p{L}]*|говорить\s+по\s+рації/iu,
    /pide refuerzos|solicita apoyo|llama a refuerzos/i
  ] },
  { intent: 'drop_weapon', motionCue: 'turn', patterns: [
    /\b(?:drops?|lowers?)\s+(?:his|her|their|the)?\s*(?:gun|pistol|weapon|rifle)\b|\bthrows?\s+(?:his|her|their|the)?\s*(?:gun|pistol|weapon)\s+down\b/i,
    /бросает\s+(?:пистолет|оружие|револьвер)|роняет\s+(?:пистолет|оружие)|опускает\s+(?:пистолет|оружие)|выбрасывает\s+(?:пистолет|оружие)/iu,
    /кида[\p{L}]*\s+(?:пістолет|зброю)|опуска[\p{L}]*\s+(?:пістолет|зброю)|випуска[\p{L}]*\s+(?:пістолет|зброю)/iu,
    /deja caer|baja|suelta\s+(?:su\s+)?(?:arma|pistola)/i
  ] },
  { intent: 'hands_up', motionCue: 'surprised', patterns: [
    /\b(?:raises?|puts?)\s+(?:both\s+)?hands?(?:\s+(?:up|above (?:his|her|their) head))?\b/i,
    /поднимает\s+руки|поднимает\s+обе\s+руки/iu,
    /підніма[\p{L}]*\s+руки/iu,
    /levanta\s+las\s+manos/i
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
    /\b(?:sits? down|sits? (?:on|beside|near|by)|takes? a seat)\b/i,
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
    /\b(?:points? (?:at|to|toward)|gestures? toward|signals? toward)\b/i,
    /указывает на|показывает пальцем|жестом указывает/iu,
    /вказує на|показує пальцем|жестом показує/iu,
    /señala\w*/
  ] },
  { intent: 'write_draw', motionCue: 'talk', patterns: [
    /\b(?:writes?|sketches?|paints?)\b|\bdraws?\s+(?:a|the|his|her|their)?\s*(?:picture|map|diagram|portrait|sketch|plan|symbol|shape)\b/i,
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


/**
 * Resolve the procedural renderer cue from the source-ordered action timeline.
 * Step boundaries are normalized to the scene's 0..1 progress range. If a scene
 * has no supported single-phase step timeline, retain the existing lexical fallback.
 */
export function detectSceneActionAtProgress(scene = {}, progress = 0, fallbackTitle = '', fallbackDescription = '') {
  const phases = Array.isArray(scene?.actionTimeline?.phases) ? scene.actionTimeline.phases : [];
  const normalizedProgress = Math.max(0, Math.min(1, Number.isFinite(Number(progress)) ? Number(progress) : 0));
  const hasTimedPhases = phases.some(phase => {
    const start = Number(phase?.start);
    const end = Number(phase?.end);
    return Number.isFinite(start) && Number.isFinite(end) && end > start;
  });

  if (hasTimedPhases) {
    let activePhase = null;
    phases.forEach((phase, index) => {
      const start = Number(phase?.start);
      const end = Number(phase?.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
      const isActive = normalizedProgress >= start
        && (normalizedProgress < end || (index === phases.length - 1 && normalizedProgress <= end));
      if (isActive) activePhase = phase;
    });

    // A validated timeline is authoritative: gaps between phases are deliberate holds.
    if (!activePhase) return 'idle';

    const steps = Array.isArray(activePhase.steps) ? activePhase.steps : [];
    if (steps.length) {
      const activeStep = steps.find((step, index) => {
        const start = Number(step?.start);
        const end = Number(step?.end);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;
        return normalizedProgress >= start
          && (normalizedProgress < end || (index === steps.length - 1 && normalizedProgress <= end));
      });
      if (!activeStep) return 'idle';
      const cue = String(activeStep.motionCue ?? '').trim();
      if (cue === 'idle' || ACTION_PATTERNS.some(entry => entry.action === cue)) return cue;
      const stepDescription = String(activeStep.description ?? '').trim();
      if (stepDescription) {
        const detected = detectSceneAction(stepDescription);
        if (detected !== 'idle') return detected;
      }
      const phaseDescription = String(activePhase.description ?? '').trim();
      return phaseDescription ? detectSceneAction(phaseDescription) : detectSceneActionForScene(scene, fallbackTitle, fallbackDescription);
    }

    const phaseDescription = String(activePhase.description ?? '').trim();
    return phaseDescription ? detectSceneAction(phaseDescription) : detectSceneActionForScene(scene, fallbackTitle, fallbackDescription);
  }

  return detectSceneActionForScene(scene, fallbackTitle, fallbackDescription);
}

/**
 * Extracts ordered, source-grounded action events from a single scene description.
 * It does not invent connective actions: only explicit positive matches are returned.
 * Overlapping synonyms are collapsed so one phrase cannot create duplicate timeline phases.
 */
export function extractSceneActionSequence(input, { maxActions = 16 } = {}) {
  const text = String(input ?? '').normalize('NFKC').trim();
  if (!text) return [];
  const matchesFound = [];
  for (let priority = 0; priority < SEMANTIC_ACTIONS.length; priority++) {
    const entry = SEMANTIC_ACTIONS[priority];
    for (const pattern of entry.patterns) {
      try {
        const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
        const scanner = new RegExp(pattern.source, flags);
        let match;
        while ((match = scanner.exec(text))) {
          if (match[0] && !isNegatedMatch(text, match.index)) {
            matchesFound.push({
              intent: entry.intent,
              motionCue: entry.motionCue,
              confidence: 0.9,
              evidence: match[0],
              startIndex: match.index,
              endIndex: match.index + match[0].length,
              priority
            });
          }
          if (match[0] === '') scanner.lastIndex++;
        }
      } catch {
        // An invalid optional pattern must not prevent the remaining actions from parsing.
      }
    }
  }
  // Include the renderer's basic movement/emotion cues as explicit events too.
  for (let priority = 0; priority < ACTION_PATTERNS.length; priority++) {
    const entry = ACTION_PATTERNS[priority];
    for (const pattern of entry.patterns) {
      try {
        const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
        const scanner = new RegExp(pattern.source, flags);
        let match;
        while ((match = scanner.exec(text))) {
          if (match[0] && !isNegatedMatch(text, match.index)) {
            matchesFound.push({
              intent: entry.action,
              motionCue: entry.action,
              confidence: 0.65,
              evidence: match[0],
              startIndex: match.index,
              endIndex: match.index + match[0].length,
              priority: SEMANTIC_ACTIONS.length + priority
            });
          }
          if (match[0] === '') scanner.lastIndex++;
        }
      } catch {
        // Ignore malformed optional patterns and continue with the remaining cues.
      }
    }
  }
  matchesFound.sort((a, b) => a.startIndex - b.startIndex || a.priority - b.priority || b.endIndex - a.endIndex);
  const sequence = [];
  for (const candidate of matchesFound) {
    // Collapse duplicate detections of the same event and generic renderer cues
    // covered by a semantic event. Never let one semantic phrase swallow a later,
    // distinct semantic event in the same sentence.
    const overlap = sequence.find(item =>
      candidate.startIndex < item.endIndex
      && candidate.endIndex > item.startIndex
      && (
        candidate.intent === item.intent
        || candidate.priority >= SEMANTIC_ACTIONS.length
        || item.priority >= SEMANTIC_ACTIONS.length
      )
    );
    if (overlap) {
      if (candidate.priority < overlap.priority) Object.assign(overlap, candidate);
      continue;
    }
    sequence.push(candidate);
    if (sequence.length >= Math.max(1, Math.min(24, Number(maxActions) || 16))) break;
  }
  const durationWeight = {
    enter_location: 1.1, hear_sound: 0.75, listen_carefully: 1.4,
    stealth_advance: 1.5, advance: 1.2, draw_weapon: 0.9,
    discover_threat: 0.9, intervene: 1.05, aim_weapon: 0.85,
    shout_command: 0.8, freeze: 1.2, take_cover: 0.95,
    call_for_backup: 1, drop_weapon: 0.8, hands_up: 0.8
  };
  return sequence.map(({ priority, ...event }) => ({
    ...event,
    durationWeight: durationWeight[event.intent] || 1
  }));
}
