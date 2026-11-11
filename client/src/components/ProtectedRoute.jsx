import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Spinner } from './Spinner';

export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'loading') return <Spinner label="Restaurando sesión…" />;
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function PublicOnlyRoute() {
  const status = useAuthStore((s) => s.status);
  if (status === 'loading') return <Spinner label="Restaurando sesión…" />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <Outlet />;
}
