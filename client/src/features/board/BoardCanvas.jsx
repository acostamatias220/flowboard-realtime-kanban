import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { groupCardsByColumn } from '../../utils/board';
import { positionForIndex } from '../../utils/ordering';
import { BoardColumn } from './BoardColumn';
import { CardItem } from './CardItem';
import { InlineForm } from './InlineForm';

/**
 * Drag & drop surface. While a card is dragged we keep a local copy of
 * "column -> card ids" so it can jump between columns smoothly (onDragOver).
 * On drop we compute the final index, derive an optimistic fractional
 * position and send a single move request to the API.
 */
export function BoardCanvas({ snapshot, mutations, membersById, viewersByCard, onOpenCard }) {
  const { columns, cards, labels, role } = snapshot;
  const [dragGroups, setDragGroups] = useState(null);
  const [active, setActive] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const groups = useMemo(() => groupCardsByColumn(columns, cards), [columns, cards]);
  const idGroups = useMemo(
    () =>
      dragGroups ??
      Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.map((c) => c.id)])),
    [dragGroups, groups],
  );

  const findContainer = (id, source = idGroups) => {
    if (id in source) return id;
    return Object.keys(source).find((colId) => source[colId].includes(id));
  };

  // Columns only collide with columns; cards use corners for better multi-list behaviour.
  const collisionDetection = (args) => {
    if (args.active.data.current?.type === 'column') {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter(
          (c) => c.data.current?.type === 'column',
        ),
      });
    }
    return closestCorners(args);
  };

  const onDragStart = ({ active: a }) => {
    setActive(a.data.current);
    if (a.data.current?.type === 'card') setDragGroups(idGroups);
  };

  const onDragOver = ({ active: a, over }) => {
    if (a.data.current?.type !== 'card' || !over) return;
    setDragGroups((prev) => {
      if (!prev) return prev;
      const from = findContainer(a.id, prev);
      const to = findContainer(over.id, prev);
      if (!from || !to || from === to) return prev;

      const target = prev[to];
      const overIndex = target.indexOf(over.id);
      const insertAt = overIndex >= 0 ? overIndex : target.length;
      return {
        ...prev,
        [from]: prev[from].filter((id) => id !== a.id),
        [to]: [...target.slice(0, insertAt), a.id, ...target.slice(insertAt)],
      };
    });
  };

  const resetDrag = () => {
    setActive(null);
    setDragGroups(null);
  };

  const onDragEnd = ({ active: a, over }) => {
    const type = a.data.current?.type;

    if (type === 'column' && over) {
      const ids = columns.map((c) => c.id);
      const overColumnId = findContainer(over.id) ?? over.id;
      const oldIndex = ids.indexOf(a.id);
      const newIndex = ids.indexOf(overColumnId);
      if (newIndex >= 0 && oldIndex !== newIndex) {
        const siblings = columns.filter((c) => c.id !== a.id);
        mutations.moveColumn(a.id, newIndex, positionForIndex(siblings, newIndex));
      }
    }

    if (type === 'card' && over && dragGroups) {
      const container = findContainer(a.id, dragGroups);
      let ids = dragGroups[container];
      const oldIndex = ids.indexOf(a.id);
      const overIndex = ids.indexOf(over.id);
      if (overIndex >= 0 && overIndex !== oldIndex) ids = arrayMove(ids, oldIndex, overIndex);

      const index = ids.indexOf(a.id);
      const card = cardsById.get(a.id);
      const originalIndex = groups[card.columnId].findIndex((c) => c.id === a.id);
      if (container !== card.columnId || index !== originalIndex) {
        const siblings = ids.filter((id) => id !== a.id).map((id) => cardsById.get(id));
        mutations.moveCard(a.id, container, index, positionForIndex(siblings, index));
      }
    }

    resetDrag();
  };

  const activeCard = active?.type === 'card' ? cardsById.get(active.card.id) : null;
  const canManageColumns = role === 'owner' || role === 'admin';

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={resetDrag}
    >
      <div className="flex h-full items-start gap-4 overflow-x-auto p-4 sm:p-6">
        <SortableContext items={columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
          {columns.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              cards={(idGroups[column.id] ?? []).map((id) => cardsById.get(id)).filter(Boolean)}
              labels={labels}
              membersById={membersById}
              viewersByCard={viewersByCard}
              canDelete={canManageColumns}
              onAddCard={mutations.createCard}
              onRename={(id, title) => mutations.updateColumn(id, { title })}
              onDelete={mutations.deleteColumn}
              onOpenCard={onOpenCard}
            />
          ))}
        </SortableContext>
        <div className="w-72 shrink-0 rounded-2xl bg-white/60 p-3 sm:w-80">
          <InlineForm
            buttonLabel="Agregar columna"
            placeholder="Nombre de la columna"
            maxLength={80}
            onSubmit={mutations.createColumn}
          />
        </div>
      </div>

      <DragOverlay>
        {activeCard && (
          <CardItem
            card={activeCard}
            labels={labels}
            assignee={membersById.get(activeCard.assigneeId)}
            dragging
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
