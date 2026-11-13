import {
  AppSettings,
  LyricFontId,
  ThemeColors,
  ThemePresetId,
} from '../types/song';

const SETTINGS_STORAGE_KEY = 'estrofa_settings_v1';
const NOTES_STORAGE_KEY = 'estrofa_song_notes_v1';

export interface ThemePresetDefinition {
  id: Exclude<ThemePresetId, 'custom'>;
  name: string;
  description: string;
  colors: ThemeColors;
}

export const THEME_PRESETS: ThemePresetDefinition[] = [
  {
    id: 'amber-stage',
    name: 'Escenario Ámbar',
    description: 'Carbón profundo con foco dorado clásico',
    colors: {
      background: '#0C0E12',
      surface: '#141720',
      accent: '#FBBF24',
      text: '#F3F4F6',
      lyricText: '#D4D4D8',
      lyricHighlight: '#FDE68A',
    },
  },
  {
    id: 'cobalt-midnight',
    name: 'Medianoche Cobalto',
    description: 'Azul nocturno eléctrico para escenario',
    colors: {
      background: '#080D17',
      surface: '#101829',
      accent: '#38BDF8',
      text: '#F1F5F9',
      lyricText: '#CBD5E1',
      lyricHighlight: '#BAE6FD',
    },
  },
  {
    id: 'emerald-studio',
    name: 'Estudio Esmeralda',
    description: 'Verde consola de grabación de alto contraste',
    colors: {
      background: '#08100E',
      surface: '#101D19',
      accent: '#34D399',
      text: '#ECFDF5',
      lyricText: '#D1FAE5',
      lyricHighlight: '#6EE7B7',
    },
  },
  {
    id: 'crimson-theater',
    name: 'Teatro Carmesí',
    description: 'Terciopelo oscuro con acento coral cálido',
    colors: {
      background: '#130A0E',
      surface: '#1E1117',
      accent: '#FB7185',
      text: '#FFF1F2',
      lyricText: '#E2D4D8',
      lyricHighlight: '#FDA4AF',
    },
  },
  {
    id: 'violet-neon',
    name: 'Violeta Escénico',
    description: 'Púrpura profundo con brillo lavanda',
    colors: {
      background: '#0D0A17',
      surface: '#171228',
      accent: '#A78BFA',
      text: '#F5F3FF',
      lyricText: '#DDD6FE',
      lyricHighlight: '#C4B5FD',
    },
  },
  {
    id: 'paper-light',
    name: 'Papel Claro',
    description: 'Modo claro de alta legibilidad para ensayo de día',
    colors: {
      background: '#F4F5F7',
      surface: '#FFFFFF',
      accent: '#D97706',
      text: '#111827',
      lyricText: '#374151',
      lyricHighlight: '#B45309',
    },
  },
];

export interface LyricFontDefinition {
  id: LyricFontId;
  label: string;
  sample: string;
  cssFamily: string;
}

export const LYRIC_FONT_OPTIONS: LyricFontDefinition[] = [
  {
    id: 'outfit',
    label: 'Outfit',
    sample: 'Moderna y geométrica',
    cssFamily: '"Outfit", system-ui, sans-serif',
  },
  {
    id: 'jakarta',
    label: 'Plus Jakarta Sans',
    sample: 'Limpia y balanceada',
    cssFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
  },
  {
    id: 'playfair',
    label: 'Playfair Display',
    sample: 'Editorial y expresiva',
    cssFamily: '"Playfair Display", Georgia, serif',
  },
  {
    id: 'oswald',
    label: 'Oswald',
    sample: 'Condensada de escenario',
    cssFamily: '"Oswald", system-ui, sans-serif',
  },
  {
    id: 'lora',
    label: 'Lora',
    sample: 'Clásica y acústica',
    cssFamily: '"Lora", Georgia, serif',
  },
  {
    id: 'mono',
    label: 'JetBrains Mono',
    sample: 'Estudio monoespaciada',
    cssFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  themePreset: 'amber-stage',
  colors: { ...THEME_PRESETS[0].colors },
  lyricFont: 'outfit',
  lyricSizeMultiplier: 1.0,
  lyricAlign: 'left',
  lyricLineSpacing: 'balanced',
  lyricWeight: 'semibold',
  lyricUppercase: false,
  highlightStyle: 'sweep',
  pastStanzaOpacity: 0.45,
  showTimestamps: true,
  showChords: true,
  showSingingTips: true,
  countdownSeconds: 3,
  transposeSemitones: 0,
  metronomeEnabled: false,
  metronomeSound: 'wood',
  metronomeVolume: 0.65,
  autoLoopTrack: false,
  autoNextTrack: false,
  mirrorTeleprompter: false,
  focusStageMode: false,
  youtubeLyricsOnly: false,
  backgroundBubbleAuto: true,
};

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  return [12, 14, 18];
}

