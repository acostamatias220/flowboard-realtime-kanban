// Mirrors server/src/utils/ordering.js so optimistic updates use the same
// positions the server will compute.
export const POSITION_STEP = 1024;

export function positionForIndex(siblings, index) {
  const i = Math.max(0, Math.min(index, siblings.length));
  const before = siblings[i - 1]?.position;
  const after = siblings[i]?.position;
  if (before === undefined && after === undefined) return POSITION_STEP;
  if (before === undefined) return after / 2;
  if (after === undefined) return before + POSITION_STEP;
  return (before + after) / 2;
}
