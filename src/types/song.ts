export type StanzaType =
  | 'intro'
  | 'verse'
  | 'prechorus'
  | 'chorus'
  | 'bridge'
  | 'solo'
  | 'outro';

export interface LyricLine {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
}

export interface Stanza {
  id: string;
  label: string;
  type: StanzaType;
  startTime: number;
  endTime: number;
  chords: string[];
  energy: number;
  singingTip: string;
  lines: LyricLine[];
}

export interface SongAnalysis {
  title: string;
  artist: string;
  durationSec: number;
  bpm: number;
  musicalKey: string;
  timeSignature: string;
  genre: string;
  mood: string;
  vocalRange: string;
  summary: string;
  stanzas: Stanza[];
}

export interface SongTrack {
  id: string;
  isDemo: boolean;
  sourceType?: 'audio' | 'youtube';
  youtubeVideoId?: string;
  fileName?: string;
  createdAt: number;
  audioUrl: string;
  analysis: SongAnalysis;
}

export type ActiveView = 'home' | 'stage' | 'structure' | 'editor' | 'library' | 'settings';
export type LyricScale = 'normal' | 'stage';

export type ThemePresetId =
  | 'amber-stage'
  | 'cobalt-midnight'
  | 'emerald-studio'
  | 'crimson-theater'
  | 'violet-neon'
  | 'paper-light'
  | 'custom';

export type LyricFontId =
  | 'outfit'
  | 'jakarta'
  | 'playfair'
  | 'oswald'
  | 'lora'
  | 'mono';

export type LyricLineSpacing = 'compact' | 'balanced' | 'airy';
export type LyricWeight = 'medium' | 'semibold' | 'bold';
export type KaraokeHighlightStyle = 'sweep' | 'solid' | 'underline';
export type MetronomeSound = 'wood' | 'click' | 'visual';

export interface ThemeColors {
  background: string;
  surface: string;
  accent: string;
  text: string;
  lyricText: string;
  lyricHighlight: string;
}

export interface AppSettings {
  themePreset: ThemePresetId;
  colors: ThemeColors;
  lyricFont: LyricFontId;
  lyricSizeMultiplier: number; // 0.75 to 1.6
  lyricAlign: 'left' | 'center';
  lyricLineSpacing: LyricLineSpacing;
  lyricWeight: LyricWeight;
  lyricUppercase: boolean;
  highlightStyle: KaraokeHighlightStyle;
  pastStanzaOpacity: number; // 0.25 to 0.9
  showTimestamps: boolean;
  showChords: boolean;
  showSingingTips: boolean;
  countdownSeconds: number; // 0, 2, 3, 5
  transposeSemitones: number; // -6 to +6
  metronomeEnabled: boolean;
  metronomeSound: MetronomeSound;
  metronomeVolume: number; // 0.1 to 1.0
  autoLoopTrack: boolean;
  autoNextTrack: boolean;
  mirrorTeleprompter: boolean;
  focusStageMode: boolean;
  youtubeLyricsOnly: boolean;
  backgroundBubbleAuto: boolean;
}

