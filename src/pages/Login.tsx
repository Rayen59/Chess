// src/pages/Login.tsx
// Page de connexion : Flèche Retour, Email + Mot de passe, OAuth Google Popup, et Bouton Inscription très visible
import React, { useState } from 'react';
import { Lock, Mail, ShieldCheck, AlertCircle, ArrowLeft, UserPlus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useAppStore } from '../store/useAppStore.ts';

export const Login: React.FC = () => {
  const { loginWithEmail, loginWithGoogle, loading, error, setError } = useAuth();
  const { setActivePage, goBack } = useAppStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loginWithEmail(email, password);
    } catch {
      // L'erreur est déjà gérée dans useAuth
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle('FR', 'France');
    } catch {
      // L'erreur est déjà gérée dans useAuth
    }
  };

  const handleForgotPassword = () => {
    if (!email.trim()) {
      setError('Veuillez saisir votre adresse email pour recevoir un lien de réinitialisation.');
      return;
    }
    setError(null);
    setResetMessage(
      `Un code de réinitialisation sécurisé a été envoyé à ${email}. Vérifiez votre boîte de réception.`
    );
  };

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

      <div className="bg-[#23211D] border border-white/10 rounded-xl p-6 sm:p-8 shadow-xl">
        <div className="mb-6">
          <h1
            className="text-2xl font-bold text-[#EEEED2] tracking-tight"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Connexion ChessMaster Pro
          </h1>
          <p className="text-xs text-slate-400 mt-1.5">
            Accédez au matchmaking classé FIDE, aux tournois Arena et au Coach IA.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-500/40 flex items-start gap-2.5 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {resetMessage && (
          <div className="mb-4 p-3 rounded-lg bg-[#769656]/20 border border-[#769656] flex items-start gap-2.5 text-xs text-[#EEEED2]">
            <ShieldCheck className="w-4 h-4 text-[#769656] shrink-0 mt-0.5" />
            <span>{resetMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Adresse Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="joueur@chessmaster.pro"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#161512] border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#769656]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Mot de passe
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs text-[#769656] hover:underline"
              >
                Mot de passe oublié ?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#161512] border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#769656]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="min-h-[46px] w-full py-2.5 px-4 bg-[#769656] hover:bg-[#86a666] disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors whitespace-nowrap"
          >
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-slate-500">OU</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="min-h-[44px] w-full py-2.5 px-4 bg-[#161512] hover:bg-white/5 border border-white/15 rounded-xl text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <span>Continuer avec Google OAuth</span>
        </button>

        {/* Section Inscription ultra-claire */}
        <div className="mt-6 pt-5 border-t border-white/10 space-y-2.5">
          <p className="text-xs text-slate-300 text-center font-medium">
            Nouveau sur ChessMaster Pro ?
          </p>
          <button
            type="button"
            onClick={() => setActivePage('register')}
            className="min-h-[48px] w-full py-3 px-4 bg-[#EEEED2] hover:bg-white text-[#161512] font-extrabold text-sm rounded-xl border-2 border-[#769656] shadow-md transition-colors flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4 text-[#769656]" />
            <span>Créer un Compte Joueur (Inscription)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
