// src/server/socket/matchmaking.ts
// File d'attente de Matchmaking automatique par plage ELO (±100 à ±300)
import { Server, Socket } from 'socket.io';
import { Chess } from 'chess.js';
import { activeSessions, matchmakingQueue, ActiveGameSession } from './state.ts';
import { createRoomRecord } from '../../db/queries.ts';
import { parseTimeControl } from '../routes/rooms.ts';

export function registerMatchmakingHandlers(io: Server, socket: Socket) {
  socket.on(
    'matchmaking:join',
    async (payload: {
      uid: string;
      username: string;
      countryCode: string;
      elo: number;
      category: string;
      timeControl: string;
      emailVerified?: boolean;
    }) => {
      try {
        if (payload.emailVerified === false) {
          socket.emit('room:error', {
            error: 'Compte non vérifié : validez votre email pour lancer le matchmaking classé.',
          });
          return;
        }

        // Retirer toute entrée existante de ce joueur
        const existingIdx = matchmakingQueue.findIndex((q) => q.uid === payload.uid);
        if (existingIdx !== -1) {
          matchmakingQueue.splice(existingIdx, 1);
        }

        // Chercher un adversaire compatible (±300 ELO sur la même cadence)
        const matchIdx = matchmakingQueue.findIndex(
          (q) =>
            q.uid !== payload.uid &&
            q.timeControl === payload.timeControl &&
            Math.abs(q.elo - payload.elo) <= 300
        );

        if (matchIdx !== -1) {
          const opponent = matchmakingQueue.splice(matchIdx, 1)[0];
          const code = `MATCH-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          const { initialMs, incrementMs } = parseTimeControl(payload.timeControl);

          const session: ActiveGameSession = {
            roomCode: code,
            name: `${opponent.username} vs ${payload.username}`,
            category: payload.category,
            timeControl: payload.timeControl,
            isPrivate: false,
            chess: new Chess(),
            whitePlayer: {
              uid: opponent.uid,
              username: opponent.username,
              countryCode: opponent.countryCode,
              elo: opponent.elo,
              socketId: opponent.socketId,
            },
            blackPlayer: {
              uid: payload.uid,
              username: payload.username,
              countryCode: payload.countryCode,
              elo: payload.elo,
              socketId: socket.id,
            },
            spectators: new Set<string>(),
            whiteTimeMs: initialMs,
            blackTimeMs: initialMs,
            incrementMs,
            lastMoveTimestamp: Date.now(),
            moveTimingsMs: [],
            status: 'PLAYING',
          };

          activeSessions.set(code, session);

          await createRoomRecord({
            code,
            name: session.name,
            hostUid: opponent.uid,
            hostUsername: opponent.username,
            hostCountry: opponent.countryCode,
            hostElo: opponent.elo,
            timeControl: payload.timeControl,
            category: payload.category,
            isPrivate: false,
            whiteTimeMs: initialMs,
            blackTimeMs: initialMs,
            incrementMs,
          });

          socket.join(code);
          const oppSocket = io.sockets.sockets.get(opponent.socketId);
          oppSocket?.join(code);

          io.to(code).emit('matchmaking:found', {
            roomCode: code,
            name: session.name,
            timeControl: session.timeControl,
            category: session.category,
            whitePlayer: session.whitePlayer,
            blackPlayer: session.blackPlayer,
            fen: session.chess.fen(),
            whiteTimeMs: session.whiteTimeMs,
            blackTimeMs: session.blackTimeMs,
          });
        } else {
          matchmakingQueue.push({
            socketId: socket.id,
            uid: payload.uid,
            username: payload.username,
            countryCode: payload.countryCode || 'FR',
            elo: payload.elo || 1200,
            category: payload.category || 'blitz',
            timeControl: payload.timeControl || '3+2',
            joinedAt: Date.now(),
          });

          socket.emit('matchmaking:searching', {
            status: 'SEARCHING',
            range: '±150 ELO',
            queueSize: matchmakingQueue.length,
          });
        }
      } catch (error) {
        console.error('Socket matchmaking:join error:', error);
      }
    }
  );

  socket.on('matchmaking:leave', (payload: { uid: string }) => {
    const idx = matchmakingQueue.findIndex((q) => q.uid === payload?.uid);
    if (idx !== -1) {
      matchmakingQueue.splice(idx, 1);
    }
  });
}
