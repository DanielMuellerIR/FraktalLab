import { Mod } from './mod';

export const loadMod = async (url: string): Promise<Mod> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch MOD file: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const mod = new Mod(arrayBuffer);
  return mod;
};
