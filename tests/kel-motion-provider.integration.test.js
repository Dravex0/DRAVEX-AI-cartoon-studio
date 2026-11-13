import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProductionScene } from '../src/scene-production.js';
import { createHuggingFaceZeroGPUVideoProvider } from '../src/huggingface-zerogpu-video-provider.js';

test('carries Kel body movement and the mechanical-bird interaction into the Wan 2.2 request', async () => {
  let submittedArguments = null;
  const submission = {
    async *[Symbol.asyncIterator]() {
      yield { type: 'data', data: [{ url: 'https://files.example.test/kel-action.mp4' }] };
    }
  };
  const provider = createHuggingFaceZeroGPUVideoProvider({
    client: {
      submit: (endpoint, args) => {
        assert.equal(endpoint, '/generate_video');
        submittedArguments = args;
        return submission;
      }
    },
    handleFile: blob => ({ fileBlob: blob }),
    fetchImpl: async () => ({
      ok: true,
      blob: async () => new Blob(['video'], { type: 'video/mp4' })
    })
  });

  const scene = buildProductionScene({
    id: 'kel-frees-bird',
    title: 'Kel frees the mechanical bird',
    imagePrompt: 'Kel kneels beside a fallen branch; a small mechanical bird is trapped underneath.',
    motionPrompt: 'Kel steps closer, kneels, reaches under the fallen branch, grips it with both hands, lifts it, and frees the mechanical bird. The bird unfolds its wings and flutters into the air.',
    characters: ['Kel'],
    camera: 'Medium action shot; keep Kel and the bird visible.',
    startState: 'Kel is standing beside the branch; the mechanical bird is trapped beneath it.',
    endState: 'Kel holds the raised branch; the mechanical bird is free and flutters upward.',
    continuityLock: 'Kel keeps the same face, green jacket and brown satchel. The bird remains the same small brass mechanical bird.'
  }, [{
    characterId: 'Kel',
    visualDescription: 'Young forest explorer with short dark hair',
    clothing: 'Green jacket and brown satchel',
    colors: 'Green, brown and brass',
    distinctiveFeatures: 'Round amber eyes'
  }]);

  const result = await provider.generate({
    taskType: 'image-to-video',
    prompt: scene.motionGenerationPrompt,
    negativePrompt: scene.negativePrompt,
    durationSeconds: 5,
    fps: 16,
    seed: 246813579,
    image: new Blob(['kel-scene-still'], { type: 'image/png' })
  });

  assert.equal(result.status, 'completed');
  assert.ok(submittedArguments);
  const wanPrompt = submittedArguments[1];
  assert.match(wanPrompt, /Kel steps closer, kneels, reaches under the fallen branch/i);
  assert.match(wanPrompt, /Character action is the primary motion/i);
  assert.match(wanPrompt, /camera pan, zoom, shake, or background movement is not a substitute/i);
  assert.match(wanPrompt, /visible contact, applying force, and completing the requested result/i);
  assert.match(wanPrompt, /Young forest explorer/);
  assert.match(wanPrompt, /Start state/);
  assert.match(wanPrompt, /End state/);
});
