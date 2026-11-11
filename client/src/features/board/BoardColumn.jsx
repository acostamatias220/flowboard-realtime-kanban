import { useState } from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { SortableCard } from './SortableCard';
import { InlineForm } from './InlineForm';

export function BoardColumn({
  column,
  cards,
  labels,
  membersById,
  viewersByCard,
  canDelete,
  onAddCard,
  onRename,
  onDelete,
  onOpenCard,
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(column.title);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: 'column', column },
  });

  const overLimit = column.wipLimit && cards.length > column.wipLimit;

  const saveTitle = () => {
    setEditing(false);
    const next = title.trim();
    if (next && next !== column.title) onRename(column.id, next);
    else setTitle(column.title);
  };

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={clsx(
        'flex max-h-full w-72 shrink-0 flex-col rounded-2xl bg-slate-200/70 sm:w-80',
        isDragging && 'opacity-50',
      )}
      aria-label={`Columna ${column.title}`}
    >
      <header
        className="flex cursor-grab items-center gap-2 px-3 pt-3 pb-2 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        {editing ? (
          <input
            autoFocus
            className="input py-1"
            value={title}
            aria-label="Nombre de la columna"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <h3
            className="flex-1 truncate text-sm font-semibold text-slate-700"
            onDoubleClick={() => setEditing(true)}
            title="Doble click para renombrar"
          >
            {column.title}
          </h3>
        )}
        <span
          className={clsx(
            'rounded-full px-2 py-0.5 text-xs font-semibold',
            overLimit ? 'bg-rose-100 text-rose-700' : 'bg-white/70 text-slate-500',
          )}
        >
          {cards.length}
          {column.wipLimit ? ` / ${column.wipLimit}` : ''}
        </span>
        {canDelete && (
          <button
            type="button"
            className="rounded p-1 text-slate-400 hover:bg-white hover:text-rose-600"
            aria-label={`Eliminar columna ${column.title}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              if (window.confirm(`¿Eliminar la columna «${column.title}» y sus tarjetas?`)) {
                onDelete(column.id);
              }
            }}
          >
            ✕
          </button>
        )}
      </header>

      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[3rem] flex-1 flex-col gap-2 overflow-y-auto px-3 pb-2">
          {cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              labels={labels}
              assignee={membersById.get(card.assigneeId)}
              viewers={viewersByCard.get(card.id) ?? []}
              onOpen={() => onOpenCard(card.id)}
            />
          ))}
        </div>
      </SortableContext>

      <div className="px-3 pb-3">
        <InlineForm
          buttonLabel="Agregar tarjeta"
          placeholder="Título de la tarjeta"
          onSubmit={(text) => onAddCard(column.id, text)}
        />
      </div>
    </section>
  );
}
