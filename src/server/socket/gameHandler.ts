// src/server/socket/gameHandler.ts
// Gestionnaire Socket.io des coups d'échecs : Validation stricte chess.js côté serveur, anti-triche, abandon et nulle
import { Server, Socket } from 'socket.io';
import { activeSessions } from './state.ts';
import {
  addEloHistoryEntry,
  createGameRecord,
  getUserByUid,
  updateRoomRecord,
  updateUserProfile,
} from '../../db/queries.ts';
import { calculateFideElo, EloCategory } from '../services/elo.ts';
import { analyzeCompletedGame } from '../services/stockfish.ts';

export function registerGameHandlers(io: Server, socket: Socket) {
  // 1. Jouer un coup (Validation serveur obligatoire avec chess.js = anti-triche)
  socket.on(
    'game:move',
    async (payload: {
      roomCode: string;
      uid: string;
      from: string;
      to: string;
      promotion?: string;
    }) => {
      try {
        const code = String(payload.roomCode || '').toUpperCase();
        const session = activeSessions.get(code);
        if (!session || session.status !== 'PLAYING') return;

        const turn = session.chess.turn();
        const expectedUid =
          turn === 'w' ? session.whitePlayer.uid : session.blackPlayer?.uid;

        // Vérifier que c'est bien le tour du joueur émetteur
        if (expectedUid && payload.uid !== expectedUid) {
          socket.emit('game:error', { error: 'Ce n’est pas votre tour de jouer.' });
          return;
        }

        // Validation du coup par chess.js côté serveur
        const now = Date.now();
        const elapsedMs = Math.max(50, now - session.lastMoveTimestamp);

        let moveResult;
        try {
          moveResult = session.chess.move({
            from: payload.from,
            to: payload.to,
            promotion: payload.promotion || 'q',
          });
        } catch {
          socket.emit('game:error', { error: 'Coup illégal rejeté par le serveur.' });
          return;
        }

        if (!moveResult) {
          socket.emit('game:error', { error: 'Coup illégal rejeté par le serveur.' });
          return;
        }

        // Mise à jour des horloges avec incrément
        if (turn === 'w') {
          session.whiteTimeMs = Math.max(0, session.whiteTimeMs - elapsedMs + session.incrementMs);
        } else {
          session.blackTimeMs = Math.max(0, session.blackTimeMs - elapsedMs + session.incrementMs);
        }

        session.lastMoveTimestamp = now;
        session.moveTimingsMs.push(elapsedMs);
        session.drawOfferedBy = null;

        // Diffuser immédiatement la mise à jour aux joueurs et spectateurs
        io.to(code).emit('game:update', {
          roomCode: code,
          fen: session.chess.fen(),
          pgn: session.chess.pgn(),
          turn: session.chess.turn(),
          lastMove: {
            from: moveResult.from,
            to: moveResult.to,
            san: moveResult.san,
            color: moveResult.color,
          },
          whiteTimeMs: session.whiteTimeMs,
          blackTimeMs: session.blackTimeMs,
          spectatorsCount: session.spectators.size,
          isCheck: session.chess.inCheck(),
        });

        // Vérifier si la partie est terminée (Mat, Pat, Répétition, Règle des 50 coups, Matériel insuffisant)
        if (session.chess.isGameOver()) {
          let result: '1-0' | '0-1' | '1/2-1/2' = '1/2-1/2';
          let reason = 'draw';

          if (session.chess.isCheckmate()) {
            result = turn === 'w' ? '1-0' : '0-1';
            reason = 'checkmate';
          } else if (session.chess.isStalemate()) {
            reason = 'stalemate';
          } else if (session.chess.isThreefoldRepetition()) {
            reason = 'repetition';
          } else if (session.chess.isInsufficientMaterial()) {
            reason = 'insufficient';
          }

          await finalizeMultiplayerGame(io, code, result, reason);
        } else {
          await updateRoomRecord(code, {
            fen: session.chess.fen(),
            pgn: session.chess.pgn(),
            whiteTimeMs: session.whiteTimeMs,
            blackTimeMs: session.blackTimeMs,
          });
        }
      } catch (error) {
        console.error('Socket game:move error:', error);
      }
    }
  );

  // 2. Abandonner la partie (game:resign)
  socket.on('game:resign', async (payload: { roomCode: string; uid: string }) => {
    try {
      const code = String(payload.roomCode || '').toUpperCase();
      const session = activeSessions.get(code);
      if (!session || session.status === 'FINISHED') return;

      const isWhite = session.whitePlayer.uid === payload.uid;
      const result: '1-0' | '0-1' = isWhite ? '0-1' : '1-0';
      await finalizeMultiplayerGame(io, code, result, 'resignation');
    } catch (error) {
      console.error('Socket game:resign error:', error);
    }
  });

  // 3. Proposer ou accepter la nulle (game:offerDraw)
  socket.on(
    'game:offerDraw',
    async (payload: { roomCode: string; uid: string; accept?: boolean }) => {
      try {
        const code = String(payload.roomCode || '').toUpperCase();
        const session = activeSessions.get(code);
        if (!session || session.status !== 'PLAYING') return;

        const playerColor: 'w' | 'b' =
          session.whitePlayer.uid === payload.uid ? 'w' : 'b';

        if (payload.accept || (session.drawOfferedBy && session.drawOfferedBy !== playerColor)) {
          await finalizeMultiplayerGame(io, code, '1/2-1/2', 'draw');
        } else {
          session.drawOfferedBy = playerColor;
          io.to(code).emit('game:drawOffered', {
            roomCode: code,
            offeredBy: playerColor,
            username:
              playerColor === 'w'
                ? session.whitePlayer.username
                : session.blackPlayer?.username,
          });
        }
      } catch (error) {
        console.error('Socket game:offerDraw error:', error);
      }
    }
  );
}

