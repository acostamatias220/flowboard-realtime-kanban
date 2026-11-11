import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute';
import { Spinner } from './components/Spinner';
import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';

// Route level code splitting: the board (dnd-kit, sockets) loads on demand.
const WorkspacesPage = lazy(() => import('./features/workspaces/WorkspacesPage'));
const BoardPage = lazy(() => import('./features/board/BoardPage'));

function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
      <p className="text-5xl font-bold text-slate-300">404</p>
      <p className="text-slate-600">No encontramos esta página.</p>
      <Link to="/" className="btn btn-primary">
        Volver al inicio
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<WorkspacesPage />} />
            <Route path="/boards/:boardId" element={<BoardPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
