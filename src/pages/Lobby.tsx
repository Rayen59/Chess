// src/pages/Lobby.tsx
// Salon principal (Lobby) — Ergonomie Android & Desktop :
// Bannière d'Inscription claire, Lancement Rapide en 1 clic, 8 Niveaux d'IA + Curseur de Puissance libre (400 à 3000 ELO) + Styles IA
import React, { useEffect, useState } from 'react';
import ReactCountryFlag from 'react-country-flag';
import {
  Play,
  Cpu,
  Users,
  Lock,
  Plus,
  Eye,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Zap,
  UserPlus,
  LogIn,
  Sliders,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore.ts';
import { useSocket } from '../hooks/useSocket.ts';
import { apiRequest } from '../lib/api.ts';
import { AiPlayStyle, BotEloLevel } from '../lib/stockfish.worker.ts';
import heroArenaImg from '../assets/images/chess_arena_hero_1790540913025.jpg';

interface TimePreset {
  label: string;
  tc: string;
  category: 'bullet' | 'blitz' | 'rapid' | 'classical' | 'correspondence';
  desc: string;
}

const TIME_PRESETS: TimePreset[] = [
  // Bullet
  { label: '1+0', tc: '1+0', category: 'bullet', desc: 'Bullet' },
  { label: '1+1', tc: '1+1', category: 'bullet', desc: 'Bullet' },
  { label: '2+1', tc: '2+1', category: 'bullet', desc: 'Bullet' },
  // Blitz
  { label: '3+0', tc: '3+0', category: 'blitz', desc: 'Blitz' },
  { label: '3+2', tc: '3+2', category: 'blitz', desc: 'Blitz' },
  { label: '5+0', tc: '5+0', category: 'blitz', desc: 'Blitz' },
  { label: '5+3', tc: '5+3', category: 'blitz', desc: 'Blitz' },
  // Rapid
  { label: '10+0', tc: '10+0', category: 'rapid', desc: 'Rapide' },
  { label: '10+5', tc: '10+5', category: 'rapid', desc: 'Rapide' },
  { label: '15+10', tc: '15+10', category: 'rapid', desc: 'Rapide' },
  { label: '30+0', tc: '30+0', category: 'rapid', desc: 'Rapide' },
  // Classique & Correspondance
  { label: '60+0', tc: '60+0', category: 'classical', desc: 'Classique' },
  { label: '90+30', tc: '90+30', category: 'classical', desc: 'Classique' },
  { label: 'Sans chrono', tc: 'correspondence', category: 'correspondence', desc: 'Correspondance' },
];

const STOCKFISH_PRESET_LEVELS: { elo: BotEloLevel; title: string; badge: string }[] = [
  { elo: 400, title: 'Débutant Découverte', badge: 'Niv. 1' },
  { elo: 800, title: 'Apprenti de Club', badge: 'Niv. 2' },
  { elo: 1200, title: 'Joueur Régulier', badge: 'Niv. 3' },
  { elo: 1500, title: 'Compétiteur Tournoi', badge: 'Niv. 4' },
  { elo: 1800, title: 'Tacticien Confirmé', badge: 'Niv. 5' },
  { elo: 2100, title: 'Candidat Maître FIDE', badge: 'Niv. 6' },
  { elo: 2400, title: 'Maître International', badge: 'Niv. 7' },
  { elo: 2800, title: 'Grand Maître Stockfish Max', badge: 'Niv. 8' },
];

const AI_STYLES: { id: AiPlayStyle; label: string; desc: string }[] = [
  { id: 'balanced', label: '⚖️ Équilibré', desc: 'Jeu universel FIDE' },
  { id: 'aggressive', label: '⚔️ Agressif', desc: 'Attaque sur le Roi' },
  { id: 'solid', label: '🛡️ Forteresse', desc: 'Défense & Positionnel' },
  { id: 'tactical', label: '⚡ Tactique Pur', desc: 'Calcul de combinaisons' },
];

export const Lobby: React.FC = () => {
  const { user, startGameWithConfig, setActivePage } = useAppStore();
  const { socket } = useSocket();

  const [mobileTab, setMobileTab] = useState<'bot' | 'online' | 'rooms'>('bot');
  const [selectedPreset, setSelectedPreset] = useState<TimePreset>(TIME_PRESETS[4]); // 3+2 Blitz
  const [customMinutes, setCustomMinutes] = useState(7);
  const [customIncrement, setCustomIncrement] = useState(3);
  const [useCustomTc, setUseCustomTc] = useState(false);

  const [selectedBotLevel, setSelectedBotLevel] = useState<BotEloLevel>(1500);
  const [selectedBotStyle, setSelectedBotStyle] = useState<AiPlayStyle>('balanced');
  const [selectedBotDepth, setSelectedBotDepth] = useState<number>(2);
  const [selectedColor, setSelectedColor] = useState<'w' | 'b'>('w');

  const [rooms, setRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [isSearchingMatch, setIsSearchingMatch] = useState(false);
  const [lobbyError, setLobbyError] = useState<string | null>(null);

  // Formulaire de création de salle
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomPrivate, setNewRoomPrivate] = useState(false);
  const [newRoomPassword, setNewRoomPassword] = useState('');

  const effectiveTimeControl = useCustomTc
    ? `${customMinutes}+${customIncrement}`
    : selectedPreset.tc;
  const effectiveCategory = useCustomTc ? 'custom' : selectedPreset.category;

  const fetchRooms = async () => {
    setLoadingRooms(true);
    try {
      const res = await apiRequest<{ rooms: any[] }>('/api/rooms');
      setRooms(res.rooms || []);
    } catch {
      // Ignorer
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchRooms();

    const handleMatchFound = (data: any) => {
      setIsSearchingMatch(false);
      const myColor = data.whitePlayer?.uid === user?.uid ? 'w' : 'b';
      startGameWithConfig({
        mode: 'online',
        roomCode: data.roomCode,
        timeControl: data.timeControl,
        category: data.category,
        playerColor: myColor,
        asSpectator: false,
      });
    };

    const handleRoomError = (data: { error: string }) => {
      setIsSearchingMatch(false);
      setLobbyError(data.error);
    };

    socket.on('matchmaking:found', handleMatchFound);
    socket.on('room:error', handleRoomError);

    return () => {
      socket.off('matchmaking:found', handleMatchFound);
      socket.off('room:error', handleRoomError);
    };
  }, [socket, startGameWithConfig, user?.uid]);

  const handleStartMatchmaking = () => {
    setLobbyError(null);
    if (!user) {
      setActivePage('register');
      return;
    }
    if (!user.emailVerified) {
      setLobbyError(
        'Accès bloqué : vous devez vérifier votre adresse email avant de jouer en ligne.'
      );
      return;
    }

    if (isSearchingMatch) {
      socket.emit('matchmaking:leave', { uid: user.uid });
      setIsSearchingMatch(false);
      return;
    }

    setIsSearchingMatch(true);
    socket.emit('matchmaking:join', {
      uid: user.uid,
      username: user.username,
      countryCode: user.countryCode,
      elo: user.eloBlitz,
      category: effectiveCategory,
      timeControl: effectiveTimeControl,
      emailVerified: user.emailVerified,
    });
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setLobbyError(null);
    if (!user) {
      setActivePage('register');
      return;
    }
    if (!user.emailVerified) {
      setLobbyError(
        'Le jeu en ligne est bloqué tant que votre adresse email n’est pas vérifiée.'
      );
      return;
    }

    try {
      const res = await apiRequest<{ room: any }>('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({
          name: newRoomName.trim() || `Table de ${user.username}`,
          timeControl: effectiveTimeControl,
          category: effectiveCategory,
          isPrivate: newRoomPrivate,
          password: newRoomPassword,
        }),
      });
      setShowCreateModal(false);
      startGameWithConfig({
        mode: 'online',
        roomCode: res.room.code,
        timeControl: res.room.timeControl,
        category: res.room.category,
        playerColor: 'w',
        asSpectator: false,
      });
    } catch (err: any) {
      setLobbyError(err.message || 'Impossible de créer la salle.');
    }
  };

  const handleJoinRoom = (room: any, asSpectator = false) => {
    setLobbyError(null);
    if (!asSpectator) {
      if (!user) {
        setActivePage('register');
        return;
      }
      if (!user.emailVerified) {
        setLobbyError(
          'Compte non vérifié : validez votre code email pour rejoindre une partie en ligne.'
        );
        return;
      }
    }

    startGameWithConfig({
      mode: 'online',
      roomCode: room.code,
      timeControl: room.timeControl,
      category: room.category,
      playerColor: room.hostUid === user?.uid ? 'w' : 'b',
      asSpectator,
    });
  };

  return (
    <div className="max-w-[1360px] mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24 md:pb-8 space-y-5">
      {/* Bannière d'Inscription / Connexion ultra-visible si le visiteur n'est pas connecté */}
      {!user && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-[#23211D] via-[#2A3322] to-[#23211D] border-2 border-[#769656] shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="inline-block px-2 py-0.5 rounded bg-[#769656] text-white text-[10px] font-bold uppercase tracking-wider mb-1">
              Compte Officiel FIDE & Coach IA
            </span>
            <h2 className="text-sm sm:text-base font-bold text-[#EEEED2]">
              Rejoignez ChessMaster Pro gratuitement
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Sauvegardez votre classement ELO, votre drapeau national et débloquez les tournois et l’analyse IA complète.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActivePage('register')}
              className="min-h-[44px] px-4 py-2.5 bg-[#EEEED2] hover:bg-white text-[#161512] text-xs sm:text-sm font-extrabold rounded-xl border-2 border-[#769656] shadow-md transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4 text-[#769656] shrink-0" />
              <span>Inscription Gratuite</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePage('login')}
              className="min-h-[44px] px-4 py-2.5 bg-[#161512] hover:bg-white/10 text-white text-xs sm:text-sm font-semibold rounded-xl border border-white/20 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <LogIn className="w-4 h-4 text-[#95BB4A] shrink-0" />
              <span>Se Connecter</span>
            </button>
          </div>
        </div>
      )}

      {/* Bannière d'avertissement si le joueur est connecté mais n'a pas encore vérifié son email */}
      {user && !user.emailVerified && (
        <div className="p-3.5 rounded-xl bg-amber-950/70 border border-amber-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-amber-200">
                Vérification d’email requise pour le multijoueur
              </h3>
              <p className="text-xs text-amber-300/85 mt-0.5">
                Validez votre code reçu sur {user.email}. Le mode IA Stockfish reste accessible immédiatement.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActivePage('register')}
            className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Valider mon Code
          </button>
        </div>
      )}

      {lobbyError && (
        <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/40 text-xs text-red-200 flex items-center justify-between gap-2">
          <span>{lobbyError}</span>
          <button
            type="button"
            onClick={() => setLobbyError(null)}
            className="text-red-300 hover:text-white font-semibold shrink-0"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Barre de Lancement Rapide en 1 Clic */}
      <div className="bg-[#23211D] border border-white/10 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#769656]/20 border border-[#769656]/50 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-[#95BB4A]" />
          </div>
          <div>
            <h1
              className="text-base sm:text-lg font-bold text-[#EEEED2]"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Démarrage Rapide & Coach IA
            </h1>
            <p className="text-xs text-slate-400">
              Choisissez la puissance exacte de l’IA ou lancez un duel en 1 clic.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              startGameWithConfig({
                mode: 'bot',
                botLevel: selectedBotLevel,
                botStyle: selectedBotStyle,
                botDepth: selectedBotDepth,
                playerColor: selectedColor,
                timeControl: '3+2',
                category: 'blitz',
              })
            }
            className="min-h-[44px] px-3.5 py-2 bg-[#769656] hover:bg-[#86a666] text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Cpu className="w-3.5 h-3.5 shrink-0" />
            <span>IA {selectedBotLevel} ELO (3+2)</span>
          </button>

          <button
            type="button"
            onClick={() =>
              startGameWithConfig({
                mode: 'bot',
                botLevel: selectedBotLevel,
                botStyle: selectedBotStyle,
                botDepth: selectedBotDepth,
                playerColor: selectedColor,
                timeControl: '10+0',
                category: 'rapid',
              })
            }
            className="min-h-[44px] px-3.5 py-2 bg-[#161512] hover:bg-white/10 border border-white/15 text-[#EEEED2] text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 text-[#769656] shrink-0" />
            <span>IA {selectedBotLevel} ELO (10+0)</span>
          </button>

          <button
            type="button"
            onClick={handleStartMatchmaking}
            className="col-span-2 sm:col-span-1 min-h-[44px] px-3.5 py-2 bg-[#EEEED2] hover:bg-white text-[#161512] text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Users className="w-3.5 h-3.5 text-[#161512] shrink-0" />
            <span>
              {isSearchingMatch
                ? 'Recherche en cours...'
                : `Matchmaking En Ligne (${effectiveTimeControl})`}
            </span>
          </button>
        </div>
      </div>

      {/* Sélecteur d'onglets sur Android / Mobile */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-[#23211D] border border-white/10 rounded-xl lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTab('bot')}
          className={`min-h-[42px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            mobileTab === 'bot'
              ? 'bg-[#769656] text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Puissance IA ({selectedBotLevel})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('online')}
          className={`min-h-[42px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            mobileTab === 'online'
              ? 'bg-[#769656] text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Cadences & Duel
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('rooms')}
          className={`min-h-[42px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            mobileTab === 'rooms'
              ? 'bg-[#769656] text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Salles ({rooms.length})
        </button>
      </div>

      {/* Grille Principale : Cadences En Ligne (6 cols) & Puissance IA Avancée (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Colonne Gauche : Configuration Avancée de Puissance IA Stockfish (8 Niveaux + Curseur 400-3000 ELO + Style) */}
        <div
          className={`lg:col-span-6 bg-[#23211D] border border-white/10 rounded-xl p-4 sm:p-6 flex-col justify-between space-y-4 ${
            mobileTab === 'bot' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-[#769656]" />
                <h2 className="text-base font-bold text-[#EEEED2]">
                  Choisir la Puissance & le Niveau de l’IA
                </h2>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-[#161512] border border-[#769656] font-mono text-xs font-extrabold text-[#95BB4A]">
                {selectedBotLevel} ELO
              </span>
            </div>

            {/* 1. Curseur de Puissance sur mesure (400 à 3000 ELO) */}
            <div className="p-3.5 rounded-xl bg-[#161512] border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#95BB4A]" />
                  <span>Réglage Précis de la Puissance IA :</span>
                </span>
                <span className="font-mono font-bold text-white">{selectedBotLevel} ELO</span>
              </div>
              <input
                type="range"
                min={400}
                max={3000}
                step={25}
                value={selectedBotLevel}
                onChange={(e) => setSelectedBotLevel(Number(e.target.value))}
                className="w-full accent-[#769656]"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>400 (Débutant)</span>
                <span>1200 (Club)</span>
                <span>2000 (Expert)</span>
                <span>3000 (Max)</span>
              </div>
            </div>

            {/* 2. Grille des 8 Niveaux Prédéfinis */}
            <div>
              <span className="block text-xs font-semibold text-slate-300 mb-2">
                Ou sélectionnez l’un des 8 niveaux d’entraînement :
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {STOCKFISH_PRESET_LEVELS.map((lvl) => {
                  const isSelected = selectedBotLevel === lvl.elo;
                  return (
                    <button
                      key={lvl.elo}
                      type="button"
                      onClick={() => setSelectedBotLevel(lvl.elo)}
                      className={`min-h-[54px] p-2 rounded-lg border text-left transition-colors flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#769656]/30 border-[#769656] text-white'
                          : 'bg-[#161512] border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] font-mono text-[#95BB4A] font-bold">
                          {lvl.badge}
                        </span>
                        <span className="font-mono text-xs font-extrabold text-[#EEEED2]">
                          {lvl.elo}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium truncate w-full mt-0.5">
                        {lvl.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Style de jeu de l'IA & Profondeur */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Style de jeu de l’IA :
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {AI_STYLES.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSelectedBotStyle(st.id)}
                      className={`py-2 px-2.5 rounded-lg border text-left transition-colors ${
                        selectedBotStyle === st.id
                          ? 'bg-[#769656]/25 border-[#769656] text-white'
                          : 'bg-[#161512] border-white/10 text-slate-300'
                      }`}
                    >
                      <div className="text-xs font-semibold truncate">{st.label}</div>
                      <div className="text-[10px] text-slate-400 truncate">{st.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Votre couleur :
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedColor('w')}
                      className={`min-h-[40px] py-1.5 px-2.5 rounded-lg border text-xs font-medium transition-colors ${
                        selectedColor === 'w'
                          ? 'bg-[#EEEED2] text-[#161512] border-[#EEEED2] font-bold'
                          : 'bg-[#161512] text-slate-300 border-white/10'
                      }`}
                    >
                      ♔ Blancs
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedColor('b')}
                      className={`min-h-[40px] py-1.5 px-2.5 rounded-lg border text-xs font-medium transition-colors ${
                        selectedColor === 'b'
                          ? 'bg-[#769656] text-white border-[#769656] font-bold'
                          : 'bg-[#161512] text-slate-300 border-white/10'
                      }`}
                    >
                      ♚ Noirs
                    </button>
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-slate-300 mb-1">
                    Profondeur moteur : <strong className="text-[#95BB4A]">Niv. {selectedBotDepth}</strong>
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[1, 2, 3].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setSelectedBotDepth(d)}
                        className={`py-1.5 rounded-lg border text-xs font-mono font-bold ${
                          selectedBotDepth === d
                            ? 'bg-[#769656]/30 border-[#769656] text-white'
                            : 'bg-[#161512] border-white/10 text-slate-400'
                        }`}
                      >
                        Rapide x{d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              startGameWithConfig({
                mode: 'bot',
                botLevel: selectedBotLevel,
                botStyle: selectedBotStyle,
                botDepth: selectedBotDepth,
                playerColor: selectedColor,
                timeControl: effectiveTimeControl,
                category: effectiveCategory,
              })
            }
            className="min-h-[48px] w-full py-3 px-4 bg-[#EEEED2] hover:bg-white text-[#161512] font-extrabold text-sm rounded-xl border-2 border-[#769656] shadow-md transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 text-[#769656]" />
            <span>
              Lancer le Match contre l’IA ({selectedBotLevel} ELO · {effectiveTimeControl})
            </span>
          </button>
        </div>

        {/* Colonne Droite : Bannière Tournoi & Sélecteur de Cadences */}
        <div
          className={`lg:col-span-6 bg-[#23211D] border border-white/10 rounded-xl overflow-hidden flex-col justify-between ${
            mobileTab === 'online' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <div className="relative h-36 sm:h-48 overflow-hidden">
            <img
              src={heroArenaImg}
              alt="Échiquier de tournoi officiel ChessMaster Pro"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#161512] via-black/60 to-transparent" />
            <div className="absolute bottom-3.5 left-4 right-4 sm:bottom-5 sm:left-6 sm:right-6">
              <div className="text-[11px] text-[#EEEED2]/85 font-mono mb-0.5">
                FÉDÉRATION INTERNATIONALE · CLASSEMENT FIDE TEMPS RÉEL
              </div>
              <h2
                className="text-lg sm:text-2xl font-bold text-white tracking-tight"
                style={{ fontFamily: "'Cinzel', serif", textWrap: 'balance' }}
              >
                L’Arène des Maîtres d’Échecs
              </h2>
            </div>
          </div>

          {/* Grille des Cadences de Jeu */}
          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs sm:text-sm font-semibold text-[#EEEED2]">
                Choisissez la cadence de jeu ({effectiveTimeControl})
              </h3>
              <button
                type="button"
                onClick={() => setUseCustomTc((v) => !v)}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  useCustomTc
                    ? 'bg-[#769656] text-white'
                    : 'text-slate-300 hover:text-white bg-[#161512] border border-white/10'
                }`}
              >
                {useCustomTc ? 'Cadence Personnalisée Active' : 'Personnaliser'}
              </button>
            </div>

            {!useCustomTc ? (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {TIME_PRESETS.map((preset) => {
                  const active = selectedPreset.tc === preset.tc;
                  return (
                    <button
                      key={preset.tc}
                      type="button"
                      onClick={() => setSelectedPreset(preset)}
                      className={`min-h-[52px] flex flex-col items-center justify-center py-2 px-2 rounded-lg border transition-colors ${
                        active
                          ? 'bg-[#769656]/25 border-[#769656] text-white'
                          : 'bg-[#161512] border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <span className="font-mono text-xs sm:text-sm font-bold tabular-nums">
                        {preset.label}
                      </span>
                      <span className="text-[10px] text-slate-400">{preset.desc}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#161512] rounded-lg border border-white/10">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Temps initial :{' '}
                    <span className="text-white font-mono">{customMinutes} min</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={120}
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(Number(e.target.value))}
                    className="w-full accent-[#769656]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Incrément Fischer :{' '}
                    <span className="text-white font-mono">+{customIncrement} s</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    value={customIncrement}
                    onChange={(e) => setCustomIncrement(Number(e.target.value))}
                    className="w-full accent-[#769656]"
                  />
                </div>
              </div>
            )}

            {/* Boutons d'action principaux */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleStartMatchmaking}
                className="min-h-[48px] py-3 px-4 bg-[#769656] hover:bg-[#86a666] text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shadow-sm"
              >
                <Play className="w-4 h-4 fill-current shrink-0" />
                <span>
                  {isSearchingMatch
                    ? 'Recherche ELO (±150)... Annuler'
                    : `Matchmaking Classé (${effectiveTimeControl})`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="min-h-[48px] py-3 px-4 bg-[#161512] hover:bg-white/5 text-[#EEEED2] border border-white/15 font-semibold text-xs sm:text-sm rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4 text-[#769656] shrink-0" />
                <span>Créer une Salle / Inviter un Ami</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des Salles Multijoueur Temps Réel */}
      <div
        className={`bg-[#23211D] border border-white/10 rounded-xl p-4 sm:p-6 ${
          mobileTab === 'rooms' ? 'block' : 'hidden lg:block'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-[#EEEED2] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#769656]" />
              <span>Salles en Direct & Spectateurs</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Rejoignez une table ouverte ou observez les parties en cours.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="lg:hidden px-3 py-2 bg-[#769656] text-white rounded-lg text-xs font-semibold whitespace-nowrap"
            >
              + Créer
            </button>
            <button
              type="button"
              onClick={fetchRooms}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#161512] hover:bg-white/5 border border-white/10 rounded-lg text-xs text-slate-300 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingRooms ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {rooms.map((room) => (
            <div
              key={room.code}
              className="p-4 rounded-xl bg-[#161512] border border-white/10 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white truncate">{room.name}</span>
                  {room.isPrivate && <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1.5 font-mono tabular-nums">
                  <ReactCountryFlag
                    countryCode={room.hostCountry || 'FR'}
                    svg
                    style={{ width: '1.15em', height: '0.85em' }}
                  />
                  <span className="truncate">{room.hostUsername}</span>
                  <span aria-hidden="true">·</span>
                  <span>{room.hostElo} ELO</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#769656] font-semibold">{room.timeControl}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                <span className="text-[11px] font-mono text-slate-500">#{room.code}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleJoinRoom(room, true)}
                    className="min-h-[38px] px-3 py-1.5 bg-[#23211D] hover:bg-white/10 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Observer</span>
                  </button>
                  {room.status === 'WAITING' && (
                    <button
                      type="button"
                      onClick={() => handleJoinRoom(room, false)}
                      className="min-h-[38px] px-3.5 py-1.5 bg-[#769656] hover:bg-[#86a666] text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      Rejoindre
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modale de Création de Salle */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#23211D] border border-white/15 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-[#EEEED2] mb-1">
              Créer une Salle Multijoueur
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Cadence sélectionnée : <strong className="text-white">{effectiveTimeControl}</strong>
            </p>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nom de la salle
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Ex: Duel Blitz Amical"
                  className="w-full px-3 py-2.5 bg-[#161512] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#769656]"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="private-room"
                  type="checkbox"
                  checked={newRoomPrivate}
                  onChange={(e) => setNewRoomPrivate(e.target.checked)}
                  className="accent-[#769656] w-4 h-4"
                />
                <label htmlFor="private-room" className="text-xs text-slate-300">
                  Salle privée (mot de passe optionnel & lien d’invitation)
                </label>
              </div>

              {newRoomPrivate && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Mot de passe de la salle (optionnel)
                  </label>
                  <input
                    type="password"
                    value={newRoomPassword}
                    onChange={(e) => setNewRoomPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full px-3 py-2.5 bg-[#161512] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#769656]"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="min-h-[42px] px-4 py-2 bg-[#161512] text-slate-300 rounded-lg text-xs font-medium hover:bg-white/5"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] px-4 py-2 bg-[#769656] hover:bg-[#86a666] text-white rounded-lg text-xs font-semibold"
                >
                  Créer & Ouvrir la Salle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
