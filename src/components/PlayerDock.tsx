import { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Repeat,
  MicOff,
  Mic,
  Volume2,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  PictureInPicture2,
  Eye,
  EyeOff,
  Upload,
  X,
} from 'lucide-react';
import { LyricScale, SongTrack, Stanza } from '../types/song';
import { formatTime } from '../utils/time';

interface PlayerDockProps {
  track: SongTrack;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
  syncOffset: number;
  volume: number;
  vocalReduction: boolean;
  loopStanzaId: string | null;
  activeStanza: Stanza | null;
  lyricScale: LyricScale;
  analyserNode: AnalyserNode | null;
  isYouTube?: boolean;
  youtubeLyricsOnly?: boolean;
  isBubbleOpen?: boolean;
  onTogglePlay: () => void;
  onSeek: (timeSec: number) => void;
  onChangeRate: (rate: number) => void;
  onChangeOffset: (delta: number) => void;
  onChangeVolume: (vol: number) => void;
  onToggleVocalReduction: () => void;
  onToggleLoopCurrentStanza: () => void;
  onToggleLyricScale: () => void;
  onToggleYouTubeLyricsOnly?: () => void;
  onToggleBubble?: () => void;
  onOpenAnalyzer?: (initialTab?: 'audio' | 'youtube') => void;
}

const SPEED_OPTIONS = [0.75, 0.9, 1.0, 1.1];

