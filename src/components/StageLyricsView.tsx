import { useEffect, useRef, useState } from 'react';
import {
  Repeat,
  ArrowDownToLine,
  Volume2,
  Share2,
  Youtube,
  NotebookPen,
  Sliders,
  Maximize,
  Minimize,
  PictureInPicture2,
  Eye,
  EyeOff,
  Upload,
} from 'lucide-react';
import { AppSettings, LyricScale, SongTrack, Stanza } from '../types/song';
import { LYRIC_FONT_OPTIONS } from '../utils/appSettings';
import { formatSemitoneOffset, transposeChord, transposeMusicalKey } from '../utils/chordTransposer';
import { PlayHistoryEntry } from '../utils/playHistory';
import { formatTime, PlaybackLocation } from '../utils/time';
import { RecentHistorySection } from './RecentHistorySection';

interface StageLyricsViewProps {
  track: SongTrack;
  availableTracks: SongTrack[];
  history: PlayHistoryEntry[];
  location: PlaybackLocation;
  isPlaying: boolean;
  loopStanzaId: string | null;
  lyricScale: LyricScale;
  settings: AppSettings;
  currentBeat: number;
  beatsPerBar: number;
  songNote: string;
  isBubbleOpen: boolean;
  isVisible?: boolean;
  videoPlayerNode?: React.ReactNode;
  onSeek: (timeSec: number) => void;
  onToggleLoopStanza: (stanzaId: string) => void;
  onShareStanza: (stanza: Stanza) => void;
  onStartPlay: () => void;
  onSelectFromHistory: (trackId: string, resumeAtSec?: number) => void;
  onRemoveHistory: (trackId: string) => void;
  onClearHistory: () => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onUpdateSongNote: (note: string) => void;
  onOpenSettings: () => void;
  onToggleBubble: () => void;
  onOpenAnalyzer: (initialTab?: 'audio' | 'youtube') => void;
}

