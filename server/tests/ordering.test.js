import { describe, expect, it } from 'vitest';
import { MIN_GAP, POSITION_STEP, evenlySpaced, positionForIndex } from '../src/utils/ordering.js';

const list = (...positions) => positions.map((position) => ({ position }));

describe('positionForIndex', () => {
  it('uses the default step for an empty list', () => {
    expect(positionForIndex([], 0)).toEqual({ position: POSITION_STEP, needsRebalance: false });
  });

  it('places items at the start, middle and end', () => {
    const siblings = list(1024, 2048, 3072);
    expect(positionForIndex(siblings, 0).position).toBe(512);
    expect(positionForIndex(siblings, 1).position).toBe(1536);
    expect(positionForIndex(siblings, 3).position).toBe(3072 + POSITION_STEP);
  });

  it('clamps out of range indexes', () => {
    const siblings = list(1024, 2048);
    expect(positionForIndex(siblings, -5).position).toBe(512);
    expect(positionForIndex(siblings, 99).position).toBe(2048 + POSITION_STEP);
  });

  it('asks for a rebalance when the gap is too small', () => {
    const siblings = list(1, 1 + MIN_GAP);
    expect(positionForIndex(siblings, 1).needsRebalance).toBe(true);
  });

  it('evenlySpaced returns increasing positions', () => {
    expect(evenlySpaced(3)).toEqual([1024, 2048, 3072]);
  });
});
