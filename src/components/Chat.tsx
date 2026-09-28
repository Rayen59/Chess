// src/components/Chat.tsx
// Chat temps réel modéré (Socket.io + PostgreSQL) avec sélecteur de canal et réactions rapides
import React, { useEffect, useRef, useState } from 'react';
import ReactCountryFlag from 'react-country-flag';
import { Send } from 'lucide-react';
import { useSocket } from '../hooks/useSocket.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { apiRequest } from '../lib/api.ts';

interface ChatMessage {
  id?: number;
  senderUid: string;
  senderUsername: string;
  senderCountry: string;
  channel: string;
  content: string;
  createdAt?: string;
}

interface ChatProps {
  defaultChannel?: string;
  compact?: boolean;
}

const QUICK_REACTIONS = ['Bien joué !', 'Bonne partie !', 'Merci !', 'Belle tactique !'];

export const Chat: React.FC<ChatProps> = ({ defaultChannel = 'global', compact = false }) => {
  const { user } = useAppStore();
  const { socket } = useSocket();
  const [channel, setChannel] = useState<string>(defaultChannel);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setChannel(defaultChannel);
  }, [defaultChannel]);

  // Charger l'historique du canal depuis PostgreSQL
  useEffect(() => {
    let active = true;
    apiRequest<{ messages: ChatMessage[] }>(`/api/friends/messages?channel=${encodeURIComponent(channel)}`)
      .then((res) => {
        if (active && res.messages) {
          setMessages(res.messages);
        }
      })
      .catch(() => {});

    socket.emit('chat:joinChannel', channel);

    const handleNewMessage = (msg: ChatMessage) => {
      if (msg.channel === channel) {
        setMessages((prev) => {
          if (msg.id && prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    socket.on('chat:new', handleNewMessage);
    return () => {
      active = false;
      socket.off('chat:new', handleNewMessage);
    };
  }, [channel, socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendMessage = (textToSend?: string) => {
    const raw = (textToSend ?? input).trim();
    if (!raw) return;

    const senderUid = user?.uid || `guest-${socket.id}`;
    const senderUsername = user?.username || 'Invité';
    const senderCountry = user?.countryCode || 'FR';

    socket.emit('chat:message', {
      senderUid,
      senderUsername,
      senderCountry,
      channel,
      content: raw,
    });

    if (!textToSend) {
      setInput('');
    }
  };

  const countryChannel = `country:${user?.countryCode || 'FR'}`;

  return (
    <div className="flex flex-col bg-[#1D1B18] border border-white/10 rounded-lg overflow-hidden h-full">
      {/* Sélecteur de canal */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-[#23211D]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setChannel(defaultChannel)}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              channel === defaultChannel
                ? 'bg-[#769656] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {defaultChannel.startsWith('room:') ? 'Salle' : 'Global'}
          </button>
          <button
            type="button"
            onClick={() => setChannel(countryChannel)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              channel === countryChannel
                ? 'bg-[#769656] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ReactCountryFlag countryCode={user?.countryCode || 'FR'} svg />
            <span>Canal {user?.countryCode || 'FR'}</span>
          </button>
        </div>
        <span className="text-[11px] text-slate-400">Chat modéré</span>
      </div>

      {/* Liste des messages */}
      <div
        className={`flex-1 overflow-y-auto p-3 space-y-2 ${
          compact ? 'max-h-[180px] min-h-[140px]' : 'max-h-[300px] min-h-[200px]'
        }`}
      >
        {messages.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            Aucun message dans ce canal. Dites bonjour et bonne partie !
          </p>
        ) : (
          messages.map((m, idx) => (
            <div key={m.id || idx} className="text-xs leading-relaxed break-words">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-200 mr-1.5">
                <ReactCountryFlag countryCode={m.senderCountry || 'FR'} svg />
                <span>{m.senderUsername}:</span>
              </span>
              <span className="text-slate-300">{m.content}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Réactions rapides de courtoisie échiquéenne */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-white/5 bg-[#191815] overflow-x-auto">
        {QUICK_REACTIONS.map((phrase) => (
          <button
            key={phrase}
            type="button"
            onClick={() => sendMessage(phrase)}
            className="px-2 py-0.5 text-[11px] bg-white/5 hover:bg-white/10 text-slate-300 rounded transition-colors whitespace-nowrap shrink-0"
          >
            {phrase}
          </button>
        ))}
      </div>

      {/* Champ de saisie */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="flex items-center gap-2 p-2 border-t border-white/10 bg-[#23211D]"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            user?.isMuted
              ? 'Compte en sourdine...'
              : 'Envoyer un message...'
          }
          disabled={Boolean(user?.isMuted)}
          className="flex-1 bg-[#161512] border border-white/10 rounded px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#769656]"
        />
        <button
          type="submit"
          disabled={!input.trim() || Boolean(user?.isMuted)}
          className="p-1.5 rounded bg-[#769656] text-white hover:bg-[#86a666] disabled:opacity-40 transition-colors"
          aria-label="Envoyer le message"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
