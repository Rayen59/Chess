// src/db/schema.ts
// Schéma complet PostgreSQL (Drizzle ORM) pour ChessMaster Pro
import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// 1. Table des Utilisateurs (Joueurs & Administrateurs)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Identifiant unique Firebase Auth ou JWT
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash'),
  countryCode: text('country_code').notNull().default('FR'),
  countryName: text('country_name').notNull().default('France'),
  avatarUrl: text('avatar_url').default(''),
  bio: text('bio').notNull().default('Passionné d’échecs sur ChessMaster Pro.'),
  estimatedLevel: text('estimated_level').notNull().default('Intermédiaire (1200)'),
  emailVerified: boolean('email_verified').notNull().default(false),
  verificationCode: text('verification_code'),
  eloBullet: integer('elo_bullet').notNull().default(1200),
  eloBlitz: integer('elo_blitz').notNull().default(1200),
  eloRapid: integer('elo_rapid').notNull().default(1200),
  eloClassical: integer('elo_classical').notNull().default(1200),
  gamesPlayed: integer('games_played').notNull().default(0),
  wins: integer('wins').notNull().default(0),
  losses: integer('losses').notNull().default(0),
  draws: integer('draws').notNull().default(0),
  puzzleRating: integer('puzzle_rating').notNull().default(1200),
  puzzlesSolved: integer('puzzles_solved').notNull().default(0),
  puzzleStreak: integer('puzzle_streak').notNull().default(0),
  role: text('role').notNull().default('USER'), // 'USER' | 'ADMIN' | 'MODERATOR'
  isBanned: boolean('is_banned').notNull().default(false),
  isMuted: boolean('is_muted').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Historique de progression ELO par catégorie
export const eloHistory = pgTable('elo_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  userUid: text('user_uid').notNull(),
  category: text('category').notNull(), // 'bullet' | 'blitz' | 'rapid' | 'classical'
  elo: integer('elo').notNull(),
  delta: integer('delta').notNull().default(0),
  recordedAt: timestamp('recorded_at').defaultNow(),
});

