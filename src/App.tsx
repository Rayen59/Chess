/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// src/App.tsx
// Application principale ChessMaster Pro — Navigation Top Bar avec Flèche Retour permanente,
// Bouton Inscription haute visibilité et Barre d'onglets fixe en zone du pouce (Android/Mobile)
import React, { useEffect } from 'react';
import ReactCountryFlag from 'react-country-flag';
import {
  Play,
  LayoutGrid,
  Puzzle,
  Trophy,
  BarChart3,
  Users,
  LogOut,
  ArrowLeft,
  UserPlus,
  LogIn,
} from 'lucide-react';
import { useAppStore } from './store/useAppStore.ts';
import { useAuth } from './hooks/useAuth.ts';
import { Lobby } from './pages/Lobby.tsx';
import { Game } from './pages/Game.tsx';
import { Puzzles } from './pages/Puzzles.tsx';
import { Tournaments } from './pages/Tournaments.tsx';
import { Leaderboard } from './pages/Leaderboard.tsx';
import { Profile } from './pages/Profile.tsx';
import { Login } from './pages/Login.tsx';
import { Register } from './pages/Register.tsx';
import { SocialAndAdmin } from './pages/SocialAndAdmin.tsx';

export default function App() {
  const {
    user,
    activePage,
    lang,
    setActivePage,
    goBack,
    setLang,
    startGameWithConfig,
  } = useAppStore();
  const { handleLogout } = useAuth();

  // Détection d'un lien d'invitation partageable (?room=CODE) au chargement
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      startGameWithConfig({
        mode: 'online',
        roomCode: roomParam.toUpperCase(),
        timeControl: '3+2',
        category: 'blitz',
        playerColor: 'b',
      });
    }
  }, [startGameWithConfig]);

  const navItems = [
    { id: 'lobby' as const, fr: 'Salon', en: 'Lobby', icon: Play },
    { id: 'game' as const, fr: 'Échiquier', en: 'Board', icon: LayoutGrid },
    { id: 'puzzles' as const, fr: 'Puzzles', en: 'Puzzles', icon: Puzzle },
    { id: 'tournaments' as const, fr: 'Tournois', en: 'Arena', icon: Trophy },
    { id: 'leaderboard' as const, fr: 'Classement', en: 'Ratings', icon: BarChart3 },
    { id: 'social' as const, fr: 'Club & Arbitrage', en: 'Club', icon: Users },
  ];

  const mobileBottomTabs = [
    { id: 'lobby' as const, fr: 'Jouer', en: 'Play', icon: Play },
    { id: 'game' as const, fr: 'Match', en: 'Board', icon: LayoutGrid },
    { id: 'puzzles' as const, fr: 'Puzzles', en: 'Puzzles', icon: Puzzle },
    { id: 'tournaments' as const, fr: 'Tournois', en: 'Arena', icon: Trophy },
    { id: 'leaderboard' as const, fr: 'ELO & Club', en: 'Ratings', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#161512] text-[#F1F5F9] font-sans">
      {/* Top Bar : Zone 1 (Flèche Retour + Marque) — Zone 2 (Navigation Desktop) — Zone 3 (Actions & Inscription claire) */}
      <header className="sticky top-0 z-40 h-14 sm:h-15 flex items-center justify-between px-2.5 sm:px-8 bg-[#161512]/95 backdrop-blur-md border-b border-white/10">
        {/* Zone 1 : Flèche Retour universelle (dès qu'on n'est pas sur le Salon) + Titre de marque */}
        <div className="flex items-center gap-2 min-w-0">
          {activePage !== 'lobby' && (
            <button
              type="button"
              onClick={goBack}
              className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-[#23211D] hover:bg-white/10 border border-[#769656]/60 text-[#EEEED2] text-xs font-bold flex items-center gap-1 transition-colors shrink-0"
              title={lang === 'fr' ? 'Revenir en arrière' : 'Go back'}
              aria-label={lang === 'fr' ? 'Revenir en arrière' : 'Go back'}
            >
              <ArrowLeft className="w-4 h-4 text-[#95BB4A]" />
              <span className="hidden xs:inline">{lang === 'fr' ? 'Retour' : 'Back'}</span>
            </button>
          )}

          <a
            href="#lobby"
            onClick={(e) => {
              e.preventDefault();
              setActivePage('lobby');
            }}
            className="text-sm sm:text-lg font-bold tracking-tight text-[#EEEED2] whitespace-nowrap truncate"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            ChessMaster Pro
          </a>
        </div>

        {/* Zone 2 : Liens de navigation épurés sur Desktop */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActivePage(item.id)}
              className={`transition-colors whitespace-nowrap pb-0.5 ${
                activePage === item.id
                  ? 'text-[#769656] border-b-2 border-[#769656] font-semibold'
                  : 'hover:text-white'
              }`}
            >
              {lang === 'fr' ? item.fr : item.en}
            </button>
          ))}
        </nav>

        {/* Zone 3 : Actions principales (Club mobile + Langue + Connexion / Inscription ultra-lisible) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActivePage('social')}
            className={`md:hidden p-2 rounded-lg border text-xs transition-colors ${
              activePage === 'social' || activePage === 'admin'
                ? 'bg-[#769656] border-[#769656] text-white'
                : 'bg-[#23211D] border-white/10 text-slate-300'
            }`}
            title="Club & Amis"
            aria-label="Club & Amis"
          >
            <Users className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
            className="px-2 py-1.5 text-xs font-mono text-slate-300 hover:text-white bg-[#23211D] border border-white/10 rounded-lg transition-colors whitespace-nowrap"
          >
            {lang.toUpperCase()}
          </button>

          {user ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActivePage('profile', user.uid)}
                className="px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-white bg-[#23211D] hover:bg-white/10 border border-[#769656] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <ReactCountryFlag
                  countryCode={user.countryCode || 'FR'}
                  svg
                  style={{ width: '1.1em', height: '0.85em' }}
                />
                <span className="truncate max-w-[80px] sm:max-w-[120px]">{user.username}</span>
                <span className="font-mono text-[#EEEED2] tabular-nums hidden sm:inline">
                  {user.eloBlitz}
                </span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium text-slate-400 hover:text-white bg-[#23211D] sm:bg-transparent border border-white/10 sm:border-0 rounded-lg transition-colors whitespace-nowrap"
                title={lang === 'fr' ? 'Déconnexion' : 'Logout'}
              >
                <LogOut className="w-4 h-4 sm:hidden" />
                <span className="hidden sm:inline">
                  {lang === 'fr' ? 'Déconnexion' : 'Logout'}
                </span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setActivePage('login')}
                className="min-h-[36px] px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-slate-100 hover:text-white bg-[#23211D] hover:bg-white/10 border border-white/20 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5 text-[#95BB4A]" />
                <span>{lang === 'fr' ? 'Connexion' : 'Sign In'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePage('register')}
                className="min-h-[36px] px-3 sm:px-4 py-1.5 text-xs font-extrabold text-[#161512] bg-[#EEEED2] hover:bg-white border-2 border-[#769656] rounded-lg shadow-md transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5 text-[#769656] shrink-0" />
                <span>{lang === 'fr' ? 'S’inscrire' : 'Register'}</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Contenu principal */}
      <main className="flex-1">
        {activePage === 'lobby' && <Lobby />}
        {activePage === 'game' && <Game />}
        {activePage === 'puzzles' && <Puzzles />}
        {activePage === 'tournaments' && <Tournaments />}
        {activePage === 'leaderboard' && <Leaderboard />}
        {activePage === 'profile' && <Profile />}
        {activePage === 'login' && <Login />}
        {activePage === 'register' && <Register />}
        {activePage === 'social' && <SocialAndAdmin initialTab="social" />}
        {activePage === 'admin' && <SocialAndAdmin initialTab="admin" />}
      </main>

      {/* Barre de navigation inférieure fixe sur Android / Mobile (Ergonomie Zone du Pouce) */}
      <nav
        aria-label="Navigation mobile"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#161512]/95 backdrop-blur-md border-t border-white/10 grid grid-cols-5 items-center px-1"
      >
        {mobileBottomTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activePage === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActivePage(tab.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors ${
                isActive ? 'text-[#95BB4A] font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-[#769656]' : ''}`} />
              <span className="text-[10px] tracking-tight whitespace-nowrap">
                {lang === 'fr' ? tab.fr : tab.en}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Pied de page Desktop uniquement */}
      <footer className="hidden md:flex border-t border-white/10 py-5 px-6 text-xs text-slate-500 items-center justify-between gap-3">
        <span>© 2026 ChessMaster Pro · Plateforme Officielle d’Échecs Temps Réel & Coach IA</span>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActivePage('leaderboard')}
            className="hover:text-slate-300 transition-colors"
          >
            Classement FIDE
          </button>
          <button
            type="button"
            onClick={() => setActivePage('tournaments')}
            className="hover:text-slate-300 transition-colors"
          >
            Tournois Arena
          </button>
          <button
            type="button"
            onClick={() => setActivePage('admin')}
            className="hover:text-slate-300 transition-colors"
          >
            Arbitrage & Fair-Play
          </button>
        </div>
      </footer>
    </div>
  );
}
