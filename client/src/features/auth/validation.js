const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Client side checks mirror the server schema for instant feedback. */
export function validateAuthForm(values, { register = false } = {}) {
  const errors = {};
  if (register && (!values.name || values.name.trim().length < 2)) {
    errors.name = 'Ingresá tu nombre';
  }
  if (!EMAIL_RE.test(values.email ?? '')) errors.email = 'Email inválido';
  if (!values.password) {
    errors.password = 'Ingresá tu contraseña';
  } else if (register) {
    if (values.password.length < 8) errors.password = 'Mínimo 8 caracteres';
    else if (!/[A-Za-z]/.test(values.password) || !/\d/.test(values.password)) {
      errors.password = 'Debe incluir letras y números';
    }
  }
  return errors;
}
