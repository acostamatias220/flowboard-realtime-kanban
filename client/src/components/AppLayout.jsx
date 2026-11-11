import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../lib/api';
import { disconnectSocket } from '../lib/socket';
import { Avatar } from './Avatar';
import { Logo } from './Logo';

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const logout = async () => {
    await authApi.logout().catch(() => {});
    disconnectSocket();
    queryClient.clear();
    clearSession();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900">
            <Logo />
            FlowBoard
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline">{user?.name}</span>
            <Avatar user={user} />
            <button type="button" className="btn btn-ghost" onClick={logout}>
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
