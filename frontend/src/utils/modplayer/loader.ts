import { Mod } from './mod';

export const loadMod = async (url: string): Promise<Mod> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch MOD file: ${response.status} ${response.statusText} (${url})`);
  }

  // Detect if Apache's SPA rewrite served index.html instead of the binary
  const ct = response.headers.get('content-type') || '';
  if (ct.includes('text/html')) {
    throw new Error(`Server returned HTML instead of MOD binary for ${url} — file missing on server?`);
  }

  const arrayBuffer = await response.arrayBuffer();

  // Sanity: a valid 4-channel MOD is at least ~1084 bytes (header + 1 pattern)
  if (arrayBuffer.byteLength < 1084) {
    throw new Error(`MOD file too small (${arrayBuffer.byteLength} bytes) — possibly not a valid MOD: ${url}`);
  }

  // Der Parser verwendet durchgehend vier Kanäle und 1024 Bytes je Pattern.
  // Mehrkanal-Formate müssen vor dem Parsen abgewiesen werden, sonst verschieben sich Samples.
  const sig = new Uint8Array(arrayBuffer, 1080, 4);
  const sigStr = String.fromCharCode(sig[0], sig[1], sig[2], sig[3]);
  const validSigs = ['M.K.', 'M!K!', 'FLT4', '4CHN'];
  if (!validSigs.includes(sigStr)) {
    throw new Error(`Unsupported MOD signature "${sigStr}" — only 4-channel ProTracker MODs are supported: ${url}`);
  }

  const mod = new Mod(arrayBuffer);
  return mod;
};
