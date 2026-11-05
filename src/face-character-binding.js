const normalizedId = value => String(value ?? "").trim().toLocaleLowerCase();

function uniqueCharacterIds(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const id = String(value ?? "").trim();
    const key = normalizedId(id);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(id);
  }
  return result;
}

/**
 * Fail-closed gate for associating a single detected face with a character.
 * This is deliberately conservative: only a user-confirmed, single-character
 * scene with exactly one detected face can be considered unambiguous.
 * It does not perform identity recognition or tracking.
 */
export function validateFaceCharacterBinding({
  sceneCharacterIds,
  detectedFaceCount,
  confirmedCharacterId,
  userConfirmed = false
} = {}) {
  const characters = uniqueCharacterIds(sceneCharacterIds);
  const count = Number(detectedFaceCount);
  const confirmedId = String(confirmedCharacterId ?? "").trim();

  if (!Number.isInteger(count) || count < 0) {
    return { allowed: false, status: "invalid-face-count", characterId: null };
  }
  if (count === 0) {
    return { allowed: false, status: "no-face", characterId: null };
  }
  if (count !== 1) {
    return { allowed: false, status: "multiple-faces", characterId: null };
  }
  if (characters.length === 0) {
    return { allowed: false, status: "no-scene-character", characterId: null };
  }
  if (characters.length !== 1) {
    return { allowed: false, status: "multiple-scene-characters", characterId: null };
  }
  if (!confirmedId || normalizedId(confirmedId) !== normalizedId(characters[0])) {
    return { allowed: false, status: "character-not-selected", characterId: null };
  }
  if (userConfirmed !== true) {
    return { allowed: false, status: "user-confirmation-required", characterId: null };
  }
  return {
    allowed: true,
    status: "explicit-single-character-binding",
    characterId: characters[0],
    detectedFaceCount: 1,
    identityTracked: false
  };
}
