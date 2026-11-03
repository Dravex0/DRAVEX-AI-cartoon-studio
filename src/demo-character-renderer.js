const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : 0));

function drawLimb(ctx, { x, y, upper, lower, angle, color, width = 9 }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, upper);
  ctx.lineTo(Math.sin(angle * 0.55) * 5, upper + lower);
  ctx.stroke();
  ctx.fillStyle = '#f4c28f';
  ctx.beginPath();
  ctx.ellipse(Math.sin(angle * 0.55) * 5, upper + lower + 2, 8, 4, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Draw the built-in fox with independently animated limbs, tail and head. */
export function drawProceduralDemoFox(ctx, {
  x = 0, y = 0, time = 0, action = 'idle', sceneIndex = 0,
  mouthOpenness = 0, viseme = 'neutral'
} = {}) {
  if (!ctx || typeof ctx.save !== 'function' || typeof ctx.beginPath !== 'function') {
    throw new TypeError('A CanvasRenderingContext2D-like context is required.');
  }
  const t = Number.isFinite(Number(time)) ? Number(time) : 0;
  const scene = Math.max(0, Math.floor(Number(sceneIndex) || 0));
  const poses = [[0,0,0],[18,0,-.08],[48,-12,.16],[12,-34,-.18],[-8,0,0]];
  const pose = poses[scene % poses.length];
  const pulse = Math.sin(t * 2.4);
  let fx = Number(x) + pose[0] + Math.sin(t) * 6;
  let fy = Number(y) + pose[1] + Math.sin(t * 2) * 3 + (scene === 3 ? Math.abs(pulse) * 7 : 0);
  if (action === 'run') { fx += Math.sin(t * 4) * 22; fy -= Math.abs(Math.sin(t * 4)) * 8; }
  else if (action === 'jump') fy -= Math.abs(Math.sin(t * 3)) * 28;
  else if (action === 'walk') { fx += Math.sin(t * 2.2) * 13; fy -= Math.abs(Math.sin(t * 2.2)) * 4; }
  else if (action === 'dance') { fx += Math.sin(t * 3.4) * 12; fy -= Math.abs(Math.sin(t * 3.4)) * 12; }
  else if (action === 'talk') fy += Math.sin(t * 5) * 2;
  else if (action === 'surprised') fy -= Math.abs(Math.sin(t * 2)) * 5;
  else if (action === 'sad') fy += Math.abs(Math.sin(t * 1.5)) * 3;

  const strideRate = action === 'run' ? 9 : action === 'walk' ? 5 : action === 'dance' ? 7 : 2.4;
  const stride = Math.sin(t * strideRate);
  const activeStride = ['run', 'walk', 'dance', 'jump'].includes(action) ? stride : Math.sin(t * 2);
  const airborne = action === 'jump' ? Math.abs(Math.sin(t * 3)) : 0;
  const armSwing = action === 'wave' ? Math.sin(t * 5) * 0.34 : activeStride * (action === 'run' ? 0.72 : 0.42);
  const legSwing = activeStride * (action === 'run' ? 0.82 : 0.52);

  ctx.save();
  ctx.translate(fx, fy);
  ctx.rotate(pose[2] + (scene === 2 ? Math.sin(t * 1.8) * .04 : 0) +
    (action === 'dance' ? Math.sin(t * 3.4) * .2 : action === 'turn' ? Math.sin(t * 2) * .5 : 0));

  // Tail is drawn behind the body and has its own follow-through.
  ctx.save();
  ctx.translate(-43, 20);
  ctx.rotate(-0.48 + Math.sin(t * 2.8) * 0.16 + activeStride * 0.12);
  ctx.fillStyle = '#e97838';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.quadraticCurveTo(-35, -38, -62, -9);
  ctx.quadraticCurveTo(-45, 19, -15, 17); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff0dc';
  ctx.beginPath(); ctx.ellipse(-55, -8, 11, 8, -.35, 0, TAU); ctx.fill();
  ctx.restore();

  // Legs remain visible below the body; each side swings in opposition.
  drawLimb(ctx, { x: -22, y: 36, upper: 23, lower: 18, angle: legSwing - airborne * .45, color: '#d96e36', width: 11 });
  drawLimb(ctx, { x: 24, y: 36, upper: 23, lower: 18, angle: -legSwing - airborne * .45, color: '#f18a48', width: 11 });

  ctx.fillStyle = '#f18a48';
  ctx.beginPath(); ctx.ellipse(0, 10, 55, 42, 0, 0, TAU); ctx.fill();

  // Front arms swing independently; wave raises the near paw.
  drawLimb(ctx, { x: -34, y: 2, upper: 18, lower: 13, angle: -0.48 - armSwing, color: '#e97838', width: 9 });
  drawLimb(ctx, { x: 38, y: 2, upper: 18, lower: 13, angle: action === 'wave' ? -2.35 + Math.sin(t * 5) * .22 : 0.48 + armSwing, color: '#f18a48', width: 9 });

  // Head and ears get a small secondary motion instead of being rigidly fixed.
  ctx.save();
  ctx.translate(0, -17 + Math.sin(t * 2.1) * 1.8);
  ctx.rotate(action === 'surprised' ? -0.08 : action === 'sad' ? 0.1 : Math.sin(t * 2.2) * 0.035);
  ctx.fillStyle = '#f18a48';
  ctx.beginPath(); ctx.moveTo(-38, -10); ctx.lineTo(-48, -68); ctx.lineTo(-10, -38); ctx.fill();
  ctx.beginPath(); ctx.moveTo(5, -36); ctx.lineTo(32, -72); ctx.lineTo(42, -17); ctx.fill();
  ctx.fillStyle = '#ffd0a1'; ctx.beginPath(); ctx.ellipse(8, 17, 31, 23, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(4, -5, 9, 12, 0, 0, TAU); ctx.ellipse(28, -5, 9, 12, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#242033'; ctx.beginPath(); ctx.arc(7, -4, 4, 0, TAU); ctx.arc(29, -4, 4, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(17, 13, 5, 0, TAU); ctx.fill();

  const openness = clamp(mouthOpenness, 0, 1);
  if (openness > 0.035) {
    ctx.fillStyle = '#242033';
    if (viseme === 'closed') {
      ctx.strokeStyle = '#242033'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(12, 20); ctx.lineTo(22, 20); ctx.stroke();
    } else {
      const mouthWidth = viseme === 'wide' ? 5.5 : viseme === 'round' ? 2.7 : viseme === 'teeth' ? 4.8 : 3.8;
      const mouthHeight = viseme === 'wide' ? 1.8 + openness * 2 : viseme === 'round' ? 2.5 + openness * 4 :
        viseme === 'teeth' ? 1.8 + openness * 2 : viseme === 'open' ? 2 + openness * 7 : 1.8 + openness * 2;
      ctx.beginPath(); ctx.ellipse(17, 20, mouthWidth, mouthHeight, 0, 0, TAU); ctx.fill();
    }
  } else if (action === 'happy' || action === 'sad') {
    ctx.strokeStyle = '#242033'; ctx.lineWidth = 2.5; ctx.beginPath();
    ctx.arc(17, 20, action === 'happy' ? 8 : 7, action === 'happy' ? 0 : Math.PI, action === 'happy' ? Math.PI : TAU); ctx.stroke();
  } else if (action === 'talk' || action === 'surprised') {
    const mouthOpen = action === 'surprised' ? 1 : Math.max(0.2, (Math.sin(t * 8) + 1) * 0.35);
    ctx.fillStyle = '#242033'; ctx.beginPath();
    ctx.ellipse(17, 20, action === 'surprised' ? 6 : 4, Math.max(1.5, 2 + mouthOpen * 7), 0, 0, TAU); ctx.fill();
  }
  if (action === 'sad') {
    ctx.fillStyle = 'rgba(130,220,255,.85)'; ctx.beginPath(); ctx.ellipse(34, 8, 3, 6, -.25, 0, TAU); ctx.fill();
  }
  if (scene === 2 || scene === 3) {
    ctx.strokeStyle = '#242033'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-1, -20); ctx.lineTo(10, -17); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
  return { x: fx, y: fy };
}
