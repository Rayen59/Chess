// src/server/socket/chatHandler.ts
// Gestionnaire Socket.io du Chat modéré en jeu, des canaux par pays et des défis entre amis
import { Server, Socket } from 'socket.io';
import { createMessageRecord, createNotificationRecord } from '../../db/queries.ts';

const BANNED_WORDS = ['tricheur', 'idiot', 'imbécile', 'stupide', 'hack', 'cheatbot'];

function sanitizeChatMessage(raw: string): string {
  let clean = raw.trim().slice(0, 350);
  for (const word of BANNED_WORDS) {
    const regex = new RegExp(word, 'gi');
    clean = clean.replace(regex, '***');
  }
  return clean;
}

export function registerChatHandlers(io: Server, socket: Socket) {
  socket.on('chat:joinChannel', (channel: string) => {
    if (channel) {
      socket.join(`chat:${channel}`);
    }
  });

  socket.on(
    'chat:message',
    async (payload: {
      senderUid: string;
      senderUsername: string;
      senderCountry: string;
      channel: string;
      content: string;
      recipientUid?: string;
    }) => {
      try {
        const cleanContent = sanitizeChatMessage(String(payload.content || ''));
        if (!cleanContent) return;

        const saved = await createMessageRecord({
          senderUid: payload.senderUid,
          senderUsername: payload.senderUsername,
          senderCountry: payload.senderCountry || 'FR',
          channel: payload.channel || 'global',
          content: cleanContent,
          recipientUid: payload.recipientUid || null,
        });

        // Diffuser à tous les abonnés du canal et en global
        io.emit('chat:new', saved);
      } catch (error) {
        console.error('Socket chat:message error:', error);
      }
    }
  );

  // Défi direct entre amis avec notification temps réel
  socket.on(
    'friend:challenge',
    async (payload: {
      challengerUid: string;
      challengerUsername: string;
      targetUid: string;
      targetUsername: string;
      roomCode: string;
      timeControl: string;
    }) => {
      try {
        const notif = await createNotificationRecord({
          userUid: payload.targetUid,
          type: 'GAME_CHALLENGE',
          title: `Défi Échecs (${payload.timeControl})`,
          body: `${payload.challengerUsername} vous défie en direct dans la salle ${payload.roomCode} !`,
          link: payload.roomCode,
        });

        io.emit('notification:new', notif);
      } catch (error) {
        console.error('Socket friend:challenge error:', error);
      }
    }
  );
}
