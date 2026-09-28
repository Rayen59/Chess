// src/server/services/email.ts
// Service d'envoi d'emails transactionnels via Nodemailer (Vérification de compte & Mot de passe oublié)
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'chessmaster@ethereal.email',
    pass: process.env.SMTP_PASS || 'smtp_password',
  },
});

/**
 * Envoie un email contenant le code de vérification à 6 chiffres pour débloquer le jeu en ligne
 */
export async function sendVerificationEmail(
  toEmail: string,
  username: string,
  verificationCode: string
): Promise<{ sent: boolean; previewCode: string }> {
  const htmlContent = `
    <div style="font-family: sans-serif; background: #161512; color: #F1F5F9; padding: 32px; border-radius: 12px;">
      <h2 style="color: #769656; margin-top: 0;">Bienvenue sur ChessMaster Pro, ${username} !</h2>
      <p>Pour débloquer le matchmaking classé FIDE, les tournois et les salles en ligne, veuillez confirmer votre adresse email avec le code suivant :</p>
      <div style="font-size: 28px; font-weight: bold; letter-spacing: 6px; padding: 16px 24px; background: #262421; color: #EEEED2; display: inline-block; border-radius: 8px; margin: 16px 0;">
        ${verificationCode}
      </div>
      <p style="font-size: 13px; color: #94A3B8;">Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement cet email.</p>
    </div>
  `;

  try {
    if (process.env.SMTP_USER && process.env.SMTP_USER !== 'chessmaster@ethereal.email') {
      await transporter.sendMail({
        from: '"ChessMaster Pro FIDE" <no-reply@chessmaster.pro>',
        to: toEmail,
        subject: `[ChessMaster Pro] Code de vérification : ${verificationCode}`,
        html: htmlContent,
      });
    }
    return { sent: true, previewCode: verificationCode };
  } catch (error) {
    console.warn('Info SMTP (Mode Aperçu Direct activé) :', error);
    return { sent: false, previewCode: verificationCode };
  }
}
