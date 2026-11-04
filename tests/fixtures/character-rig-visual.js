import { buildCharacterRigAssetPlan } from '../../src/character-rig-asset-plan.js';
import { createCharacterRigMotionPreset } from '../../src/character-rig-motion-presets.js';
import { sampleCharacterRigTimeline } from '../../src/character-rig-timeline.js';
import { drawCharacterLayers } from '../../src/scene-character-layers.js';

const WIDTH = 480;
const HEIGHT = 420;
const phases = [0, 0.25, 0.5, 0.75];
const sheet = document.querySelector('#contactSheet');
const sheetContext = sheet.getContext('2d', { willReadFrequently: true });
const status = document.querySelector('#status');

function makePartImage(partId) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(30, 20, 220, 230);
  gradient.addColorStop(0, '#ffcc72');
  gradient.addColorStop(1, '#b94f35');
  context.fillStyle = gradient;
  context.strokeStyle = '#462c3b';
  context.lineWidth = 12;
  context.lineJoin = 'round';

  const rounded = (x, y, width, height, radius) => {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fill();
    context.stroke();
  };

  if (partId === 'head') {
    context.beginPath();
    context.ellipse(128, 132, 91, 99, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#fff7df';
    context.beginPath();
    context.ellipse(128, 164, 54, 36, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#27334d';
    for (const x of [91, 165]) {
      context.beginPath();
      context.ellipse(x, 122, 9, 15, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#3b2632';
    context.beginPath();
    context.ellipse(128, 155, 8, 6, 0, 0, Math.PI * 2);
    context.fill();
  } else if (partId === 'torso') {
    rounded(56, 24, 144, 210, 52);
    context.fillStyle = '#5b9d9a';
    rounded(74, 124, 108, 70, 26);
  } else if (partId.includes('arm')) {
    rounded(80, 12, 96, 232, 44);
    context.fillStyle = '#ffe0a5';
    context.beginPath();
    context.arc(128, 218, 36, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else if (partId.includes('leg')) {
    rounded(78, 12, 100, 232, 42);
    context.fillStyle = '#4d557b';
    rounded(69, 176, 118, 62, 28);
  }
  return canvas;
}

function drawBackdrop(context, index, phase) {
  const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, '#263c5c');
  gradient.addColorStop(1, '#111c32');
  context.fillStyle = gradient;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = 'rgba(255,255,255,0.08)';
  for (let dot = 0; dot < 18; dot++) {
    const x = (dot * 83 + 29) % WIDTH;
    const y = (dot * 47 + 23) % 260;
    context.beginPath();
    context.arc(x, y, 2 + (dot % 3), 0, Math.PI * 2);
    context.fill();
  }
  context.strokeStyle = 'rgba(230,240,255,0.42)';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, 350);
  context.lineTo(WIDTH, 350);
  context.stroke();
  context.fillStyle = '#eef3ff';
  context.font = '600 18px system-ui';
  context.fillText(`Dance phase ${index + 1} · ${phase.toFixed(2)}`, 18, 30);
}

function differenceRatio(left, right) {
  let changed = 0;
  let compared = 0;
  for (let index = 0; index < left.length; index += 4) {
    compared++;
    if (Math.abs(left[index] - right[index]) > 12
      || Math.abs(left[index + 1] - right[index + 1]) > 12
      || Math.abs(left[index + 2] - right[index + 2]) > 12) changed++;
  }
  return compared ? changed / compared : 0;
}

try {
  const plan = buildCharacterRigAssetPlan({
    characterId: 'Foxy',
    appearanceReference: 'A friendly orange fox cartoon with cream muzzle and teal vest'
  });
  if (plan.status !== 'ready_for_generation') throw new Error('Could not build the visual rig fixture.');

  const imageByUrl = new Map();
  const rig = {
    ...plan.rig,
    parts: plan.rig.parts.map(part => {
      const imageUrl = `https://dravex-local.test/rig/${part.id}.png`;
      imageByUrl.set(imageUrl, makePartImage(part.id));
      return { ...part, imageUrl };
    })
  };
  const motion = createCharacterRigMotionPreset(rig, 'dance');
  if (motion.status !== 'ready') throw new Error(`Dance preset failed: ${motion.status}`);

  const framePixels = [];
  const frameReports = [];
  phases.forEach((phase, index) => {
    const row = Math.floor(index / 2);
    const column = index % 2;
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = WIDTH;
    frameCanvas.height = HEIGHT;
    const context = frameCanvas.getContext('2d', { willReadFrequently: true });
    drawBackdrop(context, index, phase);
    const poses = sampleCharacterRigTimeline(motion.timeline, phase);
    const result = drawCharacterLayers(
      context,
      [{ characterId: 'Foxy', imageUrl: 'https://dravex-local.test/whole-character.png' }],
      url => imageByUrl.get(url) || null,
      WIDTH,
      HEIGHT,
      {
        drawRigParts: true,
        preferRigParts: true,
        characterRigs: [rig],
        rigPoses: poses
      }
    );
    if (result.rigDrawn !== rig.parts.length || result.rigSkipped !== 0) {
      throw new Error(`Renderer drew ${result.rigDrawn}/${rig.parts.length} rig parts at phase ${phase}.`);
    }
    const pixels = context.getImageData(0, 0, WIDTH, HEIGHT).data;
    framePixels.push(new Uint8ClampedArray(pixels));
    frameReports.push({ phase, rigDrawn: result.rigDrawn, rigSkipped: result.rigSkipped });
    sheetContext.drawImage(frameCanvas, column * WIDTH, row * HEIGHT, WIDTH, HEIGHT);
  });

  const quadrantHeadPixels = phases.map((phase, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const pixel = sheetContext.getImageData(
      column * WIDTH + Math.round(WIDTH / 2),
      row * HEIGHT + Math.round(HEIGHT * 0.28),
      1,
      1
    ).data;
    if (!(pixel[0] > 100 && pixel[0] > pixel[1])) {
      throw new Error(`Contact-sheet quadrant ${index + 1} is missing its rendered character head.`);
    }
    return { phase, red: pixel[0], green: pixel[1], blue: pixel[2] };
  });

  const motionDifferences = framePixels.slice(1).map((pixels, index) => ({
    from: phases[index],
    to: phases[index + 1],
    changedPixelRatio: Number(differenceRatio(framePixels[index], pixels).toFixed(4))
  }));
  const minMotionDifference = Math.min(...motionDifferences.map(item => item.changedPixelRatio));
  if (!(minMotionDifference > 0.002)) {
    throw new Error(`Dance frames are visually too similar: ${JSON.stringify(motionDifferences)}`);
  }

  window.__rigVisualReport = {
    status: 'ready',
    preset: motion.preset,
    partCount: rig.parts.length,
    frames: frameReports,
    quadrantHeadPixels,
    motionDifferences,
    minMotionDifference
  };
  status.textContent = `READY · ${rig.parts.length} rig parts · ${phases.length} rendered phases · min pixel change ${minMotionDifference}`;
} catch (error) {
  window.__rigVisualReport = { status: 'error', message: error?.message || String(error) };
  status.textContent = `FAILED · ${window.__rigVisualReport.message}`;
  status.style.color = '#ff9b9b';
  throw error;
}
