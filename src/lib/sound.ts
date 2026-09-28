// src/lib/sound.ts
// Synthétiseur audio Web Audio API pour les effets sonores d'échecs (déplacement, capture, échec, roque, fin)

class ChessSoundEngine {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playMove() {
    const ctx = this.getContext();
    if (!ctx) return;
    this.tone(ctx, 260, 0.06, 'triangle', 0.14);
  }

  public playCapture() {
    const ctx = this.getContext();
    if (!ctx) return;
    this.tone(ctx, 180, 0.08, 'sawtooth', 0.18);
    setTimeout(() => this.tone(ctx, 130, 0.07, 'triangle', 0.15), 35);
  }

  public playCheck() {
    const ctx = this.getContext();
    if (!ctx) return;
    this.tone(ctx, 587.33, 0.12, 'sine', 0.22);
    setTimeout(() => this.tone(ctx, 880, 0.18, 'sine', 0.2), 90);
  }

  public playCastle() {
    const ctx = this.getContext();
    if (!ctx) return;
    this.tone(ctx, 240, 0.05, 'triangle', 0.15);
    setTimeout(() => this.tone(ctx, 320, 0.06, 'triangle', 0.15), 75);
  }

  public playGameEnd(won = true) {
    const ctx = this.getContext();
    if (!ctx) return;
    const notes = won ? [440, 554.37, 659.25] : [392, 349.23, 311.13];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.tone(ctx, freq, 0.16, 'sine', 0.2), idx * 120);
    });
  }

  private tone(
    ctx: AudioContext,
    freq: number,
    durationSec: number,
    type: OscillatorType,
    gainVal: number
  ) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + durationSec);
    } catch {
      // Ignorer si l'interaction utilisateur n'a pas encore débloqué l'AudioContext
    }
  }
}

export const chessSounds = new ChessSoundEngine();
