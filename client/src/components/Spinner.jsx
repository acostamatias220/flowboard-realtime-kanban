export function Spinner({ label = 'Cargando…' }) {
  return (
    <div className="flex items-center justify-center gap-3 p-10 text-slate-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
