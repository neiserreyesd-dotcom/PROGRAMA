import { useEffect, useRef, useState } from 'react';
import {
  GripHorizontal,
  Maximize2,
  Minimize2,
  Music2,
  Pause,
  PictureInPicture2,
  Play,
  X,
} from 'lucide-react';
import { AppSettings, SongTrack } from '../types/song';
import { LYRIC_FONT_OPTIONS } from '../utils/appSettings';
import { PlaybackLocation } from '../utils/time';

interface FloatingLyricsBubbleProps {
  isOpen: boolean;
  track: SongTrack;
  location: PlaybackLocation;
  isPlaying: boolean;
  settings: AppSettings;
  onTogglePlay: () => void;
  onOpenStage: () => void;
  onClose: () => void;
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines;
}

export function FloatingLyricsBubble({
  isOpen,
  track,
  location,
  isPlaying,
  settings,
  onTogglePlay,
  onOpenStage,
  onClose,
}: FloatingLyricsBubbleProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const [pipError, setPipError] = useState<string | null>(null);

  // Draggable viewport position (bottom-right default above PlayerDock)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  // Hidden canvas + video used for universal system Picture-in-Picture lyrics window
  const pipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);

  const fontDef =
    LYRIC_FONT_OPTIONS.find((f) => f.id === settings.lyricFont) ??
    LYRIC_FONT_OPTIONS[0];

  const activeStanza = location.stanza;
  const activeLine = location.line;

  // Compute upcoming line inside current stanza or first line of next stanza
  let nextLineText: string | null = null;
  if (activeStanza && location.lineIndexInStanza >= 0) {
    const sameStanzaNext = activeStanza.lines[location.lineIndexInStanza + 1];
    if (sameStanzaNext) {
      nextLineText = sameStanzaNext.text;
    } else if (location.stanzaIndex >= 0) {
      const nextStanza = track.analysis.stanzas[location.stanzaIndex + 1];
      nextLineText = nextStanza?.lines[0]?.text ?? null;
    }
  } else if (activeStanza?.lines[0]) {
    nextLineText = activeStanza.lines[0].text;
  }

  // Keep dragged position inside viewport on resize
  useEffect(() => {
    const onResize = () => {
      setPos((prev) => {
        if (!prev) return null;
        const rect = bubbleRef.current?.getBoundingClientRect();
        const w = rect?.width ?? 300;
        const h = rect?.height ?? 160;
        return {
          x: Math.max(10, Math.min(window.innerWidth - w - 10, prev.x)),
          y: Math.max(64, Math.min(window.innerHeight - h - 96, prev.y)),
        };
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Redraw PiP canvas frame whenever lyrics, playback or theme colors update
  useEffect(() => {
    if (!pipActive) return;
    const canvas = pipCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const { colors } = settings;

    // Background
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, w, h);

    // Subtle framed surface card
    ctx.fillStyle = colors.surface;
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(18, 18, w - 36, h - 36, 18);
    ctx.fill();
    ctx.stroke();

    // Header: Song title + Stanza label
    ctx.fillStyle = colors.accent;
    ctx.font = '600 22px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const headerLabel = activeStanza ? activeStanza.label : 'Listo para cantar';
    ctx.fillText(headerLabel, 42, 38, w - 84);

    ctx.fillStyle = colors.text;
    ctx.globalAlpha = 0.65;
    ctx.font = '500 18px system-ui, -apple-system, sans-serif';
    ctx.fillText(track.analysis.title, 42, 68, w - 84);
    ctx.globalAlpha = 1;

    // Main active lyric line(s) — ONLY lyrics
    const displayLine =
      activeLine?.text ??
      activeStanza?.lines[0]?.text ??
      'Reproduce la canción para ver las letras en vivo';

    ctx.fillStyle = colors.lyricHighlight;
    ctx.font = '700 32px system-ui, -apple-system, sans-serif';
    const wrappedActive = wrapCanvasText(ctx, displayLine, w - 84, 3);
    let yCursor = 122;
    for (const lineStr of wrappedActive) {
      ctx.fillText(lineStr, 42, yCursor);
      yCursor += 42;
    }

    // Next line preview
    if (nextLineText) {
      ctx.fillStyle = colors.lyricText;
      ctx.globalAlpha = 0.65;
      ctx.font = '500 22px system-ui, -apple-system, sans-serif';
      const wrappedNext = wrapCanvasText(ctx, nextLineText, w - 84, 2);
      let nextY = Math.max(yCursor + 12, 250);
      for (const lineStr of wrappedNext) {
        if (nextY > h - 46) break;
        ctx.fillText(lineStr, 42, nextY);
        nextY += 28;
      }
      ctx.globalAlpha = 1;
    }

    // Bottom progress bar along active stanza/line
    const progress = activeLine ? location.lineProgress : 0;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(42, h - 34, w - 84, 5);
    ctx.fillStyle = colors.accent;
    ctx.fillRect(42, h - 34, (w - 84) * Math.max(0, Math.min(1, progress)), 5);
  }, [
    pipActive,
    track.analysis.title,
    activeStanza,
    activeLine,
    nextLineText,
    location.lineProgress,
    settings,
  ]);

  // Listen for PiP exit
  useEffect(() => {
    const videoEl = pipVideoRef.current;
    if (!videoEl) return;
    const handleLeave = () => setPipActive(false);
    videoEl.addEventListener('leavepictureinpicture', handleLeave);
    return () => {
      videoEl.removeEventListener('leavepictureinpicture', handleLeave);
    };
  }, []);

  const handleTogglePip = async () => {
    setPipError(null);
    const videoEl = pipVideoRef.current;
    const canvasEl = pipCanvasRef.current;
    if (!videoEl || !canvasEl) return;

    try {
      if (document.pictureInPictureElement === videoEl) {
        await document.exitPictureInPicture();
        setPipActive(false);
        return;
      }

      if (typeof canvasEl.captureStream !== 'function') {
        setPipError('Tu navegador no admite ventana flotante externa; usa la burbuja interna.');
        return;
      }

      if (!videoEl.srcObject) {
        videoEl.srcObject = canvasEl.captureStream(15);
      }

      setPipActive(true);
      await videoEl.play();

      if (typeof videoEl.requestPictureInPicture === 'function') {
        await videoEl.requestPictureInPicture();
      } else {
        const webkitVideo = videoEl as HTMLVideoElement & {
          webkitSetPresentationMode?: (mode: string) => void;
        };
        if (typeof webkitVideo.webkitSetPresentationMode === 'function') {
          webkitVideo.webkitSetPresentationMode('picture-in-picture');
        } else {
          setPipActive(false);
          setPipError('Ventana PiP no disponible aquí; usa esta burbuja flotante.');
        }
      }
    } catch {
      setPipActive(false);
      setPipError('Activa Picture-in-Picture en el navegador o usa esta burbuja flotante.');
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Do not initiate drag when clicking buttons inside the bubble
    if ((e.target as HTMLElement).closest('button')) return;
    const rect = bubbleRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      drag.moved = true;
    }
    const rect = bubbleRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 300;
    const h = rect?.height ?? 160;
    const nextX = Math.max(10, Math.min(window.innerWidth - w - 10, drag.originX + dx));
    const nextY = Math.max(64, Math.min(window.innerHeight - h - 96, drag.originY + dy));
    setPos({ x: nextX, y: nextY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragStateRef.current = null;
    if (!drag.moved && collapsed) {
      setCollapsed(false);
    }
  };

  if (!isOpen) return null;

  const currentLineText =
    activeLine?.text ??
    activeStanza?.lines[0]?.text ??
    'Reproduce la canción para seguir la letra en vivo';

  const progressPct = activeLine ? Math.round(location.lineProgress * 1000) / 10 : 0;

  return (
    <>
      {/* Hidden PiP media pipeline for external background floating lyrics window */}
      <canvas
        ref={pipCanvasRef}
        width={640}
        height={360}
        className="hidden"
        aria-hidden="true"
      />
      <video
        ref={pipVideoRef}
        muted
        playsInline
        className="pointer-events-none fixed -left-[9999px] h-px w-px opacity-0"
        aria-hidden="true"
      />

      <div
        ref={bubbleRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={
          pos
            ? { left: `${pos.x}px`, top: `${pos.y}px` }
            : undefined
        }
        className={`fixed z-40 touch-none select-none ${
          pos
            ? ''
            : collapsed
              ? 'bottom-[110px] right-3.5 sm:bottom-28 sm:right-6'
              : 'bottom-[108px] left-3 right-3 mx-auto sm:left-auto sm:right-6 sm:bottom-28'
        } ${
          collapsed
            ? 'h-14 w-14 rounded-full border-2 border-[var(--app-accent)] bg-[var(--app-surface)] shadow-[0_12px_32px_rgba(0,0,0,0.45)] flex items-center justify-center cursor-grab active:cursor-grabbing'
            : 'w-auto max-w-[380px] sm:w-[368px] rounded-2xl border border-[var(--app-accent-border)] bg-[var(--app-surface)]/95 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.04] backdrop-blur-xl overflow-hidden'
        }`}
      >
        {collapsed ? (
          <div className="relative flex h-full w-full items-center justify-center">
            <Music2
              className="h-6 w-6 text-[var(--app-accent)]"
              aria-hidden="true"
            />
            <span className="sr-only">Expandir burbuja de letras</span>
          </div>
        ) : (
          <div>
            {/* Compact Draggable Handle Header */}
            <div className="flex cursor-grab items-center justify-between gap-2 border-b border-[var(--app-border)] bg-[var(--app-bg)]/60 px-3.5 py-2 active:cursor-grabbing">
              <div className="min-w-0 flex items-center gap-2">
                <GripHorizontal className="h-3.5 w-3.5 shrink-0 text-[var(--app-text-soft)]" aria-hidden="true" />
                <Music2 className="h-3.5 w-3.5 shrink-0 text-[var(--app-accent)]" aria-hidden="true" />
                <span className="truncate text-xs font-semibold text-[var(--app-text)]">
                  {activeStanza ? activeStanza.label : track.analysis.title}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleTogglePip()}
                  title="Ventana flotante en segundo plano (PiP)"
                  aria-label="Abrir ventana flotante externa de letras"
                  className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                    pipActive
                      ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                      : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text)]'
                  }`}
                >
                  <PictureInPicture2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  title="Minimizar a burbuja"
                  aria-label="Minimizar a burbuja"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--app-text-muted)] hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text)]"
                >
                  <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  title="Cerrar burbuja"
                  aria-label="Cerrar burbuja flotante"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--app-text-muted)] hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text)]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Lyrics-Only Live Body */}
            <div className="px-4 py-3.5">
              <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-[var(--app-text-muted)]">
                <span className="truncate">{track.analysis.title}</span>
                {settings.countdownSeconds > 0 &&
                  location.countdownSeconds !== null &&
                  location.countdownSeconds <= settings.countdownSeconds && (
                    <span className="font-mono tabular-nums text-[var(--app-accent)] whitespace-nowrap">
                      Entra en {location.countdownSeconds}s
                    </span>
                  )}
              </div>

              <p
                style={
                  {
                    fontFamily: fontDef.cssFamily,
                    '--line-progress': `${progressPct}%`,
                  } as React.CSSProperties
                }
                className={`text-lg sm:text-xl font-bold leading-snug tracking-tight ${
                  settings.lyricUppercase ? 'uppercase' : ''
                } ${
                  activeLine && settings.highlightStyle === 'sweep'
                    ? 'karaoke-line-active'
                    : 'text-[var(--lyric-highlight)]'
                }`}
              >
                {currentLineText}
              </p>

              {nextLineText && (
                <p
                  style={{
                    fontFamily: fontDef.cssFamily,
                    color: settings.colors.lyricText,
                  }}
                  className={`mt-1.5 text-sm leading-snug opacity-70 truncate ${
                    settings.lyricUppercase ? 'uppercase' : ''
                  }`}
                >
                  {nextLineText}
                </p>
              )}

              {pipError && (
                <p className="mt-2 text-[11px] leading-snug text-[var(--app-accent)]">
                  {pipError}
                </p>
              )}
            </div>

            {/* Quick Controls Footer */}
            <div className="flex items-center justify-between gap-2 border-t border-[var(--app-border)] bg-[var(--app-bg)]/40 px-3.5 py-2">
              <button
                type="button"
                onClick={onTogglePlay}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[var(--app-accent)] px-3 py-1 text-xs font-semibold text-[var(--app-accent-contrast)] hover:opacity-90 whitespace-nowrap"
              >
                {isPlaying ? (
                  <Pause className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                )}
                <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
              </button>

              <button
                type="button"
                onClick={onOpenStage}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-elevated)] px-3 py-1 text-xs font-medium text-[var(--app-text)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent)] whitespace-nowrap"
              >
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Ver letras completas</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
