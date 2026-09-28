// src/db/queries.ts
// Couche d'accès aux données PostgreSQL via Drizzle ORM (avec gestion d'erreur sécurisée à 2 niveaux)
import { desc, eq, and, or, asc } from 'drizzle-orm';
import { db } from './index.ts';
import {
  users,
  eloHistory,
  rooms,
  games,
  moves,
  friends,
  messages,
  tournaments,
  puzzles,
  notifications,
  moderationReports,
} from './schema.ts';

// Récupérer un utilisateur par son UID
export async function getUserByUid(uid: string) {
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid));
    return rows[0] || null;
  } catch (error) {
    console.error('Database query getUserByUid failed:', error);
    throw new Error('Impossible de récupérer le profil utilisateur.', { cause: error });
  }
}

// Récupérer un utilisateur par son email
export async function getUserByEmail(email: string) {
  try {
    const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return rows[0] || null;
  } catch (error) {
    console.error('Database query getUserByEmail failed:', error);
    throw new Error('Impossible de vérifier l’adresse email.', { cause: error });
  }
}

// Récupérer un utilisateur par son pseudo (vérification d'unicité temps réel)
export async function getUserByUsername(username: string) {
  try {
    const rows = await db.select().from(users).where(eq(users.username, username));
    return rows[0] || null;
  } catch (error) {
    console.error('Database query getUserByUsername failed:', error);
    throw new Error('Impossible de vérifier la disponibilité du pseudo.', { cause: error });
  }
}

// Créer ou mettre à jour un utilisateur (Upsert sécurisé contre les accès concurrents)
export async function upsertUser(data: {
  uid: string;
  email: string;
  username: string;
  passwordHash?: string | null;
  countryCode: string;
  countryName: string;
  avatarUrl?: string;
  bio?: string;
  estimatedLevel: string;
  emailVerified: boolean;
  verificationCode?: string | null;
  initialElo?: number;
}) {
  try {
    const elo = data.initialElo ?? 1200;
    const result = await db
      .insert(users)
      .values({
        uid: data.uid,
        email: data.email.toLowerCase(),
        username: data.username,
        passwordHash: data.passwordHash ?? null,
        countryCode: data.countryCode,
        countryName: data.countryName,
        avatarUrl: data.avatarUrl ?? '',
        bio: data.bio ?? 'Passionné d’échecs sur ChessMaster Pro.',
        estimatedLevel: data.estimatedLevel,
        emailVerified: data.emailVerified,
        verificationCode: data.verificationCode ?? null,
        eloBullet: elo,
        eloBlitz: elo,
        eloRapid: elo,
        eloClassical: elo,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: data.email.toLowerCase(),
          countryCode: data.countryCode,
          countryName: data.countryName,
        },
      })
      .returning();

    const createdUser = result[0];
    if (createdUser) {
      // Ajouter un point initial dans l'historique ELO
      await db.insert(eloHistory).values({
        userId: createdUser.id,
        userUid: createdUser.uid,
        category: 'blitz',
        elo: createdUser.eloBlitz,
        delta: 0,
      });
    }
    return createdUser;
  } catch (error) {
    console.error('Database query upsertUser failed:', error);
    throw new Error('Erreur lors de la création du compte joueur.', { cause: error });
  }
}

// Mettre à jour les informations du profil joueur
export async function updateUserProfile(
  uid: string,
  updates: Partial<{
    username: string;
    countryCode: string;
    countryName: string;
    bio: string;
    avatarUrl: string;
    emailVerified: boolean;
    verificationCode: string | null;
    eloBullet: number;
    eloBlitz: number;
    eloRapid: number;
    eloClassical: number;
    gamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    puzzleRating: number;
    puzzlesSolved: number;
    puzzleStreak: number;
    isBanned: boolean;
    isMuted: boolean;
    role: string;
  }>
) {
  try {
    const result = await db.update(users).set(updates).where(eq(users.uid, uid)).returning();
    return result[0] || null;
  } catch (error) {
    console.error('Database query updateUserProfile failed:', error);
    throw new Error('Impossible de mettre à jour le profil.', { cause: error });
  }
}

