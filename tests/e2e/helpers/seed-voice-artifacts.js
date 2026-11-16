/**
 * Seed deterministic, non-silent local WAV fixtures for one-click film E2E tests.
 * This bypasses model download/latency while exercising the real IndexedDB,
 * voice timeline, speech-readiness gate, and WebM export path.
 */
export async function seedVoiceArtifactsForCurrentDraft(page, { language = 'en' } = {}) {
  await page.locator('#make').click();
  await page.locator('#save').click();
  const evidence = await page.evaluate(async ({ language }) => {
    const draftKey = 'dravex-cartoon-draft';
    const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
    if (!draft || !Array.isArray(draft.sceneMetadata) || draft.sceneMetadata.length === 0) {
      throw new Error('The storyboard draft was not saved before voice fixture setup.');
    }
    const [{ createVoiceAudioStorage }, { buildSceneVoiceTimeline }] = await Promise.all([
      import('./src/voice-audio-storage.js'),
      import('./src/scene-voice-workflow.js')
    ]);
    const storage = createVoiceAudioStorage();
    const speakerNames = [...new Set(draft.sceneMetadata.flatMap(scene =>
      Array.isArray(scene.characters) ? scene.characters.filter(value => typeof value === 'string' && value.trim()) : []
    ))].sort();
    const voiceBySpeaker = new Map(speakerNames.map((speaker, index) => [speaker, {
      voiceId: 'e2e-synthetic-' + (index + 1),
      frequency: 220 + index * 65
    }]));
    let generatedArtifacts = 0;
    const encodeWav = (frequency, durationMs = 650, sampleRate = 16000) => {
      const sampleCount = Math.round(sampleRate * durationMs / 1000);
      const bytes = new ArrayBuffer(44 + sampleCount * 2);
      const view = new DataView(bytes);
      const write = (offset, value) => {
        for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
      };
      write(0, 'RIFF');
      view.setUint32(4, 36 + sampleCount * 2, true);
      write(8, 'WAVE');
      write(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      write(36, 'data');
      view.setUint32(40, sampleCount * 2, true);
      for (let i = 0; i < sampleCount; i++) {
        const fade = Math.min(1, i / 240, (sampleCount - i) / 240);
        const sample = Math.round(Math.sin(2 * Math.PI * frequency * i / sampleRate) * 8500 * Math.max(0, fade));
        view.setInt16(44 + i * 2, sample, true);
      }
      return new Blob([bytes], { type: 'audio/wav' });
    };
    for (let sceneIndex = 0; sceneIndex < draft.sceneMetadata.length; sceneIndex++) {
      const scene = draft.sceneMetadata[sceneIndex];
      const speakers = [...new Set(Array.isArray(scene.characters)
        ? scene.characters.filter(value => typeof value === 'string' && value.trim())
        : [])];
      if (!speakers.length) continue;
      const dialogue = speakers.map(characterId => ({
        characterId,
        text: characterId + ' speaks in scene ' + (sceneIndex + 1) + '.',
        language
      }));
      const artifacts = [];
      for (const line of dialogue) {
        const voice = voiceBySpeaker.get(line.characterId);
        const blob = encodeWav(voice.frequency);
        const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
        const audioHash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
        const durationMs = 650;
        await storage.put(audioHash, blob, {
          filename: 'e2e-' + voice.voiceId + '.wav',
          mimeType: 'audio/wav',
          engineUsed: 'e2e-synthetic-local-fixture',
          durationMs,
          sampleRate: 16000
        });
        artifacts.push({ audioHash, durationMs, voiceId: voice.voiceId });
        generatedArtifacts++;
      }
      const scheduled = buildSceneVoiceTimeline({
        sceneId: scene.id,
        dialogue,
        artifacts,
        fps: 24,
        gapMs: 0
      });
      scene.dialogue = dialogue;
      scene.voiceCues = scheduled.cues;
      scene.voiceTimeline = scheduled.timeline;
    }
    draft.language = language;
    draft.sceneMetadata = draft.sceneMetadata;
    localStorage.setItem(draftKey, JSON.stringify(draft));
    if (generatedArtifacts === 0) {
      throw new Error('No character speakers were found in the storyboard; voice fixtures cannot be seeded.');
    }
    return { scenes: draft.sceneMetadata.length, speakers: speakerNames.length, generatedArtifacts };
  }, { language });
  await page.reload();
  return evidence;
}
