import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { applyBoardEvent } from '../utils/board';

export const boardKey = (id) => ['board', id];
export const activityKey = (id) => ['activity', id];

const BOARD_EVENTS = [
  'board:updated',
  'column:created',
  'column:updated',
  'column:moved',
  'column:deleted',
  'card:created',
  'card:updated',
  'card:moved',
  'card:deleted',
  'comment:created',
  'comment:deleted',
  'label:created',
  'label:deleted',
];

export const cardKey = (id) => ['card', id];

/** Keeps an open card modal (its own query) in sync with remote changes. */
function syncCardDetail(queryClient, event, payload) {
  if (event === 'card:updated') {
    queryClient.setQueryData(cardKey(payload.id), (old) =>
      old ? { card: { ...old.card, ...payload } } : old,
    );
  } else if (event === 'comment:created') {
    queryClient.setQueryData(cardKey(payload.cardId), (old) =>
      old && !old.card.comments.some((c) => c.id === payload.id)
        ? { card: { ...old.card, comments: [...old.card.comments, payload] } }
        : old,
    );
  } else if (event === 'comment:deleted') {
    queryClient.setQueryData(cardKey(payload.cardId), (old) =>
      old
        ? { card: { ...old.card, comments: old.card.comments.filter((c) => c.id !== payload.id) } }
        : old,
    );
  }
}

/**
 * Loads the board snapshot and keeps it in sync through Socket.IO.
 * Incoming events are applied to the React Query cache with a pure reducer,
 * so the UI never has to refetch the whole board for each change.
 */
export function useBoard(boardId) {
  const queryClient = useQueryClient();
  const [presence, setPresence] = useState([]);
  const [focus, setFocus] = useState({}); // userId -> cardId
  const [connected, setConnected] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const query = useQuery({
    queryKey: boardKey(boardId),
    queryFn: () => api.get(`/boards/${boardId}`),
  });

  useEffect(() => {
    const socket = getSocket();

    const join = () => {
      setConnected(true);
      socket.emit('board:join', boardId, (res) => {
        if (res?.ok) setPresence(res.users);
      });
      // Events may have been missed while offline: resync the snapshot.
      queryClient.invalidateQueries({ queryKey: boardKey(boardId) });
    };

    const handlers = BOARD_EVENTS.map((event) => {
      const handler = (payload) => {
        queryClient.setQueryData(boardKey(boardId), (old) => applyBoardEvent(old, event, payload));
        syncCardDetail(queryClient, event, payload);
      };
      socket.on(event, handler);
      return [event, handler];
    });

    const onPresence = (data) => data.boardId === boardId && setPresence(data.users);
    const onFocus = ({ userId, cardId }) => setFocus((f) => ({ ...f, [userId]: cardId }));
    const onActivity = (activity) =>
      queryClient.setQueryData(activityKey(boardId), (old) =>
        old ? { activities: [activity, ...old.activities].slice(0, 100) } : old,
      );
    const onBoardDeleted = () => setDeleted(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', join);
    socket.on('disconnect', onDisconnect);
    socket.on('presence:update', onPresence);
    socket.on('card:focus', onFocus);
    socket.on('activity:created', onActivity);
    socket.on('board:deleted', onBoardDeleted);

    if (socket.connected) join();
    else socket.connect();

    return () => {
      socket.emit('board:leave', boardId);
      handlers.forEach(([event, handler]) => socket.off(event, handler));
      socket.off('connect', join);
      socket.off('disconnect', onDisconnect);
      socket.off('presence:update', onPresence);
      socket.off('card:focus', onFocus);
      socket.off('activity:created', onActivity);
      socket.off('board:deleted', onBoardDeleted);
    };
  }, [boardId, queryClient]);

  const focusCard = (cardId) => getSocket().emit('card:focus', { boardId, cardId });

  return { ...query, presence, focus, focusCard, connected, deleted };
}

export function useActivity(boardId, enabled = true) {
  return useQuery({
    queryKey: activityKey(boardId),
    queryFn: () => api.get(`/boards/${boardId}/activity?limit=50`),
    enabled,
  });
}
