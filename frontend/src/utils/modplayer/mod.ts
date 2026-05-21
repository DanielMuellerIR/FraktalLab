export class Instrument {
  public index: number;
  public name: string;
  public length: number;
  public finetune: number;
  public volume: number;
  public repeatOffset: number;
  public repeatLength: number;
  public bytes: Int8Array;
  public isLooped: boolean;

  constructor(modfile: ArrayBuffer, index: number, sampleStart: number) {
    const data = new Uint8Array(modfile, 20 + index * 30, 30);
    const nameBytes = data.slice(0, 22).filter(a => !!a);
    this.index = index;
    this.name = String.fromCodePoint(...Array.from(nameBytes)).trim();
    this.length = 2 * (data[22] * 256 + data[23]);
    this.finetune = data[24];
    if (this.finetune > 7) this.finetune -= 16;
    this.volume = data[25];
    this.repeatOffset = 2 * (data[26] * 256 + data[27]);
    this.repeatLength = 2 * (data[28] * 256 + data[29]);
    
    // Check bounds to prevent constructing Int8Array with out of bound offsets
    const actualSampleStart = Math.min(sampleStart, modfile.byteLength);
    const actualLength = Math.min(this.length, modfile.byteLength - actualSampleStart);
    this.bytes = new Int8Array(modfile, actualSampleStart, actualLength);
    this.isLooped = this.repeatOffset !== 0 || this.repeatLength > 2;
  }
}

export class Note {
  public instrument: number;
  public period: number;
  public rawEffect: number;
  public effectId: number;
  public effectData: number;
  public effectHigh: number;
  public effectLow: number;
  public hasEffect: boolean | number;

  constructor(noteData: Uint8Array) {
    this.instrument = (noteData[0] & 0xf0) | (noteData[2] >> 4);
    this.period = (noteData[0] & 0x0f) * 256 + noteData[1];
    let effectId = noteData[2] & 0x0f;
    let effectData = noteData[3];
    if (effectId === 0x0e) {
      effectId = 0xe0 | (effectData >> 4);
      effectData &= 0x0f;
    }
    this.rawEffect = ((noteData[2] & 0x0f) << 8) | noteData[3];
    this.effectId = effectId;
    this.effectData = effectData;
    this.effectHigh = effectData >> 4;
    this.effectLow = effectData & 0x0f;
    this.hasEffect = effectId || effectData;
  }
}

export class Row {
  public notes: Note[] = [];

  constructor(rowData: Uint8Array) {
    for (let i = 0; i < 16; i += 4) {
      const noteData = rowData.slice(i, i + 4);
      this.notes.push(new Note(noteData));
    }
  }
}

export class Pattern {
  public rows: Row[] = [];

  constructor(modfile: ArrayBuffer, index: number) {
    const data = new Uint8Array(modfile, 1084 + index * 1024, 1024);
    for (let i = 0; i < 64; ++i) {
      const rowData = data.slice(i * 16, i * 16 + 16);
      this.rows.push(new Row(rowData));
    }
  }
}

export class Mod {
  public name: string;
  public length: number;
  public patternTable: Uint8Array;
  public instruments: (Instrument | null)[];
  public patterns: Pattern[];

  constructor(modfile: ArrayBuffer) {
    const nameArray = new Uint8Array(modfile, 0, 20);
    const nameBytes = nameArray.filter(a => !!a);
    this.name = String.fromCodePoint(...Array.from(nameBytes)).trim();

    this.length = new Uint8Array(modfile, 950, 1)[0];
    this.patternTable = new Uint8Array(modfile, 952, this.length);

    const maxPatternIndex = Math.max(...Array.from(this.patternTable));

    this.instruments = [null];
    let sampleStart = 1084 + (maxPatternIndex + 1) * 1024;
    for (let i = 0; i < 31; ++i) {
      const instr = new Instrument(modfile, i, sampleStart);
      this.instruments.push(instr);
      sampleStart += instr.length;
    }

    this.patterns = [];
    for (let i = 0; i <= maxPatternIndex; ++i) {
      const pattern = new Pattern(modfile, i);
      this.patterns.push(pattern);
    }
  }
}
