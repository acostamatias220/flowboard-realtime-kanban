import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '../../lib/api';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import { MembersPanel } from './MembersPanel';

const BOARD_COLORS = ['#6366f1', '#0ea5e9', '#22c55e', '#f97316', '#ec4899', '#a855f7'];

function CreateBoardForm({ workspaceId }) {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState(BOARD_COLORS[0]);
  const queryClient = useQueryClient();
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: () => api.post(`/workspaces/${workspaceId}/boards`, { title, color }),
    onSuccess: () => {
      setTitle('');
      queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success('Tablero creado');
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-slate-300 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) mutation.mutate();
      }}
    >
      <label htmlFor="board-title" className="label">
        Nuevo tablero
      </label>
      <input
        id="board-title"
        className="input"
        placeholder="Ej: Sprint 12"
        value={title}
        maxLength={120}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5" role="radiogroup" aria-label="Color">
          {BOARD_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={clsx(
                'h-5 w-5 rounded-full',
                color === c && 'ring-2 ring-slate-900 ring-offset-2',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <button className="btn btn-primary" disabled={!title.trim() || mutation.isPending}>
          Crear
        </button>
      </div>
    </form>
  );
}

function CreateWorkspace({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => api.post('/workspaces', { name }),
    onSuccess: ({ workspace }) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setName('');
      setOpen(false);
      onCreated(workspace.id);
    },
  });

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-ghost w-full justify-start"
        onClick={() => setOpen(true)}
      >
        + Nuevo workspace
      </button>
    );
  }
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) mutation.mutate();
      }}
    >
      <input
        className="input"
        autoFocus
        placeholder="Nombre del workspace"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={mutation.isPending}>
          Crear
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function WorkspacesPage() {
  const [selectedId, setSelectedId] = useState(null);
  const workspaces = useQuery({ queryKey: ['workspaces'], queryFn: () => api.get('/workspaces') });
  const list = workspaces.data?.workspaces ?? [];
  const activeId = selectedId ?? list[0]?.id;

  const detail = useQuery({
    queryKey: ['workspace', activeId],
    queryFn: () => api.get(`/workspaces/${activeId}`),
    enabled: Boolean(activeId),
  });
  const workspace = detail.data?.workspace;

  if (workspaces.isLoading) return <Spinner />;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 p-4 sm:p-6 lg:grid-cols-[240px_1fr]">
      <aside className="space-y-1">
        <h2 className="label px-2">Workspaces</h2>
        {list.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => setSelectedId(w.id)}
            className={clsx(
              'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm',
              w.id === activeId ? 'bg-white font-semibold shadow-sm' : 'hover:bg-white/60',
            )}
          >
            <span className="truncate">{w.name}</span>
            <span className="text-xs text-slate-400">{w.boardCount}</span>
          </button>
        ))}
        <CreateWorkspace onCreated={setSelectedId} />
      </aside>

      <section className="space-y-6">
        {detail.isLoading || !workspace ? (
          <Spinner />
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{workspace.name}</h1>
              <p className="text-sm text-slate-500">
                Tu rol: <span className="font-medium capitalize">{workspace.role}</span> ·{' '}
                {workspace.members.length} miembro(s)
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {workspace.boards.map((b) => (
                <Link
                  key={b.id}
                  to={`/boards/${b.id}`}
                  className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="h-2" style={{ backgroundColor: b.color }} />
                  <div className="p-4">
                    <h3 className="font-semibold group-hover:text-indigo-600">{b.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                      {b.description || 'Sin descripción'}
                    </p>
                  </div>
                </Link>
              ))}
              <CreateBoardForm workspaceId={workspace.id} />
            </div>

            <MembersPanel workspace={workspace} />
          </>
        )}
      </section>
    </div>
  );
}