export function getRelativeLuminance(hex: string): number {
  const [r, g, b] = parseHexRgb(hex).map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isLightColor(hex: string): boolean {
  return getRelativeLuminance(hex) > 0.45;
}

export function getReadableContrastText(hex: string): string {
  return getRelativeLuminance(hex) > 0.36 ? '#0C0E12' : '#FFFFFF';
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHexRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function mixHexColors(hexA: string, hexB: string, ratioB: number): string {
  const [r1, g1, b1] = parseHexRgb(hexA);
  const [r2, g2, b2] = parseHexRgb(hexB);
  const t = Math.min(1, Math.max(0, ratioB));
  const r = Math.round(r1 * (1 - t) + r2 * t);
  const g = Math.round(g1 * (1 - t) + g2 * t);
  const b = Math.round(b1 * (1 - t) + b2 * t);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function applySettingsToDocument(settings: AppSettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const { colors } = settings;
  const lightBg = isLightColor(colors.background);

  const surfaceElevated = lightBg
    ? mixHexColors(colors.surface, colors.background, 0.45)
    : mixHexColors(colors.surface, '#FFFFFF', 0.05);

  const borderColor = lightBg
    ? 'rgba(15, 23, 42, 0.11)'
    : 'rgba(255, 255, 255, 0.09)';

  const borderStrong = lightBg
    ? 'rgba(15, 23, 42, 0.20)'
    : 'rgba(255, 255, 255, 0.18)';

  const textMuted = lightBg
    ? mixHexColors(colors.text, '#FFFFFF', 0.42)
    : mixHexColors(colors.text, '#000000', 0.38);

  const textSoft = lightBg
    ? mixHexColors(colors.text, '#FFFFFF', 0.58)
    : mixHexColors(colors.text, '#000000', 0.55);

  const fontDef =
    LYRIC_FONT_OPTIONS.find((f) => f.id === settings.lyricFont) ??
    LYRIC_FONT_OPTIONS[0];

  root.style.setProperty('--app-bg', colors.background);
  root.style.setProperty('--app-bg-glass', hexToRgba(colors.background, 0.94));
  root.style.setProperty('--app-surface', colors.surface);
  root.style.setProperty('--app-surface-elevated', surfaceElevated);
  root.style.setProperty('--app-border', borderColor);
  root.style.setProperty('--app-border-strong', borderStrong);
  root.style.setProperty('--app-text', colors.text);
  root.style.setProperty('--app-text-muted', textMuted);
  root.style.setProperty('--app-text-soft', textSoft);
  root.style.setProperty('--app-accent', colors.accent);
  root.style.setProperty('--app-accent-soft', hexToRgba(colors.accent, 0.15));
  root.style.setProperty('--app-accent-glow', hexToRgba(colors.accent, lightBg ? 0.08 : 0.12));
  root.style.setProperty('--app-accent-border', hexToRgba(colors.accent, 0.42));
  root.style.setProperty('--app-accent-contrast', getReadableContrastText(colors.accent));
  root.style.setProperty('--lyric-text', colors.lyricText);
  root.style.setProperty('--lyric-highlight', colors.lyricHighlight);
  root.style.setProperty('--lyric-unfilled', hexToRgba(colors.lyricText, lightBg ? 0.36 : 0.44));
  root.style.setProperty('--lyric-font', fontDef.cssFamily);
  root.style.setProperty('color-scheme', lightBg ? 'light' : 'dark');
}

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_APP_SETTINGS,
      ...parsed,
      colors: {
        ...DEFAULT_APP_SETTINGS.colors,
        ...(parsed.colors ?? {}),
      },
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadAllSongNotes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, string>;
    }
    return {};
  } catch {
    return {};
  }
}

export function saveSongNote(trackId: string, note: string): Record<string, string> {
  const all = loadAllSongNotes();
  if (!note.trim()) {
    delete all[trackId];
  } else {
    all[trackId] = note;
  }
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Ignore storage errors
  }
  return all;
}
