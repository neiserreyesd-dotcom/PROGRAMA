const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const NOTE_TO_INDEX: Record<string, number> = {
  C: 0,
  'B#': 0,
  'C#': 1,
  DB: 1,
  D: 2,
  'D#': 3,
  EB: 3,
  E: 4,
  FB: 4,
  'E#': 5,
  F: 5,
  'F#': 6,
  GB: 6,
  G: 7,
  'G#': 8,
  AB: 8,
  A: 9,
  'A#': 10,
  BB: 10,
  B: 11,
  CB: 11,
};

const SPANISH_SHARP_NAMES = [
  'Do',
  'Do♯',
  'Re',
  'Re♯',
  'Mi',
  'Fa',
  'Fa♯',
  'Sol',
  'Sol♯',
  'La',
  'La♯',
  'Si',
];

const SPANISH_NOTE_INDEX: Array<{ pattern: RegExp; index: number }> = [
  { pattern: /^do\s*(?:#|♯|sostenido)?/i, index: 0 },
  { pattern: /^re\s*(?:b|♭|bemol)/i, index: 1 },
  { pattern: /^re\s*(?:#|♯|sostenido)/i, index: 3 },
  { pattern: /^re/i, index: 2 },
  { pattern: /^mi\s*(?:b|♭|bemol)/i, index: 3 },
  { pattern: /^mi/i, index: 4 },
  { pattern: /^fa\s*(?:#|♯|sostenido)/i, index: 6 },
  { pattern: /^fa/i, index: 5 },
  { pattern: /^sol\s*(?:b|♭|bemol)/i, index: 6 },
  { pattern: /^sol\s*(?:#|♯|sostenido)/i, index: 8 },
  { pattern: /^sol/i, index: 7 },
  { pattern: /^la\s*(?:b|♭|bemol)/i, index: 8 },
  { pattern: /^la\s*(?:#|♯|sostenido)/i, index: 10 },
  { pattern: /^la/i, index: 9 },
  { pattern: /^si\s*(?:b|♭|bemol)/i, index: 10 },
  { pattern: /^si/i, index: 11 },
];

function transposeNoteToken(token: string, semitones: number): string {
  const normalized = token.replace('♯', '#').replace('♭', 'b').toUpperCase();
  const idx = NOTE_TO_INDEX[normalized];
  if (idx === undefined) return token;
  const shifted = ((idx + semitones) % 12 + 12) % 12;
  const preferFlats = token.includes('b') || token.includes('♭');
  return preferFlats ? FLAT_NOTES[shifted] : SHARP_NOTES[shifted];
}

export function transposeChord(chord: string, semitones: number): string {
  if (!semitones) return chord;
  const parts = chord.split('/');
  const transposed = parts.map((part) => {
    const match = part.trim().match(/^([A-Ga-g][#b♯♭]?)(.*)$/);
    if (!match) return part;
    return `${transposeNoteToken(match[1], semitones)}${match[2]}`;
  });
  return transposed.join('/');
}

export function transposeMusicalKey(musicalKey: string, semitones: number): string {
  if (!semitones) return musicalKey;
  const trimmed = musicalKey.trim();

  // Check Spanish solfege prefixes first (handle C#/Db variants carefully)
  if (/^(do|re|mi|fa|sol|la|si)\b/i.test(trimmed)) {
    const orderedPatterns = [
      { pattern: /^do\s*(?:#|♯|sostenido)/i, index: 1 },
      { pattern: /^do/i, index: 0 },
      ...SPANISH_NOTE_INDEX.slice(1),
    ];
    for (const item of orderedPatterns) {
      const m = trimmed.match(item.pattern);
      if (m) {
        const rest = trimmed.slice(m[0].length);
        const shifted = ((item.index + semitones) % 12 + 12) % 12;
        return `${SPANISH_SHARP_NAMES[shifted]}${rest}`;
      }
    }
  }

  return transposeChord(trimmed, semitones);
}

export function formatSemitoneOffset(semitones: number): string {
  if (semitones === 0) return 'Original (0)';
  return semitones > 0 ? `+${semitones} st` : `${semitones} st`;
}
