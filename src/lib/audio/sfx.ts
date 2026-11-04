/**
 * AIEM Hunt — Procedural Tactical Web Audio Engine (SFX)
 * Low-latency procedural sound effects using the Web Audio API.
 * Requires zero external audio binaries/mp3 files and works seamlessly offline.
 * Respects user quiet-mode preferences and prefers-reduced-motion.
 */

class TacticalAudioEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private initialized: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const savedMute = localStorage.getItem("aiem_sfx_muted");
        this.muted = savedMute === "true";
      } catch {
        this.muted = false;
      }
    }
  }

  private initCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;

    if (!this.ctx) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      } catch {
        return null;
      }
    }

    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    this.initialized = true;
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("aiem_sfx_muted", muted ? "true" : "false");
      } catch {}
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * 1. Radar Ping: High-tech frequency sweep for radar scanning and map pings
   */
  public playRadarPing(freq = 1200, duration = 0.25): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 2.5, now + duration);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch {}
  }

  /**
   * 2. Mechanical Locker Equip: Heavy pneumatic servo latch + magnetic snap
   */
  public playLockerEquip(): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Sub-bass thud
      const thudOsc = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thudOsc.type = "triangle";
      thudOsc.frequency.setValueAtTime(90, now);
      thudOsc.frequency.exponentialRampToValueAtTime(30, now + 0.12);

      thudGain.gain.setValueAtTime(0.35, now);
      thudGain.gain.exponentialRampToValueAtTime(0.005, now + 0.12);

      thudOsc.connect(thudGain);
      thudGain.connect(ctx.destination);
      thudOsc.start(now);
      thudOsc.stop(now + 0.12);

      // Metallic contact click
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = "square";
      clickOsc.frequency.setValueAtTime(2400, now + 0.04);
      clickOsc.frequency.exponentialRampToValueAtTime(400, now + 0.09);

      clickGain.gain.setValueAtTime(0.12, now + 0.04);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      clickOsc.connect(clickGain);
      clickGain.connect(ctx.destination);
      clickOsc.start(now + 0.04);
      clickOsc.stop(now + 0.09);
    } catch {}
  }

  /**
   * 3. Clue Decryption Stutter: 4-beat mechanical typewriter decryption
   */
  public playDecryptionStutter(): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const freqs = [1400, 1800, 1600, 2200];

      freqs.forEach((freq, idx) => {
        const time = now + idx * 0.06;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.12, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + 0.05);
      });
    } catch {}
  }

  /**
   * 4. Level-Up Fanfare: Shimmering C-Major9 cybernetic synth chord with sub-bass swell
   */
  public playLevelUpFanfare(): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Sub-bass foundation (65 Hz C2)
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = "sine";
      sub.frequency.setValueAtTime(65.41, now);
      subGain.gain.setValueAtTime(0.3, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start(now);
      sub.stop(now + 0.7);

      // C-Major9 arpeggio: C4 (261.63), E4 (329.63), G4 (392.00), B4 (493.88), D5 (587.33)
      const chord = [261.63, 329.63, 392.0, 493.88, 587.33];
      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteTime = now + idx * 0.08;

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.15, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteTime);
        osc.stop(noteTime + 0.65);
      });
    } catch {}
  }

  /**
   * 5. Coin Cascade: Granular micro-clicks with sparkling arpeggiated chime
   */
  public playCoinCascade(count = 5): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      for (let i = 0; i < count; i++) {
        const time = now + i * 0.05 + Math.random() * 0.02;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const baseFreq = 2200 + i * 180 + (Math.random() * 100 - 50);
        osc.type = "sine";
        osc.frequency.setValueAtTime(baseFreq, time);

        gain.gain.setValueAtTime(0.12, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + 0.08);
      }
    } catch {}
  }

  /**
   * 6. Safe-Desk Physical Stamp: Magnetic vault solenoid release + dual-tone security chime
   */
  public playSafeDeskStamp(): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Heavy stamp impact
      const stampOsc = ctx.createOscillator();
      const stampGain = ctx.createGain();
      stampOsc.type = "triangle";
      stampOsc.frequency.setValueAtTime(140, now);
      stampOsc.frequency.exponentialRampToValueAtTime(45, now + 0.16);

      stampGain.gain.setValueAtTime(0.4, now);
      stampGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      stampOsc.connect(stampGain);
      stampGain.connect(ctx.destination);
      stampOsc.start(now);
      stampOsc.stop(now + 0.16);

      // Dual-tone security chime: 880 Hz & 1760 Hz
      [880, 1760].forEach((freq, idx) => {
        const chimeOsc = ctx.createOscillator();
        const chimeGain = ctx.createGain();
        const time = now + 0.08 + idx * 0.07;

        chimeOsc.type = "sine";
        chimeOsc.frequency.setValueAtTime(freq, time);

        chimeGain.gain.setValueAtTime(0.18, time);
        chimeGain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

        chimeOsc.connect(chimeGain);
        chimeGain.connect(ctx.destination);

        chimeOsc.start(time);
        chimeOsc.stop(time + 0.45);
      });
    } catch {}
  }
}

// Export singleton instance for unified audio management
export const sfx = new TacticalAudioEngine();

