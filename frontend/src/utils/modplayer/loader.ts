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

  // Check for M.K. / FLT4 / 4CHN / etc. signature at offset 1080
  const sig = new Uint8Array(arrayBuffer, 1080, 4);
  const sigStr = String.fromCharCode(sig[0], sig[1], sig[2], sig[3]);
  const validSigs = ['M.K.', 'M!K!', 'FLT4', 'FLT8', '4CHN', '6CHN', '8CHN'];
  if (!validSigs.includes(sigStr)) {
    throw new Error(`Invalid MOD signature "${sigStr}" — file may be corrupted or not a ProTracker MOD: ${url}`);
  }

  const mod = new Mod(arrayBuffer);
  return mod;
};
