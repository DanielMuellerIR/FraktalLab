#!/usr/bin/env node
/**
 * SID Player AUDIO render test.
 *
 * Why this exists:
 *   The old test-sid.mjs only parsed headers and checked that the worklet file
 *   contained the right strings. It never ran the emulator, so it could not tell
 *   whether any *sound* came out. This test instead loads the real
 *   SidPlayerProcessor engine out of the worklet file, renders real PCM samples,
 *   measures the signal, and writes a .wav you can actually listen to.
 *
 * How it reproduces the browser failure mode:
 *   AudioWorklet modules run in strict mode. Any assignment to an undeclared
 *   variable (e.g. the old `output = 0` bug) throws a ReferenceError in the
 *   browser but would silently create a global in loose Node. So we wrap the
 *   worklet source in "use strict" — if the engine has that class of bug, this
 *   test throws exactly like the browser does.
 *
 * Usage:  node test-sid-audio.mjs [path/to/file.sid] [seconds]
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────────────────
const SAMPLE_RATE = 44100;                       // browser AudioContext default
// Default to the tune bundled in the repo so the test runs on a clean checkout.
const sidPath = process.argv[2] || join(__dirname, 'public', 'audio', 'Turrican.sid');
const seconds = Number(process.argv[3] || 6);
const workletPath = join(__dirname, 'public', 'audio', 'sid-player-worklet.js');

// ── Load the engine class out of the worklet file ────────────────────────────
// We shim the three worklet globals the file relies on:
//   AudioWorkletProcessor (base class), sampleRate (Hz), registerProcessor (noop).
// Then we hand back the SidPlayerProcessor class so we can drive it directly.
function loadEngineClass(src) {
  // Fake base class. The real engine constructor never touches `port`, but the
  // sibling SidPlayerWorklet class does, so give it a harmless stub.
  class FakeAudioWorkletProcessor {
    constructor() {
      this.port = { postMessage() {}, onmessage: null };
    }
  }

  // Build a factory that runs the worklet source in STRICT mode and returns the
  // engine class. Strict mode is the whole point — see header comment.
  const factory = new Function(
    'AudioWorkletProcessor',
    'sampleRate',
    'registerProcessor',
    `"use strict";\n${src}\nreturn SidPlayerProcessor;`
  );

  return factory(FakeAudioWorkletProcessor, SAMPLE_RATE, function () {});
}

// ── 16-bit PCM mono WAV writer ───────────────────────────────────────────────
function writeWav(path, samples, rate) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);          // 44-byte header + 16-bit samples
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);                      // fmt chunk size
  buf.writeUInt16LE(1, 20);                       // PCM
  buf.writeUInt16LE(1, 22);                       // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);                // byte rate
  buf.writeUInt16LE(2, 32);                       // block align
  buf.writeUInt16LE(16, 34);                      // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    // Clamp to [-1, 1] then scale to signed 16-bit.
    let s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  writeFileSync(path, buf);
}

// ── Run ───────────────────────────────────────────────────────────────────────
console.log(`\n🎵 SID AUDIO render test`);
console.log(`   file:   ${sidPath}`);
console.log(`   length: ${seconds}s @ ${SAMPLE_RATE} Hz\n`);

const src = readFileSync(workletPath, 'utf8');
const data = new Uint8Array(readFileSync(sidPath));

// ── Structural guard: the engine class must NOT be an AudioWorkletProcessor ──
// The browser only lets the audio system construct AudioWorkletProcessor
// subclasses; manually doing `new SidPlayerProcessor()` when it extends the base
// throws "an error thrown from AudioWorkletProcessor constructor" at runtime,
// killing the processor (no sound, no visualizer). Node can't reproduce that
// (we shim the base class), so we catch it here at the source level instead.
if (/class\s+SidPlayerProcessor\s+extends\s+AudioWorkletProcessor/.test(src)) {
  console.error('❌ SidPlayerProcessor extends AudioWorkletProcessor — it is');
  console.error('   instantiated manually, so the browser will throw in its');
  console.error('   constructor and emit pure silence. Make it a plain class.');
  process.exit(1);
}

let engine, metadata;
try {
  const SidPlayerProcessor = loadEngineClass(src);
  engine = new SidPlayerProcessor();
  metadata = engine.loadSID(data);              // parse + map into 64K memory
  engine.initSubtune(0);                         // run the 6502 init routine
  engine.setVolume(1.0);
} catch (err) {
  console.error(`❌ ENGINE THREW during setup — this is the browser silence cause:`);
  console.error(`   ${err.stack || err}`);
  process.exit(1);
}

console.log(`   title:  "${metadata.title}"`);
console.log(`   author: "${metadata.author}"`);
console.log(`   model:  ${metadata.prefModel}   subtunes: ${metadata.subtunesCount}\n`);

// Render.
const total = SAMPLE_RATE * seconds;
const samples = new Float32Array(total);
let renderErr = null;
let firstNonZero = -1;
// Snapshot the channel state (gates + frequencies + quantized envelopes) a few
// times per second. A WORKING tune constantly changes these as the song plays;
// a frozen drone (the symptom of the CPU INX/TAY bug) keeps emitting one steady
// tone, so the set of distinct states stays tiny. This is what catches "there is
// SOME sound but the song never advances", which a pure RMS check would miss.
const songStates = new Set();
const snapEvery = Math.floor(SAMPLE_RATE / 20); // 20 snapshots per second
try {
  for (let i = 0; i < total; i++) {
    const s = engine.playSample();
    if (!Number.isFinite(s)) throw new Error(`non-finite sample at ${i}: ${s}`);
    samples[i] = s;
    if (firstNonZero < 0 && s !== 0) firstNonZero = i;
    if (i % snapEvery === 0) {
      const d = engine.getChannelsData();
      songStates.add(
        d.gates.join(',') + '|' + d.frequencies.join(',') + '|' +
        d.envelopes.map((e) => Math.round(e * 20)).join(',')
      );
    }
  }
} catch (err) {
  renderErr = err;
}

if (renderErr) {
  console.error(`❌ ENGINE THREW during playback: ${renderErr.stack || renderErr}`);
  process.exit(1);
}

// ── Analyze the signal ────────────────────────────────────────────────────────
let peak = 0, sumSq = 0, nonZero = 0, zeroCross = 0;
let prev = 0;
const distinct = new Set();
for (let i = 0; i < total; i++) {
  const s = samples[i];
  const a = Math.abs(s);
  if (a > peak) peak = a;
  sumSq += s * s;
  if (s !== 0) nonZero++;
  if ((s > 0 && prev <= 0) || (s < 0 && prev >= 0)) zeroCross++;
  prev = s;
  // Quantize to 1e-4 buckets to count meaningful distinct levels cheaply.
  distinct.add(Math.round(s * 10000));
}
const rms = Math.sqrt(sumSq / total);
const nonZeroPct = (nonZero / total) * 100;
const estHz = zeroCross / 2 / seconds;          // rough fundamental estimate

console.log(`   RMS level:        ${rms.toFixed(5)}`);
console.log(`   peak amplitude:   ${peak.toFixed(5)}`);
console.log(`   non-zero samples: ${nonZeroPct.toFixed(1)}%`);
console.log(`   distinct levels:  ${distinct.size}`);
console.log(`   zero-crossings:   ${zeroCross}  (~${estHz.toFixed(0)} Hz avg)`);
console.log(`   distinct song states: ${songStates.size}  (frozen drone ≈ 1-3)`);
console.log(`   first sound at:   ${firstNonZero < 0 ? 'NEVER' : (firstNonZero / SAMPLE_RATE).toFixed(3) + 's'}\n`);

// ── Write WAV ───────────────────────────────────────────────────────────────
const wavPath = join(__dirname, 'test-results',
  basename(sidPath).replace(/\.sid$/i, '') + '.wav');
try {
  writeWav(wavPath, samples, SAMPLE_RATE);
  console.log(`   🔊 wrote ${wavPath}`);
} catch (err) {
  console.log(`   (could not write wav: ${err.message})`);
}

// ── Verdict ───────────────────────────────────────────────────────────────────
// Real C64 music is loud and busy: high non-zero %, many distinct levels,
// meaningful RMS. Silence = all zeros. A DC offset / stuck value = 1-2 levels.
const PASS =
  rms > 0.005 &&             // audible energy
  peak > 0.02 &&             // real peaks
  nonZeroPct > 50 &&         // mostly producing signal
  distinct.size > 50 &&      // rich waveform, not a stuck value
  zeroCross > seconds * 20 && // oscillating, not DC
  songStates.size > 10;      // the SONG actually progresses (not a frozen drone)

console.log(`\n${'═'.repeat(56)}`);
if (PASS) {
  console.log(`✅ AUDIO OK — real, oscillating signal AND the song progresses.`);
  process.exit(0);
} else if (songStates.size <= 10) {
  console.log(`❌ FROZEN — sound present but the song does not advance`);
  console.log(`   (only ${songStates.size} distinct states — CPU/player is stuck).`);
  process.exit(1);
} else {
  console.log(`❌ NO USABLE AUDIO — signal is silent / stuck / DC.`);
  console.log(`   (need rms>0.005, peak>0.02, nonzero>50%, levels>50, osc, states>10)`);
  process.exit(1);
}
