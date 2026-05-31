import { getSharedAudioContext } from './shared-audio';

export interface SidMetadata {
  title: string;
  author: string;
  info: string;
  subtunesCount: number;
  prefModel: number;
}

export interface SidVisuals {
  envelopes: [number, number, number];
  frequencies: [number, number, number];
  gates: [number, number, number];
  // Selected waveform per voice (upper nibble of the control register:
  // 0x10 TRI, 0x20 SAW, 0x40 PULSE, 0x80 NOISE).
  waveforms: [number, number, number];
  // Pulse-width duty cycle per voice, 0..1.
  pulsewidths: [number, number, number];
  // Elapsed playback time in seconds (drives the scrubber / time display).
  playtime: number;
}

/**
 * Parse SID file header WITHOUT needing an AudioContext.
 * Works on the raw Uint8Array from a fetch or file upload.
 */
function parseSidHeader(data: Uint8Array): SidMetadata | null {
  if (data.length < 0x7E) return null;

  // Check magic: "PSID" or "RSID"
  const magic = String.fromCharCode(data[0], data[1], data[2], data[3]);
  if (magic !== 'PSID' && magic !== 'RSID') return null;

  const readString = (offset: number, len: number): string => {
    let s = '';
    for (let i = 0; i < len; i++) {
      const ch = data[offset + i];
      if (ch === 0) break;
      s += String.fromCharCode(ch);
    }
    return s.trim();
  };

  const title = readString(0x16, 32);
  const author = readString(0x36, 32);
  const info = readString(0x56, 32);
  const subtunesCount = data[0xF] || 1;
  const prefModel = (data[0x77] & 0x30) >= 0x20 ? 8580 : 6581;

  return { title, author, info, subtunesCount, prefModel };
}

export class SidPlayer {
  private audioCtx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private volume: number = 0.3;
  private visualCallback: ((data: SidVisuals) => void) | null = null;
  private loadedCallback: ((metadata: SidMetadata) => void) | null = null;
  public loaded: boolean = false;
  public playing: boolean = false;
  private loadGen = 0;

  // Pending SID binary data (loaded without AudioContext)
  private pendingData: Uint8Array | null = null;
  private pendingSubtune: number = 0;

  // Promise resolved when worklet confirms load
  private workletLoadReady: Promise<void> | null = null;
  private workletLoadResolve: (() => void) | null = null;

  constructor() {}

  /**
   * Initialize AudioContext and AudioWorklet.
   * MUST be called from a user gesture (click/touch) callback.
   */
  private async setupAudio() {
    if (this.workletNode) return;

    this.audioCtx = getSharedAudioContext();
    const ctx = this.audioCtx;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (err) {
        console.warn('SidPlayer: Failed to resume AudioContext:', err);
      }
    }

    // iOS Safari unlock
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (e) {
      console.warn('SidPlayer: iOS unlock buffer failed:', e);
    }

    const audioCtxAny = ctx as any;
    if (!audioCtxAny.__sidWorkletAdded) {
      const BASE = import.meta.env.BASE_URL;
      const absoluteWorkletUrl = new URL(`${BASE}audio/sid-player-worklet.js`, window.location.href).href;
      await ctx.audioWorklet.addModule(absoluteWorkletUrl);
      audioCtxAny.__sidWorkletAdded = true;
    }

    this.workletNode = new AudioWorkletNode(ctx, 'sid-player-worklet', {
      outputChannelCount: [2]
    });

    this.workletNode.connect(ctx.destination);
    this.workletNode.port.onmessage = (e) => {
      const data = e.data;
      if (data.type === 'visualizer') {
        if (this.visualCallback) this.visualCallback(data.data);
      } else if (data.type === 'loaded') {
        this.loaded = true;
        if (this.loadedCallback) this.loadedCallback(data.metadata);
        // Resolve pending play() promise if waiting
        if (this.workletLoadResolve) {
          this.workletLoadResolve();
          this.workletLoadResolve = null;
        }
      }
    };

    this.workletNode.port.postMessage({ type: 'setVolume', volume: this.volume });
  }

  /**
   * Fetch SID file from URL and parse header.
   * Does NOT touch AudioContext — safe to call anytime.
   */
  async load(url: string, subtune: number = 0) {
    const myGen = ++this.loadGen;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    const buf = await res.arrayBuffer();
    const uint8 = new Uint8Array(buf);

    if (myGen !== this.loadGen) return; // stale

    const meta = parseSidHeader(uint8);
    if (!meta) throw new Error('Invalid SID file (bad header)');

    this.pendingData = uint8;
    this.pendingSubtune = subtune;
    this.loaded = true;

    // If worklet already running, send data immediately
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'load', data: uint8, subtune });
    }

    if (this.loadedCallback) this.loadedCallback(meta);
  }

  /**
   * Load SID from a Uint8Array buffer (user upload).
   * Does NOT touch AudioContext — safe to call anytime.
   */
  async loadBuffer(uint8: Uint8Array, subtune: number = 0) {
    const myGen = ++this.loadGen;

    const meta = parseSidHeader(uint8);
    if (!meta) throw new Error('Invalid SID file (bad header)');

    if (myGen !== this.loadGen) return; // stale

    this.pendingData = uint8;
    this.pendingSubtune = subtune;
    this.loaded = true;

    // If worklet already running, send data immediately
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'load', data: uint8, subtune });
    }

    if (this.loadedCallback) this.loadedCallback(meta);
  }

  /**
   * Start playback. Sets up AudioContext on first call (requires user gesture).
   * If SID data has been loaded, sends it to the worklet before playing.
   */
  async play() {
    await this.setupAudio();
    if (!this.workletNode) return;

    // If pending data hasn't been sent to worklet yet, send and wait for confirmation
    if (this.pendingData) {
      const dataToSend = this.pendingData;
      const subtuneToSend = this.pendingSubtune;
      this.pendingData = null;

      // Create promise that setupAudio's onmessage handler will resolve
      this.workletLoadReady = new Promise<void>(r => { this.workletLoadResolve = r; });

      this.workletNode.port.postMessage({
        type: 'load',
        data: dataToSend,
        subtune: subtuneToSend,
      });

      // Wait for worklet 'loaded' or 2s safety timeout
      await Promise.race([
        this.workletLoadReady,
        new Promise<void>(r => setTimeout(r, 2000)),
      ]);
    }

    this.resumeContext();
    this.workletNode.port.postMessage({ type: 'play' });
    this.playing = true;
  }

  stop() {
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'stop' });
    }
    this.playing = false;
  }

  setSubtune(subtune: number) {
    this.pendingSubtune = subtune;
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'setSubtune', subtune });
    }
  }

  /**
   * Seek to a position in seconds. The worklet restarts the current subtune and
   * fast-forwards the emulation (SID has no random access). No-op until the
   * worklet has been set up and the tune sent (i.e. after the first play()).
   */
  seek(seconds: number) {
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'seek', seconds });
    }
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'setVolume', volume });
    }
  }

  watchVisuals(callback: (data: SidVisuals) => void) {
    this.visualCallback = callback;
  }

  watchLoaded(callback: (metadata: SidMetadata) => void) {
    this.loadedCallback = callback;
  }

  unload() {
    this.stop();
    if (this.workletNode) {
      try {
        this.workletNode.disconnect();
      } catch (_) {}
    }
    this.workletNode = null;
    this.loaded = false;
    this.playing = false;
    this.pendingData = null;

    this.visualCallback = null;
    this.loadedCallback = null;
  }

  resumeContext() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }
}
