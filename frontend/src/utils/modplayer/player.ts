import { loadMod } from './loader';
import { Mod } from './mod';

const AUDIO = Symbol('audio');
const GAIN = Symbol('gain');
const WORKLET = Symbol('worklet');
const ROW_CALLBACKS = Symbol('rowCallbacks');
const SINGLE_CALLBACKS = Symbol('singleCallbacks');
const STOP_CALLBACKS = Symbol('stopCallbacks');
const ALL_NOTES_CALLBACKS = Symbol('allNotesCallbacks');

const range = function* (min: number, max: number): Generator<number, void, unknown> {
  for (let i = min; i <= max; ++i) {
    yield i;
  }
};

const map = function* <T, U>(iterator: Generator<T, void, unknown>, func: (val: T) => U): Generator<U, void, unknown> {
  for (let i of iterator) {
    yield func(i);
  }
};

const notePerPeriod = [...map(range(0, 65535), p => 
  p < 124 ? null :
  24 + Math.round(12 * Math.log2(428 / p))
)];

export class ModPlayer {
  public mod: Mod | null = null;
  public playing: boolean = false;
  private [AUDIO]: AudioContext | null = null;
  private [GAIN]: GainNode | null = null;
  private [WORKLET]: AudioWorkletNode | null = null;
  private [ROW_CALLBACKS]: ((position: number, row: number) => void)[] = [];
  private [SINGLE_CALLBACKS]: Record<string, (() => void)[]> = {};
  private [STOP_CALLBACKS]: (() => void)[] = [];
  private [ALL_NOTES_CALLBACKS]: ((note: { channel: number; sample: number; volume: number; note: number | null }) => void)[] = [];

  constructor(audioContext?: AudioContext) {
    this[AUDIO] = audioContext || null;
  }

  /// Loads an Amiga ProTracker MOD file from a given url
  async load(url: string, workletUrl: string = 'audio/mod-player-worklet.js') {
    if (this[WORKLET]) this.unload(false);

    this.mod = await loadMod(url);
    if (!this[AUDIO]) this[AUDIO] = new AudioContext();
    
    if (this[GAIN]) {
      try {
        this[GAIN].disconnect();
      } catch (_) {}
    }
    this[GAIN] = this[AUDIO].createGain();
    this[GAIN].gain.value = 0.3;
    
    // We add the AudioWorklet module using the local worklet path
    const audioCtx = this[AUDIO] as any;
    if (!audioCtx.__workletAdded) {
      await audioCtx.audioWorklet.addModule(workletUrl);
      audioCtx.__workletAdded = true;
    }
    this[WORKLET] = new AudioWorkletNode(this[AUDIO], 'mod-player-worklet', {
      outputChannelCount: [2]
    });
    this[WORKLET].connect(this[GAIN]).connect(this[AUDIO].destination);

    this[WORKLET].port.onmessage = this.onmessage.bind(this);
  }

  onmessage(event: MessageEvent) {
    const { data } = event;
    switch (data.type) {
      case 'row':
        // Call all the general row callbacks
        for (let callback of this[ROW_CALLBACKS]) {
          callback(data.position, data.rowIndex);
        }

        // Call all the single row callbacks
        const key = data.position + ':' + data.rowIndex;
        if (key in this[SINGLE_CALLBACKS]) {
          for (let callback of this[SINGLE_CALLBACKS][key]) {
            callback();
          }
        }
        break;
      case 'stop':
        for (let callback of this[STOP_CALLBACKS]) {
          callback();
        }
        break;
      case 'note':
        for (let callback of this[ALL_NOTES_CALLBACKS]) {
          callback({
            channel: data.channel,
            sample: data.sample,
            volume: data.volume,
            note: notePerPeriod[data.period]
          });
        }
        break;
    }
  }

  /// Subscribes to all rows
  watchRows(callback: (position: number, row: number) => void) {
    if (this[WORKLET]) {
      this[WORKLET].port.postMessage({
        type: 'enableRowSubscription'
      });
    }
    this[ROW_CALLBACKS].push(callback);
  }

  /// Subscribes to a single row
  watch(position: number, row: number, callback: () => void) {
    if (this[WORKLET]) {
      this[WORKLET].port.postMessage({
        type: 'enableRowSubscription'
      });
    }

    const key = position + ':' + row;
    if (!(key in this[SINGLE_CALLBACKS])) {
      this[SINGLE_CALLBACKS][key] = [];
    }
    this[SINGLE_CALLBACKS][key].push(callback);
  }

  /// Subscribes to when music stops playing
  watchStop(callback: () => void) {
    if (this[WORKLET]) {
      this[WORKLET].port.postMessage({
        type: 'enableStopSubscription'
      });
    }
    this[STOP_CALLBACKS].push(callback);
  }

  /// Subscribes to all individual notes starting
  watchNotes(callback: (note: { channel: number; sample: number; volume: number; note: number | null }) => void) {
    if (this[WORKLET]) {
      this[WORKLET].port.postMessage({
        type: 'enableNoteSubscription'
      });
    }
    this[ALL_NOTES_CALLBACKS].push(callback);
  }

  /// Unloads a MOD file and removes all subscriptions
  unload(closeContext: boolean = true) {
    if (this.playing) this.stop();
    if (!this[WORKLET]) {
      if (closeContext && this[AUDIO]) {
        this[AUDIO].close();
        this[AUDIO] = null;
      }
      return;
    }

    this[WORKLET].disconnect();
    
    if (closeContext && this[AUDIO]) {
      this[AUDIO].close();
    }

    this.mod = null;
    this[WORKLET] = null;
    if (closeContext) {
      this[AUDIO] = null;
    }
    this[ROW_CALLBACKS] = [];
    this[SINGLE_CALLBACKS] = {};
    this[ALL_NOTES_CALLBACKS] = [];
    this[STOP_CALLBACKS] = [];
  }

  resumeContext() {
    if (!this[AUDIO]) {
      this[AUDIO] = new AudioContext();
    }
    if (this[AUDIO] && this[AUDIO].state === 'suspended') {
      this[AUDIO].resume().catch(() => {});
    }
  }

  /// Starts the playback of a MOD file from position 0, row 0
  play() {
    if (this.playing) return;
    if (!this[WORKLET]) return;

    this[AUDIO]?.resume();
    this[WORKLET].port.postMessage({
      type: 'play',
      mod: this.mod,
      sampleRate: this[AUDIO]?.sampleRate
    });

    this.playing = true;
  }

  /// Stops the playback
  stop() {
    if (!this.playing) return;
    if (!this[WORKLET]) return;

    this[WORKLET].port.postMessage({
      type: 'stop'
    });

    this.playing = false;
  }

  /// Resumes the playback of a MOD file from the last stop() position
  resume() {
    if (this.playing) return;
    if (!this[WORKLET]) return;

    this[WORKLET].port.postMessage({
      type: 'resume'
    });

    this.playing = true;
  }

  /// Immediately jumps to a specific position and row
  setRow(position: number, row: number) {
    if (this[WORKLET]) {
      this[WORKLET].port.postMessage({
        type: 'setRow',
        position: position,
        row: row
      });
    }
  }

  /// Sets the playback volume
  setVolume(volume: number) {
    if (this[GAIN]) {
      this[GAIN].gain.value = volume;
    }
  }
}
