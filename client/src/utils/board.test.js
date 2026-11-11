import { describe, expect, it } from 'vitest';
import { applyBoardEvent, dueStatus, groupCardsByColumn, initials } from './board';
import { positionForIndex } from './ordering';

const snapshot = {
  board: { id: 'b1', title: 'Board' },
  labels: [{ id: 'l1', name: 'Bug', color: '#f00' }],
  columns: [
    { id: 'c1', title: 'Todo', position: 1024 },
    { id: 'c2', title: 'Done', position: 2048 },
  ],
  cards: [
    { id: 'k1', columnId: 'c1', position: 2048, labelIds: ['l1'], commentCount: 0 },
    { id: 'k2', columnId: 'c1', position: 1024, labelIds: [], commentCount: 0 },
    { id: 'k3', columnId: 'c2', position: 1024, labelIds: [], commentCount: 0 },
  ],
};

describe('groupCardsByColumn', () => {
  it('groups and sorts cards by position', () => {
    const groups = groupCardsByColumn(snapshot.columns, snapshot.cards);
    expect(groups.c1.map((c) => c.id)).toEqual(['k2', 'k1']);
    expect(groups.c2.map((c) => c.id)).toEqual(['k3']);
  });
});

describe('applyBoardEvent', () => {
  it('moves a card to another column and applies rebalanced positions', () => {
    const next = applyBoardEvent(snapshot, 'card:moved', {
      cardId: 'k1',
      toColumnId: 'c2',
      position: 512,
      rebalanced: [{ id: 'k3', position: 3072 }],
    });
    expect(next.cards.find((c) => c.id === 'k1')).toMatchObject({ columnId: 'c2', position: 512 });
    expect(next.cards.find((c) => c.id === 'k3').position).toBe(3072);
    expect(snapshot.cards.find((c) => c.id === 'k1').columnId).toBe('c1'); // immutable
  });

  it('upserts created cards without duplicating them', () => {
    const card = { id: 'k4', columnId: 'c2', position: 4096, labelIds: [] };
    const once = applyBoardEvent(snapshot, 'card:created', card);
    const twice = applyBoardEvent(once, 'card:created', card);
    expect(twice.cards.filter((c) => c.id === 'k4')).toHaveLength(1);
  });

  it('removes a column together with its cards', () => {
    const next = applyBoardEvent(snapshot, 'column:deleted', { id: 'c1' });
    expect(next.columns.map((c) => c.id)).toEqual(['c2']);
    expect(next.cards.map((c) => c.id)).toEqual(['k3']);
  });

  it('strips deleted labels from cards', () => {
    const next = applyBoardEvent(snapshot, 'label:deleted', { id: 'l1' });
    expect(next.labels).toHaveLength(0);
    expect(next.cards.find((c) => c.id === 'k1').labelIds).toEqual([]);
  });

  it('increments the comment counter', () => {
    const next = applyBoardEvent(snapshot, 'comment:created', { id: 'x', cardId: 'k2' });
    expect(next.cards.find((c) => c.id === 'k2').commentCount).toBe(1);
  });

  it('ignores unknown events', () => {
    expect(applyBoardEvent(snapshot, 'nope', {})).toBe(snapshot);
  });
});

describe('helpers', () => {
  it('computes fractional positions like the server', () => {
    const siblings = [{ position: 1024 }, { position: 2048 }];
    expect(positionForIndex(siblings, 0)).toBe(512);
    expect(positionForIndex(siblings, 1)).toBe(1536);
    expect(positionForIndex(siblings, 2)).toBe(3072);
  });

  it('classifies due dates', () => {
    const today = new Date(2026, 10, 11);
    expect(dueStatus('2026-11-10', today)).toBe('overdue');
    expect(dueStatus('2026-11-12', today)).toBe('soon');
    expect(dueStatus('2026-12-01', today)).toBe('later');
    expect(dueStatus(null, today)).toBeNull();
  });

  it('builds initials', () => {
    expect(initials('Matías Acosta')).toBe('MA');
    expect(initials('ana')).toBe('A');
  });
});
