import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '../../lib/api';
import { Modal } from '../../components/Modal';
import { Avatar } from '../../components/Avatar';
import { Spinner } from '../../components/Spinner';
import { cardKey } from '../../hooks/useBoard';
import { timeAgo } from '../../utils/board';

const LABEL_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#0ea5e9',
  '#6366f1',
  '#a855f7',
  '#ec4899',
];

function LabelPicker({ labels, selected, onToggle, onCreate }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(LABEL_COLORS[4]);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {labels.map((l) => {
          const on = selected.includes(l.id);
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(l.id)}
              className={clsx(
                'rounded-full px-2.5 py-1 text-xs font-semibold transition',
                on ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
              style={on ? { backgroundColor: l.color } : undefined}
            >
              {l.name}
            </button>
          );
        })}
      </div>
      <form
        className="space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await onCreate(name.trim(), color);
          setName('');
        }}
      >
        <div className="flex gap-2">
          <input
            className="input min-w-0 py-1 text-xs"
            placeholder="Nueva etiqueta"
            aria-label="Nueva etiqueta"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-ghost px-2 py-1 text-xs">Crear</button>
        </div>
        <div className="flex gap-1.5" role="radiogroup" aria-label="Color de etiqueta">
          {LABEL_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={clsx(
                'h-4 w-4 rounded-full',
                color === c && 'ring-2 ring-slate-900 ring-offset-1',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </form>
    </div>
  );
}

// Local draft state that resets (via `key`) when the value changes remotely.
function TitleField({ value, onSave }) {
  const [draft, setDraft] = useState(value);
  return (
    <input
      className="mt-1 w-full rounded-lg border border-transparent px-1 text-xl font-semibold hover:border-slate-200 focus:border-indigo-400 focus:outline-none"
      value={draft}
      aria-label="Título"
      maxLength={200}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() && draft.trim() !== value && onSave(draft.trim())}
    />
  );
}

function DescriptionField({ value, onSave }) {
  const [draft, setDraft] = useState(value);
  return (
    <textarea
      id="card-description"
      rows={5}
      className="input resize-y"
      placeholder="Agregá más detalles…"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() !== value && onSave(draft.trim())}
    />
  );
}

export function CardModal({ cardId, snapshot, mutations, onClose }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: cardKey(cardId),
    queryFn: () => api.get(`/cards/${cardId}`),
  });
  const card = data?.card;
  const [comment, setComment] = useState('');

  const save = async (changes) => {
    const updated = await mutations.updateCard(cardId, changes);
    if (updated) {
      queryClient.setQueryData(cardKey(cardId), (old) => ({ card: { ...old.card, ...updated } }));
    }
  };

  const addComment = useMutation({
    mutationFn: (body) => api.post(`/cards/${cardId}/comments`, { body }),
    onSuccess: ({ comment: created }) => {
      setComment('');
      queryClient.setQueryData(cardKey(cardId), (old) => ({
        card: { ...old.card, comments: [...old.card.comments, created] },
      }));
    },
  });

  const column = snapshot.columns.find((c) => c.id === card?.columnId);

  return (
    <Modal open onClose={onClose} title={card?.title ?? 'Tarjeta'} wide>
      {isLoading || !card ? (
        <Spinner />
      ) : (
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_220px]">
          <div className="space-y-5">
            <div>
              <p className="text-xs text-slate-500">
                en <span className="font-medium">{column?.title}</span>
              </p>
              <TitleField
                key={card.title}
                value={card.title}
                onSave={(next) => save({ title: next })}
              />
            </div>

            <div>
              <label htmlFor="card-description" className="label">
                Descripción
              </label>
              <DescriptionField
                key={card.description ?? ''}
                value={card.description ?? ''}
                onSave={(next) => save({ description: next || null })}
              />
            </div>

            <div>
              <h3 className="label">Comentarios ({card.comments.length})</h3>
              <ul className="space-y-3">
                {card.comments.map((c) => (
                  <li key={c.id} className="flex gap-2.5">
                    <Avatar user={c.author} size="sm" />
                    <div className="flex-1 rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-xs">
                        <span className="font-semibold">{c.author.name}</span>{' '}
                        <span className="text-slate-400">{timeAgo(c.createdAt)}</span>
                      </p>
                      <p className="text-sm whitespace-pre-wrap text-slate-700">{c.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (comment.trim()) addComment.mutate(comment.trim());
                }}
              >
                <input
                  className="input"
                  placeholder="Escribí un comentario…"
                  aria-label="Nuevo comentario"
                  value={comment}
                  maxLength={2000}
                  onChange={(e) => setComment(e.target.value)}
                />
                <button className="btn btn-primary" disabled={addComment.isPending}>
                  Enviar
                </button>
              </form>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label htmlFor="card-assignee" className="label">
                Responsable
              </label>
              <select
                id="card-assignee"
                className="input"
                value={card.assigneeId ?? ''}
                onChange={(e) => save({ assigneeId: e.target.value || null })}
              >
                <option value="">Sin asignar</option>
                {snapshot.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="card-due" className="label">
                Vencimiento
              </label>
              <input
                id="card-due"
                type="date"
                className="input"
                value={card.dueDate ?? ''}
                onChange={(e) => save({ dueDate: e.target.value || null })}
              />
            </div>
            <div>
              <span className="label">Etiquetas</span>
              <LabelPicker
                labels={snapshot.labels}
                selected={card.labelIds}
                onToggle={(id) =>
                  save({
                    labelIds: card.labelIds.includes(id)
                      ? card.labelIds.filter((x) => x !== id)
                      : [...card.labelIds, id],
                  })
                }
                onCreate={async (name, color) => {
                  const label = await mutations.createLabel(name, color);
                  if (label) await save({ labelIds: [...card.labelIds, label.id] });
                }}
              />
            </div>
            <div className="border-t border-slate-100 pt-4">
              <button
                type="button"
                className="btn btn-danger w-full"
                onClick={async () => {
                  if (window.confirm('¿Eliminar esta tarjeta?')) {
                    await mutations.deleteCard(cardId);
                    onClose();
                  }
                }}
              >
                Eliminar tarjeta
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
