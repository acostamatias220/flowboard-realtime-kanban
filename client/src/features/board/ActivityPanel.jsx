import { Avatar } from '../../components/Avatar';
import { Spinner } from '../../components/Spinner';
import { useActivity } from '../../hooks/useBoard';
import { describeActivity, timeAgo } from '../../utils/board';

export function ActivityPanel({ boardId, membersById, onClose }) {
  const { data, isLoading } = useActivity(boardId);

  return (
    <aside className="fixed inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-2xl sm:top-14">
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="font-semibold">Actividad</h2>
        <button
          type="button"
          className="btn btn-ghost px-2 py-1"
          onClick={onClose}
          aria-label="Cerrar"
        >
          ✕
        </button>
      </header>
      {isLoading ? (
        <Spinner />
      ) : (
        <ol className="flex-1 space-y-4 overflow-y-auto p-4">
          {data?.activities.map((a) => (
            <li key={a.id} className="flex gap-3 text-sm">
              <Avatar user={membersById.get(a.user?.id) ?? a.user} size="sm" />
              <div>
                <p>
                  <span className="font-medium">{a.user?.name ?? 'Alguien'}</span>{' '}
                  <span className="text-slate-600">{describeActivity(a)}</span>
                </p>
                <time className="text-xs text-slate-400" dateTime={a.createdAt}>
                  {timeAgo(a.createdAt)}
                </time>
              </div>
            </li>
          ))}
          {data?.activities.length === 0 && (
            <p className="text-sm text-slate-500">Todavía no hay actividad.</p>
          )}
        </ol>
      )}
    </aside>
  );
}
