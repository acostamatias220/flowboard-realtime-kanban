export function Logo({ className = 'h-7 w-7' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#4f46e5" />
      <rect x="7" y="8" width="5" height="16" rx="1.5" fill="#fff" />
      <rect x="13.5" y="8" width="5" height="11" rx="1.5" fill="#c7d2fe" />
      <rect x="20" y="8" width="5" height="7" rx="1.5" fill="#fff" />
    </svg>
  );
}
