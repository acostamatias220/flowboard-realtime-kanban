import clsx from 'clsx';
import { Avatar, AvatarStack } from '../../components/Avatar';
import { dueStatus, formatDueDate } from '../../utils/board';

const DUE_STYLES = {
  overdue: 'bg-rose-100 text-rose-700',
  soon: 'bg-amber-100 text-amber-800',
  later: 'bg-slate-100 text-slate-600',
};

/**
 * Presentational card used both in the column and in the drag overlay.
 * @param {{ card, labels, assignee, viewers?, dragging?, onOpen? }} props
 */
export function CardItem({ card, labels = [], assignee, viewers = [], dragging = false, onOpen }) {
  const status = dueStatus(card.dueDate);
  const cardLabels = labels.filter((l) => card.labelIds.includes(l.id));

  return (
    <article
      className={clsx(
        'group cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition active:cursor-grabbing',
        dragging
          ? 'rotate-2 shadow-xl ring-2 ring-indigo-400'
          : 'hover:border-slate-300 hover:shadow',
      )}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen?.()}
      aria-label={card.title}
    >
      {cardLabels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {cardLabels.map((l) => (
            <span
              key={l.id}
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
              style={{ backgroundColor: l.color }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}
      <h4 className="text-sm leading-snug font-medium text-slate-800">{card.title}</h4>

      <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-500">
        {status && (
          <span
            className={clsx('rounded-md px-1.5 py-0.5 font-medium', DUE_STYLES[status])}
            data-testid="due-badge"
            data-status={status}
          >
            📅 {formatDueDate(card.dueDate)}
          </span>
        )}
        {card.description && <span title="Tiene descripción">≡</span>}
        {card.commentCount > 0 && (
          <span aria-label={`${card.commentCount} comentarios`}>💬 {card.commentCount}</span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {viewers.length > 0 && <AvatarStack users={viewers} size="sm" max={2} />}
          {assignee && <Avatar user={assignee} size="sm" />}
        </div>
      </div>
    </article>
  );
}
