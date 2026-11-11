import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthForm } from './AuthForm';

describe('<AuthForm />', () => {
  it('validates fields on the client before submitting', async () => {
    const onSubmit = vi.fn();
    render(<AuthForm mode="register" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Email'), 'wrong');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Ingresá tu nombre')).toBeInTheDocument();
    expect(screen.getByText('Email inválido')).toBeInTheDocument();
    expect(screen.getByText('Mínimo 8 caracteres')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('submits normalized values when valid', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    render(<AuthForm mode="login" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Email'), 'ana@demo.dev');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'whatever1');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(onSubmit).toHaveBeenCalledWith({ email: 'ana@demo.dev', password: 'whatever1' });
  });

  it('shows a friendly message on invalid credentials', async () => {
    const onSubmit = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { status: 401 }));
    render(<AuthForm mode="login" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Email'), 'ana@demo.dev');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'bad-pass1');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos');
  });
});
