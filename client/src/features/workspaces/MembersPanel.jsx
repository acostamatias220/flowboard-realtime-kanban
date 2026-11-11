import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Avatar } from '../../components/Avatar';
import { useToast } from '../../components/Toast';
import { useAuthStore } from '../../store/authStore';

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', member: 'Miembro' };

export function MembersPanel({ workspace }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const toast = useToast();
  const canManage = workspace.role === 'owner' || workspace.role === 'admin';

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['workspace', workspace.id] });

  const invite = useMutation({
    mutationFn: () => api.post(`/workspaces/${workspace.id}/members`, { email, role }),
    onSuccess: () => {
      setEmail('');
      refresh();
      toast.success('Miembro agregado');
    },
    onError: (err) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (userId) => api.delete(`/workspaces/${workspace.id}/members/${userId}`),
    onSuccess: refresh,
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-semibold">Miembros</h2>
      <ul className="divide-y divide-slate-100">
        {workspace.members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2.5">
            <Avatar user={m} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {m.name} {m.id === me?.id && <span className="text-slate-400">(vos)</span>}
              </p>
              <p className="truncate text-xs text-slate-500">{m.email}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {ROLE_LABEL[m.role]}
            </span>
            {canManage && m.role !== 'owner' && m.id !== me?.id && (
              <button
                type="button"
                className="btn btn-ghost px-2 py-1 text-xs"
                onClick={() => remove.mutate(m.id)}
              >
                Quitar
              </button>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (email) invite.mutate();
          }}
        >
          <input
            type="email"
            className="input"
            placeholder="email@empresa.com"
            aria-label="Email del nuevo miembro"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {workspace.role === 'owner' && (
            <select
              className="input sm:w-36"
              value={role}
              aria-label="Rol"
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="member">Miembro</option>
              <option value="admin">Admin</option>
            </select>
          )}
          <button className="btn btn-primary" disabled={invite.isPending}>
            Invitar
          </button>
        </form>
      )}
    </div>
  );
}
