// src/hooks/useSocket.ts
// Hook temps réel Socket.io : gestion des salles, matchmaking, coups d'échecs et notifications
import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '../lib/socket.ts';

export function useSocket() {
  const [socket] = useState<Socket>(() => getSocket());
  const [connected, setConnected] = useState<boolean>(socket.connected);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);

  return { socket, connected };
}
