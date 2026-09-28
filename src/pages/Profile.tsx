// src/pages/Profile.tsx
// Profil Joueur Complet : Photo, Pays & Drapeau, Titre FIDE, Bio, Statistiques, Graphique Recharts ELO & Historique
import React, { useEffect, useState } from 'react';
import ReactCountryFlag from 'react-country-flag';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { CheckCircle2, Edit3, Save, ShieldAlert, Trophy } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.ts';
import { apiRequest } from '../lib/api.ts';
import { CountrySelector } from '../components/CountrySelector.tsx';

export const Profile: React.FC = () => {
  const { user, viewedProfileUid, updateUser, setActivePage } = useAppStore();
  const targetUid = viewedProfileUid || user?.uid || 'gm-alireza-fr';
  const isOwnProfile = Boolean(user && user.uid === targetUid);

  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const [bioInput, setBioInput] = useState('');
  const [countryCodeInput, setCountryCodeInput] = useState('FR');
  const [countryNameInput, setCountryNameInput] = useState('France');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiRequest(`/api/users/profile/${encodeURIComponent(targetUid)}`)
      .then((res) => {
        if (!active) return;
        setProfileData(res);
        if (res.user) {
          setBioInput(res.user.bio || '');
          setCountryCodeInput(res.user.countryCode || 'FR');
          setCountryNameInput(res.user.countryName || 'France');
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [targetUid]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify({
          bio: bioInput,
          countryCode: countryCodeInput,
          countryName: countryNameInput,
        }),
      });
      if (res.user) {
        updateUser(res.user);
        setProfileData((prev: any) => ({ ...prev, user: res.user }));
      }
      setEditing(false);
      setSaveMessage('Profil mis à jour avec succès.');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      // Ignorer
    }
  };

  if (loading || !profileData?.user) {
    return (
      <div className="max-w-5xl mx-auto p-8 text-center text-sm text-slate-400">
        Chargement du dossier joueur FIDE...
      </div>
    );
  }

  const pUser = profileData.user;
  const badge = profileData.badge;
  const rawHistory: any[] = profileData.eloHistory || [];
  const recentGames: any[] = profileData.recentGames || [];

  const chartData =
    rawHistory.length > 0
      ? rawHistory.map((item, idx) => ({
          step: `Partie ${idx + 1}`,
          elo: item.elo,
        }))
      : [
          { step: 'Début', elo: pUser.eloBlitz - 35 },
          { step: 'S1', elo: pUser.eloBlitz - 18 },
          { step: 'S2', elo: pUser.eloBlitz - 6 },
          { step: 'Actuel', elo: pUser.eloBlitz },
        ];

  return (
    <div className="max-w-[1280px] mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24 md:pb-8 space-y-5">
      {/* En-tête du Profil */}
      <div className="bg-[#23211D] border border-white/10 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-[#161512] border border-[#769656] flex items-center justify-center text-xl font-bold text-[#EEEED2] shrink-0">
            {pUser.username.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              {badge?.title && (
                <span className={`font-mono text-sm font-bold ${badge.colorClass}`}>
                  {badge.title}
                </span>
              )}
              <h1 className="text-xl sm:text-2xl font-bold text-white">{pUser.username}</h1>
              <ReactCountryFlag
                countryCode={pUser.countryCode || 'FR'}
                svg
                style={{ width: '1.4em', height: '1.05em' }}
                title={pUser.countryName}
              />
            </div>

            {/* Métadonnées statiques sans pilules (Zero-Pill Discipline) */}
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
              <span>{pUser.countryName}</span>
              <span aria-hidden="true">·</span>
              <span>{badge?.label || 'Joueur Classé'}</span>
              <span aria-hidden="true">·</span>
              {pUser.emailVerified ? (
                <span className="inline-flex items-center gap-1 text-[#769656]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Compte Vérifié FIDE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-400">
                  <ShieldAlert className="w-3.5 h-3.5" /> Email non vérifié
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 mt-2 max-w-2xl">{pUser.bio}</p>
          </div>
        </div>

        {isOwnProfile && (
          <div className="flex items-center gap-2">
            {!pUser.emailVerified && (
              <button
                type="button"
                onClick={() => setActivePage('register')}
                className="px-3.5 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg whitespace-nowrap"
              >
                Vérifier mon Email
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="px-3.5 py-2 bg-[#161512] hover:bg-white/10 border border-white/15 rounded-lg text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#769656]" />
              <span>{editing ? 'Fermer l’édition' : 'Modifier mon profil'}</span>
            </button>
          </div>
        )}
      </div>

      {saveMessage && (
        <div className="p-3 rounded-lg bg-[#769656]/25 border border-[#769656] text-xs text-white">
          {saveMessage}
        </div>
      )}

      {/* Formulaire d'édition du profil */}
      {editing && isOwnProfile && (
        <form
          onSubmit={handleSaveProfile}
          className="bg-[#23211D] border border-[#769656] rounded-xl p-6 space-y-4"
        >
          <h3 className="text-sm font-bold text-white">Modifier mes informations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CountrySelector
              label="Pays de fédération"
              selectedCode={countryCodeInput}
              onSelect={(c) => {
                setCountryCodeInput(c.code);
                setCountryNameInput(c.name);
              }}
            />
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Biographie & Répertoire d’ouvertures
              </label>
              <input
                type="text"
                value={bioInput}
                onChange={(e) => setBioInput(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#161512] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#769656]"
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-[#769656] hover:bg-[#86a666] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Enregistrer</span>
          </button>
        </form>
      )}

      {/* Grille des Classements ELO par Catégorie */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 font-mono tabular-nums">
        <div className="p-4 bg-[#23211D] border border-white/10 rounded-xl">
          <span className="text-xs text-slate-400 font-sans block">Bullet</span>
          <span className="text-2xl font-bold text-[#EEEED2] mt-1 block">{pUser.eloBullet}</span>
        </div>
        <div className="p-4 bg-[#23211D] border border-[#769656]/50 rounded-xl">
          <span className="text-xs text-[#769656] font-sans font-semibold block">Blitz</span>
          <span className="text-2xl font-bold text-white mt-1 block">{pUser.eloBlitz}</span>
        </div>
        <div className="p-4 bg-[#23211D] border border-white/10 rounded-xl">
          <span className="text-xs text-slate-400 font-sans block">Rapide</span>
          <span className="text-2xl font-bold text-[#EEEED2] mt-1 block">{pUser.eloRapid}</span>
        </div>
        <div className="p-4 bg-[#23211D] border border-white/10 rounded-xl">
          <span className="text-xs text-slate-400 font-sans block">Classique</span>
          <span className="text-2xl font-bold text-[#EEEED2] mt-1 block">{pUser.eloClassical}</span>
        </div>
        <div className="p-4 bg-[#23211D] border border-white/10 rounded-xl">
          <span className="text-xs text-slate-400 font-sans block">Puzzles Tactiques</span>
          <span className="text-2xl font-bold text-amber-400 mt-1 block">
            {pUser.puzzleRating}
          </span>
        </div>
      </div>

      {/* Graphique de progression ELO (Recharts) & Bilan Victoires/Nulles/Défaites */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-[#23211D] border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[#EEEED2] flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#769656]" />
              <span>Progression du Classement ELO FIDE</span>
            </h2>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {pUser.gamesPlayed} parties · {pUser.wins}V / {pUser.draws}N / {pUser.losses}D
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="eloGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#769656" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#769656" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="step" stroke="#94A3B8" fontSize={11} />
                <YAxis domain={['auto', 'auto']} stroke="#94A3B8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#161512',
                    borderColor: '#769656',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="elo"
                  stroke="#769656"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#eloGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Historique des Parties Récentes */}
        <div className="lg:col-span-4 bg-[#23211D] border border-white/10 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#EEEED2] mb-4">
              Dernières Parties Officiellement Homologuées
            </h2>
            <div className="space-y-3">
              {recentGames.length === 0 ? (
                <p className="text-xs text-slate-500">Aucune partie enregistrée pour ce joueur.</p>
              ) : (
                recentGames.slice(0, 6).map((g) => (
                  <div
                    key={g.id}
                    className="p-3 rounded-lg bg-[#161512] border border-white/5 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-200 truncate">
                        {g.whiteUsername} vs {g.blackUsername}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                        {g.timeControl} · {g.reason} · Précision {g.whiteAccuracy || 89}%
                      </div>
                    </div>
                    <span className="font-mono font-bold text-[#EEEED2] shrink-0">
                      {g.result}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
