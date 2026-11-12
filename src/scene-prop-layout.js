/**
 * Deterministic, source-grounded scene prop layout for the local storyboard path.
 * Coordinates are only assigned to props already present in locked state records.
 */
const normalize = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase()
  .trim();

function propKind(entityId) {
  const value = normalize(entityId);
  if (/bird|птиц|пташ|pajaro|ave/.test(value)) return 'bird';
  if (/branch|ветк|гілк|rama/.test(value)) return 'branch';
  if (/star|звезд|зирк|estrella/.test(value)) return 'star';
  if (/key|ключ|llave/.test(value)) return 'key';
  if (/book|книг|книж|libro/.test(value)) return 'book';
  if (/ball|мяч|куля|pelota/.test(value)) return 'ball';
  if (/apple|яблок|яблук|manzana/.test(value)) return 'apple';
  return 'generic';
}

function collectLockedProps(scene) {
  const records = [
    ...(Array.isArray(scene?.stateChanges) ? scene.stateChanges : []),
    ...(Array.isArray(scene?.propStates) ? scene.propStates : [])
  ];
  const result = new Map();
  for (const record of records) {
    if (!record || record.entityType !== 'prop') continue;
    const entityId = String(record.entityId ?? '').trim().slice(0, 120);
    const property = String(record.property ?? '').trim();
    if (!entityId || !['holder', 'state'].includes(property)) continue;
    result.set(normalize(entityId), entityId);
  }
  return [...result.values()].slice(0, 12);
}

/**
 * Produces stable local-canvas coordinates for known story props when no
 * director-authored coordinates exist. It never creates a new prop ID.
 */
export function buildDeterministicScenePropAnchors(scene = {}) {
  if (scene?.propAnchors && typeof scene.propAnchors === 'object' && !Array.isArray(scene.propAnchors)) {
    const supplied = Object.entries(scene.propAnchors).filter(([id, point]) =>
      collectLockedProps(scene).some(locked => normalize(locked) === normalize(id))
      && point && Number.isFinite(point.x) && Number.isFinite(point.y)
      && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1
    );
    if (supplied.length) return Object.fromEntries(supplied.map(([id, point]) => [id, { x: point.x, y: point.y }]));
  }

  const props = collectLockedProps(scene);
  if (!props.length) return {};
  const kinds = new Map(props.map(id => [normalize(id), propKind(id)]));
  const hasBird = props.some(id => kinds.get(normalize(id)) === 'bird');
  const hasBranch = props.some(id => kinds.get(normalize(id)) === 'branch');
  const anchors = {};

  for (const [index, entityId] of props.entries()) {
    const kind = kinds.get(normalize(entityId));
    let point;
    if (hasBird && hasBranch && kind === 'bird') {
      point = { x: 0.54, y: 0.755 };
    } else if (hasBird && hasBranch && kind === 'branch') {
      point = { x: 0.54, y: 0.715 };
    } else {
      const column = index % 4;
      const row = Math.floor(index / 4);
      const base = kind === 'bird' ? { x: 0.56, y: 0.755 }
        : kind === 'branch' ? { x: 0.60, y: 0.72 }
        : { x: 0.64, y: 0.78 };
      point = {
        x: Math.max(0.28, Math.min(0.82, base.x + (column - 1.5) * 0.055)),
        y: Math.max(0.62, Math.min(0.86, base.y + row * 0.045))
      };
    }
    anchors[entityId] = point;
  }
  return anchors;
}
