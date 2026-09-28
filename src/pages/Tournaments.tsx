// src/pages/Tournaments.tsx
// Page Tournois Officiels : Arena, Suisse, Round-Robin et Élimination Directe (Création min. 4 joueurs & Brackets en direct)
import React, { useEffect, useState } from 'react';
import ReactCountryFlag from 'react-country-flag';
import { Trophy, Plus, Users, Swords, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import { useAppStore } from '../store/useAppStore.ts';

export const Tournaments: React.FC = () => {
  const { user, setActivePage, startGameWithConfig } = useAppStore();

  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<any | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Formulaire de création de tournoi
  const [name, setName] = useState('');
  const [format, setFormat] = useState<'ARENA' | 'SWISS' | 'ROUND_ROBIN' | 'KNOCKOUT'>('ARENA');
  const [category, setCategory] = useState<'bullet' | 'blitz' | 'rapid' | 'classical'>('blitz');
  const [timeControl, setTimeControl] = useState('3+2');
  const [minElo, setMinElo] = useState(800);
  const [maxElo, setMaxElo] = useState(3200);
  const [maxPlayers, setMaxPlayers] = useState(16);

  const loadTournaments = async () => {
    try {
      const res = await apiRequest<{ tournaments: any[] }>('/api/tournaments');
      setTournaments(res.tournaments || []);
      if (res.tournaments?.length && !selectedTournament) {
        setSelectedTournament(res.tournaments[0]);
      }
    } catch {
      // Ignorer
    }
  };

  useEffect(() => {
    loadTournaments();
  }, []);

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user) {
      setActivePage('login');
      return;
    }

    try {
      const res = await apiRequest<{ tournament: any }>('/api/tournaments', {
        method: 'POST',
        body: JSON.stringify({
          name,
          format,
          category,
          timeControl,
          minElo,
          maxElo,
          maxPlayers: Math.max(4, maxPlayers),
        }),
      });
      setTournaments((prev) => [res.tournament, ...prev]);
      setSelectedTournament(res.tournament);
      setShowCreateModal(false);
      setName('');
      setMessage('Tournoi créé et ouvert aux inscriptions !');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du tournoi.');
    }
  };

  const handleJoinTournament = async (tournamentId: number) => {
    setError(null);
    setMessage(null);
    if (!user) {
      setActivePage('login');
      return;
    }

    try {
      const res = await apiRequest<{ tournament: any; message: string }>(
        `/api/tournaments/${tournamentId}/join`,
        { method: 'POST' }
      );
      setMessage(res.message);
      setTournaments((prev) =>
        prev.map((t) => (t.id === tournamentId ? res.tournament : t))
      );
      setSelectedTournament(res.tournament);
    } catch (err: any) {
      setError(err.message || 'Impossible de rejoindre ce tournoi.');
    }
  };

  return (
    <div className="max-w-[1320px] mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24 md:pb-8 space-y-5">
      {/* En-tête Tournois */}
      <div className="bg-[#23211D] border border-white/10 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold text-[#EEEED2] tracking-tight flex items-center gap-2.5"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            <Trophy className="w-6 h-6 text-[#769656]" />
            <span>Tournois Officiels (Arena, Suisse, Round-Robin & Élimination)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Inscriptions automatiques vérifiées par plage ELO, tableaux d’appariements et
            classements en direct.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-[#769656] hover:bg-[#86a666] text-white font-semibold text-xs rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Créer un Tournoi (Min. 4 joueurs)</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-950/60 border border-red-500/40 text-xs text-red-200">
          {error}
        </div>
      )}

      {message && (
        <div className="p-3.5 rounded-lg bg-[#769656]/25 border border-[#769656] text-xs text-white flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#769656]" />
          <span>{message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Colonne Gauche (5 cols) : Liste des Tournois */}
        <div className="lg:col-span-5 space-y-3">
          {tournaments.map((t) => {
            const active = selectedTournament?.id === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setSelectedTournament(t)}
                className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#262421] border-[#769656]'
                    : 'bg-[#23211D] border-white/10 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-white truncate">{t.name}</h3>
                  <span className="text-xs font-mono text-[#769656] font-semibold">
                    {t.format}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums mt-1.5">
                  <span>{t.timeControl}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    ELO {t.minElo}–{t.maxElo}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t.participants?.length || 0}/{t.maxPlayers} joueurs
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Colonne Droite (7 cols) : Détails, Classement Live & Appariements (Brackets) */}
        <div className="lg:col-span-7">
          {selectedTournament && (
            <div className="bg-[#23211D] border border-white/10 rounded-xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <div className="text-xs font-mono text-[#769656]">
                    FORMAT {selectedTournament.format} · CADENCE {selectedTournament.timeControl}
                  </div>
                  <h2 className="text-xl font-bold text-white mt-0.5">
                    {selectedTournament.name}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Organisé par {selectedTournament.creatorUsername} · Plage ELO autorisée :{' '}
                    {selectedTournament.minElo} à {selectedTournament.maxElo}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleJoinTournament(selectedTournament.id)}
                    className="px-4 py-2 bg-[#769656] hover:bg-[#86a666] text-white font-semibold text-xs rounded-lg transition-colors whitespace-nowrap"
                  >
                    S’inscrire au Tournoi
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      startGameWithConfig({
                        mode: 'bot',
                        timeControl: selectedTournament.timeControl,
                        category: selectedTournament.category,
                        botLevel: 2000,
                      })
                    }
                    className="px-3.5 py-2 bg-[#161512] hover:bg-white/10 border border-white/15 text-slate-200 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                  >
                    Jouer Ronde Test
                  </button>
                </div>
              </div>

              {/* Classement en direct du Tournoi */}
              <div>
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#769656]" />
                  <span>Classement en Direct ({selectedTournament.participants?.length || 0} inscrits)</span>
                </h3>
                <div className="bg-[#161512] border border-white/10 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400">
                        <th className="py-2.5 px-3">Rang</th>
                        <th className="py-2.5 px-3">Participant</th>
                        <th className="py-2.5 px-3 text-right">ELO</th>
                        <th className="py-2.5 px-3 text-right">Points Arena</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {(selectedTournament.participants || []).map((p: any, idx: number) => (
                        <tr key={p.uid} className="hover:bg-white/5">
                          <td className="py-2.5 px-3 font-bold text-slate-400">#{idx + 1}</td>
                          <td className="py-2.5 px-3 font-sans text-white flex items-center gap-2">
                            <ReactCountryFlag
                              countryCode={p.country || 'FR'}
                              svg
                              style={{ width: '1.15em', height: '0.85em' }}
                            />
                            <span className="font-semibold">{p.username}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-300">{p.elo}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#769656]">
                            {p.score} pts
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Appariements / Brackets en direct */}
              <div>
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Swords className="w-4 h-4 text-[#769656]" />
                  <span>Tableau des Appariements (Brackets Ronde Actuelle)</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(selectedTournament.pairings || []).length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Les appariements sont générés dès que de nouveaux joueurs rejoignent la compétition.
                    </p>
                  ) : (
                    selectedTournament.pairings.map((pair: any, i: number) => (
                      <div
                        key={i}
                        className="p-3 bg-[#161512] border border-white/10 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div className="space-y-1">
                          <div className="text-white font-semibold">♔ {pair.white}</div>
                          <div className="text-slate-300 font-semibold">♚ {pair.black}</div>
                        </div>
                        <span className="font-mono font-bold text-[#EEEED2]">{pair.result}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modale de Création de Tournoi */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#23211D] border border-white/15 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-[#EEEED2] mb-4">
              Créer un Nouveau Tournoi FIDE
            </h3>
            <form onSubmit={handleCreateTournament} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Nom du tournoi *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Coupe Blitz Nocturne"
                  className="w-full px-3 py-2 bg-[#161512] border border-white/10 rounded-lg text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Système</label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#161512] border border-white/10 rounded-lg text-xs text-white"
                  >
                    <option value="ARENA">Arena</option>
                    <option value="SWISS">Système Suisse</option>
                    <option value="ROUND_ROBIN">Round-Robin</option>
                    <option value="KNOCKOUT">Élimination Directe</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Cadence</label>
                  <select
                    value={timeControl}
                    onChange={(e) => setTimeControl(e.target.value)}
                    className="w-full px-3 py-2 bg-[#161512] border border-white/10 rounded-lg text-xs text-white"
                  >
                    <option value="1+0">1+0 Bullet</option>
                    <option value="3+0">3+0 Blitz</option>
                    <option value="3+2">3+2 Blitz</option>
                    <option value="10+0">10+0 Rapide</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">ELO Min</label>
                  <input
                    type="number"
                    value={minElo}
                    onChange={(e) => setMinElo(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-[#161512] border border-white/10 rounded-lg text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">ELO Max</label>
                  <input
                    type="number"
                    value={maxElo}
                    onChange={(e) => setMaxElo(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-[#161512] border border-white/10 rounded-lg text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Joueurs (≥4)</label>
                  <input
                    type="number"
                    min={4}
                    max={128}
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-[#161512] border border-white/10 rounded-lg text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-[#161512] text-slate-300 rounded-lg text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#769656] text-white font-semibold rounded-lg text-xs"
                >
                  Homologuer & Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
