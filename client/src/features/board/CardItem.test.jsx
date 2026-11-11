import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CardItem } from './CardItem';

const labels = [
  { id: 'l1', name: 'Backend', color: '#0ea5e9' },
  { id: 'l2', name: 'UX', color: '#ec4899' },
];

const baseCard = {
  id: 'c1',
  title: 'Implementar login',
  description: 'JWT + refresh',
  labelIds: ['l1'],
  dueDate: '2000-01-01',
  commentCount: 3,
  assigneeId: 'u1',
};

describe('<CardItem />', () => {
  it('renders title, only its own labels, comments and assignee', () => {
    render(
      <CardItem
        card={baseCard}
        labels={labels}
        assignee={{ id: 'u1', name: 'Ana López', avatarColor: '#f00' }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Implementar login' })).toBeInTheDocument();
    expect(screen.getByText('Backend')).toBeInTheDocument();
    expect(screen.queryByText('UX')).not.toBeInTheDocument();
    expect(screen.getByLabelText('3 comentarios')).toBeInTheDocument();
    expect(screen.getByLabelText('Ana López')).toHaveTextContent('AL');
  });

  it('flags overdue cards', () => {
    render(<CardItem card={baseCard} labels={labels} />);
    expect(screen.getByTestId('due-badge')).toHaveAttribute('data-status', 'overdue');
  });

  it('hides optional metadata when missing', () => {
    render(
      <CardItem
        card={{ ...baseCard, dueDate: null, commentCount: 0, labelIds: [] }}
        labels={labels}
      />,
    );
    expect(screen.queryByTestId('due-badge')).not.toBeInTheDocument();
    expect(screen.queryByText('Backend')).not.toBeInTheDocument();
  });

  it('calls onOpen when clicked', async () => {
    const onOpen = vi.fn();
    render(<CardItem card={baseCard} labels={labels} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('article'));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
