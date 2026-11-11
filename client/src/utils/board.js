const byPosition = (a, b) => a.position - b.position;

/** Groups cards by column id, each list sorted by position. */
export function groupCardsByColumn(columns, cards) {
  const groups = Object.fromEntries(columns.map((c) => [c.id, []]));
  for (const card of cards) groups[card.columnId]?.push(card);
  for (const list of Object.values(groups)) list.sort(byPosition);
  return groups;
}

const applyRebalance = (items, rebalanced) => {
  if (!rebalanced) return items;
  const positions = new Map(rebalanced.map((r) => [r.id, r.position]));
  return items.map((it) => (positions.has(it.id) ? { ...it, position: positions.get(it.id) } : it));
};

const upsert = (items, item) =>
  items.some((i) => i.id === item.id)
    ? items.map((i) => (i.id === item.id ? { ...i, ...item } : i))
    : [...items, item];

/**
 * Pure reducer that applies a realtime event to the board snapshot cached by
 * React Query. Returning a new object keeps React re-renders predictable.
 */
export function applyBoardEvent(snapshot, event, payload) {
  if (!snapshot) return snapshot;
  switch (event) {
    case 'board:updated':
      return { ...snapshot, board: { ...snapshot.board, ...payload } };
    case 'column:created':
    case 'column:updated':
      return { ...snapshot, columns: upsert(snapshot.columns, payload).sort(byPosition) };
    case 'column:moved':
      return {
        ...snapshot,
        columns: applyRebalance(upsert(snapshot.columns, payload.column), payload.rebalanced).sort(
          byPosition,
        ),
      };
    case 'column:deleted':
      return {
        ...snapshot,
        columns: snapshot.columns.filter((c) => c.id !== payload.id),
        cards: snapshot.cards.filter((c) => c.columnId !== payload.id),
      };
    case 'card:created':
    case 'card:updated':
      return { ...snapshot, cards: upsert(snapshot.cards, payload) };
    case 'card:moved': {
      const cards = snapshot.cards.map((c) =>
        c.id === payload.cardId
          ? { ...c, columnId: payload.toColumnId, position: payload.position }
          : c,
      );
      return { ...snapshot, cards: applyRebalance(cards, payload.rebalanced) };
    }
    case 'card:deleted':
      return { ...snapshot, cards: snapshot.cards.filter((c) => c.id !== payload.id) };
    case 'comment:created':
    case 'comment:deleted': {
      const delta = event === 'comment:created' ? 1 : -1;
      return {
        ...snapshot,
        cards: snapshot.cards.map((c) =>
          c.id === payload.cardId
            ? { ...c, commentCount: Math.max(0, (c.commentCount ?? 0) + delta) }
            : c,
        ),
      };
    }
    case 'label:created':
      return { ...snapshot, labels: upsert(snapshot.labels, payload) };
    case 'label:deleted':
      return {
        ...snapshot,
        labels: snapshot.labels.filter((l) => l.id !== payload.id),
        cards: snapshot.cards.map((c) => ({
          ...c,
          labelIds: c.labelIds.filter((id) => id !== payload.id),
        })),
      };
    default:
      return snapshot;
  }
}

/** 'overdue' | 'soon' (next 2 days) | 'later' | null */
export function dueStatus(dueDate, today = new Date()) {
  if (!dueDate) return null;
  const [y, m, d] = dueDate.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((due - start) / 86_400_000);
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 2) return 'soon';
  return 'later';
}

export function formatDueDate(dueDate) {
  if (!dueDate) return '';
  const [y, m, d] = dueDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

const ACTIVITY_TEXT = {
  'board.created': (m) => `creó el tablero «${m.title}»`,
  'board.updated': () => 'actualizó el tablero',
  'column.created': (m) => `agregó la columna «${m.title}»`,
  'column.renamed': (m) => `renombró «${m.from}» a «${m.to}»`,
  'column.deleted': (m) => `eliminó la columna «${m.title}»`,
  'card.created': (m) => `creó «${m.title}» en ${m.column}`,
  'card.updated': (m) => `editó «${m.title}»`,
  'card.moved': (m) => `movió «${m.title}» de ${m.from} a ${m.to}`,
  'card.deleted': (m) => `eliminó «${m.title}»`,
  'comment.added': (m) => `comentó en «${m.title}»`,
};

export function describeActivity(activity) {
  const fn = ACTIVITY_TEXT[activity.action];
  return fn ? fn(activity.meta ?? {}) : activity.action;
}

export function timeAgo(date, now = Date.now()) {
  const seconds = Math.round((now - new Date(date).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  if (seconds < 60) return 'recién';
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), 'minute');
  if (seconds < 86_400) return rtf.format(-Math.floor(seconds / 3600), 'hour');
  return rtf.format(-Math.floor(seconds / 86_400), 'day');
}