export function PlayerDock({
  track,
  currentTime,
  duration,
  isPlaying,
  playbackRate,
  syncOffset,
  volume,
  vocalReduction,
  loopStanzaId,
  activeStanza,
  lyricScale,
  analyserNode,
  isYouTube = false,
  youtubeLyricsOnly = false,
  isBubbleOpen = false,
  onTogglePlay,
  onSeek,
  onChangeRate,
  onChangeOffset,
  onChangeVolume,
  onToggleVocalReduction,
  onToggleLoopCurrentStanza,
  onToggleLyricScale,
  onToggleYouTubeLyricsOnly,
  onToggleBubble,
  onOpenAnalyzer,
}: PlayerDockProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    time: number;
    label: string;
    pct: number;
  } | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const safeDuration = Math.max(1, duration || track.analysis.durationSec);
  const progressPct = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));

  // Real-time audio spectrum visualizer reading active theme accent
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const dataArray = analyserNode
      ? new Uint8Array(analyserNode.frequencyBinCount)
      : null;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const styles = getComputedStyle(document.documentElement);
      const accentColor = styles.getPropertyValue('--app-accent').trim() || '#fbbf24';
      const mutedTrackColor = styles.getPropertyValue('--app-border-strong').trim() || 'rgba(255,255,255,0.16)';

      const barCount = 56;
      const gap = 2;
      const barWidth = Math.max(2, (width - gap * (barCount - 1)) / barCount);

      if (analyserNode && dataArray && isPlaying) {
        analyserNode.getByteFrequencyData(dataArray);
      }

      for (let i = 0; i < barCount; i++) {
        let magnitude = 0.08;
        if (analyserNode && dataArray && isPlaying) {
          const binIdx = Math.floor((i / barCount) * (dataArray.length * 0.65));
          magnitude = Math.max(0.08, dataArray[binIdx] / 255);
        }
        const barH = Math.max(2, magnitude * (height - 2));
        const x = i * (barWidth + gap);
        const y = height - barH;
        const barPct = (i / barCount) * 100;
        ctx.globalAlpha = barPct <= progressPct ? 0.9 : 0.42;
        ctx.fillStyle = barPct <= progressPct ? accentColor : mutedTrackColor;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, [2, 2, 0, 0]);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [analyserNode, isPlaying, progressPct]);

  const handleScrub = (clientX: number) => {
    const bar = progressBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onSeek(ratio * safeDuration);
  };

  const handleHover = (clientX: number) => {
    const bar = progressBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const time = ratio * safeDuration;
    const stanza = track.analysis.stanzas.find(
      (s) => time >= s.startTime && time <= s.endTime,
    );
    setHoverInfo({
      time,
      label: stanza?.label ?? '',
      pct: ratio * 100,
    });
  };

  const hasCustomMobileOptions =
    (!isYouTube && vocalReduction) || loopStanzaId !== null || playbackRate !== 1 || syncOffset !== 0;

  return (
    <>
      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--app-border)] bg-[var(--app-bg-glass)] backdrop-blur-lg pb-safe">
        <div className="mx-auto max-w-[1360px] px-3.5 pt-1 sm:px-6 sm:pt-2.5">
          {/* Interactive Stanza Timeline & Live Audio Spectrum */}
          <div className="relative mb-1 sm:mb-2.5">
            {!isYouTube && (
              <canvas
                ref={canvasRef}
                width={640}
                height={18}
                aria-hidden="true"
                className="pointer-events-none hidden sm:block h-[18px] w-full opacity-85"
              />
            )}

            {hoverInfo && (
              <div
                style={{ left: `${Math.min(88, Math.max(12, hoverInfo.pct))}%` }}
                className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-[var(--app-surface)] px-2 py-0.5 text-[11px] font-mono text-[var(--app-text)] shadow border border-[var(--app-border-strong)] whitespace-nowrap"
              >
                {hoverInfo.label ? `${hoverInfo.label} · ` : ''}
                {formatTime(hoverInfo.time)}
              </div>
            )}

            {/* Touch-friendly hit zone around seek bar */}
            <div
              ref={progressBarRef}
              role="slider"
              tabIndex={0}
              aria-label="Progreso de la canción"
              aria-valuemin={0}
              aria-valuemax={Math.round(safeDuration)}
              aria-valuenow={Math.round(currentTime)}
              onClick={(e) => handleScrub(e.clientX)}
              onTouchStart={(e) => {
                if (e.touches[0]) handleScrub(e.touches[0].clientX);
              }}
              onTouchMove={(e) => {
                if (e.touches[0]) handleScrub(e.touches[0].clientX);
              }}
              onMouseMove={(e) => handleHover(e.clientX)}
              onMouseLeave={() => setHoverInfo(null)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') onSeek(Math.min(safeDuration, currentTime + 5));
                if (e.key === 'ArrowLeft') onSeek(Math.max(0, currentTime - 5));
              }}
              className="group relative flex h-5 sm:h-4 w-full cursor-pointer items-center focus-visible:outline-2 focus-visible:outline-[var(--app-accent)]"
            >
              <div className="relative h-1.5 sm:h-2 w-full rounded-full bg-[var(--app-border)]">
                <div className="relative h-full w-full overflow-hidden rounded-full">
                  {track.analysis.stanzas.map((stanza) => {
                    const leftPct = (stanza.startTime / safeDuration) * 100;
                    return (
                      <span
                        key={stanza.id}
                        aria-hidden="true"
                        style={{ left: `${leftPct}%` }}
                        className="absolute top-0 bottom-0 w-[1.5px] bg-[var(--app-bg)]/85 z-10"
                      />
                    );
                  })}
                  <div
                    style={{ width: `${progressPct}%` }}
                    className="h-full rounded-full bg-[var(--app-accent)] transition-[width] duration-75"
                  />
                </div>
                <span
                  aria-hidden="true"
                  style={{ left: `${progressPct}%` }}
                  className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-[var(--app-accent)] ring-2 ring-[var(--app-surface)] opacity-0 scale-75 transition-all group-hover:opacity-100 group-hover:scale-100"
                />
              </div>
            </div>

            {/* Mobile Timecode Row */}
            <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-[var(--app-text-muted)] md:hidden -mt-0.5">
              <span className="text-[var(--app-text)]">{formatTime(currentTime)}</span>
              <span>{formatTime(safeDuration)}</span>
            </div>
          </div>

          {/* Transport & Singing Controls Row */}
          <div className="flex items-center justify-between gap-2.5 sm:gap-3 pb-0.5 sm:pb-0">
            {/* Left: Track Info + Desktop Timecode */}
            <div className="flex min-w-0 flex-1 md:flex-initial items-center gap-2 sm:gap-3">
              <div className="min-w-0 flex-1 md:max-w-[200px]">
                <div className="truncate text-xs sm:text-[13px] font-semibold text-[var(--app-text)]">
                  {track.analysis.title}
                </div>
                <div className="truncate text-[11px] text-[var(--app-accent)] md:text-[var(--app-text-muted)]">
                  {activeStanza ? activeStanza.label : track.analysis.artist}
                </div>
              </div>
              <div className="hidden md:block font-mono text-xs tabular-nums text-[var(--app-text-muted)] whitespace-nowrap shrink-0">
                <span className="text-[var(--app-text)]">{formatTime(currentTime)}</span>
                <span className="mx-1 text-[var(--app-text-soft)]">/</span>
                <span>{formatTime(safeDuration)}</span>
              </div>
            </div>

            {/* Center: Play / Seek / Mobile Drawer Trigger */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onSeek(Math.max(0, currentTime - 5))}
                aria-label="Retroceder 5 segundos"
                title="Retroceder 5 segundos"
                className="flex h-10 w-9 sm:h-auto sm:w-auto items-center justify-center rounded-lg p-1.5 sm:p-2 text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text)]"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onTogglePlay}
                aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
                className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-[var(--app-accent)] text-[var(--app-accent-contrast)] shadow-[0_6px_20px_-4px_var(--app-accent-border)] transition-all hover:opacity-92 active:scale-95"
              >
                {isPlaying ? (
                  <Pause className="h-4.5 w-4.5 fill-current" aria-hidden="true" />
                ) : (
                  <Play className="h-4.5 w-4.5 translate-x-0.5 fill-current" aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onSeek(Math.min(safeDuration, currentTime + 5))}
                aria-label="Adelantar 5 segundos"
                title="Adelantar 5 segundos"
                className="flex h-10 w-9 sm:h-auto sm:w-auto items-center justify-center rounded-lg p-1.5 sm:p-2 text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text)]"
              >
                <RotateCw className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onToggleLoopCurrentStanza}
                title="Repetir estrofa actual en bucle"
                className={`hidden md:inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  loopStanzaId
                    ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border border-[var(--app-accent-border)]'
                    : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text)]'
                }`}
              >
                <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Bucle</span>
              </button>

              {/* Mobile Bottom Sheet Trigger */}
              <button
                type="button"
                onClick={() => setMobileSheetOpen(true)}
                aria-label="Abrir ajustes de canto"
                title="Karaoke, bucle, velocidad y tamaño de letra"
                className={`flex md:hidden h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                  hasCustomMobileOptions
                    ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border border-[var(--app-accent-border)]'
                    : 'text-[var(--app-text)] bg-[var(--app-surface)] border border-[var(--app-border)]'
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Right Desktop Studio Controls */}
            <div className="hidden md:flex items-center gap-2.5">
              {!isYouTube && (
                <button
                  type="button"
                  onClick={onToggleVocalReduction}
                  title="Atenuar voz central para cantar encima (modo karaoke)"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    vocalReduction
                      ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border border-[var(--app-accent-border)]'
                      : 'border border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:border-[var(--app-border-strong)]'
                  }`}
                >
                  {vocalReduction ? (
                    <MicOff className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{vocalReduction ? 'Voz reducida' : 'Modo karaoke'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const idx = SPEED_OPTIONS.indexOf(playbackRate);
                  const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
                  onChangeRate(next);
                }}
                title="Velocidad de reproducción"
                className="rounded-lg border border-[var(--app-border)] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[var(--app-text)] hover:border-[var(--app-border-strong)] whitespace-nowrap"
              >
                {playbackRate.toFixed(playbackRate === 1 ? 1 : 2)}x
              </button>

              <div
                className="flex items-center rounded-lg border border-[var(--app-border)] text-xs"
                title="Ajuste fino de sincronización de letra"
              >
                <button
                  type="button"
                  onClick={() => onChangeOffset(-0.2)}
                  className="px-2 py-1.5 text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
                >
                  -0.2s
                </button>
                <span className="border-x border-[var(--app-border)] px-2 py-1.5 font-mono tabular-nums text-[var(--app-text)]">
                  {syncOffset >= 0 ? `+${syncOffset.toFixed(1)}s` : `${syncOffset.toFixed(1)}s`}
                </span>
                <button
                  type="button"
                  onClick={() => onChangeOffset(0.2)}
                  className="px-2 py-1.5 text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
                >
                  +0.2s
                </button>
              </div>

              <button
                type="button"
                onClick={onToggleLyricScale}
                title={lyricScale === 'stage' ? 'Tamaño normal de letra' : 'Modo escenario grande'}
                className="rounded-lg border border-[var(--app-border)] p-1.5 text-[var(--app-text-muted)] hover:border-[var(--app-border-strong)] hover:text-[var(--app-text)]"
              >
                {lyricScale === 'stage' ? (
                  <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </button>

              <div className="flex items-center gap-1.5 pl-1">
                <Volume2 className="h-3.5 w-3.5 text-[var(--app-text-muted)]" aria-hidden="true" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  aria-label="Volumen"
                  onChange={(e) => onChangeVolume(Number(e.target.value))}
                  className="w-16 accent-[var(--app-accent)] cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Sheet for Full Singing Controls */}
      {mobileSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileSheetOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Controles de canto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-[var(--app-border-strong)] bg-[var(--app-surface)] px-5 pt-3 pb-safe shadow-2xl"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--app-border-strong)]" />

            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-[var(--app-text)]">
                Ajustes de canto
              </h3>
              <button
                type="button"
                onClick={() => setMobileSheetOpen(false)}
                aria-label="Cerrar ajustes"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-5 pb-4">
              {/* Loop & Vocal Reduction */}
              <div className={`grid gap-2.5 ${isYouTube ? 'grid-cols-1' : 'grid-cols-2'}`}>
                <button
                  type="button"
                  onClick={onToggleLoopCurrentStanza}
                  className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors ${
                    loopStanzaId
                      ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border border-[var(--app-accent-border)]'
                      : 'bg-[var(--app-bg)] text-[var(--app-text)] border border-[var(--app-border)]'
                  }`}
                >
                  <Repeat className="h-4 w-4" aria-hidden="true" />
                  <span>{loopStanzaId ? 'Bucle activo' : 'Repetir estrofa'}</span>
                </button>

                {!isYouTube && (
                  <button
                    type="button"
                    onClick={onToggleVocalReduction}
                    className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors ${
                      vocalReduction
                        ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border border-[var(--app-accent-border)]'
                        : 'bg-[var(--app-bg)] text-[var(--app-text)] border border-[var(--app-border)]'
                    }`}
                  >
                    {vocalReduction ? (
                      <MicOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Mic className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>{vocalReduction ? 'Voz reducida' : 'Modo karaoke'}</span>
                  </button>
                )}
              </div>

              {/* Mobile Quick Shortcuts: Bubble & YouTube Solo Letras */}
              {(onToggleBubble || (isYouTube && onToggleYouTubeLyricsOnly)) && (
                <div className={`grid gap-2.5 ${isYouTube && onToggleYouTubeLyricsOnly && onToggleBubble ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {onToggleBubble && (
                    <button
                      type="button"
                      onClick={() => {
                        onToggleBubble();
                        setMobileSheetOpen(false);
                      }}
                      className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors ${
                        isBubbleOpen
                          ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border border-[var(--app-accent-border)]'
                          : 'bg-[var(--app-bg)] text-[var(--app-text)] border border-[var(--app-border)]'
                      }`}
                    >
                      <PictureInPicture2 className="h-4 w-4" aria-hidden="true" />
                      <span>{isBubbleOpen ? 'Ocultar burbuja' : 'Burbuja flotante'}</span>
                    </button>
                  )}

                  {isYouTube && onToggleYouTubeLyricsOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        onToggleYouTubeLyricsOnly();
                        setMobileSheetOpen(false);
                      }}
                      className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors ${
                        youtubeLyricsOnly
                          ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border border-[var(--app-accent-border)]'
                          : 'bg-[var(--app-bg)] text-[var(--app-text)] border border-[var(--app-border)]'
                      }`}
                    >
                      {youtubeLyricsOnly ? (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      )}
                      <span>{youtubeLyricsOnly ? 'Ver video YouTube' : 'Solo letras'}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Playback Speed */}
              <div>
                <div className="mb-2 text-xs text-[var(--app-text-muted)]">Velocidad de práctica</div>
                <div className="grid grid-cols-4 gap-2">
                  {SPEED_OPTIONS.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => onChangeRate(rate)}
                      className={`min-h-[44px] rounded-xl font-mono text-xs font-medium tabular-nums transition-colors ${
                        playbackRate === rate
                          ? 'bg-[var(--app-accent)] text-[var(--app-accent-contrast)]'
                          : 'bg-[var(--app-bg)] text-[var(--app-text)] border border-[var(--app-border)]'
                      }`}
                    >
                      {rate.toFixed(rate === 1 ? 1 : 2)}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Sync Offset */}
              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-[var(--app-text-muted)]">
                  <span>Sincronización de letra</span>
                  <span className="font-mono tabular-nums text-[var(--app-accent)]">
                    {syncOffset >= 0 ? `+${syncOffset.toFixed(1)}s` : `${syncOffset.toFixed(1)}s`}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[-0.5, -0.1, 0.1, 0.5].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => onChangeOffset(delta)}
                      className="min-h-[44px] rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] font-mono text-xs text-[var(--app-text)]"
                    >
                      {delta > 0 ? `+${delta}s` : `${delta}s`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lyric Size & Volume */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <button
                  type="button"
                  onClick={onToggleLyricScale}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-xs font-medium text-[var(--app-text)]"
                >
                  {lyricScale === 'stage' ? (
                    <Minimize2 className="h-4 w-4 text-[var(--app-accent)]" aria-hidden="true" />
                  ) : (
                    <Maximize2 className="h-4 w-4 text-[var(--app-accent)]" aria-hidden="true" />
                  )}
                  <span>{lyricScale === 'stage' ? 'Letra grande' : 'Letra normal'}</span>
                </button>

                <div className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3">
                  <Volume2 className="h-4 w-4 shrink-0 text-[var(--app-text-muted)]" aria-hidden="true" />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volume}
                    aria-label="Volumen"
                    onChange={(e) => onChangeVolume(Number(e.target.value))}
                    className="w-full accent-[var(--app-accent)] cursor-pointer"
                  />
                </div>
              </div>

              {onOpenAnalyzer && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileSheetOpen(false);
                    onOpenAnalyzer('audio');
                  }}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--app-accent)] px-4 text-xs font-semibold text-[var(--app-accent-contrast)]"
                >
                  <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Importar música o video de YouTube</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

