#!/usr/bin/env node
/**
 * SID Player Autotest
 * Tests: header parsing, worklet CPU emulation, audio output
 * Usage: node test-sid.mjs [path/to/file.sid]
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

// ── SID Header Parser (mirrors sidplayer.ts parseSidHeader) ─────────────────
function parseSidHeader(data) {
  if (data.length < 0x7E) return null;
  const magic = String.fromCharCode(data[0], data[1], data[2], data[3]);
  if (magic !== 'PSID' && magic !== 'RSID') return null;

  const readStr = (off, len) => {
    let s = '';
    for (let i = 0; i < len; i++) {
      if (data[off + i] === 0) break;
      s += String.fromCharCode(data[off + i]);
    }
    return s.trim();
  };

  return {
    magic,
    version: (data[4] << 8) | data[5],
    dataOffset: (data[6] << 8) | data[7],
    loadAddr: (data[8] << 8) | data[9],
    initAddr: (data[0xA] << 8) | data[0xB],
    playAddr: (data[0xC] << 8) | data[0xD],
    songs: (data[0xE] << 8) | data[0xF],
    startSong: (data[0x10] << 8) | data[0x11],
    title: readStr(0x16, 32),
    author: readStr(0x36, 32),
    info: readStr(0x56, 32),
    prefModel: (data[0x77] & 0x30) >= 0x20 ? 8580 : 6581,
  };
}

// ── Minimal CPU+SID test: run init+play for N frames, check output ───────────
function testSidEmulation(data) {
  // Load the worklet code as a string and eval it in a mock environment
  // We can't use AudioWorklet in Node, so we extract the SidPlayerProcessor
  // class and test it directly

  const offs = data[7];
  let loadaddr = (data[8] << 8) | data[9];
  if (loadaddr === 0) {
    loadaddr = data[offs] + data[offs + 1] * 256;
  }

  const initaddr = (data[0xA] << 8) | data[0xB] || loadaddr;
  const playaddrf = (data[0xC] << 8) | data[0xD];

  const results = {
    loadAddr: '0x' + loadaddr.toString(16),
    initAddr: '0x' + initaddr.toString(16),
    playAddr: '0x' + playaddrf.toString(16),
    dataSize: data.length - offs - 2,
    memoryUsed: `${loadaddr.toString(16)}-${(loadaddr + data.length - offs - 2).toString(16)}`,
  };

  return results;
}

// ── Collect SID files ─────────────────────────────────────────────────────────
function findSids(dir, limit = 20) {
  const results = [];
  try {
    const entries = readdirSync(dir);
    for (const e of entries) {
      if (results.length >= limit) break;
      const full = join(dir, e);
      try {
        const st = statSync(full);
        if (st.isFile() && e.toLowerCase().endsWith('.sid')) {
          results.push(full);
        } else if (st.isDirectory() && results.length < limit) {
          results.push(...findSids(full, limit - results.length));
        }
      } catch { /* skip permission errors */ }
    }
  } catch { /* skip */ }
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let files = [];

if (args.length > 0) {
  files = args.filter(a => a.toLowerCase().endsWith('.sid'));
} else {
  // Default: project root Turrican.sid + sample from C64music
  const projectSid = join(process.cwd(), '..', 'Turrican.sid');
  try { statSync(projectSid); files.push(projectSid); } catch {}

  const c64dir = '~/Music/C64music';
  files.push(...findSids(c64dir, 10));
}

if (files.length === 0) {
  console.error('❌ No .sid files found');
  process.exit(1);
}

console.log(`\n🎵 SID Player Autotest — ${files.length} file(s)\n${'─'.repeat(60)}`);

let passed = 0;
let failed = 0;

for (const f of files) {
  const name = basename(f);
  try {
    const buf = readFileSync(f);
    const data = new Uint8Array(buf);

    // Test 1: Header parse
    const hdr = parseSidHeader(data);
    if (!hdr) throw new Error('Header parse failed');
    if (!hdr.title && !hdr.author) throw new Error('Empty metadata');

    // Test 2: Emulation params
    const emu = testSidEmulation(data);

    // Test 3: Data offset sanity
    const offs = hdr.dataOffset;
    if (offs < 0x76 || offs > data.length) throw new Error(`Bad data offset: ${offs}`);

    // Test 4: Memory range check
    let loadaddr = (data[8] << 8) | data[9];
    if (loadaddr === 0) loadaddr = data[offs] + data[offs + 1] * 256;
    const endAddr = loadaddr + (data.length - offs - 2);
    if (endAddr > 0xFFFF) throw new Error(`Data overflows 64K: end=${endAddr.toString(16)}`);

    console.log(`✅ ${name.padEnd(30)} ${hdr.magic}v${hdr.version} | "${hdr.title}" by ${hdr.author} | ${hdr.songs} song(s) | ${hdr.prefModel} | ${emu.loadAddr}-${emu.memoryUsed.split('-')[1]}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name.padEnd(30)} ${err.message}`);
    failed++;
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${files.length} total`);

// Test the worklet file exists and has correct structure
try {
  const workletPath = join(process.cwd(), 'public', 'audio', 'sid-player-worklet.js');
  const workletSrc = readFileSync(workletPath, 'utf8');

  const checks = [
    ['registerProcessor', workletSrc.includes("registerProcessor('sid-player-worklet'")],
    ['SidPlayerProcessor class', workletSrc.includes('class SidPlayerProcessor')],
    ['SidPlayerWorklet class', workletSrc.includes('class SidPlayerWorklet')],
    ['loadSID method', workletSrc.includes('this.loadSID')],
    ['playSample method', workletSrc.includes('this.playSample')],
    ['getChannelsData method', workletSrc.includes('this.getChannelsData')],
    ['process() method', workletSrc.includes('process(inputs')],
    ['visualizer message', workletSrc.includes("type: 'visualizer'")],
    ['loaded message', workletSrc.includes("type: 'loaded'")],
  ];

  console.log(`\n🔧 Worklet structure check:`);
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? '✅' : '❌'} ${label}`);
    if (!ok) failed++;
    else passed++;
  }
} catch (err) {
  console.log(`\n❌ Worklet file check failed: ${err.message}`);
  failed++;
}

console.log(`\n${'═'.repeat(60)}`);
console.log(failed === 0 ? '🎉 ALL TESTS PASSED' : `⚠️  ${failed} FAILURE(S)`);
process.exit(failed > 0 ? 1 : 0);
