// src/agent/socket.jsx — live updates over socket.io (same events as the mobile app)
//   new_lead_assigned            → new / reassigned lead
//   meeting_permission_response  → admin approved/denied remote clock-in
//   attendance:updated           → attendance record changed on the server
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getToken } from './api.js';

function socketUrl() {
  const explicit = import.meta.env.VITE_SOCKET_URL;
  if (explicit) return explicit;
  const api = import.meta.env.VITE_API_URL || '';
  if (/^https?:\/\//.test(api)) return api.replace(/\/api\/?$/, '');
  return window.location.origin; // dev: Vite proxies /socket.io
}

const Ctx = createContext({ socket: null, connected: false });

export function SocketProvider({ userId, children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!userId) return undefined;
    const s = io(socketUrl(), {
      transports: ['websocket', 'polling'],
      auth: (cb) => { const t = getToken(); cb(t ? { token: t } : {}); },
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });
    // Re-join rooms on every (re)connect, otherwise events stop after a network blip.
    const join = () => {
      setConnected(true);
      s.emit('agent_join', { userId });
      s.emit('att_join', { userId });
    };
    s.on('connect', join);
    s.on('disconnect', () => setConnected(false));
    setSocket(s);
    return () => { s.off(); s.disconnect(); setSocket(null); setConnected(false); };
  }, [userId]);

  return <Ctx.Provider value={{ socket, connected }}>{children}</Ctx.Provider>;
}

export const useSocket = () => useContext(Ctx);

/** Subscribe to one socket event while mounted. `handler` may change freely. */
export function useSocketEvent(event, handler) {
  const { socket } = useSocket();
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; }, [handler]);
  useEffect(() => {
    if (!socket) return undefined;
    const fn = (...args) => ref.current?.(...args);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [socket, event]);
}
