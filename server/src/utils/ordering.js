/**
 * Fractional indexing helpers.
 *
 * Every column / card has a numeric `position`. To move an item we only need
 * to compute a number between its new neighbours, so a move is a single-row
 * UPDATE instead of re-numbering the whole list. When two neighbours get too
 * close (after many inserts in the same gap) the list is rebalanced.
 */
export const POSITION_STEP = 1024;
export const MIN_GAP = 1e-6;

/**
 * Computes the position for an item inserted at `index` of `siblings`
 * (siblings must be sorted by position ASC and must NOT include the moved item).
 *
 * @param {{ position: number }[]} siblings
 * @param {number} index Target index (clamped to [0, siblings.length])
 * @returns {{ position: number, needsRebalance: boolean }}
 */
export function positionForIndex(siblings, index) {
  const i = Math.max(0, Math.min(index, siblings.length));
  const before = siblings[i - 1]?.position;
  const after = siblings[i]?.position;

  if (before === undefined && after === undefined) {
    return { position: POSITION_STEP, needsRebalance: false };
  }
  if (before === undefined) {
    return { position: after / 2, needsRebalance: after / 2 < MIN_GAP };
  }
  if (after === undefined) {
    return { position: before + POSITION_STEP, needsRebalance: false };
  }

  const position = (before + after) / 2;
  return { position, needsRebalance: after - before < MIN_GAP * 2 };
}

/**
 * Returns evenly spaced positions for `count` items.
 * @param {number} count
 */
export function evenlySpaced(count) {
  return Array.from({ length: count }, (_, i) => (i + 1) * POSITION_STEP);
}

/**
 * Places `itemId` at `index` inside the rows of `table` matching `scope`
 * (e.g. all cards of one column). Must run inside a transaction that already
 * holds a lock on the parent board so concurrent moves are serialized.
 *
 * @returns {Promise<{ position: number, rebalanced: { id: string, position: number }[] | null }>}
 */
export async function placeItem(trx, table, scope, itemId, index) {
  const siblings = await trx(table)
    .where(scope)
    .whereNot({ id: itemId })
    .orderBy('position', 'asc')
    .select('id', 'position');

  const { position, needsRebalance } = positionForIndex(siblings, index);
  if (!needsRebalance) return { position, rebalanced: null };

  const ordered = [...siblings];
  ordered.splice(Math.max(0, Math.min(index, siblings.length)), 0, { id: itemId });
  const positions = evenlySpaced(ordered.length);
  const rebalanced = ordered.map((row, i) => ({ id: row.id, position: positions[i] }));

  for (const row of rebalanced) {
    if (row.id !== itemId) {
      await trx(table).where({ id: row.id }).update({ position: row.position });
    }
  }
  return { position: rebalanced.find((r) => r.id === itemId).position, rebalanced };
}