// Fonction utilitaire pour clôturer une partie multijoueur et mettre à jour l'ELO en base PostgreSQL
async function finalizeMultiplayerGame(
  io: Server,
  roomCode: string,
  result: '1-0' | '0-1' | '1/2-1/2',
  reason: string
) {
  const session = activeSessions.get(roomCode);
  if (!session || session.status === 'FINISHED') return;

  session.status = 'FINISHED';

  const whiteEloBefore = session.whitePlayer.elo;
  const blackEloBefore = session.blackPlayer?.elo || 1200;

  const eloCalc = calculateFideElo(whiteEloBefore, blackEloBefore, result, 30, 30);
  const pgn = session.chess.pgn();
  const analysis = analyzeCompletedGame(pgn);

  // Détection anti-triche sur les temps de coup
  const avgTime =
    session.moveTimingsMs.length > 0
      ? session.moveTimingsMs.reduce((a, b) => a + b, 0) / session.moveTimingsMs.length
      : 2000;
  const suspiciousFlag = session.moveTimingsMs.length >= 12 && avgTime < 350;

  await createGameRecord({
    roomCode,
    whiteUid: session.whitePlayer.uid,
    blackUid: session.blackPlayer?.uid || 'guest',
    whiteUsername: session.whitePlayer.username,
    blackUsername: session.blackPlayer?.username || 'Invité',
    whiteCountry: session.whitePlayer.countryCode,
    blackCountry: session.blackPlayer?.countryCode || 'FR',
    whiteEloBefore,
    blackEloBefore,
    whiteEloAfter: eloCalc.whiteNewElo,
    blackEloAfter: eloCalc.blackNewElo,
    category: session.category,
    timeControl: session.timeControl,
    result,
    reason,
    pgn,
    finalFen: session.chess.fen(),
    movesCount: session.chess.history().length,
    whiteAccuracy: analysis.whiteAccuracy,
    blackAccuracy: analysis.blackAccuracy,
    suspiciousFlag,
    suspiciousReason: suspiciousFlag
      ? `Cadence robotique détectée (${Math.round(avgTime)}ms/coup).`
      : null,
  });

  await updateRoomRecord(roomCode, {
    status: 'FINISHED',
    fen: session.chess.fen(),
    pgn,
  });

  // Mettre à jour les profils des deux joueurs en base PostgreSQL
  const cat = (['bullet', 'blitz', 'rapid', 'classical'].includes(session.category)
    ? session.category
    : 'blitz') as EloCategory;

  for (const side of ['w', 'b'] as const) {
    const p = side === 'w' ? session.whitePlayer : session.blackPlayer;
    if (!p) continue;
    const dbUser = await getUserByUid(p.uid);
    if (!dbUser) continue;

    const newElo = side === 'w' ? eloCalc.whiteNewElo : eloCalc.blackNewElo;
    const delta = side === 'w' ? eloCalc.whiteDelta : eloCalc.blackDelta;
    const won = (side === 'w' && result === '1-0') || (side === 'b' && result === '0-1');
    const lost = (side === 'w' && result === '0-1') || (side === 'b' && result === '1-0');

    await updateUserProfile(dbUser.uid, {
      ...(cat === 'bullet' ? { eloBullet: newElo } : {}),
      ...(cat === 'blitz' ? { eloBlitz: newElo } : {}),
      ...(cat === 'rapid' ? { eloRapid: newElo } : {}),
      ...(cat === 'classical' ? { eloClassical: newElo } : {}),
      gamesPlayed: dbUser.gamesPlayed + 1,
      wins: won ? dbUser.wins + 1 : dbUser.wins,
      losses: lost ? dbUser.losses + 1 : dbUser.losses,
      draws: result === '1/2-1/2' ? dbUser.draws + 1 : dbUser.draws,
    });

    await addEloHistoryEntry({
      userId: dbUser.id,
      userUid: dbUser.uid,
      category: cat,
      elo: newElo,
      delta,
    });
  }

  io.to(roomCode).emit('game:over', {
    roomCode,
    result,
    reason,
    pgn,
    finalFen: session.chess.fen(),
    whiteEloNew: eloCalc.whiteNewElo,
    blackEloNew: eloCalc.blackNewElo,
    whiteDelta: eloCalc.whiteDelta,
    blackDelta: eloCalc.blackDelta,
    analysis,
  });
}
