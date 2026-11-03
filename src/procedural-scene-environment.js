const ENVIRONMENTS = [
  { type: 'forest', pattern: /\\bforest\\b|\\bwoods?\\b|\\btrees?\\b|лес|лесу|дерев|ліс|дерев/i },
  { type: 'castle', pattern: /\\bcastle\\b|\\bkingdom\\b|\\bpalace\\b|замок|дворец|палац|фортец/i },
  { type: 'cave', pattern: /\\bcave\\b|\\btunnel\\b|\\bunderground\\b|пещер|туннел|печер|підзем/i },
  { type: 'beach', pattern: /\\bbeach\\b|\\bocean\\b|\\bsea\\b|\\bshore\\b|пляж|океан|море|узбереж/i },
  { type: 'city', pattern: /\\bcity\\b|\\bstreet\\b|\\btown\\b|\\bbuildings?\\b|город|улиц|міст|вулиц|будин/i }
];

/** Infer a small, deterministic environment vocabulary from grounded scene text. */
export function inferProceduralEnvironment(scene = {}) {
  const source = [scene.location, scene.environmentDescription, scene.prompt, scene.storyDetail, scene.title]
    .filter(value => typeof value === 'string').join(' ').slice(0, 8_000);
  return ENVIRONMENTS.find(environment => environment.pattern.test(source))?.type || 'hills';
}

function polygon(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw restrained background silhouettes after the sky/terrain wash and before characters.
 * This is a local visual fallback, not a substitute for generated scene artwork.
 */
export function drawProceduralSceneEnvironment(ctx, scene, width, height, time = 0) {
  if (!ctx || typeof ctx.beginPath !== 'function' || typeof ctx.fillRect !== 'function') return 'hills';
  const type = inferProceduralEnvironment(scene);
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const t = Number.isFinite(Number(time)) ? Number(time) : 0;
  ctx.save();
  ctx.globalAlpha = 0.88;
  if (type === 'forest') {
    for (let i = 0; i < 9; i++) {
      const x = (i + 0.35) * w / 9;
      const top = h * (0.38 + (i % 3) * 0.045);
      ctx.fillStyle = i % 2 ? '#173b3b' : '#204b43';
      ctx.fillRect(x - 5, top, 10, h - top);
      ctx.fillStyle = i % 2 ? '#245b4b' : '#2e6b50';
      ctx.beginPath(); ctx.arc(x, top, h * 0.095, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x - 12, top + 17, h * 0.065, 0, Math.PI * 2); ctx.fill();
    }
  } else if (type === 'castle') {
    const base = h * 0.79;
    ctx.fillStyle = '#27384f';
    ctx.fillRect(w * 0.23, h * 0.48, w * 0.54, base - h * 0.48);
    for (const x of [w * 0.2, w * 0.39, w * 0.61, w * 0.8]) {
      ctx.fillRect(x - w * 0.045, h * 0.36, w * 0.09, base - h * 0.36);
      polygon(ctx, [[x - w * 0.055, h * 0.36], [x, h * 0.27], [x + w * 0.055, h * 0.36]], '#354965');
    }
    ctx.fillStyle = '#17263c'; ctx.fillRect(w * 0.45, h * 0.62, w * 0.1, h * 0.17);
  } else if (type === 'cave') {
    polygon(ctx, [[0,0],[w*.2,0],[w*.3,h*.2],[w*.37,h*.43],[w*.48,h*.22],[w*.55,0],[w,0],[w,h*.16],[w*.84,h*.25],[w*.78,h*.48],[w*.66,h*.31],[w*.58,h*.56],[w*.42,h*.35],[w*.28,h*.58],[w*.17,h*.3],[0,h*.2]], '#172b39');
    ctx.fillStyle = '#263b49'; ctx.fillRect(0,h*.79,w,h*.21);
    ctx.fillStyle = 'rgba(112,190,220,.24)'; ctx.beginPath(); ctx.ellipse(w*.52,h*.79,w*.18,h*.035,0,0,Math.PI*2); ctx.fill();
  } else if (type === 'beach') {
    ctx.fillStyle = '#d6b878'; ctx.fillRect(0,h*.76,w,h*.24);
    ctx.fillStyle = '#267d91'; ctx.fillRect(0,h*.62,w,h*.14);
    for (let i = 0; i < 3; i++) {
      const y = h * (.66 + i * .045);
      ctx.strokeStyle = 'rgba(205,245,239,.58)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0,y + Math.sin(t*1.2+i)*2);
      ctx.quadraticCurveTo(w*.5,y-5,w,y+Math.cos(t*1.2+i)*2); ctx.stroke();
    }
    ctx.fillStyle = '#ffe0a0'; ctx.beginPath(); ctx.arc(w*.78,h*.23,h*.07,0,Math.PI*2); ctx.fill();
  } else if (type === 'city') {
    for (let i = 0; i < 8; i++) {
      const bw = w * (.07 + (i % 3) * .012);
      const x = i * w / 8;
      const bh = h * (.22 + ((i * 7) % 5) * .055);
      ctx.fillStyle = i % 2 ? '#263b54' : '#30465c';
      ctx.fillRect(x, h*.8-bh, bw, bh);
      ctx.fillStyle = 'rgba(255,224,154,.55)';
      for (let row = 0; row < 3; row++) for (let col = 0; col < 2; col++) {
        ctx.fillRect(x+bw*(.2+col*.42),h*.8-bh+h*.04+row*h*.055,Math.max(2,bw*.12),Math.max(2,h*.025));
      }
    }
  }
  ctx.restore();
  return type;
}
