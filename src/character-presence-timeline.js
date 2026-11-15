import { createCharacterPresenceTracker } from "./character-presence-tracker.js";

const clean = value => String(value ?? "").trim().slice(0, 120);
const list = value => Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
const unique = values => [...new Set(values)];

function presenceEvents(scene) {
  return Array.isArray(scene?.presenceEvents) ? scene.presenceEvents.filter(event => event && typeof event === "object") : [];
}
function explicitExits(scene) {
  const direct = list(scene?.exitedCharacterIds);
  const eventExits = presenceEvents(scene)
    .filter(event => ["exit", "exited", "leave", "left"].includes(String(event.type ?? event.action ?? "").toLowerCase()))
    .map(event => clean(event.characterId ?? event.character ?? event.actorId))
    .filter(Boolean);
  return unique([...direct, ...eventExits]);
}
function explicitEntries(scene) {
  const direct = list(scene?.enteredCharacterIds);
  const eventEntries = presenceEvents(scene)
    .filter(event => ["enter", "entered", "arrive", "arrived", "reenter", "re-enter", "return"].includes(String(event.type ?? event.action ?? "").toLowerCase()))
    .map(event => clean(event.characterId ?? event.character ?? event.actorId))
    .filter(Boolean);
  return unique([...direct, ...eventEntries]);
}

/**
 * Build a conservative presence timeline from storyboard metadata.
 * A character omitted from a shot becomes offscreen, never exited.
 * Exits and re-entries are accepted only from explicit structured narrative events.
 * The scene cast is the planned visible cast, not computer-vision proof.
 */
export function buildCharacterPresenceTimeline(scenes = []) {
  const source = Array.isArray(scenes) ? scenes : [];
  const castByScene = source.map(scene => list(scene?.characters));
  const exitsByScene = source.map(explicitExits);
  const entriesByScene = source.map(explicitEntries);
  const allIds = unique([
    ...castByScene.flat(),
    ...exitsByScene.flat(),
    ...entriesByScene.flat()
  ]);
  const tracker = createCharacterPresenceTracker(allIds);
  let previousCamera = "";
  return source.map((scene, index) => {
    const camera = clean(scene?.camera ?? scene?.shotType);
    const cameraCut = Boolean(camera && previousCamera && camera !== previousCamera);
    const result = tracker.update({
      sceneId: clean(scene?.id) || `scene_${index + 1}`,
      visibleCharacterIds: castByScene[index],
      cameraCut,
      exitedCharacterIds: exitsByScene[index],
      enteredCharacterIds: entriesByScene[index]
    });
    if (camera) previousCamera = camera;
    return {
      sceneId: result.sceneId,
      cameraCut,
      characters: result.characters,
      changes: result.changes,
      evidence: "storyboard-cast-and-explicit-presence-events"
    };
  });
}
