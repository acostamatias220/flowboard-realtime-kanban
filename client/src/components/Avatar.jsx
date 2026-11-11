import clsx from 'clsx';
import { initials } from '../utils/board';

const SIZES = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

export function Avatar({ user, size = 'md', ring = false, className }) {
  if (!user) return null;
  return (
    <span
      title={user.name}
      aria-label={user.name}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none',
        SIZES[size],
        ring && 'ring-2 ring-white',
        className,
      )}
      style={{ backgroundColor: user.avatarColor ?? '#6366f1' }}
    >
      {initials(user.name)}
    </span>
  );
}

/** Overlapping avatars with a "+N" counter when there are too many users. */
export function AvatarStack({ users, max = 4, size = 'md' }) {
  const visible = users.slice(0, max);
  const extra = users.length - visible.length;
  return (
    <div className="flex -space-x-2" data-testid="avatar-stack">
      {visible.map((u) => (
        <Avatar key={u.id} user={u} size={size} ring />
      ))}
      {extra > 0 && (
        <span
          className={clsx(
            'inline-flex items-center justify-center rounded-full bg-slate-300 font-semibold text-slate-700 ring-2 ring-white',
            SIZES[size],
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
