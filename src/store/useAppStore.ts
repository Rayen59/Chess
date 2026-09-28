// src/store/useAppStore.ts
// Store global Zustand : Authentification en mémoire, Historique de navigation (Flèche Retour),
// Thèmes d'échiquier, Styles de pièces, i18n FR/EN & Configuration avancée de puissance IA
import { create } from 'zustand';
import { setAuthToken } from '../lib/api.ts';
import { chessSounds } from '../lib/sound.ts';
import { AiPlayStyle, BotEloLevel } from '../lib/stockfish.worker.ts';

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  username: string;
  countryCode: string;
  countryName: string;
  avatarUrl?: string;
  bio: string;
  estimatedLevel: string;
  emailVerified: boolean;
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
  role: string;
  isBanned: boolean;
  isMuted: boolean;
}

export type AppPage =
  | 'lobby'
  | 'game'
  | 'puzzles'
  | 'tournaments'
  | 'leaderboard'
  | 'social'
  | 'profile'
  | 'admin'
  | 'login'
  | 'register';

export type BoardThemeKey = 'emerald' | 'wood' | 'classic' | 'midnight';
export type PieceStyleKey = 'staunton' | 'neo' | 'tournament' | 'classic' | 'minimal';

export interface GameLaunchConfig {
  mode: 'bot' | 'online' | 'local';
  timeControl: string;
  category: 'bullet' | 'blitz' | 'rapid' | 'classical' | 'correspondence' | 'custom';
  botLevel: BotEloLevel; // 400 à 3000 ELO
  botStyle?: AiPlayStyle; // balanced | aggressive | solid | tactical
  botDepth?: number; // 1 à 3
  playerColor: 'w' | 'b';
  roomCode?: string;
  asSpectator?: boolean;
}

interface AppState {
  user: UserProfile | null;
  token: string | null;
  verificationPreviewCode: string | null;
  activePage: AppPage;
  pageHistory: AppPage[];
  viewedProfileUid: string | null;
  lang: 'fr' | 'en';
  boardTheme: BoardThemeKey;
  pieceStyle: PieceStyleKey;
  soundEnabled: boolean;
  gameConfig: GameLaunchConfig;
  notificationsCount: number;

  setSession: (user: UserProfile | null, token: string | null, previewCode?: string | null) => void;
  updateUser: (user: UserProfile) => void;
  logout: () => void;
  setActivePage: (page: AppPage, profileUid?: string | null) => void;
  goBack: () => void;
  setLang: (lang: 'fr' | 'en') => void;
  setBoardTheme: (theme: BoardThemeKey) => void;
  setPieceStyle: (style: PieceStyleKey) => void;
  toggleSound: () => void;
  startGameWithConfig: (config: Partial<GameLaunchConfig>) => void;
  updateGameConfig: (config: Partial<GameLaunchConfig>) => void;
  setNotificationsCount: (count: number) => void;
}

export const BOARD_THEMES: Record<
  BoardThemeKey,
  { name: string; darkSquare: string; lightSquare: string }
> = {
  emerald: {
    name: 'Émeraude Tournoi (#769656)',
    darkSquare: '#769656',
    lightSquare: '#EEEED2',
  },
  wood: {
    name: 'Noyer & Buis Royal',
    darkSquare: '#B58863',
    lightSquare: '#F0D9B5',
  },
  classic: {
    name: 'Ardoise FIDE',
    darkSquare: '#4B7399',
    lightSquare: '#EAE9D2',
  },
  midnight: {
    name: 'Obsidienne Nocturne',
    darkSquare: '#334155',
    lightSquare: '#94A3B8',
  },
};

export const useAppStore = create<AppState>((set) => ({
  user: null,
  token: null,
  verificationPreviewCode: null,
  activePage: 'lobby',
  pageHistory: [],
  viewedProfileUid: null,
  lang: 'fr',
  boardTheme: 'emerald',
  pieceStyle: 'staunton',
  soundEnabled: true,
  notificationsCount: 0,
  gameConfig: {
    mode: 'bot',
    timeControl: '3+2',
    category: 'blitz',
    botLevel: 1600,
    botStyle: 'balanced',
    botDepth: 2,
    playerColor: 'w',
  },

  setSession: (user, token, previewCode = null) => {
    setAuthToken(token);
    set({
      user,
      token,
      verificationPreviewCode: previewCode ?? null,
    });
  },

  updateUser: (user) => set({ user }),

  logout: () => {
    setAuthToken(null);
    set({
      user: null,
      token: null,
      verificationPreviewCode: null,
      activePage: 'lobby',
      pageHistory: [],
    });
  },

  setActivePage: (page, profileUid = null) =>
    set((state) => {
      if (state.activePage === page && profileUid === null) {
        return state;
      }
      const nextHistory = [...state.pageHistory, state.activePage].slice(-12);
      return {
        activePage: page,
        pageHistory: nextHistory,
        viewedProfileUid: profileUid !== undefined ? profileUid : state.viewedProfileUid,
      };
    }),

  goBack: () =>
    set((state) => {
      if (state.pageHistory.length === 0) {
        return { activePage: 'lobby' };
      }
      const nextHistory = [...state.pageHistory];
      const previousPage = nextHistory.pop() || 'lobby';
      return {
        activePage: previousPage,
        pageHistory: nextHistory,
      };
    }),

  setLang: (lang) => set({ lang }),

  setBoardTheme: (boardTheme) => set({ boardTheme }),

  setPieceStyle: (pieceStyle) => set({ pieceStyle }),

  toggleSound: () =>
    set((state) => {
      const next = !state.soundEnabled;
      chessSounds.enabled = next;
      return { soundEnabled: next };
    }),

  startGameWithConfig: (partial) =>
    set((state) => ({
      gameConfig: { ...state.gameConfig, ...partial },
      pageHistory:
        state.activePage !== 'game'
          ? [...state.pageHistory, state.activePage].slice(-12)
          : state.pageHistory,
      activePage: 'game',
    })),

  updateGameConfig: (partial) =>
    set((state) => ({
      gameConfig: { ...state.gameConfig, ...partial },
    })),

  setNotificationsCount: (notificationsCount) => set({ notificationsCount }),
}));