export function StageLyricsView({
  track,
  availableTracks,
  history,
  location,
  isPlaying,
  loopStanzaId,
  lyricScale,
  settings,
  currentBeat,
  beatsPerBar,
  songNote,
  isBubbleOpen,
  isVisible = true,
  videoPlayerNode,
  onSeek,
  onToggleLoopStanza,
  onShareStanza,
  onStartPlay,
  onSelectFromHistory,
  onRemoveHistory,
  onClearHistory,
  onUpdateSettings,
  onUpdateSongNote,
  onOpenSettings,
  onToggleBubble,
  onOpenAnalyzer,
}: StageLyricsViewProps) {
  const { analysis } = track;
  const hasVideo = Boolean(videoPlayerNode);
  const showVideoLayout = hasVideo && !settings.youtubeLyricsOnly;
  const stanzaRefs = useRef<Record<string, HTMLElement | null>>({});
  const [autoFollow, setAutoFollow] = useState(true);
  const [showNotesBox, setShowNotesBox] = useState(false);
  const [showMobileStudio, setShowMobileStudio] = useState(false);
  const lastScrolledStanzaRef = useRef<string | null>(null);
  const programmaticScrollRef = useRef(false);

  // Auto-scroll to active stanza when it changes
  useEffect(() => {
    if (!isVisible || !autoFollow || !location.stanza) return;
    if (lastScrolledStanzaRef.current === location.stanza.id) return;

    const el = stanzaRefs.current[location.stanza.id];
    if (el) {
      lastScrolledStanzaRef.current = location.stanza.id;
      programmaticScrollRef.current = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => {
        programmaticScrollRef.current = false;
      }, 600);
    }
  }, [isVisible, autoFollow, location.stanza]);

  // Detect manual scroll to pause auto-follow temporarily
  useEffect(() => {
    if (!isVisible) return;
    const handleScroll = () => {
      if (programmaticScrollRef.current) return;
      if (isPlaying && autoFollow) {
        setAutoFollow(false);
      }
    };
    window.addEventListener('wheel', handleScroll, { passive: true });
    window.addEventListener('touchmove', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('wheel', handleScroll);
      window.removeEventListener('touchmove', handleScroll);
    };
  }, [isVisible, isPlaying, autoFollow]);

  const handleResumeAutoFollow = () => {
    setAutoFollow(true);
    if (location.stanza) {
      const el = stanzaRefs.current[location.stanza.id];
      if (el) {
        programmaticScrollRef.current = true;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.setTimeout(() => {
          programmaticScrollRef.current = false;
        }, 600);
      }
    }
  };

  const handleStanzaJump = (stanza: Stanza) => {
    setAutoFollow(true);
    lastScrolledStanzaRef.current = stanza.id;
    onSeek(stanza.startTime);
    if (!isPlaying) {
      onStartPlay();
    }
  };

  const fontDef =
    LYRIC_FONT_OPTIONS.find((f) => f.id === settings.lyricFont) ?? LYRIC_FONT_OPTIONS[0];

  const basePx = showVideoLayout
    ? lyricScale === 'stage'
      ? 24
      : 19
    : lyricScale === 'stage'
      ? 30
      : 22;
  const computedFontPx = Math.round(basePx * settings.lyricSizeMultiplier);

  const lineHeightValue =
    settings.lyricLineSpacing === 'compact'
      ? 1.18
      : settings.lyricLineSpacing === 'airy'
        ? 1.52
        : 1.32;

  const weightClass =
    settings.lyricWeight === 'bold'
      ? 'font-bold'
      : settings.lyricWeight === 'medium'
        ? 'font-medium'
        : 'font-semibold';

  const transposedKey = transposeMusicalKey(
    analysis.musicalKey,
    settings.transposeSemitones,
  );

  // Configurable countdown badge
  const showCountdown =
    settings.countdownSeconds > 0 &&
    location.countdownSeconds !== null &&
    location.countdownSeconds <= settings.countdownSeconds;

  return (
    <section
      aria-hidden={!isVisible}
      className={`${
        isVisible ? 'block' : 'hidden'
      } mx-auto max-w-[1260px] px-3.5 pt-4 pb-36 sm:px-6 sm:pt-6 sm:pb-40`}
    >
      {!settings.focusStageMode && (
        <RecentHistorySection
          entries={history}
          availableTracks={availableTracks}
          activeTrackId={track.id}
          variant="strip"
          onSelectFromHistory={onSelectFromHistory}
          onRemoveEntry={onRemoveHistory}
          onClearHistory={onClearHistory}
        />
      )}

      {/* Song Stage Header */}
      <div className="mb-4 sm:mb-8">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-end md:justify-between pb-3 sm:pb-4 border-b border-[var(--app-border)]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {hasVideo && (
                <Youtube
                  className="h-4.5 w-4.5 sm:h-5 sm:w-5 shrink-0 text-[var(--app-accent)]"
                  aria-hidden="true"
                />
              )}
              <h1 className="font-display text-xl font-bold tracking-tight text-[var(--app-text)] sm:text-[32px] leading-tight text-balance truncate">
                {analysis.title}
              </h1>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm text-[var(--app-text-muted)]">
              <span className="font-medium text-[var(--app-text)] truncate max-w-[160px] sm:max-w-none">
                {analysis.artist}
              </span>
              <span aria-hidden="true" className="text-[var(--app-text-soft)]">·</span>
              <span className="font-mono tabular-nums">{analysis.bpm} BPM</span>
              <span aria-hidden="true" className="text-[var(--app-text-soft)]">·</span>
              <span className="font-mono">
                {transposedKey}
                {settings.transposeSemitones !== 0
                  ? ` (${formatSemitoneOffset(settings.transposeSemitones)})`
                  : ''}
              </span>
              <span aria-hidden="true" className="text-[var(--app-text-soft)]">·</span>
              <span className="font-mono tabular-nums">{formatTime(analysis.durationSec)}</span>
            </div>
          </div>

          {location.stanza && (
            <div className="flex items-center justify-between gap-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/80 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm text-[var(--app-text-muted)] shrink-0">
              <div className="min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[var(--app-text-soft)]">
                  Sección
                </span>
                <span className="font-semibold text-[var(--app-accent)] truncate">
                  {location.stanza.label}
                </span>
                {showCountdown && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-[var(--app-accent)] whitespace-nowrap">
                      {location.countdownSeconds}s
                    </span>
                  </>
                )}
              </div>
              <div className="h-4 w-px bg-[var(--app-border)]" aria-hidden="true" />
              <button
                type="button"
                onClick={() => location.stanza && onShareStanza(location.stanza)}
                className="inline-flex min-h-[36px] sm:min-h-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-accent)] whitespace-nowrap shrink-0"
              >
                <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Compartir</span>
              </button>
            </div>
          )}
        </div>

        {/* Clean Section Jump Navigator */}
        {!settings.focusStageMode && (
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar border-b border-[var(--app-border)] px-1">
            {analysis.stanzas.map((stanza, idx) => {
              const isCurrent = location.stanzaIndex === idx;
              const isLooped = loopStanzaId === stanza.id;
              return (
                <button
                  key={stanza.id}
                  type="button"
                  onClick={() => handleStanzaJump(stanza)}
                  className={`relative min-h-[40px] py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--app-accent)] ${
                    isCurrent
                      ? 'text-[var(--app-accent)] font-semibold'
                      : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                  }`}
                >
                  <span>
                    {stanza.label}
                    {isLooped ? ' · Bucle' : ''}
                  </span>
                  {isCurrent && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[var(--app-accent)]"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Phone-First 4-Column Quick Action Strip (Zero horizontal clipping on 320px-430px phones) */}
        <div className="mt-2.5 grid grid-cols-4 gap-1.5 md:hidden">
          {hasVideo ? (
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ youtubeLyricsOnly: !settings.youtubeLyricsOnly })
              }
              className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1.5 text-[10px] font-medium transition-colors ${
                settings.youtubeLyricsOnly
                  ? 'border-[var(--app-accent-border)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                  : 'border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)]'
              }`}
            >
              {settings.youtubeLyricsOnly ? (
                <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              <span className="truncate max-w-full">
                {settings.youtubeLyricsOnly ? 'Ver video' : 'Solo letras'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowMobileStudio((prev) => !prev)}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1.5 text-[10px] font-medium transition-colors ${
                settings.transposeSemitones !== 0
                  ? 'border-[var(--app-accent-border)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                  : 'border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)]'
              }`}
            >
              <span className="font-mono text-[11px] font-semibold tabular-nums leading-none">
                {settings.transposeSemitones >= 0
                  ? `+${settings.transposeSemitones}`
                  : settings.transposeSemitones}{' '}
                st
              </span>
              <span className="truncate max-w-full">Tono</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleBubble}
            className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1.5 text-[10px] font-medium transition-colors ${
              isBubbleOpen
                ? 'border-[var(--app-accent-border)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                : 'border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)]'
            }`}
          >
            <PictureInPicture2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate max-w-full">Burbuja</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateSettings({ metronomeEnabled: !settings.metronomeEnabled })
            }
            className={`flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-1.5 text-[10px] font-medium transition-colors ${
              settings.metronomeEnabled
                ? 'border-[var(--app-accent-border)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                : 'border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)]'
            }`}
          >
            <span className="inline-flex items-center gap-1 h-3.5" aria-hidden="true">
              {Array.from({ length: Math.min(4, beatsPerBar) }).map((_, b) => (
                <span
                  key={b}
                  className={`h-1.5 w-1.5 rounded-full transition-transform ${
                    settings.metronomeEnabled && currentBeat === b && isPlaying
                      ? 'bg-[var(--app-accent)] scale-125'
                      : 'bg-current opacity-40'
                  }`}
                />
              ))}
            </span>
            <span className="truncate max-w-full">Pulso</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMobileStudio((prev) => !prev)}
            className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1.5 text-[10px] font-medium transition-colors ${
              showMobileStudio || showNotesBox || settings.focusStageMode
                ? 'border-[var(--app-accent-border)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                : 'border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)]'
            }`}
          >
            <Sliders className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate max-w-full">Estudio</span>
          </button>
        </div>

        {/* Expandable Phone Studio Controls Drawer */}
        {showMobileStudio && (
          <div className="mt-2.5 space-y-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 md:hidden">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--app-text-muted)]">
                Transponer acordes
              </span>
              <div className="inline-flex items-center rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)]/50">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      transposeSemitones: Math.max(-6, settings.transposeSemitones - 1),
                    })
                  }
                  className="min-h-[36px] px-3 text-xs font-medium text-[var(--app-text)]"
                >
                  -1 st
                </button>
                <span className="border-x border-[var(--app-border)] px-3 font-mono text-xs tabular-nums text-[var(--app-accent)]">
                  {settings.transposeSemitones >= 0
                    ? `+${settings.transposeSemitones}`
                    : settings.transposeSemitones}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      transposeSemitones: Math.min(6, settings.transposeSemitones + 1),
                    })
                  }
                  className="min-h-[36px] px-3 text-xs font-medium text-[var(--app-text)]"
                >
                  +1 st
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setShowNotesBox((prev) => !prev)}
                className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border text-xs font-medium ${
                  showNotesBox || songNote.trim().length > 0
                    ? 'border-[var(--app-accent-border)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                    : 'border-[var(--app-border)] bg-[var(--app-bg)]/40 text-[var(--app-text)]'
                }`}
              >
                <NotebookPen className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Notas</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ focusStageMode: !settings.focusStageMode })
                }
                className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border text-xs font-medium ${
                  settings.focusStageMode
                    ? 'border-[var(--app-accent-border)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                    : 'border-[var(--app-border)] bg-[var(--app-bg)]/40 text-[var(--app-text)]'
                }`}
              >
                {settings.focusStageMode ? (
                  <Minimize className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Maximize className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Enfoque</span>
              </button>

              <button
                type="button"
                onClick={onOpenSettings}
                className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)]/40 text-xs font-medium text-[var(--app-text)]"
              >
                <Sliders className="h-3.5 w-3.5 text-[var(--app-accent)]" aria-hidden="true" />
                <span>Colores</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => onOpenAnalyzer('audio')}
              className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-[var(--app-accent)] px-3 text-xs font-semibold text-[var(--app-accent-contrast)]"
            >
              <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Importar música desde este teléfono</span>
            </button>
          </div>
        )}

        {/* Unified Desktop Studio Console Bar */}
        <div className="mt-3 hidden md:flex items-center gap-1 overflow-x-auto no-scrollbar rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/85 p-1">
          {/* Quick Chord Transposer */}
          <div className="inline-flex items-center text-xs shrink-0">
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({
                  transposeSemitones: Math.max(-6, settings.transposeSemitones - 1),
                })
              }
              title="Bajar medio tono"
              className="rounded-md px-2 py-1 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text)] whitespace-nowrap"
            >
              -1 st
            </button>
            <span className="px-2 py-1 font-mono text-[11px] tabular-nums text-[var(--app-text)] whitespace-nowrap">
              Tono {settings.transposeSemitones >= 0 ? `+${settings.transposeSemitones}` : settings.transposeSemitones}
            </span>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({
                  transposeSemitones: Math.min(6, settings.transposeSemitones + 1),
                })
              }
              title="Subir medio tono"
              className="rounded-md px-2 py-1 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text)] whitespace-nowrap"
            >
              +1 st
            </button>
          </div>

          <span className="h-4 w-px bg-[var(--app-border)] mx-0.5 shrink-0" aria-hidden="true" />

          {/* Metronome Toggle + Beat Visualizer */}
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({ metronomeEnabled: !settings.metronomeEnabled })
            }
            className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              settings.metronomeEnabled
                ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text)]'
            }`}
          >
            <span>Metrónomo</span>
            {settings.metronomeEnabled && (
              <span className="inline-flex items-center gap-1" aria-hidden="true">
                {Array.from({ length: Math.min(6, beatsPerBar) }).map((_, b) => (
                  <span
                    key={b}
                    className={`h-1.5 w-1.5 rounded-full transition-transform ${
                      currentBeat === b && isPlaying
                        ? 'bg-[var(--app-accent)] scale-125'
                        : 'bg-current opacity-25'
                    }`}
                  />
                ))}
              </span>
            )}
          </button>

          {hasVideo && (
            <>
              <span className="h-4 w-px bg-[var(--app-border)] mx-0.5 shrink-0" aria-hidden="true" />
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ youtubeLyricsOnly: !settings.youtubeLyricsOnly })
                }
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  settings.youtubeLyricsOnly
                    ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                    : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text)]'
                }`}
              >
                {settings.youtubeLyricsOnly ? (
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{settings.youtubeLyricsOnly ? 'Mostrar video' : 'Solo letras'}</span>
              </button>
            </>
          )}

          <span className="h-4 w-px bg-[var(--app-border)] mx-0.5 shrink-0" aria-hidden="true" />

          <button
            type="button"
            onClick={onToggleBubble}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              isBubbleOpen
                ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text)]'
            }`}
          >
            <PictureInPicture2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Burbuja flotante</span>
          </button>

          <span className="h-4 w-px bg-[var(--app-border)] mx-0.5 shrink-0" aria-hidden="true" />

          <button
            type="button"
            onClick={() => setShowNotesBox((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              showNotesBox || songNote.trim().length > 0
                ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text)]'
            }`}
          >
            <NotebookPen className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Notas</span>
          </button>

          <span className="h-4 w-px bg-[var(--app-border)] mx-0.5 shrink-0" aria-hidden="true" />

          <button
            type="button"
            onClick={() =>
              onUpdateSettings({ focusStageMode: !settings.focusStageMode })
            }
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              settings.focusStageMode
                ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text)]'
            }`}
          >
            {settings.focusStageMode ? (
              <Minimize className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Maximize className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{settings.focusStageMode ? 'Salir enfoque' : 'Modo enfoque'}</span>
          </button>

          <span className="h-4 w-px bg-[var(--app-border)] mx-0.5 shrink-0" aria-hidden="true" />

          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-accent)] whitespace-nowrap shrink-0"
          >
            <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Colores y letras</span>
          </button>
        </div>
      </div>

      {/* Expandable Notes Drawer */}
      {showNotesBox && (
        <div className="mb-5">
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3.5 sm:p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--app-text)]">
                Notas de ensayo · {analysis.title}
              </span>
              <span className="text-[11px] text-[var(--app-text-muted)]">
                Guardado automático
              </span>
            </div>
            <textarea
              rows={3}
              value={songNote}
              onChange={(e) => onUpdateSongNote(e.target.value)}
              placeholder="Anota respiraciones, tono, capotraste o recordatorios..."
              className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-soft)] focus:border-[var(--app-accent)] focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Main Content: Responsive Split (Sticky YouTube Video + Scrolling Stanzas) or Lyrics-Only Teleprompter */}
      <div
        className={
          showVideoLayout
            ? 'lg:grid lg:grid-cols-[440px_minmax(0,1fr)] xl:grid-cols-[480px_minmax(0,1fr)] lg:gap-8 lg:items-start'
            : ''
        }
      >
        {/* Keep YouTube IFrame mounted in DOM even in Solo Letras mode so audio continues playing seamlessly */}
        {hasVideo && (
          <aside
            className={
              settings.youtubeLyricsOnly
                ? 'pointer-events-none fixed -left-[9999px] h-px w-px overflow-hidden opacity-0'
                : 'sticky top-0 md:top-[64px] lg:top-20 z-20 -mx-3.5 mb-4 px-3.5 pt-1.5 pb-2 bg-[var(--app-bg-glass)] backdrop-blur-md border-b border-[var(--app-border)] lg:mx-0 lg:mb-0 lg:p-0 lg:bg-transparent lg:backdrop-blur-none lg:border-0'
            }
          >
            <div className="mx-auto w-full max-w-[calc(25dvh*16/9)] sm:max-w-[calc(32dvh*16/9)] lg:max-w-none">
              {videoPlayerNode}
            </div>

            {/* Compact sticky mobile quick bar below video */}
            <div className="mt-2 flex items-center justify-between gap-2 lg:hidden">
              <span className="truncate text-xs font-medium text-[var(--app-accent)]">
                {location.stanza?.label ?? analysis.title}
              </span>
              <button
                type="button"
                onClick={() => onUpdateSettings({ youtubeLyricsOnly: true })}
                className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--app-text)] whitespace-nowrap shrink-0"
              >
                <EyeOff className="h-3 w-3" aria-hidden="true" />
                <span>Solo letras</span>
              </button>
            </div>

            {!settings.youtubeLyricsOnly && location.stanza && (
              <div className="hidden lg:block mt-3.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[var(--app-accent)]">
                    {location.stanza.label}
                  </span>
                  {settings.showChords && location.stanza.chords.length > 0 && (
                    <span className="font-mono text-[var(--app-text-muted)] truncate">
                      {location.stanza.chords
                        .map((c) => transposeChord(c, settings.transposeSemitones))
                        .join(' · ')}
                    </span>
                  )}
                </div>
                {location.line && (
                  <p
                    style={{ fontFamily: fontDef.cssFamily }}
                    className="mt-2 text-base font-semibold leading-snug text-[var(--app-text)]"
                  >
                    {location.line.text}
                  </p>
                )}
              </div>
            )}
          </aside>
        )}

        {/* Stanza Teleprompter Column */}
        <div
          className={`${showVideoLayout ? 'space-y-4 sm:space-y-5' : 'mx-auto max-w-3xl space-y-4 sm:space-y-6'} ${
            settings.mirrorTeleprompter ? '-scale-x-100' : ''
          }`}
        >
          {analysis.stanzas.map((stanza, sIdx) => {
            const isStanzaActive = location.stanzaIndex === sIdx;
            const isLooped = loopStanzaId === stanza.id;
            const displayChords = stanza.chords.map((c) =>
              transposeChord(c, settings.transposeSemitones),
            );

            return (
              <article
                key={stanza.id}
                ref={(el) => {
                  stanzaRefs.current[stanza.id] = el;
                }}
                style={{
                  backgroundColor: 'var(--app-surface)',
                  backgroundImage: isStanzaActive
                    ? 'linear-gradient(180deg, var(--app-accent-glow) 0%, transparent 130px)'
                    : undefined,
                  borderColor: isStanzaActive
                    ? 'var(--app-accent-border)'
                    : 'var(--app-border)',
                  opacity: isStanzaActive ? 1 : settings.pastStanzaOpacity,
                }}
                className={`rounded-2xl border transition-all duration-300 px-4 py-5 sm:px-7 sm:py-6 ${
                  isStanzaActive
                    ? 'shadow-[0_20px_50px_-18px_rgba(0,0,0,0.55)] ring-1 ring-[var(--app-accent-soft)]'
                    : 'hover:opacity-95'
                }`}
              >
                {/* Stanza Metadata Header */}
                <div className="mb-3.5 sm:mb-4 border-b border-[var(--app-border)] pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => handleStanzaJump(stanza)}
                        className={`min-h-[36px] sm:min-h-0 flex items-center font-semibold tracking-wide transition-colors truncate ${
                          isStanzaActive
                            ? 'text-[var(--app-accent)]'
                            : 'text-[var(--app-text)] hover:text-[var(--app-accent)]'
                        }`}
                      >
                        {stanza.label}
                      </button>
                      <span aria-hidden="true" className="text-[var(--app-text-soft)]">
                        ·
                      </span>
                      <span className="font-mono tabular-nums text-[var(--app-text-muted)] whitespace-nowrap">
                        {formatTime(stanza.startTime)}–{formatTime(stanza.endTime)}
                      </span>
                      {settings.showChords && displayChords.length > 0 && (
                        <span className="hidden sm:inline font-mono text-[var(--app-text-muted)]">
                          <span aria-hidden="true" className="text-[var(--app-text-soft)] mr-2">
                            ·
                          </span>
                          {displayChords.join(' · ')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleLoopStanza(stanza.id)}
                        title={
                          isLooped
                            ? 'Desactivar bucle de estrofa'
                            : 'Repetir esta estrofa en bucle'
                        }
                        className={`inline-flex min-h-[38px] sm:min-h-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          isLooped
                            ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border border-[var(--app-accent-border)]'
                            : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-surface-elevated)]'
                        }`}
                      >
                        <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{isLooped ? 'Repitiendo' : 'Repetir'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onShareStanza(stanza)}
                        aria-label={`Compartir ${stanza.label} como imagen`}
                        title="Compartir estrofa como imagen"
                        className="inline-flex min-h-[38px] min-w-[38px] sm:min-h-0 sm:min-w-0 items-center justify-center gap-1.5 rounded-md px-2 sm:px-2.5 py-1 text-xs font-medium text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-accent)] whitespace-nowrap shrink-0"
                      >
                        <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="hidden sm:inline">Compartir</span>
                      </button>
                    </div>
                  </div>

                  {settings.showChords && displayChords.length > 0 && (
                    <div className="mt-0.5 sm:hidden font-mono text-[11px] text-[var(--app-text-muted)] truncate">
                      {displayChords.join(' · ')}
                    </div>
                  )}
                </div>

                {/* Vocal Guidance Note inside Active Stanza */}
                {settings.showSingingTips && isStanzaActive && stanza.singingTip && (
                  <div className="mb-3.5 sm:mb-4 flex items-start gap-2 text-xs leading-relaxed text-[var(--app-accent)]">
                    <Volume2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{stanza.singingTip}</span>
                  </div>
                )}

                {/* Lyric Lines */}
                <div className="space-y-2 sm:space-y-3">
                  {stanza.lines.map((line, lIdx) => {
                    const isLineActive =
                      isStanzaActive && location.lineIndexInStanza === lIdx;
                    const isLinePast =
                      isStanzaActive &&
                      location.lineIndexInStanza !== -1 &&
                      lIdx < location.lineIndexInStanza;
                    const isInstrumental =
                      line.text.startsWith('(') && line.text.endsWith(')');

                    const progressPct = isLineActive
                      ? Math.round(location.lineProgress * 1000) / 10
                      : 0;

                    return (
                      <button
                        key={line.id}
                        type="button"
                        onClick={() => {
                          setAutoFollow(true);
                          onSeek(line.startTime);
                          if (!isPlaying) onStartPlay();
                        }}
                        className={`group block min-h-[44px] w-full rounded-lg px-2 py-2 -mx-2 transition-transform duration-200 focus-visible:outline-2 focus-visible:outline-[var(--app-accent)] ${
                          settings.lyricAlign === 'center' ? 'text-center' : 'text-left'
                        } ${
                          isLineActive
                            ? 'sm:translate-x-1 bg-[var(--app-accent-soft)] sm:bg-transparent'
                            : 'hover:bg-[var(--app-surface-elevated)]/60'
                        }`}
                      >
                        <div
                          className={`flex items-baseline gap-2.5 sm:gap-3 ${
                            settings.lyricAlign === 'center' ? 'justify-center' : ''
                          }`}
                        >
                          {settings.showTimestamps && (
                            <span
                              className={`font-mono text-[10px] sm:text-[11px] tabular-nums shrink-0 w-8 sm:w-10 transition-colors ${
                                isLineActive
                                  ? 'text-[var(--app-accent)]'
                                  : 'text-[var(--app-text-soft)] group-hover:text-[var(--app-text-muted)]'
                              }`}
                            >
                              {formatTime(line.startTime)}
                            </span>
                          )}

                          {isLineActive ? (
                            <span
                              style={
                                {
                                  fontFamily: fontDef.cssFamily,
                                  fontSize: `clamp(${Math.round(17 * settings.lyricSizeMultiplier)}px, 4.8vw, ${computedFontPx}px)`,
                                  lineHeight: lineHeightValue,
                                  '--line-progress': `${progressPct}%`,
                                  color:
                                    settings.highlightStyle === 'sweep'
                                      ? undefined
                                      : 'var(--lyric-highlight)',
                                } as React.CSSProperties
                              }
                              className={`tracking-tight break-words ${weightClass} ${
                                settings.lyricUppercase ? 'uppercase' : ''
                              } ${
                                settings.highlightStyle === 'sweep'
                                  ? 'karaoke-line-active'
                                  : settings.highlightStyle === 'underline'
                                    ? 'underline decoration-2 underline-offset-4'
                                    : ''
                              } ${isInstrumental ? 'italic font-medium' : ''}`}
                            >
                              {line.text}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontFamily: fontDef.cssFamily,
                                fontSize: `clamp(${Math.round(16 * settings.lyricSizeMultiplier)}px, 4.4vw, ${computedFontPx}px)`,
                                lineHeight: lineHeightValue,
                                color: isInstrumental
                                  ? 'var(--app-text-soft)'
                                  : isLinePast
                                    ? 'var(--lyric-highlight)'
                                    : 'var(--lyric-text)',
                              }}
                              className={`tracking-tight transition-colors break-words ${weightClass} ${
                                settings.lyricUppercase ? 'uppercase' : ''
                              } ${
                                isInstrumental
                                  ? 'italic opacity-80'
                                  : isLinePast
                                    ? 'opacity-75'
                                    : isStanzaActive
                                      ? 'opacity-95'
                                      : 'opacity-80 group-hover:opacity-100'
                              }`}
                            >
                              {line.text}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Floating Resume Auto-Follow Button */}
      {!autoFollow && isVisible && (
        <div className="fixed bottom-28 right-4 sm:right-6 z-20">
          <button
            type="button"
            onClick={handleResumeAutoFollow}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--app-accent-border)] bg-[var(--app-surface)] px-4 py-2.5 text-xs font-semibold text-[var(--app-accent)] shadow-lg backdrop-blur-md transition-colors hover:bg-[var(--app-accent-soft)] whitespace-nowrap"
          >
            <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
            <span>Volver a la estrofa actual</span>
          </button>
        </div>
      )}
    </section>
  );
}


