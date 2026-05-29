import { loadMod } from './loader';
import { Mod } from './mod';
import { getSharedAudioContext } from '../shared-audio';

// Symbole als private Felder. TypeScript erlaubt private-Felder direkt, aber
// das Original-Pattern mit Symbol-Keys bleibt erhalten — so muessen Aufrufer
// im Projekt nicht umgestellt werden.
const AUDIO = Symbol('audio');
const GAIN = Symbol('gain');
const WORKLET = Symbol('worklet');
const ROW_CALLBACKS = Symbol('rowCallbacks');
const SINGLE_CALLBACKS = Symbol('singleCallbacks');
const STOP_CALLBACKS = Symbol('stopCallbacks');
const ALL_NOTES_CALLBACKS = Symbol('allNotesCallbacks');
// Neuer Slot fuer Level-Subscribers — bekommt das echte Per-Channel-Peak-
// Array aus dem AudioWorklet (~47x pro Sekunde, siehe Worklet `process()`).
// Aus Standalone-ProTracker-Player portiert (Hybrid-Reintegration).
const LEVEL_CALLBACKS = Symbol('levelCallbacks');

// Hilfs-Generatoren fuer die `notePerPeriod`-Tabelle. Period (12-Bit Wert
// von der Paula-Chip-Tabelle) -> MIDI-Halbton-Nummer.
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
  // Vor der Hybrid-Reintegration konnte das hier auch ein
  // ScriptProcessorNode-Fallback sein. Der ist entfernt, weil er auf dem
  // Main-Thread laeuft (deprecated) und unter Last die gesamte Seite ruckeln
  // liess — siehe AUDIT_FINDINGS.md ProTracker-Befund "CRITICAL".
  // Alle modernen Ziel-Browser (Chrome >= 66, Firefox >= 76, Safari >= 14.1)
  // unterstuetzen AudioWorklet.
  private [WORKLET]: AudioWorkletNode | null = null;
  private [ROW_CALLBACKS]: ((position: number, row: number) => void)[] = [];
  private [SINGLE_CALLBACKS]: Record<string, (() => void)[]> = {};
  private [STOP_CALLBACKS]: (() => void)[] = [];
  private [ALL_NOTES_CALLBACKS]: ((note: { channel: number; sample: number; volume: number; note: number | null }) => void)[] = [];
  private [LEVEL_CALLBACKS]: ((peaks: number[]) => void)[] = [];

  private volume: number = 0.3;
  private workletUrl: string = 'audio/mod-player-worklet.js';

  constructor(audioContext?: AudioContext) {
    this[AUDIO] = audioContext || null;
  }

  /// Loads an Amiga ProTracker MOD file from a given url
  async load(url: string, workletUrl: string = 'audio/mod-player-worklet.js') {
    this.unload(false);

    this.workletUrl = workletUrl;
    this.mod = await loadMod(url);
  }

  private async setupAudio(workletUrl: string) {
    if (this[WORKLET]) return; // Already setup

    if (!this[AUDIO]) this[AUDIO] = getSharedAudioContext();
    const ctx = this[AUDIO]!;

    // Ensure the AudioContext is running
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (err) {
        console.warn('Failed to resume AudioContext during setup:', err);
      }
    }

    // Try iOS AudioContext unlock with a silent dummy buffer
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (e) {
      console.warn('Failed to play dummy buffer for iOS unlock in setupAudio:', e);
    }

    if (this[GAIN]) {
      try {
        this[GAIN].disconnect();
      } catch (_) {}
    }
    this[GAIN] = ctx.createGain();
    this[GAIN].gain.value = this.volume;

    // AudioWorklet ist Pflicht. Falls die API fehlt, wird ein expliziter Fehler
    // geworfen — der Aufrufer (AmiModPanel) faengt das ab. Der frueher hier
    // angesiedelte ScriptProcessor-Fallback lief auf dem Main-Thread und war
    // primaere Ursache fuer das von Nutzern gemeldete "Seite wird ruckelig
    // sobald MOD-Player aktiv" (Audit 2026-05-29).
    const audioCtx = ctx as any;
    if (!audioCtx.audioWorklet) {
      throw new Error('AudioWorklet wird vom Browser nicht unterstuetzt — moderner Browser noetig.');
    }

    if (!audioCtx.__workletAdded) {
      // iOS WebKit (inkl. Firefox/Chrome iOS) loest relative URLs in addModule()
      // nicht korrekt auf. Daher immer eine absolute URL erzeugen — egal ob
      // workletUrl relativ oder absolut uebergeben wird.
      const absoluteWorkletUrl = new URL(workletUrl, window.location.href).href;
      await audioCtx.audioWorklet.addModule(absoluteWorkletUrl);
      audioCtx.__workletAdded = true;
    }
    this[WORKLET] = new AudioWorkletNode(ctx, 'mod-player-worklet', {
      outputChannelCount: [2]
    });

    this[WORKLET]!.connect(this[GAIN]!).connect(this[AUDIO]!.destination);

    this[WORKLET]!.port.onmessage = this.onmessage.bind(this);

    // Re-register subscriptions on the newly created worklet
    if (this[ROW_CALLBACKS].length > 0 || Object.keys(this[SINGLE_CALLBACKS]).length > 0) {
      this[WORKLET]!.port.postMessage({
        type: 'enableRowSubscription'
      });
    }
    if (this[STOP_CALLBACKS].length > 0) {
      this[WORKLET]!.port.postMessage({
        type: 'enableStopSubscription'
      });
    }
    if (this[ALL_NOTES_CALLBACKS].length > 0) {
      this[WORKLET]!.port.postMessage({
        type: 'enableNoteSubscription'
      });
    }
    if (this[LEVEL_CALLBACKS].length > 0) {
      this[WORKLET]!.port.postMessage({
        type: 'enableLevelSubscription'
      });
    }
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
      case 'levels':
        // Echtes Per-Channel-Peak-Array vom Worklet. data.peaks ist [p0..p3]
        // im Wertebereich 0..~0.5 (vgl. `Channel.nextOutput()` im Worklet).
        // Aufrufer (z. B. AmiModPanel) bekommt das Array 1:1 weitergereicht.
        for (let callback of this[LEVEL_CALLBACKS]) {
          callback(data.peaks);
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

  /// Subscribed auf das echte Per-Channel-Peak-Array, das das Worklet
  /// ca. 47x pro Sekunde schickt. Callback bekommt ein number[4] mit
  /// Peak-Werten (Bereich grob 0..0.5, vgl. `Channel.nextOutput()` im
  /// Worklet). Aus Standalone-Player portiert.
  watchLevels(callback: (peaks: number[]) => void) {
    if (this[WORKLET]) {
      this[WORKLET].port.postMessage({
        type: 'enableLevelSubscription'
      });
    }
    this[LEVEL_CALLBACKS].push(callback);
  }

  /// Unloads a MOD file and removes all subscriptions
  unload(_closeContext: boolean = false) {
    if (this.playing) this.stop();
    if (this[WORKLET]) {
      try {
        this[WORKLET]!.disconnect();
      } catch (_) {}
    }

    this.mod = null;
    this[WORKLET] = null;
    this[ROW_CALLBACKS] = [];
    this[SINGLE_CALLBACKS] = {};
    this[ALL_NOTES_CALLBACKS] = [];
    this[STOP_CALLBACKS] = [];
    this[LEVEL_CALLBACKS] = [];
  }

  resumeContext() {
    if (!this[AUDIO]) {
      this[AUDIO] = getSharedAudioContext();
    }
    if (this[AUDIO]) {
      if (this[AUDIO].state === 'suspended') {
        this[AUDIO].resume().catch(() => {});
      }
      // iOS Web Audio unlock: Play a silent dummy buffer source on user gesture.
      try {
        const ctx = this[AUDIO];
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      } catch (e) {
        console.warn('Failed to play dummy buffer for iOS unlock:', e);
      }
    }
  }

  /// Starts the playback of a MOD file from position 0, row 0
  async play() {
    if (this.playing) return;

    await this.setupAudio(this.workletUrl);
    if (!this[WORKLET]) return;

    this.resumeContext();
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
  async resume() {
    if (this.playing) return;

    await this.setupAudio(this.workletUrl);
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
    this.volume = volume;
    if (this[GAIN]) {
      this[GAIN].gain.value = volume;
    }
  }
}
