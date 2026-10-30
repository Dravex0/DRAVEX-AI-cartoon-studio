/**
 * Conservative source-grounded causal links between adjacent storyboard scenes.
 * Only explicit consequence markers are accepted; no implicit causality is guessed.
 */
const MARKERS = {
  ru: /\\b(?:поэтому|в результате|вследствие этого|из-за этого|из за этого)\\b/iu,
  uk: /\\b(?:тому|через це|унаслідок цього|внаслідок цього|завдяки цьому)\\b/iu,
  en: /\\b(?:as a result|therefore|consequently|because of this|for this reason)\\b/iu,
  es: /\\b(?:como resultado|por eso|por lo tanto|en consecuencia)\\b/iu
};

const clean = (value, max = 2_000) => String(value ?? '').trim().slice(0, max);

/**
 * Returns one optional locked causal link per scene. A link on scene N may only
 * point to scene N-1, and both source details are retained as evidence.
 */
export function inferSceneCausalLinks(scenes = [], language = 'en') {
  const locale = Object.hasOwn(MARKERS, language) ? language : 'en';
  const list = Array.isArray(scenes) ? scenes : [];
  return list.map((scene, index) => {
    if (index === 0) return null;
    const cause = list[index - 1];
    const causeEvidence = clean(cause?.storyDetail, 1_200);
    const evidence = clean(scene?.storyDetail, 1_200);
    if (!causeEvidence || !evidence) return null;
    const match = MARKERS[locale].exec(evidence);
    if (!match) return null;
    return {
      type: 'consequence',
      causeSceneId: clean(cause.id, 120) || `scene_${index}`,
      effectSceneId: clean(scene.id, 120) || `scene_${index + 1}`,
      marker: match[0],
      causeEvidence,
      evidence
    };
  });
}
