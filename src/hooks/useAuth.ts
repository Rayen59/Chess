// src/hooks/useAuth.ts
// Hook personnalisé d'authentification (Inscription, Connexion JWT, OAuth Google Popup, Vérification Email)
import { useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { apiRequest } from '../lib/api.ts';
import { useAppStore, UserProfile } from '../store/useAppStore.ts';

export function useAuth() {
  const { user, token, verificationPreviewCode, setSession, updateUser, logout, setActivePage } =
    useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginWithEmail = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{
        token: string;
        user: UserProfile;
        verificationPreviewCode?: string;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setSession(data.user, data.token, data.verificationPreviewCode || null);
      setActivePage('lobby');
      return data.user;
    } catch (err: any) {
      setError(err.message || 'Échec de la connexion.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (payload: {
    email: string;
    password: string;
    username: string;
    countryCode: string;
    countryName: string;
    estimatedLevel: string;
    avatarUrl?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{
        token: string;
        user: UserProfile;
        verificationPreviewCode?: string;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSession(data.user, data.token, data.verificationPreviewCode || null);
      return data;
    } catch (err: any) {
      setError(err.message || 'Échec de l’inscription.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (countryCode = 'FR', countryName = 'France') => {
    setLoading(true);
    setError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      setSession(null, idToken);

      const data = await apiRequest<{ user: UserProfile; token: string }>('/api/auth/oauth-sync', {
        method: 'POST',
        body: JSON.stringify({
          countryCode,
          countryName,
          username: cred.user.displayName || undefined,
        }),
      });
      setSession(data.user, data.token, null);
      setActivePage('lobby');
      return data.user;
    } catch (err: any) {
      const code = err?.code || '';
      const msg = String(err?.message || '');
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        msg.includes('auth/popup-closed-by-user') ||
        msg.includes('auth/cancelled-popup-request')
      ) {
        setError('La fenêtre de connexion Google a été fermée. Vous pouvez réessayer ou vous connecter par email.');
        return null;
      }
      if (code === 'auth/popup-blocked' || msg.includes('auth/popup-blocked')) {
        setError('La fenêtre pop-up Google a été bloquée par votre navigateur. Veuillez autoriser les pop-ups ou vous connecter par email.');
        return null;
      }
      setError(err.message || 'Connexion Google interrompue.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const verifyEmailCode = async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ user: UserProfile; message: string }>(
        '/api/auth/verify-email',
        {
          method: 'POST',
          body: JSON.stringify({ code }),
        }
      );
      updateUser(data.user);
      return data;
    } catch (err: any) {
      setError(err.message || 'Code de vérification incorrect.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth).catch(() => {});
    } finally {
      logout();
    }
  };

  return {
    user,
    token,
    verificationPreviewCode,
    loading,
    error,
    setError,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    verifyEmailCode,
    handleLogout,
  };
}
