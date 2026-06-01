// AUTO-GENERIERT von scripts/build-audio-manifest.mjs — NICHT von Hand ändern.
// Neu erzeugen nach Änderung der sids/mods:  node scripts/build-audio-manifest.mjs
//
// Quelle: Battle of the Bits (https://battleofthebits.com), Lizenz für alle Tracks:
// Creative Commons Attribution-NonCommercial-ShareAlike. Keine Änderungen an den
// Originaldateien vorgenommen ("No changes made").

export interface BotbTrack {
  id: string        // BotB-Entry-ID
  file: string      // Pfad relativ zu BASE_URL (z.B. "audio/botb/botb-14870.sid")
  title: string
  author: string
  ext: 'sid' | 'mod'
  bytes: number     // echte Dateigröße
  entryUrl: string  // Link zum BotB-Entry
}

export const BOTB_LICENSE = 'Creative Commons Attribution-NonCommercial-ShareAlike'
export const BOTB_LICENSE_SHORT = 'CC BY-NC-SA'
export const BOTB_LICENSE_URL = 'https://battleofthebits.com/lyceum/View/BotB%2BCC%2BLicense/'
export const BOTB_SOURCE = 'Battle of the Bits'

export const MOD_TRACKS: BotbTrack[] = [
  { id: '17787', file: 'audio/botb/botb-17787.mod', title: 'I am retiring from BotB and making music. Peace out', author: 'mega9man', ext: 'mod', bytes: 33854, entryUrl: 'https://battleofthebits.com/arena/Entry/I+am+retiring+from+BotB+and+making+music.+Peace+out.mod/17787/' },
  { id: '18964', file: 'audio/botb/botb-18964.mod', title: 'theanthem', author: 'SoDa7', ext: 'mod', bytes: 42696, entryUrl: 'https://battleofthebits.com/arena/Entry/theanthem.mod/18964/' },
  { id: '28893', file: 'audio/botb/botb-28893.mod', title: 'vip pizza club', author: 'ipi', ext: 'mod', bytes: 210918, entryUrl: 'https://battleofthebits.com/arena/Entry/vip+pizza+club.mod/28893/' },
  { id: '31127', file: 'audio/botb/botb-31127.mod', title: '8kcompo', author: 'WouterVL', ext: 'mod', bytes: 7806, entryUrl: 'https://battleofthebits.com/arena/Entry/8kcompo.mod/31127/' },
  { id: '33971', file: 'audio/botb/botb-33971.mod', title: 'acup', author: 'Robyn', ext: 'mod', bytes: 214104, entryUrl: 'https://battleofthebits.com/arena/Entry/acup.mod/33971/' },
  { id: '44699', file: 'audio/botb/botb-44699.mod', title: 'genericjack', author: 'MelonadeM', ext: 'mod', bytes: 229784, entryUrl: 'https://battleofthebits.com/arena/Entry/genericjack.mod/44699/' },
  { id: '70291', file: 'audio/botb/botb-70291.mod', title: 'crazed afternoon', author: 'DuccBoi', ext: 'mod', bytes: 43416, entryUrl: 'https://battleofthebits.com/arena/Entry/crazed+afternoon.mod/70291/' },
  { id: '70443', file: 'audio/botb/botb-70443.mod', title: 'mod it to hell', author: 'DuccBoi', ext: 'mod', bytes: 62648, entryUrl: 'https://battleofthebits.com/arena/Entry/mod+it+to+hell.mod/70443/' },
  { id: '70449', file: 'audio/botb/botb-70449.mod', title: 'trying to be synthy', author: 'DuccBoi', ext: 'mod', bytes: 246022, entryUrl: 'https://battleofthebits.com/arena/Entry/trying+to+be+synthy.mod/70449/' },
]

export const SID_TRACKS: BotbTrack[] = [
  { id: '14870', file: 'audio/botb/botb-14870.sid', title: 'what is this thing', author: 'MovieMovies1', ext: 'sid', bytes: 31502, entryUrl: 'https://battleofthebits.com/arena/Entry/what+is+this+thing.sid/14870/' },
  { id: '15743', file: 'audio/botb/botb-15743.sid', title: 'wistleball', author: 'aji', ext: 'sid', bytes: 2389, entryUrl: 'https://battleofthebits.com/arena/Entry/wistleball.sid/15743/' },
  { id: '23575', file: 'audio/botb/botb-23575.sid', title: 'Mushroom Argument', author: 'MovieMovies1', ext: 'sid', bytes: 2729, entryUrl: 'https://battleofthebits.com/arena/Entry/Mushroom+Argument.sid/23575/' },
  { id: '23584', file: 'audio/botb/botb-23584.sid', title: '哎吔!(Aiya!)', author: 'Pegmode', ext: 'sid', bytes: 49010, entryUrl: 'https://battleofthebits.com/arena/Entry/%E5%93%8E%E5%90%94!(Aiya!).sid/23584/' },
  { id: '35682', file: 'audio/botb/botb-35682.sid', title: 'dark nights', author: 'kleeder', ext: 'sid', bytes: 11366, entryUrl: 'https://battleofthebits.com/arena/Entry/dark+nights.sid/35682/' },
]

// Echte Gesamtgrößen (Bytes) der mitgelieferten Musikdateien pro Player.
export const MOD_TRACKS_TOTAL_BYTES = 1091248
export const SID_TRACKS_TOTAL_BYTES = 96996
