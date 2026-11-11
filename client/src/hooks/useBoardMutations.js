import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { api } from '../lib/api';
import { applyBoardEvent } from '../utils/board';
import { boardKey } from './useBoard';
import { useToast } from '../components/Toast';

/**
 * Board mutations with optimistic cache updates. The same reducer used for
 * socket events is reused here, so local and remote changes go through
 * exactly the same code path.
 */
export function useBoardMutations(boardId) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const apply = useCallback(
    (event, payload) =>
      queryClient.setQueryData(boardKey(boardId), (old) => applyBoardEvent(old, event, payload)),
    [queryClient, boardId],
  );

  const fail = useCallback(
    (err) => {
      toast.error(err.message ?? 'Algo salió mal');
      queryClient.invalidateQueries({ queryKey: boardKey(boardId) });
    },
    [queryClient, boardId, toast],
  );

  return useMemo(
    () => ({
      async createColumn(title) {
        try {
          const { column } = await api.post(`/boards/${boardId}/columns`, { title });
          apply('column:created', column);
        } catch (err) {
          fail(err);
        }
      },
      async updateColumn(columnId, changes) {
        try {
          const { column } = await api.patch(`/columns/${columnId}`, changes);
          apply('column:updated', column);
        } catch (err) {
          fail(err);
        }
      },
      async moveColumn(columnId, index, optimisticPosition) {
        apply('column:moved', { column: { id: columnId, position: optimisticPosition } });
        try {
          const res = await api.patch(`/columns/${columnId}/move`, { index });
          apply('column:moved', res);
        } catch (err) {
          fail(err);
        }
      },
      async deleteColumn(columnId) {
        try {
          await api.delete(`/columns/${columnId}`);
          apply('column:deleted', { id: columnId });
        } catch (err) {
          fail(err);
        }
      },
      async createCard(columnId, title) {
        try {
          const { card } = await api.post(`/columns/${columnId}/cards`, { title });
          apply('card:created', card);
        } catch (err) {
          fail(err);
        }
      },
      async moveCard(cardId, toColumnId, index, optimisticPosition) {
        apply('card:moved', { cardId, toColumnId, position: optimisticPosition });
        try {
          const res = await api.patch(`/cards/${cardId}/move`, { columnId: toColumnId, index });
          apply('card:moved', res);
        } catch (err) {
          fail(err);
        }
      },
      async updateCard(cardId, changes) {
        try {
          const { card } = await api.patch(`/cards/${cardId}`, changes);
          apply('card:updated', card);
          return card;
        } catch (err) {
          fail(err);
          return null;
        }
      },
      async deleteCard(cardId) {
        try {
          await api.delete(`/cards/${cardId}`);
          apply('card:deleted', { id: cardId });
        } catch (err) {
          fail(err);
        }
      },
      async createLabel(name, color) {
        try {
          const { label } = await api.post(`/boards/${boardId}/labels`, { name, color });
          apply('label:created', label);
          return label;
        } catch (err) {
          fail(err);
          return null;
        }
      },
    }),
    [apply, fail, boardId],
  );
}
