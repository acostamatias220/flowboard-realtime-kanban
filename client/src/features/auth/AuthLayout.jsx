import { Logo } from '../../components/Logo';

export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-slate-100 to-sky-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo className="h-11 w-11" />
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
        <p className="mt-4 text-center text-sm text-slate-600">{footer}</p>
      </div>
    </div>
  );
}
