const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));

function cloakColor(profile = {}) {
  const source = [
    profile.colors, profile.clothing, profile.visualDescription,
    profile.distinctiveFeatures, profile.bodyShape
  ].map(value => clean(value).toLocaleLowerCase()).join(' ');
  const colors = [
    [/dark green|green|зел[её]н|зелен|verd[eo]/u, '#315d43'],
    [/blue|син|голуб|azul/u, '#345b86'],
    [/red|красн|червон|rojo/u, '#8b3d45'],
    [/brown|коричнев|кар[іи]чнев|marr[oó]n/u, '#76513b'],
    [/purple|violet|фиолет|фіолет|morado/u, '#654778'],
    [/black|ч[её]рн|чорн|negro/u, '#34343b'],
    [/white|бел|бі[лє]|blanco/u, '#c7c7bd'],
    [/yellow|ж[её]лт|жовт|amarillo/u, '#a98535']
  ];
  return colors.find(([pattern]) => pattern.test(source))?.[1] || '#52616b';
}

function line(ctx, points, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function limb(ctx, start, end, color, width) {
  line(ctx, [start, end], color, width);
  ctx.fillStyle = '#d9ad88';
  ctx.beginPath();
  ctx.arc(end[0], end[1], width * 0.42, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draws a clearly procedural local stand-in only when no character artwork exists.
 * This is not an AI-generated portrait and does not claim to reproduce the reference.
 */
export function drawProceduralCharacterStandIn(context, {
  characterId = 'Character',
  profile = {},
  x = 0.4,
  y = 0.78,
  width = 1280,
  height = 720,
  time = 0,
  progress = 0,
  action = 'idle',
  target = null,
  heldTarget = null,
  held = false,
  badgeText = 'LOCAL STAND-IN'
} = {}) {
  if (!context || typeof context.save !== 'function'
    || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { drawn: false, reason: 'invalid-canvas' };
  }
  const scale = Math.max(1, Math.min(width, height));
  const originX = clamp(x, 0.08, 0.92) * width;
  const originY = clamp(y, 0.5, 0.9) * height;
  const t = Number.isFinite(time) ? time : 0;
  const p = clamp(progress, 0, 1);
  const cloak = cloakColor(profile);
  const dark = '#252b31';
  const skin = '#d9ad88';
  const strideRate = action === 'run' ? 8 : action === 'walk' ? 5 : 2.3;
  const stride = ['run', 'walk', 'jump'].includes(action) ? Math.sin(t * strideRate) : Math.sin(t * 1.8) * 0.12;
  const bob = action === 'jump' ? -Math.abs(Math.sin(t * 3)) * 0.035 : Math.abs(Math.sin(t * strideRate)) * (action === 'walk' || action === 'run' ? 0.012 : 0.003);
  const headTilt = action === 'surprised' ? -0.12 : action === 'sad' ? 0.12 : Math.sin(t * 1.4) * 0.018;
  const isReach = Boolean(target) && ['reach', 'lift', 'free', 'rescue', 'open', 'pickup'].includes(action);
  const reachProgress = isReach ? clamp((p - 0.08) / 0.72, 0, 1) : 0;
  const targetPoint = target && Number.isFinite(target.x) && Number.isFinite(target.y)
    ? [
        (target.x * width - originX) / scale,
        (target.y * height - originY) / scale
      ]
    : [0.19, -0.08];
  const handTarget = isReach
    ? [0.055 + (targetPoint[0] - 0.055) * reachProgress, -0.075 + (targetPoint[1] + 0.075) * reachProgress]
    : [0.13, -0.02 + Math.sin(t * 2.2) * 0.025];
  const heldPoint = heldTarget && Number.isFinite(heldTarget.x) && Number.isFinite(heldTarget.y)
    ? [(heldTarget.x * width - originX) / scale, (heldTarget.y * height - originY) / scale]
    : [0.12, -0.075];

  let drawnHandLocal = handTarget;
  let secondaryHandLocal = [-0.11, -0.005];
  context.save();
  try {
    context.translate(originX, originY + bob * scale);
    context.scale(scale, scale);

    // Rear cloak and legs.
    context.fillStyle = cloak;
    context.beginPath();
    context.moveTo(-0.055, -0.105);
    context.quadraticCurveTo(-0.12, -0.005, -0.105, 0.11);
    context.quadraticCurveTo(0, 0.155, 0.105, 0.11);
    context.quadraticCurveTo(0.12, -0.005, 0.055, -0.105);
    context.closePath();
    context.fill();

    const legSwing = stride * (action === 'run' ? 0.055 : 0.032);
    limb(context, [-0.022, 0.105], [-0.035 + legSwing, 0.185], dark, 0.025);
    limb(context, [0.022, 0.105], [0.035 - legSwing, 0.185], dark, 0.025);
    line(context, [[-0.055 + legSwing, 0.188], [-0.012 + legSwing, 0.188]], '#342e2c', 0.025);
    line(context, [[0.015 - legSwing, 0.188], [0.06 - legSwing, 0.188]], '#342e2c', 0.025);

    // Torso / tunic and a simple belt.
    context.fillStyle = cloak;
    context.beginPath();
    context.moveTo(-0.06, -0.11);
    context.quadraticCurveTo(0, -0.145, 0.06, -0.11);
    context.lineTo(0.075, 0.085);
    context.quadraticCurveTo(0, 0.12, -0.075, 0.085);
    context.closePath();
    context.fill();
    context.strokeStyle = '#1f3d30';
    context.lineWidth = 0.006;
    context.stroke();
    line(context, [[-0.052, 0.025], [0.052, 0.025]], '#b39a67', 0.008);
    context.fillStyle = '#d4b36d';
    context.fillRect(-0.009, 0.018, 0.018, 0.014);

    // Inactive arm swings; active arm reaches toward the locked prop target.
    const leftArmEnd = held && target
      ? [targetPoint[0] * reachProgress + (-0.11) * (1 - reachProgress), targetPoint[1] * reachProgress + (-0.005) * (1 - reachProgress)]
      : [-0.11, -0.005 + Math.sin(t * strideRate) * 0.025];
    limb(context, [-0.045, -0.08], leftArmEnd, cloak, 0.022);
    const rightArmEnd = held ? heldPoint : handTarget;
    drawnHandLocal = rightArmEnd;
    secondaryHandLocal = leftArmEnd;
    line(context, [[0.045, -0.08], [0.055, -0.035], rightArmEnd], cloak, 0.023);
    context.fillStyle = skin;
    context.beginPath();
    context.arc(rightArmEnd[0], rightArmEnd[1], 0.014, 0, Math.PI * 2);
    context.fill();

    // Head, hair/cowl, face and eyes. This is intentionally generic.
    context.save();
    context.translate(0, -0.145);
    context.rotate(headTilt);
    context.fillStyle = skin;
    context.beginPath();
    context.ellipse(0, 0, 0.043, 0.052, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = dark;
    context.beginPath();
    context.moveTo(-0.043, -0.005);
    context.quadraticCurveTo(-0.04, -0.07, 0.014, -0.061);
    context.quadraticCurveTo(0.05, -0.05, 0.044, -0.005);
    context.lineTo(0.025, -0.02);
    context.quadraticCurveTo(-0.01, -0.035, -0.043, -0.005);
    context.closePath();
    context.fill();
    context.fillStyle = '#24252a';
    context.beginPath();
    context.arc(-0.014, 0.006, 0.0042, 0, Math.PI * 2);
    context.arc(0.014, 0.006, 0.0042, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#754d40';
    context.lineWidth = 0.0035;
    context.beginPath();
    context.moveTo(-0.008, 0.027);
    context.quadraticCurveTo(0.005, 0.035, 0.018, 0.026);
    context.stroke();
    context.restore();

    // Subtle local-mode badge avoids implying that this is generated character art.
    context.fillStyle = 'rgba(8,12,20,.76)';
    context.beginPath();
    context.roundRect(-0.13, 0.205, 0.26, 0.032, 0.012);
    context.fill();
    context.fillStyle = '#e6edf2';
    context.font = '0.014px system-ui';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(clean(badgeText, 32) || 'LOCAL STAND-IN', 0, 0.221);
  } finally {
    context.restore();
  }
  return {
    drawn: true,
    mode: 'procedural-stand-in',
    characterId: clean(characterId, 120),
    origin: { x: originX / width, y: originY / height },
    handTarget: { x: originX / width + handTarget[0] * scale / width, y: originY / height + handTarget[1] * scale / height },
    drawnHand: { x: originX / width + drawnHandLocal[0] * scale / width, y: originY / height + drawnHandLocal[1] * scale / height },
    secondaryHand: { x: originX / width + secondaryHandLocal[0] * scale / width, y: originY / height + secondaryHandLocal[1] * scale / height }
  };
}
