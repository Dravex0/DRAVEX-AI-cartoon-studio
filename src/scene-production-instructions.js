/**
 * Convert one validated production work order into concise provider instructions.
 * This passes grounded scene facts to video providers; it does not claim they
 * can guarantee every action or that any requested pass has been rendered.
 */
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const records = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object' && !Array.isArray(item)) : [];
const compact = (value, max = 900) => {
  try { return JSON.stringify(value).slice(0, max); }
  catch { return ''; }
};

export function buildSceneProductionInstructions(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return '';
  const lines = [
    'GROUNDED SCENE PRODUCTION WORK ORDER',
    'Treat the following as the authoritative scene specification. Do not invent entities, props, actions, dialogue, causal events, or state changes.',
    clean(plan.dramaticPurpose, 500) && 'Dramatic purpose: ' + clean(plan.dramaticPurpose, 500),
    clean(plan.setting?.location, 300) && 'Location: ' + clean(plan.setting.location, 300),
    clean(plan.setting?.environment, 600) && 'Environment: ' + clean(plan.setting.environment, 600),
    clean(plan.setting?.lighting, 300) && 'Lighting: ' + clean(plan.setting.lighting, 300),
    clean(plan.setting?.timeOfDay, 120) && 'Time of day: ' + clean(plan.setting.timeOfDay, 120),
    records(plan.characterProfiles).length && 'Canonical character appearance profiles (preserve these exact identities across every shot and scene): ' + records(plan.characterProfiles).slice(0, 12).map(item => compact(item, 700)).join('; '),
    records(plan.worldEntities).length && 'World entities (preserve identity and kind): ' + records(plan.worldEntities).slice(0, 16).map(item => compact({id:item.id,kind:item.kind,attributes:item.attributes}, 450)).join('; '),
    records(plan.worldRelations).length && 'Entity relationships (preserve direction and participants): ' + records(plan.worldRelations).slice(0, 16).map(item => compact(item, 500)).join('; '),
    records(plan.actionBeats).length && 'Timed action beats: ' + records(plan.actionBeats).slice(0, 16).map(item => compact({phase:item.phase,start:item.start,end:item.end,actorId:item.actorId,targetId:item.targetId,description:item.description,evidence:item.evidence}, 650)).join('; '),
    records(plan.worldActions).length && 'World actions: ' + records(plan.worldActions).slice(0, 16).map(item => compact(item, 650)).join('; '),
    records(plan.propActions).length && 'Prop state transitions (show the transition and resulting state): ' + records(plan.propActions).slice(0, 16).map(item => compact(item, 500)).join('; '),
    records(plan.physicalBeats).length && 'Grounded physical beats: ' + records(plan.physicalBeats).slice(0, 12).map(item => compact(item, 650)).join('; '),
    records(plan.causalBeats).length && 'Grounded causal beats: ' + records(plan.causalBeats).slice(0, 12).map(item => compact(item, 650)).join('; '),
    records(plan.shots).length && 'Shot coverage and timing: ' + records(plan.shots).slice(0, 12).map(item => compact(item, 500)).join('; '),
    records(plan.dialogue).length && 'Dialogue (preserve exact words and speaker assignment; do not fabricate speech): ' + records(plan.dialogue).slice(0, 16).map(item => compact(item, 400)).join('; '),
    records(plan.audioCues).length && 'Audio cues: ' + records(plan.audioCues).slice(0, 16).map(item => compact(item, 350)).join('; '),
    clean(plan.continuity?.startState, 700) && 'Continuity start state: ' + clean(plan.continuity.startState, 700),
    clean(plan.continuity?.endState, 700) && 'Continuity end state: ' + clean(plan.continuity.endState, 700),
    records(plan.continuity?.stateChanges).length && 'Continuity state changes: ' + records(plan.continuity.stateChanges).slice(0, 16).map(item => compact(item, 400)).join('; '),
    plan.filmMemoryContext?.previousScene && 'Previous scene ending (continuity reference only; do not replay it): ' + compact(plan.filmMemoryContext.previousScene, 1800),
    plan.filmMemoryContext?.currentScene && 'Unified current-scene memory (preserve entity identities, starting state, ordered actions, object handoffs and explicit causal links): ' + compact(plan.filmMemoryContext.currentScene, 2600),
    records(plan.filmMemoryContext?.continuityIssues).length && 'Film-memory continuity warnings: ' + records(plan.filmMemoryContext.continuityIssues).slice(0, 10).map(item => compact(item, 350)).join('; '),
    records(plan.continuityIssues).length && 'Continuity QA warnings to reconcile without inventing events: ' + records(plan.continuityIssues).slice(0, 12).map(item => compact(item, 450)).join('; '),
    Array.isArray(plan.requiredPasses) && plan.requiredPasses.length && 'Requested production passes: ' + plan.requiredPasses.map(value => clean(value, 80)).filter(Boolean).join(', '),
    'Execution constraints: keep each entity identity and appearance consistent with its supplied attributes; keep all listed characters and entities visually distinct; show cause before effect; maintain object ownership and contact through handoffs; preserve physical direction and scene continuity; make each timed beat visibly legible; do not replace character action with camera movement or a static background. Treat the previous-scene ending as continuity evidence, not as an instruction to replay it.',
    records(plan.continuityIssues).length && 'When continuity QA warnings are supplied, reconcile the depicted transition only when supported by the story; never invent a journey, handoff, disappearance, costume change, or state change merely to hide a warning.',
    'This is a provider instruction, not proof that the provider supports or has completed every requested pass.'
  ].filter(Boolean);
  return lines.join('\n');
}
