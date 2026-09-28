// src/pages/Leaderboard.tsx
// Classement Officiel FIDE : Mondial, Par Pays (avec sélecteur ISO & drapeaux) et Par Amis
import React, { useEffect, useState } from 'react';
import ReactCountryFlag from 'react-country-flag';
import { Trophy, Globe, Users, Flag } from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import { CountrySelector } from '../components/CountrySelector.tsx';
import { useAppStore } from '../store/useAppStore.ts';

export const Leaderboard: React.FC = () => {
  const { user, setActivePage } = useAppStore();

  const [category, setCategory] = useState<'bullet' | 'blitz' | 'rapid' | 'classical'>('blitz');
  const [scope, setScope] = useState<'global' | 'country' | 'friends'>('global');
  const [selectedCountry, setSelectedCountry] = useState<string>(user?.countryCode || 'FR');
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const query = new URLSearchParams({
      category,
      scope,
      country: selectedCountry,
      ...(user?.uid ? { userUid: user.uid } : {}),
    });

    apiRequest<{ leaderboard: any[] }>(`/api/elo/leaderboard?${query.toString()}`)
      .then((res) => {
        if (active) setPlayers(res.leaderboard || []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [category, scope, selectedCountry, user?.uid]);

  return (
    <div className="max-w-[1280px] mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24 md:pb-8 space-y-5">
      <div className="bg-[#23211D] border border-white/10 rounded-xl p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold text-[#EEEED2] tracking-tight flex items-center gap-2.5"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            <Trophy className="w-6 h-6 text-[#769656]" />
            <span>Classement Mondial & Fédérations FIDE</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Calcul ELO officiel avec facteur K adaptatif et attribution automatique des titres GM,
            IM, FM et CM.
          </p>
        </div>

        {/* Sélecteur de Catégorie (Bullet / Blitz / Rapid / Classique) */}
        <div className="flex items-center gap-1 p-1 bg-[#161512] border border-white/10 rounded-lg">
          {(
            [
              { id: 'bullet', label: 'Bullet' },
              { id: 'blitz', label: 'Blitz' },
              { id: 'rapid', label: 'Rapide' },
              { id: 'classical', label: 'Classique' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategory(tab.id)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                category === tab.id
                  ? 'bg-[#769656] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filtres de Portée : Mondial / Par Pays / Par Amis */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScope('global')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border flex items-center gap-2 transition-colors whitespace-nowrap ${
              scope === 'global'
                ? 'bg-[#769656]/25 border-[#769656] text-white'
                : 'bg-[#23211D] border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4 text-[#769656]" />
            <span>Classement Mondial</span>
          </button>

          <button
            type="button"
            onClick={() => setScope('country')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border flex items-center gap-2 transition-colors whitespace-nowrap ${
              scope === 'country'
                ? 'bg-[#769656]/25 border-[#769656] text-white'
                : 'bg-[#23211D] border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Flag className="w-4 h-4 text-[#769656]" />
            <span>Par Pays</span>
          </button>

          <button
            type="button"
            onClick={() => setScope('friends')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border flex items-center gap-2 transition-colors whitespace-nowrap ${
              scope === 'friends'
                ? 'bg-[#769656]/25 border-[#769656] text-white'
                : 'bg-[#23211D] border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 text-[#769656]" />
            <span>Entre Amis</span>
          </button>
        </div>

        {scope === 'country' && (
          <div className="w-full sm:w-72">
            <CountrySelector
              selectedCode={selectedCountry}
              onSelect={(c) => setSelectedCountry(c.code)}
            />
          </div>
        )}
      </div>

      {/* Tableau du Classement */}
      <div className="bg-[#23211D] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-[#161512] text-[11px] font-semibold text-slate-400">
                <th className="py-3.5 px-4 w-16">Rang</th>
                <th className="py-3.5 px-4">Joueur & Titre FIDE</th>
                <th className="py-3.5 px-4">Fédération</th>
                <th className="py-3.5 px-4 text-right">ELO ({category.toUpperCase()})</th>
                <th className="py-3.5 px-4 text-right">Parties (V / N / D)</th>
                <th className="py-3.5 px-4 text-right">ELO Tactique</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm font-mono tabular-nums">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-400 font-sans">
                    Actualisation du classement officiel...
                  </td>
                </tr>
              ) : players.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-400 font-sans">
                    Aucun joueur trouvé pour ce filtre.
                  </td>
                </tr>
              ) : (
                players.map((p, idx) => (
                  <tr
                    key={p.uid}
                    onClick={() => setActivePage('profile', p.uid)}
                    className="hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-300">#{idx + 1}</td>
                    <td className="py-3.5 px-4 font-sans">
                      <div className="flex items-center gap-2">
                        {p.badge?.title && (
                          <span className={`font-mono text-xs font-bold ${p.badge.colorClass}`}>
                            {p.badge.title}
                          </span>
                        )}
                        <span className="font-semibold text-white">{p.username}</span>
                        <span className="text-xs text-slate-500">· {p.badge?.label}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-sans text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <ReactCountryFlag
                          countryCode={p.countryCode || 'FR'}
                          svg
                          style={{ width: '1.25em', height: '0.9em' }}
                        />
                        <span>{p.countryName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#EEEED2]">
                      {p.activeElo}
                    </td>
                    <td className="py-3.5 px-4 text-right text-xs text-slate-400">
                      {p.gamesPlayed} ({p.wins}V · {p.draws}N · {p.losses}D)
                    </td>
                    <td className="py-3.5 px-4 text-right text-amber-400">
                      {p.puzzleRating}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
