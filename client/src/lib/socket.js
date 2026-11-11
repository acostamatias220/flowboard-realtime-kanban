import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

let socket = null;

/** Lazily creates the shared Socket.IO connection. */
export function getSocket() {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL || undefined, {
      autoConnect: false,
      transports: ['websocket'],
      // Called on every (re)connection so a renewed access token is always used.
      auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
    });
  }
  return socket;
}

export function getSocketId() {
  return socket?.connected ? socket.id : undefined;
}

export function disconnectSocket() {
  socket?.disconnect();
}
