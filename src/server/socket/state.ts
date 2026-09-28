// src/server/socket/state.ts
// État serveur faisant foi (Server-Authoritative State) pour les parties en direct et la file de matchmaking
import { Chess } from 'chess.js';

export interface ActiveGameSession {
  roomCode: string;
  name: string;
  category: string;
  timeControl: string;
  isPrivate: boolean;
  chess: Chess;
  whitePlayer: {
    uid: string;
    username: string;
    countryCode: string;
    elo: number;
    socketId?: string;
  };
  blackPlayer?: {
    uid: string;
    username: string;
    countryCode: string;
    elo: number;
    socketId?: string;
  };
  spectators: Set<string>;
  whiteTimeMs: number;
  blackTimeMs: number;
  incrementMs: number;
  lastMoveTimestamp: number;
  moveTimingsMs: number[];
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  drawOfferedBy?: 'w' | 'b' | null;
}

export interface MatchmakingQueueEntry {
  socketId: string;
  uid: string;
  username: string;
  countryCode: string;
  elo: number;
  category: string;
  timeControl: string;
  joinedAt: number;
}

// Stockage en mémoire rapide synchronisé avec PostgreSQL (équivalent Redis state store)
export const activeSessions = new Map<string, ActiveGameSession>();
export const matchmakingQueue: MatchmakingQueueEntry[] = [];
