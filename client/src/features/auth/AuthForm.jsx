import { useState } from 'react';
import { validateAuthForm } from './validation';

function Field({ id, label, error, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input
        id={id}
        className="input"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Shared login / register form.
 * @param {{ mode: 'login' | 'register', onSubmit: (values) => Promise<void> }} props
 */
export function AuthForm({ mode, onSubmit }) {
  const isRegister = mode === 'register';
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const change = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const found = validateAuthForm(values, { register: isRegister });
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    setServerError('');
    try {
      const { name, email, password } = values;
      await onSubmit(isRegister ? { name, email, password } : { email, password });
    } catch (err) {
      setServerError(
        err.status === 401
          ? 'Email o contraseña incorrectos'
          : err.status === 409
            ? 'Ese email ya está registrado'
            : err.status === 429
              ? 'Demasiados intentos, probá en unos minutos'
              : 'No pudimos procesar la solicitud',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      {isRegister && (
        <Field
          id="name"
          name="name"
          label="Nombre"
          autoComplete="name"
          value={values.name}
          onChange={change}
          error={errors.name}
        />
      )}
      <Field
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        value={values.email}
        onChange={change}
        error={errors.email}
      />
      <Field
        id="password"
        name="password"
        type="password"
        label="Contraseña"
        autoComplete={isRegister ? 'new-password' : 'current-password'}
        value={values.password}
        onChange={change}
        error={errors.password}
      />
      {serverError && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {serverError}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
        {submitting ? 'Enviando…' : isRegister ? 'Crear cuenta' : 'Ingresar'}
      </button>
    </form>
  );
}
