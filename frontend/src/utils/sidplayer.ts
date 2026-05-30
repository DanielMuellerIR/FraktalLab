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

  constructor() {}

  async setupAudio() {
    if (this.workletNode) return;

    this.audioCtx = getSharedAudioContext();
    const ctx = this.audioCtx;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (err) {
        console.warn('Failed to resume AudioContext in SidPlayer:', err);
      }
    }

    // Unlocking iOS Safari
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (e) {
      console.warn('Failed to play dummy buffer for iOS unlock in SidPlayer:', e);
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
      }
    };

    // Apply default volume to worklet
    this.workletNode.port.postMessage({ type: 'setVolume', volume: this.volume });
  }

  async load(url: string, subtune: number = 0) {
    const myGen = ++this.loadGen;
    await this.setupAudio();
    if (!this.workletNode || myGen !== this.loadGen) return;

    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const uint8 = new Uint8Array(buf);

    if (myGen === this.loadGen) {
      this.workletNode.port.postMessage({
        type: 'load',
        data: uint8,
        subtune
      });
    }
  }

  async loadBuffer(uint8: Uint8Array, subtune: number = 0) {
    const myGen = ++this.loadGen;
    await this.setupAudio();
    if (!this.workletNode || myGen !== this.loadGen) return;

    this.workletNode.port.postMessage({
      type: 'load',
      data: uint8,
      subtune
    });
  }

  play() {
    if (this.workletNode) {
      this.resumeContext();
      this.workletNode.port.postMessage({ type: 'play' });
      this.playing = true;
    }
  }

  stop() {
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'stop' });
      this.playing = false;
    }
  }

  setSubtune(subtune: number) {
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'setSubtune', subtune });
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
    this.visualCallback = null;
    this.loadedCallback = null;
  }

  resumeContext() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }
}
