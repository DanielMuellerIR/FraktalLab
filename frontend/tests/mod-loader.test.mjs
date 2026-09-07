import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Die echten TypeScript-Module ohne Browser, AudioContext oder Netzwerk laden.
const moduleURL = (source) => 'data:text/javascript;base64,' + Buffer.from(
  ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText,
).toString('base64');
const modURL = moduleURL(fs.readFileSync(new URL('../src/utils/modplayer/mod.ts', import.meta.url), 'utf8'));
const loaderSource = fs.readFileSync(new URL('../src/utils/modplayer/loader.ts', import.meta.url), 'utf8');
const { loadMod } = await import(moduleURL(loaderSource.replace("'./mod'", JSON.stringify(modURL))));

function fixture(signature, channels) {
  const bytes = new Uint8Array(1084 + 64 * channels * 4 + 2);
  bytes.set(new TextEncoder().encode(signature), 1080);
  bytes[950] = 1; // Eine Order mit Pattern 0.
  bytes[43] = 1; // Das erste Sample umfasst ein Wort = zwei Bytes.
  bytes.set([12, 34], 1084 + 64 * channels * 4);
  if (channels > 4) bytes[1084 + 1024] = 77; // Kein Sample: Patterndaten weiterer Kanäle.
  return bytes;
}

for (const signature of ['6CHN', '8CHN', 'FLT8']) {
  test(`weist ${signature} vor dem vierkanaligen Parser zurück`, async (t) => {
    const bytes = fixture(signature, signature === '6CHN' ? 6 : 8);
    t.mock.method(globalThis, 'fetch', async () => new Response(bytes));
    await assert.rejects(loadMod('https://example.invalid/test.mod'), /4-channel|vierkanalig/);
  });
}

for (const signature of ['M.K.', 'M!K!', 'FLT4', '4CHN']) {
  test(`lädt ${signature} mit korrekten Noten- und Samplegrenzen`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response(fixture(signature, 4)));
    const mod = await loadMod('blob:synthetic-mod');
    assert.equal(mod.patterns[0].rows[0].notes.length, 4);
    assert.deepEqual([...mod.instruments[1].bytes], [12, 34]);
  });
}
