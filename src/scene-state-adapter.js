/**
 * Converts conservative lexical state evidence to the strict structured scene contract.
 * "holder" is kept distinct from "owner": possession is not proof of ownership.
 */
export function toStructuredStateChanges(changes = []) {
  if (!Array.isArray(changes)) return [];
  return changes.flatMap(change => {
    if (!change || typeof change !== 'object') return [];
    const entity = typeof change.entityId === 'string' ? change.entityId.trim() : '';
    const actorId = typeof change.actorId === 'string' ? change.actorId.trim() : '';
    const evidence = typeof change.evidence === 'string' ? change.evidence.trim() : '';
    const property = change.property === 'holder' ? 'holder'
      : change.property === 'openState' ? 'state'
      : change.property === 'location' && change.entityType === 'character' ? 'location'
      : null;
    if (!entity || !property || (change.value !== null && typeof change.value !== 'string')) return [];
    return [{
      entity,
      property,
      previousValue: change.previousValue == null ? null : String(change.previousValue),
      value: change.value,
      actorId: actorId || null,
      evidence: evidence || null
    }];
  });
}
