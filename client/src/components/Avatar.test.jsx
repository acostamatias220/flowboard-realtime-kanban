import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AvatarStack } from './Avatar';

const users = ['Ana López', 'Bruno Díaz', 'Carla Gómez', 'Diego Ruiz', 'Eva Paz'].map(
  (name, i) => ({ id: String(i), name, avatarColor: '#000' }),
);

describe('<AvatarStack />', () => {
  it('shows up to `max` avatars and a counter for the rest', () => {
    render(<AvatarStack users={users} max={3} />);
    expect(screen.getByLabelText('Ana López')).toHaveTextContent('AL');
    expect(screen.queryByLabelText('Diego Ruiz')).not.toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('renders no counter when everyone fits', () => {
    render(<AvatarStack users={users.slice(0, 2)} />);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });
});