// Enregistrer une variation ELO dans l'historique
export async function addEloHistoryEntry(params: {
  userId: number;
  userUid: string;
  category: string;
  elo: number;
  delta: number;
}) {
  try {
    const result = await db.insert(eloHistory).values(params).returning();
    return result[0];
  } catch (error) {
    console.error('Database query addEloHistoryEntry failed:', error);
    throw new Error('Impossible d’enregistrer l’historique ELO.', { cause: error });
  }
}

// Récupérer l'historique ELO d'un joueur
export async function getEloHistoryByUid(userUid: string) {
  try {
    return await db
      .select()
      .from(eloHistory)
      .where(eq(eloHistory.userUid, userUid))
      .orderBy(asc(eloHistory.recordedAt));
  } catch (error) {
    console.error('Database query getEloHistoryByUid failed:', error);
    throw new Error('Impossible de charger l’historique ELO.', { cause: error });
  }
}

// Récupérer le classement (Leaderboard) mondial ou par pays
export async function getLeaderboardUsers(countryCode?: string) {
  try {
    if (countryCode && countryCode !== 'ALL') {
      return await db
        .select()
        .from(users)
        .where(eq(users.countryCode, countryCode))
        .orderBy(desc(users.eloBlitz));
    }
    return await db.select().from(users).orderBy(desc(users.eloBlitz));
  } catch (error) {
    console.error('Database query getLeaderboardUsers failed:', error);
    throw new Error('Impossible de charger le classement.', { cause: error });
  }
}

// Salles de jeu (Rooms)
export async function listActiveRooms() {
  try {
    return await db.select().from(rooms).orderBy(desc(rooms.createdAt));
  } catch (error) {
    console.error('Database query listActiveRooms failed:', error);
    throw new Error('Impossible de lister les salles de jeu.', { cause: error });
  }
}

export async function getRoomByCode(code: string) {
  try {
    const rows = await db.select().from(rooms).where(eq(rooms.code, code));
    return rows[0] || null;
  } catch (error) {
    console.error('Database query getRoomByCode failed:', error);
    throw new Error('Impossible de trouver la salle.', { cause: error });
  }
}