// 3. Salles de jeu multijoueur (Rooms)
export const rooms = pgTable('rooms', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  hostUid: text('host_uid').notNull(),
  hostUsername: text('host_username').notNull(),
  hostCountry: text('host_country').notNull().default('FR'),
  hostElo: integer('host_elo').notNull().default(1200),
  guestUid: text('guest_uid'),
  guestUsername: text('guest_username'),
  guestCountry: text('guest_country'),
  guestElo: integer('guest_elo'),
  timeControl: text('time_control').notNull().default('10+0'),
  category: text('category').notNull().default('rapid'),
  isPrivate: boolean('is_private').notNull().default(false),
  passwordHash: text('password_hash'),
  status: text('status').notNull().default('WAITING'), // 'WAITING' | 'PLAYING' | 'FINISHED'
  fen: text('fen').notNull().default('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
  pgn: text('pgn').notNull().default(''),
  whiteTimeMs: integer('white_time_ms').notNull().default(600000),
  blackTimeMs: integer('black_time_ms').notNull().default(600000),
  incrementMs: integer('increment_ms').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// 4. Parties d'échecs enregistrées (Games)
export const games = pgTable('games', {
  id: serial('id').primaryKey(),
  roomCode: text('room_code'),
  whiteUid: text('white_uid').notNull(),
  blackUid: text('black_uid').notNull(),
  whiteUsername: text('white_username').notNull(),
  blackUsername: text('black_username').notNull(),
  whiteCountry: text('white_country').notNull().default('FR'),
  blackCountry: text('black_country').notNull().default('FR'),
  whiteEloBefore: integer('white_elo_before').notNull().default(1200),
  blackEloBefore: integer('black_elo_before').notNull().default(1200),
  whiteEloAfter: integer('white_elo_after').notNull().default(1200),
  blackEloAfter: integer('black_elo_after').notNull().default(1200),
  category: text('category').notNull().default('rapid'),
  timeControl: text('time_control').notNull().default('10+0'),
  result: text('result').notNull().default('*'), // '1-0' | '0-1' | '1/2-1/2' | '*'
  reason: text('reason').notNull().default('in_progress'),
  pgn: text('pgn').notNull().default(''),
  finalFen: text('final_fen').notNull(),
  movesCount: integer('moves_count').notNull().default(0),
  whiteAccuracy: integer('white_accuracy').default(88),
  blackAccuracy: integer('black_accuracy').default(85),
  suspiciousFlag: boolean('suspicious_flag').notNull().default(false),
  suspiciousReason: text('suspicious_reason'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 5. Coups joués par partie (Moves)
export const moves = pgTable('moves', {
  id: serial('id').primaryKey(),
  gameId: integer('game_id')
    .references(() => games.id)
    .notNull(),
  moveNumber: integer('move_number').notNull(),
  color: text('color').notNull(), // 'w' | 'b'
  san: text('san').notNull(),
  fromSquare: text('from_square').notNull(),
  toSquare: text('to_square').notNull(),
  fenAfter: text('fen_after').notNull(),
  timeSpentMs: integer('time_spent_ms').notNull().default(0),
  evaluationCp: integer('evaluation_cp').default(0),
  classification: text('classification').default('good'), // 'brilliant' | 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'
  createdAt: timestamp('created_at').defaultNow(),
});

// 6. Relations Sociales / Amis (Friends)
export const friends = pgTable('friends', {
  id: serial('id').primaryKey(),
  requesterUid: text('requester_uid').notNull(),
  requesterUsername: text('requester_username').notNull(),
  requesterCountry: text('requester_country').notNull().default('FR'),
  addresseeUid: text('addressee_uid').notNull(),
  addresseeUsername: text('addressee_username').notNull(),
  addresseeCountry: text('addressee_country').notNull().default('FR'),
  status: text('status').notNull().default('PENDING'), // 'PENDING' | 'ACCEPTED' | 'BLOCKED'
  createdAt: timestamp('created_at').defaultNow(),
});

// 7. Messages Chat & Messagerie Privée
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  senderUid: text('sender_uid').notNull(),
  senderUsername: text('sender_username').notNull(),
  senderCountry: text('sender_country').notNull().default('FR'),
  recipientUid: text('recipient_uid'),
  channel: text('channel').notNull().default('global'), // 'global' | 'country:FR' | 'room:CODE' | 'dm'
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 8. Tournois (Arena, Suisse, Round-Robin, Élimination)
export const tournaments = pgTable('tournaments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  format: text('format').notNull().default('ARENA'), // 'ARENA' | 'SWISS' | 'ROUND_ROBIN' | 'KNOCKOUT'
  category: text('category').notNull().default('blitz'),
  timeControl: text('time_control').notNull().default('3+2'),
  minElo: integer('min_elo').notNull().default(800),
  maxElo: integer('max_elo').notNull().default(2800),
  maxPlayers: integer('max_players').notNull().default(16),
  status: text('status').notNull().default('ACTIVE'), // 'UPCOMING' | 'ACTIVE' | 'COMPLETED'
  creatorUid: text('creator_uid').notNull(),
  creatorUsername: text('creator_username').notNull(),
  participantsJson: text('participants_json').notNull().default('[]'),
  pairingsJson: text('pairings_json').notNull().default('[]'),
  startsAt: timestamp('starts_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 9. Puzzles Tactiques & Puzzle Quotidien
export const puzzles = pgTable('puzzles', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  fen: text('fen').notNull(),
  solutionMoves: text('solution_moves').notNull(), // ex: "Dxh7+ Rxh7 Th5#" ou SAN séparés par espace
  theme: text('theme').notNull(), // 'Mat en 1' | 'Mat en 2' | 'Mat en 3' | 'Fourchette Royale' | 'Sacrifice de Dame'
  difficultyElo: integer('difficulty_elo').notNull().default(1400),
  isDaily: boolean('is_daily').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// 10. Notifications Temps Réel
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  type: text('type').notNull(), // 'FRIEND_REQUEST' | 'GAME_CHALLENGE' | 'TOURNAMENT_START' | 'SYSTEM'
  title: text('title').notNull(),
  body: text('body').notNull(),
  link: text('link'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// 11. Signalements & Logs de Modération (Admin)
export const moderationReports = pgTable('moderation_reports', {
  id: serial('id').primaryKey(),
  reporterUid: text('reporter_uid').notNull(),
  reporterUsername: text('reporter_username').notNull(),
  reportedUid: text('reported_uid').notNull(),
  reportedUsername: text('reported_username').notNull(),
  reason: text('reason').notNull(),
  gameId: integer('game_id'),
  status: text('status').notNull().default('OPEN'), // 'OPEN' | 'RESOLVED' | 'DISMISSED'
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations Drizzle
export const usersRelations = relations(users, ({ many }) => ({
  eloHistory: many(eloHistory),
}));

export const eloHistoryRelations = relations(eloHistory, ({ one }) => ({
  user: one(users, {
    fields: [eloHistory.userId],
    references: [users.id],
  }),
}));

export const gamesRelations = relations(games, ({ many }) => ({
  moves: many(moves),
}));

export const movesRelations = relations(moves, ({ one }) => ({
  game: one(games, {
    fields: [moves.gameId],
    references: [games.id],
  }),
}));
