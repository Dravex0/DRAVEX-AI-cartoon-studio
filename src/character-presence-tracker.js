const VALID_STATES = new Set(["visible", "offscreen", "exited"]);
const cleanId = value => String(value ?? "").trim().slice(0, 120);

/** Tracks narrative presence separately from camera visibility. Not computer vision. */
export function createCharacterPresenceTracker(characterIds = []) {
  const characters = new Map();
  for (const rawId of Array.isArray(characterIds) ? characterIds : []) {
    const id = cleanId(rawId);
    if (id && !characters.has(id)) characters.set(id, { characterId: id, status: "offscreen", lastSeenSceneId: null, lastTransition: "initialized" });
  }
  function ensure(id) {
    if (!characters.has(id)) characters.set(id, { characterId: id, status: "offscreen", lastSeenSceneId: null, lastTransition: "introduced" });
    return characters.get(id);
  }
  function update({ sceneId = "", visibleCharacterIds = [], cameraCut = false, exitedCharacterIds = [], enteredCharacterIds = [] } = {}) {
    const currentSceneId = cleanId(sceneId);
    const visible = new Set((Array.isArray(visibleCharacterIds) ? visibleCharacterIds : []).map(cleanId).filter(Boolean));
    const exited = new Set((Array.isArray(exitedCharacterIds) ? exitedCharacterIds : []).map(cleanId).filter(Boolean));
    const entered = new Set((Array.isArray(enteredCharacterIds) ? enteredCharacterIds : []).map(cleanId).filter(Boolean));
    const changes = [];
    for (const id of new Set([...visible, ...exited, ...entered])) ensure(id);
    for (const [id, record] of characters) {
      const before = record.status;
      if (exited.has(id)) { record.status = "exited"; record.lastTransition = "explicit-story-exit"; }
      else if (visible.has(id)) {
        record.status = "visible"; record.lastSeenSceneId = currentSceneId || record.lastSeenSceneId;
        record.lastTransition = "observed-in-frame";
      } else if (entered.has(id)) { record.status = "offscreen"; record.lastTransition = "entered-scene-offscreen"; }
      else if (before !== "exited" && (cameraCut || before === "visible")) {
        record.status = "offscreen"; record.lastTransition = cameraCut ? "camera-cut" : "not-in-current-frame";
      }
      if (before !== record.status) changes.push({ characterId: id, from: before, to: record.status, reason: record.lastTransition });
    }
    return { sceneId: currentSceneId, characters: snapshot(), changes };
  }
  function snapshot() {
    return [...characters.values()].map(record => ({ ...record, status: VALID_STATES.has(record.status) ? record.status : "offscreen" }));
  }
  return Object.freeze({ update, snapshot });
}
export { VALID_STATES as CHARACTER_PRESENCE_STATES };
