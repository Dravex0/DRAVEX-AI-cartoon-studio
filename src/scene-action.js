const ACTION_PATTERNS = [
  { action: 'vanish', patterns: [/исчез|пропад|растворя|тает на глазах|исчезает/, /\bvanish\w*|disappear\w*|fade\s*out|dissolve\w*/, /зника|щез|розчиня/, /desaparec\w*|se desvanece/] },
  { action: 'jump', patterns: [/прыга|подпрыг|перепрыг|скачет/, /\bjump\w*|leap\w*|bounce\w*/, /стриба|підстрибу|перестрибу/, /salt\w*|brinca\w*/] },
  { action: 'run', patterns: [/беж|побеж|убега|мчится|гонится/, /\brun\w*|sprint\w*|chase\w*|runn?ing\b/, /біж|тіка|мчить|пересліду/, /corr\w*|persigue\w*|huye\w*/] },
  { action: 'dance', patterns: [/танцу|пляш|ритмично двига|кружится в танце/, /\bdanc\w*|twirl\w*|groove\w*/, /танцю|ритмічно руха|крутиться в танці/, /bail\w*|gira bailando/] },
  { action: 'walk', patterns: [/ид[её]т|шагает|прогулива|подходит|отходит/, /\bwalk\w*|stroll\w*|approach\w*|step\s+(?:forward|back)/, /йде|крокує|підходить|відходить/, /camin\w*|se acerc\w*|se aleja/] },
  { action: 'float', patterns: [/парит|взлет|летит|плыв[её]т по воздуху/, /\bfloat\w*|fly\w*|soar\w*|hover\w*/, /ширя|зліта|летить|пливе в повітрі/, /vuela|flot\w*|planea/] },
  { action: 'magic', patterns: [/свет|сия|вспыш|маг|волшеб|искрится|сверкает/, /\bglow\w*|shine\w*|flash\w*|magic\w*|spark\w*|illuminat\w*/, /світ|сяй|спалах|магі|чарів|іскриться|виблискує/, /brill\w*|magia|destell\w*|resplandec\w*/] },
  { action: 'surprised', patterns: [/удивл|изумл|ошараш|вскрикива|широко раскрывает глаза/, /\bsurpris\w*|astonish\w*|gasp\w*|wide[- ]eyed/, /здив|враж|ошелеш|широко розплющує очі/, /sorprend\w*|asombr\w*|abre mucho los ojos/] },
  { action: 'sad', patterns: [/плак|груст|страх|боится|расстро|слез/, /\bcry\w*|sad\w*|afraid|fearful|scared|sorrow\w*/, /плак|сум|боїться|злякав|сльоз/, /llor\w*|triste|asustad\w*|teme/] },
  { action: 'happy', patterns: [/радост|улыб|счаст|весел|довол/, /\bhappy|smil\w*|joy\w*|cheerful|laugh\w*/, /радіс|усміх|щаслив|весел|задовол/, /feliz|sonrí\w*|alegr\w*|ríe/] },
  { action: 'talk', patterns: [/говорит|разговари|произносит|рассказыва|шепчет/, /\btalk\w*|speak\w*|say\w*|whisper\w*|dialog\w*/, /говорить|розмовля|вимовля|розповіда|шепоче/, /habl\w*|dice|susurr\w*|convers\w*/] },
  { action: 'turn', patterns: [/поворачива|оборачива|разворачива|крутится вокруг себя/, /\bturn\w*|look\s+back|rotate\w*|spin\w*/, /поверта|озира|розверта|обертається/, /gir\w*|se vuelve|mira atrás/] }
];

function matches(text, pattern) {
  try { return pattern.test(text); } catch { return false; }
}

/** Detect the strongest explicit scene action across Russian, Ukrainian, English and Spanish. */
export function detectSceneAction(input) {
  const text = String(input ?? '').normalize('NFKC').toLocaleLowerCase();
  if (!text.trim()) return 'idle';
  for (const entry of ACTION_PATTERNS) {
    if (entry.patterns.some(pattern => matches(text, pattern))) return entry.action;
  }
  return 'idle';
}
