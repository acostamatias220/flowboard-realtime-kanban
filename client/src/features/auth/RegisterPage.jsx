import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { AuthForm } from './AuthForm';
import { AuthLayout } from './AuthLayout';

export default function RegisterPage() {
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  const register = async (values) => {
    setSession(await authApi.register(values));
    navigate('/', { replace: true });
  };

  return (
    <AuthLayout
      title="Creá tu cuenta"
      subtitle="Organizá proyectos en tiempo real con tu equipo"
      footer={
        <>
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">
            Ingresá
          </Link>
        </>
      }
    >
      <AuthForm mode="register" onSubmit={register} />
    </AuthLayout>
  );
}
