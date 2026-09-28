// src/pages/Register.tsx
// Page d'inscription complète : Flèche Retour, Validation Zod, Choix obligatoire du Pays ISO avec drapeau,
// vérification d'unicité du pseudo en temps réel, niveau estimé et validation Email obligatoire
import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  UserCheck,
  ArrowLeft,
  UserPlus,
} from 'lucide-react';
import { CountrySelector } from '../components/CountrySelector.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { apiRequest } from '../lib/api.ts';
import { useAppStore } from '../store/useAppStore.ts';

const ESTIMATED_LEVELS = [
  'Débutant (800)',
  'Intermédiaire (1200)',
  'Avancé (1600)',
  'Expert (2000+)',
];

export const Register: React.FC = () => {
  const {
    user,
    verificationPreviewCode,
    registerWithEmail,
    verifyEmailCode,
    loading,
    error,
  } = useAuth();
  const { setActivePage, goBack } = useAppStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [countryCode, setCountryCode] = useState('FR');
  const [countryName, setCountryName] = useState('France');
  const [estimatedLevel, setEstimatedLevel] = useState('Intermédiaire (1200)');

  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    reason: string;
  }>({ checking: false, available: null, reason: '' });

  const [verificationCodeInput, setVerificationCodeInput] = useState('');
  const [verifiedSuccessMsg, setVerifiedSuccessMsg] = useState<string | null>(null);

  // Vérification en temps réel de l'unicité du pseudo
  useEffect(() => {
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      setUsernameStatus({
        checking: false,
        available: null,
        reason: trimmed.length > 0 ? 'Minimum 3 caractères requis.' : '',
      });
      return;
    }

    setUsernameStatus((prev) => ({ ...prev, checking: true }));
    const timer = setTimeout(async () => {
      try {
        const res = await apiRequest<{ available: boolean; reason: string }>(
          `/api/auth/check-username?username=${encodeURIComponent(trimmed)}`
        );
        setUsernameStatus({
          checking: false,
          available: res.available,
          reason: res.reason,
        });
      } catch {
        setUsernameStatus({ checking: false, available: null, reason: '' });
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [username]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await registerWithEmail({
        email,
        password,
        username: username.trim(),
        countryCode,
        countryName,
        estimatedLevel,
      });
      if (res.verificationPreviewCode) {
        setVerificationCodeInput(res.verificationPreviewCode);
      }
    } catch {
      // Erreur gérée par useAuth
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await verifyEmailCode(verificationCodeInput.trim());
      setVerifiedSuccessMsg(res.message);
      setTimeout(() => setActivePage('lobby'), 1000);
    } catch {
      // Erreur gérée par useAuth
    }
  };

  // Étape 2 : Si le compte est créé mais l'email n'est pas encore vérifié
  if (user && !user.emailVerified) {
    return (
      <div className="max-w-md mx-auto py-6 sm:py-10 px-4 pb-24 md:pb-10">
        <div className="mb-4">
          <button
            type="button"
            onClick={goBack}
            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#23211D] hover:bg-white/10 border border-white/15 text-[#EEEED2] text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[#95BB4A]" />
            <span>Retour</span>
          </button>
        </div>

        <div className="bg-[#23211D] border border-[#769656] rounded-xl p-6 sm:p-8 shadow-xl">
          <div className="flex items-center gap-2.5 text-[#769656] mb-3">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <h2 className="text-lg font-bold text-white">
              Vérification Email Obligatoire
            </h2>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            Conformément au règlement Fair-Play de <strong>ChessMaster Pro</strong>, l’accès au
            matchmaking en ligne et aux tournois est bloqué tant que votre adresse{' '}
            <span className="text-white font-semibold">{user.email}</span> n’est pas vérifiée.
          </p>

          {verificationPreviewCode && (
            <div className="mb-4 p-3.5 rounded-lg bg-[#161512] border border-[#769656]/50">
              <div className="text-[11px] text-slate-400 mb-1">
                Code envoyé par Nodemailer (Aperçu direct boîte de réception) :
              </div>
              <div className="font-mono text-xl font-bold tracking-widest text-[#EEEED2] tabular-nums">
                {verificationPreviewCode}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-xs text-red-200">
              {error}
            </div>
          )}

          {verifiedSuccessMsg && (
            <div className="mb-4 p-3 rounded-lg bg-[#769656]/25 border border-[#769656] text-xs text-white">
              {verifiedSuccessMsg}
            </div>
          )}

          <form onSubmit={handleVerifySubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Code de vérification à 6 chiffres
              </label>
              <input
                type="text"
                required
                value={verificationCodeInput}
                onChange={(e) => setVerificationCodeInput(e.target.value)}
                placeholder="Ex: 482910"
                className="w-full px-3.5 py-2.5 bg-[#161512] border border-white/15 rounded-lg font-mono text-base tracking-widest text-white focus:outline-none focus:border-[#769656]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="min-h-[46px] w-full py-2.5 px-4 bg-[#769656] hover:bg-[#86a666] text-white font-bold text-sm rounded-xl transition-colors whitespace-nowrap"
            >
              {loading ? 'Validation...' : 'Valider mon Email & Débloquer le Jeu en Ligne'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-6 sm:py-8 px-4 pb-24 md:pb-10">
      <div className="mb-4">
        <button
          type="button"
          onClick={goBack}
          className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#23211D] hover:bg-white/10 border border-white/15 text-[#EEEED2] text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-[#95BB4A]" />
          <span>Retour</span>
        </button>
      </div>

      <div className="bg-[#23211D] border-2 border-[#769656]/60 rounded-xl p-6 sm:p-8 shadow-xl">
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#769656]/25 border border-[#769656] text-[#95BB4A] text-[11px] font-bold mb-2">
            <UserPlus className="w-3.5 h-3.5" />
            <span>CRÉATION DE COMPTE JOUEUR OFFICIEL</span>
          </div>
          <h1
            className="text-2xl font-bold text-[#EEEED2] tracking-tight"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Inscription Officielle FIDE
          </h1>
          <p className="text-xs text-slate-400 mt-1.5">
            Choisissez votre pays de fédération, votre pseudo unique et votre niveau initial.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-500/40 flex items-start gap-2.5 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          {/* Pseudo unique vérifié en temps réel */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Pseudo Unique *
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ex: GrandMaitre_Paris"
              className="w-full px-3.5 py-2.5 bg-[#161512] border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#769656]"
            />
            {usernameStatus.reason && (
              <div
                className={`mt-1.5 flex items-center gap-1.5 text-xs ${
                  usernameStatus.available ? 'text-[#769656]' : 'text-amber-400'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{usernameStatus.reason}</span>
              </div>
            )}
          </div>

          {/* Choix obligatoire du Pays ISO avec drapeau */}
          <CountrySelector
            label="Pays de Fédération (Obligatoire) *"
            selectedCode={countryCode}
            onSelect={(c) => {
              setCountryCode(c.code);
              setCountryName(c.name);
            }}
          />

          {/* Niveau estimé (calibre l'ELO initial) */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Niveau d’Échecs Estimé *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ESTIMATED_LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setEstimatedLevel(lvl)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border text-left transition-colors whitespace-nowrap truncate ${
                    estimatedLevel === lvl
                      ? 'bg-[#769656]/25 border-[#769656] text-white'
                      : 'bg-[#161512] border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Adresse Email *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre.email@exemple.fr"
              className="w-full px-3.5 py-2.5 bg-[#161512] border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#769656]"
            />
          </div>

          {/* Mot de passe fort */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Mot de passe (min. 8 caractères, 1 majuscule, 1 chiffre) *
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-[#161512] border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#769656]"
            />
          </div>

          <button
            type="submit"
            disabled={loading || usernameStatus.available === false}
            className="min-h-[50px] w-full py-3 px-4 bg-[#EEEED2] hover:bg-white disabled:opacity-50 text-[#161512] font-extrabold text-sm rounded-xl border-2 border-[#769656] shadow-lg transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-[#769656] shrink-0" />
            <span>
              {loading ? 'Création du profil...' : 'Valider mon Inscription & Recevoir le Code'}
            </span>
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-white/10 text-center">
          <p className="text-xs text-slate-400">
            Déjà inscrit sur ChessMaster Pro ?{' '}
            <button
              type="button"
              onClick={() => setActivePage('login')}
              className="text-[#95BB4A] font-bold hover:underline"
            >
              Se connecter ici
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
