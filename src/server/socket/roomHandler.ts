// src/server/socket/roomHandler.ts
// Gestionnaire Socket.io des salles : room:create, room:join, room:leave, spectateurs et reconnexion
import { Server, Socket } from 'socket.io';
import { Chess } from 'chess.js';
import { activeSessions, ActiveGameSession } from './state.ts';
import { createRoomRecord, getRoomByCode, updateRoomRecord } from '../../db/queries.ts';
import { parseTimeControl } from '../routes/rooms.ts';

export function registerRoomHandlers(io: Server, socket: Socket) {
  // 1. Création d'une salle temps réel
  socket.on(
    'room:create',
    async (payload: {
      uid: string;
      username: string;
      countryCode: string;
      elo: number;
      emailVerified?: boolean;
      name?: string;
      timeControl?: string;
      category?: string;
      isPrivate?: boolean;
    }) => {
      try {
        if (payload.emailVerified === false) {
          socket.emit('room:error', {
            error: 'Veuillez vérifier votre adresse email avant de créer une salle en ligne.',
          });
          return;
        }

        const code = `ROOM-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const timeControl = payload.timeControl || '3+2';
        const category = payload.category || 'blitz';
        const { initialMs, incrementMs } = parseTimeControl(timeControl);

        const session: ActiveGameSession = {
          roomCode: code,
          name: payload.name || `Duel de ${payload.username}`,
          category,
          timeControl,
          isPrivate: Boolean(payload.isPrivate),
          chess: new Chess(),
          whitePlayer: {
            uid: payload.uid,
            username: payload.username,
            countryCode: payload.countryCode || 'FR',
            elo: payload.elo || 1200,
            socketId: socket.id,
          },
          spectators: new Set<string>(),
          whiteTimeMs: initialMs,
          blackTimeMs: initialMs,
          incrementMs,
          lastMoveTimestamp: Date.now(),
          moveTimingsMs: [],
          status: 'WAITING',
        };

        activeSessions.set(code, session);
        socket.join(code);

        await createRoomRecord({
          code,
          name: session.name,
          hostUid: payload.uid,
          hostUsername: payload.username,
          hostCountry: payload.countryCode || 'FR',
          hostElo: payload.elo || 1200,
          timeControl,
          category,
          isPrivate: Boolean(payload.isPrivate),
          whiteTimeMs: initialMs,
          blackTimeMs: initialMs,
          incrementMs,
        });

        socket.emit('room:created', {
          roomCode: code,
          name: session.name,
          fen: session.chess.fen(),
          pgn: session.chess.pgn(),
          status: session.status,
          whitePlayer: session.whitePlayer,
          blackPlayer: null,
          whiteTimeMs: session.whiteTimeMs,
          blackTimeMs: session.blackTimeMs,
          timeControl,
          category,
        });
      } catch (error) {
        console.error('Socket room:create error:', error);
      }
    }
  );

  // 2. Rejoindre une salle (en tant que second joueur ou spectateur, ou reconnexion automatique)
  socket.on(
    'room:join',
    async (payload: {
      roomCode: string;
      uid: string;
      username: string;
      countryCode: string;
      elo: number;
      asSpectator?: boolean;
    }) => {
      try {
        const code = String(payload.roomCode || '').toUpperCase();
        let session = activeSessions.get(code);

        // Si la salle est en base PostgreSQL mais pas encore en mémoire, on la restaure
        if (!session) {
          const dbRoom = await getRoomByCode(code);
          if (!dbRoom) {
            socket.emit('room:error', { error: 'Salle introuvable.' });
            return;
          }
          const chess = new Chess();
          if (dbRoom.pgn) {
            try {
              chess.loadPgn(dbRoom.pgn);
            } catch {
              chess.load(dbRoom.fen);
            }
          }
          session = {
            roomCode: code,
            name: dbRoom.name,
            category: dbRoom.category,
            timeControl: dbRoom.timeControl,
            isPrivate: dbRoom.isPrivate,
            chess,
            whitePlayer: {
              uid: dbRoom.hostUid,
              username: dbRoom.hostUsername,
              countryCode: dbRoom.hostCountry,
              elo: dbRoom.hostElo,
            },
            blackPlayer: dbRoom.guestUid
              ? {
                  uid: dbRoom.guestUid,
                  username: dbRoom.guestUsername || 'Adversaire',
                  countryCode: dbRoom.guestCountry || 'FR',
                  elo: dbRoom.guestElo || 1200,
                }
              : undefined,
            spectators: new Set<string>(),
            whiteTimeMs: dbRoom.whiteTimeMs,
            blackTimeMs: dbRoom.blackTimeMs,
            incrementMs: dbRoom.incrementMs,
            lastMoveTimestamp: Date.now(),
            moveTimingsMs: [],
            status: (dbRoom.status as 'WAITING' | 'PLAYING' | 'FINISHED') || 'WAITING',
          };
          activeSessions.set(code, session);
        }

        socket.join(code);

        // Reconnexion ou attribution du joueur Noir
        if (session.whitePlayer.uid === payload.uid) {
          session.whitePlayer.socketId = socket.id;
        } else if (session.blackPlayer && session.blackPlayer.uid === payload.uid) {
          session.blackPlayer.socketId = socket.id;
        } else if (!session.blackPlayer && !payload.asSpectator && session.status === 'WAITING') {
          session.blackPlayer = {
            uid: payload.uid,
            username: payload.username,
            countryCode: payload.countryCode || 'FR',
            elo: payload.elo || 1200,
            socketId: socket.id,
          };
          session.status = 'PLAYING';
          session.lastMoveTimestamp = Date.now();

          await updateRoomRecord(code, {
            guestUid: payload.uid,
            guestUsername: payload.username,
            guestCountry: payload.countryCode || 'FR',
            guestElo: payload.elo || 1200,
            status: 'PLAYING',
          });
        } else {
          session.spectators.add(payload.username || socket.id);
        }

        io.to(code).emit('room:joined', {
          roomCode: code,
          name: session.name,
          status: session.status,
          fen: session.chess.fen(),
          pgn: session.chess.pgn(),
          turn: session.chess.turn(),
          whitePlayer: session.whitePlayer,
          blackPlayer: session.blackPlayer || null,
          spectatorsCount: session.spectators.size,
          whiteTimeMs: session.whiteTimeMs,
          blackTimeMs: session.blackTimeMs,
          timeControl: session.timeControl,
          category: session.category,
        });
      } catch (error) {
        console.error('Socket room:join error:', error);
      }
    }
  );

  // 3. Quitter une salle
  socket.on('room:leave', (payload: { roomCode: string; username?: string }) => {
    const code = String(payload?.roomCode || '').toUpperCase();
    socket.leave(code);
    const session = activeSessions.get(code);
    if (session && payload?.username) {
      session.spectators.delete(payload.username);
      io.to(code).emit('game:update', {
        roomCode: code,
        fen: session.chess.fen(),
        pgn: session.chess.pgn(),
        turn: session.chess.turn(),
        whiteTimeMs: session.whiteTimeMs,
        blackTimeMs: session.blackTimeMs,
        spectatorsCount: session.spectators.size,
      });
    }
  });
}
