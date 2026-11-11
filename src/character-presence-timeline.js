import { createCharacterPresenceTracker } from "./character-presence-tracker.js";

const clean = value => String(value ?? "").trim().slice(0, 120);
const list = value => Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
const unique = values => [...new Set(values)];

function explicitExits(scene) {
  const direct = list(scene?.exitedCharacterIds);
  const events = Array.isArray(scene?.presenceEvents) ? scene.presenceEvents : [];
  const eventExits = events
    .filter(event => event && typeof event === "object" && ["exit", "exited", "leave", "left"].includes(String(event.type ?? event.action ?? "").toLowerCase()))
    .map(event => clean(event.characterId ?? event.character ?? event.actorId))
    .filter(Boolean);
  return unique([...direct, ...eventExits]);
}

/**
 * Build a conservative presence timeline from storyboard metadata.
 * A character omitted from a shot becomes offscreen, never exited.
 * Exits are accepted only from explicit structured narrative events.
 * The scene cast is treated as the planned visible cast, not computer-vision proof.
 */
export function buildCharacterPresenceTimeline(scenes = []) {
  const source = Array.isArray(scenes) ? scenes : [];
  const castByScene = source.map(scene => list(scene?.characters));
  const allIds = unique([
    ...castByScene.flat(),
    ...source.flatMap(explicitExits)
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
      exitedCharacterIds: explicitExits(scene)
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
