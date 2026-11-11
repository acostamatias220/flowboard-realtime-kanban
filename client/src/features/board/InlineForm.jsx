import { useState } from 'react';

/** Small "add item" form that toggles between a button and an input. */
export function InlineForm({ buttonLabel, placeholder, onSubmit, maxLength = 200 }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const text = value.trim();
    if (!text) return;
    setValue('');
    await onSubmit(text);
  };

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-ghost w-full justify-start text-slate-500"
        onClick={() => setOpen(true)}
      >
        + {buttonLabel}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <input
        autoFocus
        className="input"
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        maxLength={maxLength}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      />
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary py-1.5">
          Agregar
        </button>
        <button type="button" className="btn btn-ghost py-1.5" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
