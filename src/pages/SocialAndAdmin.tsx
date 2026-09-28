// src/pages/SocialAndAdmin.tsx
// Espace Social (Amis, Demandes, Défis directs, Canaux par pays, Signalements) & Dashboard Admin Fair-Play
import React, { useEffect, useState } from 'react';
import ReactCountryFlag from 'react-country-flag';
import {
  Users,
  UserPlus,
  ShieldAlert,
  Ban,
  VolumeX,
  RotateCcw,
  Check,
  Swords,
  Bell,
} from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { Chat } from '../components/Chat.tsx';
import { useSocket } from '../hooks/useSocket.ts';

export const SocialAndAdmin: React.FC<{ initialTab?: 'social' | 'admin' }> = ({
  initialTab = 'social',
}) => {
  const { user, startGameWithConfig, setActivePage } = useAppStore();
  const { socket } = useSocket();

  const [tab, setTab] = useState<'social' | 'admin'>(initialTab);
  const [friends, setFriends] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [friendUsername, setFriendUsername] = useState('');
  const [reportUsername, setReportUsername] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Données Admin
  const [adminData, setAdminData] = useState<{
    users: any[];
    recentGames: any[];
    reports: any[];
    suspiciousGames: any[];
  }>({ users: [], recentGames: [], reports: [], suspiciousGames: [] });

  const loadSocialData = async () => {
    if (!user) return;
    try {
      const res = await apiRequest<{ friends: any[]; notifications: any[] }>('/api/friends');
      setFriends(res.friends || []);
      setNotifications(res.notifications || []);
    } catch {
      // Ignorer
    }
  };

  const loadAdminData = async () => {
    try {
      const res = await apiRequest('/api/users/admin/overview');
      setAdminData(res);
    } catch {
      // Ignorer
    }
  };

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    loadSocialData();
    loadAdminData();
  }, [user?.uid]);

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setActivePage('login');
      return;
    }
    try {
      const res = await apiRequest<{ message: string }>('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ targetUsername: friendUsername }),
      });
      setFeedback(res.message);
      setFriendUsername('');
      loadSocialData();
    } catch (err: any) {
      setFeedback(err.message);
    }
  };

  const handleRespondFriend = async (friendshipId: number, status: 'ACCEPTED' | 'BLOCKED') => {
    try {
      await apiRequest('/api/friends/respond', {
        method: 'POST',
        body: JSON.stringify({ friendshipId, status }),
      });
      loadSocialData();
    } catch {
      // Ignorer
    }
  };

  const handleChallengeFriend = (targetUid: string, targetUsername: string) => {
    const code = `DUEL-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    socket.emit('friend:challenge', {
      challengerUid: user?.uid || 'guest',
      challengerUsername: user?.username || 'Joueur',
      targetUid,
      targetUsername,
      roomCode: code,
      timeControl: '3+2',
    });
    startGameWithConfig({
      mode: 'online',
      roomCode: code,
      timeControl: '3+2',
      category: 'blitz',
      playerColor: 'w',
    });
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setActivePage('login');
      return;
    }
    try {
      const res = await apiRequest<{ message: string }>('/api/friends/report', {
        method: 'POST',
        body: JSON.stringify({
          reportedUsername: reportUsername,
          reason: reportReason,
        }),
      });
      setFeedback(res.message);
      setReportUsername('');
      setReportReason('');
      loadAdminData();
    } catch (err: any) {
      setFeedback(err.message);
    }
  };

  const handleAdminAction = async (
    action: 'TOGGLE_BAN' | 'TOGGLE_MUTE' | 'RESET_ELO' | 'RESOLVE_REPORT',
    targetUid?: string,
    reportId?: number
  ) => {
    if (!user) {
      setActivePage('login');
      return;
    }
    try {
      const res = await apiRequest<{ message: string }>('/api/users/admin/action', {
        method: 'POST',
        body: JSON.stringify({ action, targetUid, reportId }),
      });
      setFeedback(res.message);
      loadAdminData();
    } catch (err: any) {
      setFeedback(err.message);
    }
  };

  return (
    <div className="max-w-[1320px] mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24 md:pb-8 space-y-5">
      {/* Barre de navigation Social / Admin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#23211D] border border-white/10 rounded-xl p-3 sm:p-4">
        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('social')}
            className={`min-h-[42px] px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
              tab === 'social'
                ? 'bg-[#769656] text-white'
                : 'bg-[#161512] text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>Club & Amis</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('admin')}
            className={`min-h-[42px] px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
              tab === 'admin'
                ? 'bg-[#769656] text-white'
                : 'bg-[#161512] text-slate-300 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Console Arbitre</span>
          </button>
        </div>

        {feedback && <span className="text-xs text-[#769656] font-semibold">{feedback}</span>}
      </div>

      {tab === 'social' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Gestion des Amis & Défis Directs */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-[#23211D] border border-white/10 rounded-xl p-6 space-y-4">
              <h2 className="text-base font-bold text-[#EEEED2] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#769656]" />
                <span>Ajouter un Ami ou Lancer un Défi Direct</span>
              </h2>

              <form onSubmit={handleSendFriendRequest} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={friendUsername}
                  onChange={(e) => setFriendUsername(e.target.value)}
                  placeholder="Pseudo exact (ex: AlirezaFirouzja, MagnusCarlsen_NO)..."
                  className="flex-1 px-3.5 py-2 bg-[#161512] border border-white/10 rounded-lg text-xs text-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#769656] hover:bg-[#86a666] text-white text-xs font-semibold rounded-lg whitespace-nowrap"
                >
                  Envoyer Demande
                </button>
              </form>

              <div className="space-y-2 pt-2">
                {friends.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Ajoutez un joueur par son pseudo pour le défier en un clic.
                  </p>
                ) : (
                  friends.map((f) => {
                    const isRequester = f.requesterUid === user?.uid;
                    const friendName = isRequester ? f.addresseeUsername : f.requesterUsername;
                    const friendUid = isRequester ? f.addresseeUid : f.requesterUid;
                    const friendCountry = isRequester ? f.addresseeCountry : f.requesterCountry;

                    return (
                      <div
                        key={f.id}
                        className="p-3 bg-[#161512] border border-white/10 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <ReactCountryFlag
                            countryCode={friendCountry || 'FR'}
                            svg
                            style={{ width: '1.2em', height: '0.9em' }}
                          />
                          <span className="font-semibold text-white">{friendName}</span>
                          <span className="text-slate-400">· {f.status}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {f.status === 'PENDING' && !isRequester && (
                            <button
                              type="button"
                              onClick={() => handleRespondFriend(f.id, 'ACCEPTED')}
                              className="px-2.5 py-1 bg-[#769656] text-white rounded font-semibold"
                            >
                              Accepter
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleChallengeFriend(friendUid, friendName)}
                            className="px-2.5 py-1 bg-[#23211D] hover:bg-white/10 text-[#EEEED2] border border-white/10 rounded flex items-center gap-1"
                          >
                            <Swords className="w-3.5 h-3.5 text-[#769656]" />
                            <span>Défier</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Notifications Temps Réel & Signalement Fair-Play */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#23211D] border border-white/10 rounded-xl p-5 space-y-3">
                <h3 className="text-xs font-semibold text-slate-300 uppercase flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-[#769656]" />
                  <span>Notifications ({notifications.length})</span>
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-500">Aucune notification récente.</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="p-2.5 bg-[#161512] rounded-lg text-xs">
                        <div className="font-semibold text-white">{n.title}</div>
                        <div className="text-slate-400 mt-0.5">{n.body}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <form
                onSubmit={handleSubmitReport}
                className="bg-[#23211D] border border-white/10 rounded-xl p-5 space-y-3"
              >
                <h3 className="text-xs font-semibold text-slate-300 uppercase flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>Signaler une Triche / Abus</span>
                </h3>
                <input
                  type="text"
                  required
                  value={reportUsername}
                  onChange={(e) => setReportUsername(e.target.value)}
                  placeholder="Pseudo du joueur suspect"
                  className="w-full px-3 py-2 bg-[#161512] border border-white/10 rounded-lg text-xs text-white"
                />
                <input
                  type="text"
                  required
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Motif (ex: Aide moteur suspectée)"
                  className="w-full px-3 py-2 bg-[#161512] border border-white/10 rounded-lg text-xs text-white"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg"
                >
                  Transmettre au Comité Fair-Play
                </button>
              </form>
            </div>
          </div>

          {/* Canaux de Discussion Publics par Pays */}
          <div className="lg:col-span-5 h-[480px]">
            <Chat defaultChannel={`country:${user?.countryCode || 'FR'}`} />
          </div>
        </div>
      ) : (
        /* Dashboard Admin : Joueurs, Signalements, Bannissement, Mute, Reset ELO & Logs Suspects */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Signalements & Logs Anti-Triche */}
            <div className="bg-[#23211D] border border-white/10 rounded-xl p-6 space-y-4">
              <h2 className="text-sm font-bold text-[#EEEED2]">
                Signalements & Détection Temps de Coup Anormal ({adminData.reports.length})
              </h2>
              <div className="space-y-2.5">
                {adminData.reports.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 bg-[#161512] border border-white/10 rounded-lg flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">
                        Signalé : <span className="text-amber-400">{r.reportedUsername}</span> (par{' '}
                        {r.reporterUsername})
                      </div>
                      <div className="text-slate-400 mt-0.5">{r.reason}</div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        Statut : {r.status}
                      </div>
                    </div>
                    {r.status !== 'RESOLVED' && (
                      <button
                        type="button"
                        onClick={() => handleAdminAction('RESOLVE_REPORT', undefined, r.id)}
                        className="px-3 py-1.5 bg-[#769656] text-white rounded-md font-semibold flex items-center gap-1 shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Classer</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Gestion des Joueurs : Ban, Mute, Reset ELO */}
            <div className="bg-[#23211D] border border-white/10 rounded-xl p-6 space-y-4">
              <h2 className="text-sm font-bold text-[#EEEED2]">
                Modération des Comptes Joueurs ({adminData.users.length})
              </h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {adminData.users.map((u) => (
                  <div
                    key={u.uid}
                    className="p-3 bg-[#161512] border border-white/10 rounded-lg flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">
                        {u.username}{' '}
                        <span className="font-mono text-slate-400">({u.eloBlitz} ELO)</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {u.email} · {u.isBanned ? 'SUSPENDU' : 'Actif'} ·{' '}
                        {u.isMuted ? 'MUTE' : 'Chat OK'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAdminAction('TOGGLE_BAN', u.uid)}
                        className="p-1.5 bg-[#23211D] hover:bg-red-950/70 text-red-400 border border-white/10 rounded"
                        title="Bannir / Débannir"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdminAction('TOGGLE_MUTE', u.uid)}
                        className="p-1.5 bg-[#23211D] hover:bg-amber-950/70 text-amber-400 border border-white/10 rounded"
                        title="Mute / Unmute Chat"
                      >
                        <VolumeX className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdminAction('RESET_ELO', u.uid)}
                        className="p-1.5 bg-[#23211D] hover:bg-white/10 text-slate-300 border border-white/10 rounded"
                        title="Réinitialiser ELO à 1200"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
