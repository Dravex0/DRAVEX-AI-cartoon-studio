/**
 * Conservative source-grounded causal links between adjacent storyboard scenes.
 * Only explicit consequence markers are accepted; no implicit causality is guessed.
 */
const MARKERS = {
  ru: /(?<![\p{L}\p{N}])(?:в результате этого|по этой причине|вследствие этого|из-за этого|из за этого|поэтому|в результате)(?![\p{L}\p{N}])/iu,
  uk: /(?<![\p{L}\p{N}])(?:у результаті цього|з цієї причини|унаслідок цього|внаслідок цього|завдяки цьому|через це|тому)(?![\p{L}\p{N}])/iu,
  en: /(?<![\p{L}\p{N}])(?:as a consequence|as a result|due to this|because of this|for this reason|consequently|therefore|thus|hence)(?![\p{L}\p{N}])/iu,
  es: /(?<![\p{L}\p{N}])(?:como consecuencia|como resultado|debido a esto|por esta razón|por lo tanto|en consecuencia|por eso)(?![\p{L}\p{N}])/iu
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
    let causeIndex = index - 1;
    while (causeIndex >= 0 && !clean(list[causeIndex]?.storyDetail, 1_200)) causeIndex -= 1;
    const cause = causeIndex >= 0 ? list[causeIndex] : null;
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
