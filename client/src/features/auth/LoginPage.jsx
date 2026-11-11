import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { AuthForm } from './AuthForm';
import { AuthLayout } from './AuthLayout';

export default function LoginPage() {
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();

  const login = async (values) => {
    setSession(await authApi.login(values));
    navigate(location.state?.from ?? '/', { replace: true });
  };

  return (
    <AuthLayout
      title="Bienvenido de nuevo"
      subtitle="Ingresá para seguir colaborando con tu equipo"
      footer={
        <>
          ¿No tenés cuenta?{' '}
          <Link to="/register" className="font-medium text-indigo-600 hover:underline">
            Registrate
          </Link>
        </>
      }
    >
      <AuthForm mode="login" onSubmit={login} />
    </AuthLayout>
  );
}
