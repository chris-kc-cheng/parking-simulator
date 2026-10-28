/**
 * Synthesized Web Audio engine for realistic vehicle acoustics:
 * - Engine idle & acceleration tone
 * - Ultrasonic parking sensor beeps (dynamic repetition based on distance)
 * - Reverse gear alert chime
 * - Impact / scrape sound
 * - Gear shifting mechanical click
 * - Success chime
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  // Engine sound nodes
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;

  // Sonar state
  private lastBeepTime: number = 0;
  private sonarTimer: number | null = null;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  public init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();

      // Master engine oscillator (low rumble)
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

      this.engineSubOsc = this.ctx.createOscillator();
      this.engineSubOsc.type = 'triangle';
      this.engineSubOsc.frequency.setValueAtTime(28, this.ctx.currentTime);

      // Low pass filter to simulate engine dampening inside cabin
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.setValueAtTime(140, this.ctx.currentTime);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

      this.engineOsc.connect(engineFilter);
      this.engineSubOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc.start();
      this.engineSubOsc.start();

      this.isInitialized = true;
    } catch {
      // Audio context restricted or unavailable
    }
  }

  public updateEngine(speedKmh: number, rpm: number, isReverse: boolean) {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (this.engineOsc && this.engineGain) {
      // Base engine pitch: 40Hz at idle (800 RPM), up to 130Hz at higher RPM
      const baseFreq = 35 + (rpm / 3000) * 60 + Math.abs(speedKmh) * 1.5;
      this.engineOsc.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, 0.05);

      if (this.engineSubOsc) {
        this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, this.ctx.currentTime, 0.05);
      }

      const gain = isReverse ? 0.06 : 0.04 + Math.min(0.06, (Math.abs(speedKmh) / 20) * 0.03);
      this.engineGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.1);
    }
  }

  public updateSonar(closestDistanceMeters: number, isReverse: boolean) {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;

    // Only active when in reverse and obstacle is within 2.0 meters
    if (!isReverse || closestDistanceMeters >= 2.0 || closestDistanceMeters <= 0) {
      return;
    }

    const now = performance.now();

    // Determine interval between beeps based on distance
    // 1.8m: 750ms interval
    // 1.0m: 400ms interval
    // 0.5m: 200ms interval
    // < 0.35m: continuous tone (70ms interval)
    let interval = 700;
    if (closestDistanceMeters < 0.35) {
      interval = 60; // Solid tone
    } else if (closestDistanceMeters < 0.7) {
      interval = 160;
    } else if (closestDistanceMeters < 1.2) {
      interval = 350;
    } else if (closestDistanceMeters < 1.7) {
      interval = 550;
    }

    if (now - this.lastBeepTime >= interval) {
      this.lastBeepTime = now;
      this.playBeepTone(closestDistanceMeters < 0.35);
    }
  }

  private playBeepTone(isContinuous: boolean) {
    if (!this.ctx || this.isMuted) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      // High-pitched crystal clear parking sensor tone
      osc.frequency.setValueAtTime(isContinuous ? 1500 : 1300, this.ctx.currentTime);

      const duration = isContinuous ? 0.05 : 0.08;
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Audio node failure fallback
    }
  }

  public playGearShift() {
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + 0.06);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch {
      // Ignore
    }
  }

  public playCollision() {
    if (!this.ctx || this.isMuted) return;
    try {
      // Heavy metal crunch / thud
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
    } catch {
      // Ignore
    }
  }

  public playSuccessFanfare() {
    if (!this.ctx || this.isMuted) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.12);

        gain.gain.setValueAtTime(0, this.ctx.currentTime + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.12 + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + idx * 0.12);
        osc.stop(this.ctx.currentTime + idx * 0.12 + 0.5);
      });
    } catch {
      // Ignore
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setValueAtTime(this.isMuted ? 0 : 0.04, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public isSoundMuted(): boolean {
    return this.isMuted;
  }
}

export const soundEngine = new SoundEngine();