export async function createRoomRecord(data: {
  code: string;
  name: string;
  hostUid: string;
  hostUsername: string;
  hostCountry: string;
  hostElo: number;
  timeControl: string;
  category: string;
  isPrivate: boolean;
  passwordHash?: string | null;
  whiteTimeMs: number;
  blackTimeMs: number;
  incrementMs: number;
}) {
  try {
    const result = await db
      .insert(rooms)
      .values({
        code: data.code,
        name: data.name,
        hostUid: data.hostUid,
        hostUsername: data.hostUsername,
        hostCountry: data.hostCountry,
        hostElo: data.hostElo,
        timeControl: data.timeControl,
        category: data.category,
        isPrivate: data.isPrivate,
        passwordHash: data.passwordHash ?? null,
        whiteTimeMs: data.whiteTimeMs,
        blackTimeMs: data.blackTimeMs,
        incrementMs: data.incrementMs,
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query createRoomRecord failed:', error);
    throw new Error('Impossible de créer la salle.', { cause: error });
  }
}

export async function updateRoomRecord(
  code: string,
  updates: Partial<{
    guestUid: string | null;
    guestUsername: string | null;
    guestCountry: string | null;
    guestElo: number | null;
    status: string;
    fen: string;
    pgn: string;
    whiteTimeMs: number;
    blackTimeMs: number;
  }>
) {
  try {
    const result = await db.update(rooms).set(updates).where(eq(rooms.code, code)).returning();
    return result[0] || null;
  } catch (error) {
    console.error('Database query updateRoomRecord failed:', error);
    throw new Error('Impossible de mettre à jour la salle.', { cause: error });
  }
}

// Parties (Games) & Coups (Moves)
export async function createGameRecord(data: {
  roomCode?: string;
  whiteUid: string;
  blackUid: string;
  whiteUsername: string;
  blackUsername: string;
  whiteCountry: string;
  blackCountry: string;
  whiteEloBefore: number;
  blackEloBefore: number;
  whiteEloAfter: number;
  blackEloAfter: number;
  category: string;
  timeControl: string;
  result: string;
  reason: string;
  pgn: string;
  finalFen: string;
  movesCount: number;
  whiteAccuracy?: number;
  blackAccuracy?: number;
  suspiciousFlag?: boolean;
  suspiciousReason?: string | null;
}) {
  try {
    const result = await db
      .insert(games)
      .values({
        roomCode: data.roomCode ?? null,
        whiteUid: data.whiteUid,
        blackUid: data.blackUid,
        whiteUsername: data.whiteUsername,
        blackUsername: data.blackUsername,
        whiteCountry: data.whiteCountry,
        blackCountry: data.blackCountry,
        whiteEloBefore: data.whiteEloBefore,
        blackEloBefore: data.blackEloBefore,
        whiteEloAfter: data.whiteEloAfter,
        blackEloAfter: data.blackEloAfter,
        category: data.category,
        timeControl: data.timeControl,
        result: data.result,
        reason: data.reason,
        pgn: data.pgn,
        finalFen: data.finalFen,
        movesCount: data.movesCount,
        whiteAccuracy: data.whiteAccuracy ?? 89,
        blackAccuracy: data.blackAccuracy ?? 86,
        suspiciousFlag: data.suspiciousFlag ?? false,
        suspiciousReason: data.suspiciousReason ?? null,
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query createGameRecord failed:', error);
    throw new Error('Impossible d’enregistrer la partie.', { cause: error });
  }
}

export async function listRecentGames(userUid?: string) {
  try {
    if (userUid) {
      return await db
        .select()
        .from(games)
        .where(or(eq(games.whiteUid, userUid), eq(games.blackUid, userUid)))
        .orderBy(desc(games.createdAt));
    }
    return await db.select().from(games).orderBy(desc(games.createdAt));
  } catch (error) {
    console.error('Database query listRecentGames failed:', error);
    throw new Error('Impossible de charger l’historique des parties.', { cause: error });
  }
}

export async function recordGameMove(data: {
  gameId: number;
  moveNumber: number;
  color: string;
  san: string;
  fromSquare: string;
  toSquare: string;
  fenAfter: string;
  timeSpentMs: number;
  evaluationCp?: number;
  classification?: string;
}) {
  try {
    const result = await db.insert(moves).values(data).returning();
    return result[0];
  } catch (error) {
    console.error('Database query recordGameMove failed:', error);
    throw new Error('Impossible d’enregistrer le coup.', { cause: error });
  }
}

// Amis (Friends)
export async function getUserFriends(userUid: string) {
  try {
    return await db
      .select()
      .from(friends)
      .where(or(eq(friends.requesterUid, userUid), eq(friends.addresseeUid, userUid)))
      .orderBy(desc(friends.createdAt));
  } catch (error) {
    console.error('Database query getUserFriends failed:', error);
    throw new Error('Impossible de charger la liste d’amis.', { cause: error });
  }
}

export async function createFriendRequest(data: {
  requesterUid: string;
  requesterUsername: string;
  requesterCountry: string;
  addresseeUid: string;
  addresseeUsername: string;
  addresseeCountry: string;
}) {
  try {
    const result = await db.insert(friends).values(data).returning();
    return result[0];
  } catch (error) {
    console.error('Database query createFriendRequest failed:', error);
    throw new Error('Impossible d’envoyer la demande d’ami.', { cause: error });
  }
}

export async function updateFriendStatus(id: number, status: string) {
  try {
    const result = await db.update(friends).set({ status }).where(eq(friends.id, id)).returning();
    return result[0] || null;
  } catch (error) {
    console.error('Database query updateFriendStatus failed:', error);
    throw new Error('Impossible de modifier le statut d’amitié.', { cause: error });
  }
}

// Messages Chat
export async function getChannelMessages(channel: string) {
  try {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.channel, channel))
      .orderBy(asc(messages.createdAt));
  } catch (error) {
    console.error('Database query getChannelMessages failed:', error);
    throw new Error('Impossible de récupérer les messages.', { cause: error });
  }
}

export async function createMessageRecord(data: {
  senderUid: string;
  senderUsername: string;
  senderCountry: string;
  recipientUid?: string | null;
  channel: string;
  content: string;
}) {
  try {
    const result = await db
      .insert(messages)
      .values({
        senderUid: data.senderUid,
        senderUsername: data.senderUsername,
        senderCountry: data.senderCountry,
        recipientUid: data.recipientUid ?? null,
        channel: data.channel,
        content: data.content,
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query createMessageRecord failed:', error);
    throw new Error('Impossible d’envoyer le message.', { cause: error });
  }
}

// Tournois
export async function listTournaments() {
  try {
    return await db.select().from(tournaments).orderBy(desc(tournaments.createdAt));
  } catch (error) {
    console.error('Database query listTournaments failed:', error);
    throw new Error('Impossible de charger les tournois.', { cause: error });
  }
}

export async function createTournamentRecord(data: {
  name: string;
  format: string;
  category: string;
  timeControl: string;
  minElo: number;
  maxElo: number;
  maxPlayers: number;
  creatorUid: string;
  creatorUsername: string;
  participantsJson: string;
  pairingsJson: string;
}) {
  try {
    const result = await db.insert(tournaments).values(data).returning();
    return result[0];
  } catch (error) {
    console.error('Database query createTournamentRecord failed:', error);
    throw new Error('Impossible de créer le tournoi.', { cause: error });
  }
}

export async function updateTournamentRecord(
  id: number,
  updates: Partial<{
    status: string;
    participantsJson: string;
    pairingsJson: string;
  }>
) {
  try {
    const result = await db
      .update(tournaments)
      .set(updates)
      .where(eq(tournaments.id, id))
      .returning();
    return result[0] || null;
  } catch (error) {
    console.error('Database query updateTournamentRecord failed:', error);
    throw new Error('Impossible de mettre à jour le tournoi.', { cause: error });
  }
}

// Puzzles
export async function listPuzzles() {
  try {
    return await db.select().from(puzzles).orderBy(asc(puzzles.id));
  } catch (error) {
    console.error('Database query listPuzzles failed:', error);
    throw new Error('Impossible de charger les puzzles.', { cause: error });
  }
}

// Notifications
export async function listUserNotifications(userUid: string) {
  try {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userUid, userUid))
      .orderBy(desc(notifications.createdAt));
  } catch (error) {
    console.error('Database query listUserNotifications failed:', error);
    throw new Error('Impossible de charger les notifications.', { cause: error });
  }
}

export async function createNotificationRecord(data: {
  userUid: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}) {
  try {
    const result = await db.insert(notifications).values(data).returning();
    return result[0];
  } catch (error) {
    console.error('Database query createNotificationRecord failed:', error);
    throw new Error('Impossible de créer la notification.', { cause: error });
  }
}

// Rapports de modération (Admin)
export async function listModerationReports() {
  try {
    return await db.select().from(moderationReports).orderBy(desc(moderationReports.createdAt));
  } catch (error) {
    console.error('Database query listModerationReports failed:', error);
    throw new Error('Impossible de charger les signalements.', { cause: error });
  }
}

export async function createModerationReport(data: {
  reporterUid: string;
  reporterUsername: string;
  reportedUid: string;
  reportedUsername: string;
  reason: string;
  gameId?: number;
}) {
  try {
    const result = await db.insert(moderationReports).values(data).returning();
    return result[0];
  } catch (error) {
    console.error('Database query createModerationReport failed:', error);
    throw new Error('Impossible d’enregistrer le signalement.', { cause: error });
  }
}

export async function updateModerationReportStatus(id: number, status: string) {
  try {
    const result = await db
      .update(moderationReports)
      .set({ status })
      .where(eq(moderationReports.id, id))
      .returning();
    return result[0] || null;
  } catch (error) {
    console.error('Database query updateModerationReportStatus failed:', error);
    throw new Error('Impossible de mettre à jour le signalement.', { cause: error });
  }
}
