import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { useBoard } from '../../hooks/useBoard';
import { useBoardMutations } from '../../hooks/useBoardMutations';
import { useAuthStore } from '../../store/authStore';
import { AvatarStack } from '../../components/Avatar';
import { Spinner } from '../../components/Spinner';
import { BoardCanvas } from './BoardCanvas';
import { CardModal } from './CardModal';
import { ActivityPanel } from './ActivityPanel';

export default function BoardPage() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);
  const { data, isLoading, error, presence, focus, focusCard, connected, deleted } =
    useBoard(boardId);
  const mutations = useBoardMutations(boardId);
  const [openCardId, setOpenCardId] = useState(null);
  const [showActivity, setShowActivity] = useState(false);

  const membersById = useMemo(
    () => new Map((data?.members ?? []).map((m) => [m.id, m])),
    [data?.members],
  );

  // Who (other than me) has each card open.
  const viewersByCard = useMemo(() => {
    const map = new Map();
    for (const user of presence) {
      const cardId = focus[user.id];
      if (!cardId || user.id === me?.id) continue;
      if (!map.has(cardId)) map.set(cardId, []);
      map.get(cardId).push(user);
    }
    return map;
  }, [presence, focus, me?.id]);

  const openCard = useCallback(
    (id) => {
      setOpenCardId(id);
      focusCard(id);
    },
    [focusCard],
  );
  const closeCard = useCallback(() => {
    setOpenCardId(null);
    focusCard(null);
  }, [focusCard]);

  useEffect(() => {
    if (deleted) navigate('/', { replace: true });
  }, [deleted, navigate]);

  if (isLoading) return <Spinner label="Cargando tablero…" />;
  if (error) {
    return (
      <div className="p-10 text-center">
        <p className="text-slate-600">
          {error.status === 404 ? 'El tablero no existe o no tenés acceso.' : error.message}
        </p>
        <Link to="/" className="btn btn-primary mt-4">
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: data.board.color }} />
        <div className="min-w-0">
          <p className="text-xs text-slate-500">
            <Link to="/" className="hover:underline">
              {data.workspace?.name}
            </Link>
          </p>
          <h1 className="truncate text-lg font-bold tracking-tight">{data.board.title}</h1>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span
            className={clsx(
              'flex items-center gap-1.5 text-xs font-medium',
              connected ? 'text-emerald-600' : 'text-amber-600',
            )}
          >
            <span
              className={clsx(
                'h-2 w-2 rounded-full',
                connected ? 'animate-pulse bg-emerald-500' : 'bg-amber-500',
              )}
            />
            {connected ? 'En vivo' : 'Reconectando…'}
          </span>
          <div className="flex items-center gap-2" aria-label="Usuarios conectados">
            <AvatarStack users={presence} />
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowActivity((v) => !v)}
            aria-expanded={showActivity}
          >
            Actividad
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <BoardCanvas
          snapshot={data}
          mutations={mutations}
          membersById={membersById}
          viewersByCard={viewersByCard}
          onOpenCard={openCard}
        />
      </div>

      {openCardId && (
        <CardModal cardId={openCardId} snapshot={data} mutations={mutations} onClose={closeCard} />
      )}
      {showActivity && (
        <ActivityPanel
          boardId={boardId}
          membersById={membersById}
          onClose={() => setShowActivity(false)}
        />
      )}
    </div>
  );
}
