import { useEffect, useState } from 'react';
import {
  FileAudio,
  Loader2,
  Upload,
  AlertCircle,
  Youtube,
  Link2,
  FolderOpen,
} from 'lucide-react';
import { SongAnalysis } from '../types/song';
import { formatTime } from '../utils/time';
import { extractYouTubeVideoId, getYouTubeThumbnailUrl } from '../utils/youtube';

export type AnalyzerTab = 'audio' | 'youtube';

interface SongImporterPanelProps {
  initialTab?: AnalyzerTab;
  onAnalyzed: (file: File, analysis: SongAnalysis) => Promise<void>;
  onAnalyzedYouTube: (videoId: string, analysis: SongAnalysis) => Promise<void>;
}

const MAX_FILE_BYTES = 120 * 1024 * 1024; // 120 MB supported via raw upload + Gemini Files API
const AUTO_COMPACT_THRESHOLD_BYTES = 10 * 1024 * 1024; // Optimize analysis payload above 10 MB

function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const dur = Number.isFinite(audio.duration) ? audio.duration : 180;
      URL.revokeObjectURL(url);
      resolve(dur);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(180);
    };
    audio.src = url;
  });
}

function encodeMonoWav(samples: Float32Array, sampleRate: number): Blob {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Downsamples large audio files in-browser to a compact 16kHz mono WAV solely
 * for fast Gemini analysis, while preserving the original file for playback.
 */
async function compactAudioForAnalysis(
  file: File,
  fallbackMime: string,
): Promise<{ payload: Blob; mimeType: string }> {
  if (file.size <= AUTO_COMPACT_THRESHOLD_BYTES) {
    return { payload: file, mimeType: fallbackMime };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const decodeCtx = new AudioCtx();
    const decoded = await decodeCtx.decodeAudioData(arrayBuffer);
    await decodeCtx.close().catch(() => {});

    const targetRate = 16000;
    const lengthInSamples = Math.max(1, Math.ceil(decoded.duration * targetRate));
    const offline = new OfflineAudioContext(1, lengthInSamples, targetRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);

    const rendered = await offline.startRendering();
    const wavBlob = encodeMonoWav(rendered.getChannelData(0), targetRate);

    if (wavBlob.size < file.size) {
      return { payload: wavBlob, mimeType: 'audio/wav' };
    }
  } catch {
    // Fall back to sending the original binary file to the server Files API
  }

  return { payload: file, mimeType: fallbackMime };
}

const AUDIO_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'm4a',
  'mp4',
  'aac',
  'ogg',
  'flac',
  'webm',
  'opus',
  'amr',
  '3gp',
  'wma',
  'aiff',
]);

function isSupportedAudioFile(file: File): boolean {
  if (file.type) {
    if (file.type.startsWith('audio/')) return true;
    if (
      file.type === 'video/mp4' ||
      file.type === 'video/webm' ||
      file.type === 'application/ogg'
    ) {
      return true;
    }
    if (file.type !== 'application/octet-stream') {
      return false;
    }
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return AUDIO_EXTENSIONS.has(ext);
}

function inferMimeType(file: File): string {
  if (file.type && file.type.startsWith('audio/')) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'mp3':
      return 'audio/mp3';
    case 'wav':
      return 'audio/wav';
    case 'm4a':
    case 'mp4':
      return 'audio/mp4';
    case 'aac':
      return 'audio/aac';
    case 'ogg':
    case 'opus':
      return 'audio/ogg';
    case 'flac':
      return 'audio/flac';
    case 'webm':
      return 'audio/webm';
    case 'amr':
      return 'audio/amr';
    case '3gp':
      return 'audio/3gpp';
    default:
      return 'audio/mp3';
  }
}

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function SongImporterPanel({
  initialTab = 'audio',
  onAnalyzed,
  onAnalyzedYouTube,
}: SongImporterPanelProps) {
  const [activeTab, setActiveTab] = useState<AnalyzerTab>(initialTab);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectedDuration, setDetectedDuration] = useState<number | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [providedLyrics, setProvidedLyrics] = useState('');
  const [showLyricsBox, setShowLyricsBox] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusStep, setStatusStep] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
    setErrorMessage(null);
  }, [initialTab]);

  const detectedYtId = extractYouTubeVideoId(youtubeUrl);

  const handleFilePick = async (file: File | undefined) => {
    setErrorMessage(null);
    if (!file) return;

    if (!isSupportedAudioFile(file)) {
      setErrorMessage(
        'El archivo seleccionado no es un audio compatible. Elige un MP3, M4A, WAV, AAC, OGG o FLAC.',
      );
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setErrorMessage('El archivo supera el máximo permitido de 120 MB.');
      return;
    }

    setSelectedFile(file);
    const dur = await readAudioDuration(file);
    setDetectedDuration(dur);
  };

  const handleSubmitAudio = async () => {
    if (!selectedFile) return;

    const originalMime = inferMimeType(selectedFile);
    setStatusStep(
      selectedFile.size > AUTO_COMPACT_THRESHOLD_BYTES
        ? 'Optimizando audio para un análisis rápido...'
        : 'Preparando audio para análisis...',
    );

    const [durationSec, { payload, mimeType }] = await Promise.all([
      detectedDuration !== null
        ? Promise.resolve(detectedDuration)
        : readAudioDuration(selectedFile),
      compactAudioForAnalysis(selectedFile, originalMime),
    ]);

    setStatusStep('Identificando estrofas, letra, tonalidad y pulso...');

    const headers: Record<string, string> = {
      'Content-Type': 'application/octet-stream',
      'x-mime-type': mimeType,
      'x-file-name': encodeURIComponent(selectedFile.name),
      'x-duration-sec': String(durationSec),
    };
    if (providedLyrics.trim()) {
      headers['x-provided-lyrics-b64'] = utf8ToBase64(providedLyrics.trim());
    }

    const response = await fetch('/api/analyze-song', {
      method: 'POST',
      headers,
      body: payload,
    });

    const data = (await response.json()) as {
      analysis?: SongAnalysis;
      error?: string;
    };

    if (!response.ok || !data.analysis) {
      throw new Error(data.error || 'No se pudo completar el análisis de la canción.');
    }

    setStatusStep('Abriendo escenario y herramientas...');
    await onAnalyzed(selectedFile, data.analysis);
    setSelectedFile(null);
    setDetectedDuration(null);
    setProvidedLyrics('');
    setShowLyricsBox(false);
  };

  const handleSubmitYouTube = async () => {
    if (!detectedYtId) {
      setErrorMessage(
        'Introduce una URL válida de YouTube (por ejemplo https://www.youtube.com/watch?v=...).',
      );
      return;
    }

    setStatusStep('Obteniendo video y subtítulos de YouTube...');
    const response = await fetch('/api/analyze-youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        youtubeUrl: youtubeUrl.trim(),
        providedLyrics: providedLyrics.trim() || undefined,
      }),
    });

    const data = (await response.json()) as {
      videoId?: string;
      analysis?: SongAnalysis;
      error?: string;
    };

    if (!response.ok || !data.analysis || !data.videoId) {
      throw new Error(data.error || 'No se pudo analizar el video de YouTube.');
    }

    setStatusStep('Abriendo video, letras y herramientas...');
    await onAnalyzedYouTube(data.videoId, data.analysis);
    setYoutubeUrl('');
    setProvidedLyrics('');
    setShowLyricsBox(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAnalyzing) return;
    if (activeTab === 'audio' && !selectedFile) return;
    if (activeTab === 'youtube' && !detectedYtId) return;

    setErrorMessage(null);
    setIsAnalyzing(true);

    try {
      if (activeTab === 'youtube') {
        await handleSubmitYouTube();
      } else {
        await handleSubmitAudio();
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Ocurrió un problema inesperado al analizar la canción.',
      );
    } finally {
      setIsAnalyzing(false);
      setStatusStep('');
    }
  };

  const canSubmit =
    !isAnalyzing && (activeTab === 'youtube' ? Boolean(detectedYtId) : Boolean(selectedFile));

  return (
    <div
      style={{
        backgroundImage:
          'linear-gradient(180deg, var(--app-accent-glow) 0%, transparent 150px)',
      }}
      className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-4 sm:p-6 shadow-xl"
    >
      {/* Source Switcher Tabs */}
      <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[var(--app-bg)] p-1 border border-[var(--app-border)]">
        <button
          type="button"
          disabled={isAnalyzing}
          onClick={() => {
            setActiveTab('audio');
            setErrorMessage(null);
          }}
          className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'audio'
              ? 'bg-[var(--app-surface-elevated)] text-[var(--app-accent)] border border-[var(--app-accent-border)] shadow-sm'
              : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
          }`}
        >
          <FileAudio className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Importar música</span>
        </button>

        <button
          type="button"
          disabled={isAnalyzing}
          onClick={() => {
            setActiveTab('youtube');
            setErrorMessage(null);
          }}
          className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'youtube'
              ? 'bg-[var(--app-surface-elevated)] text-[var(--app-accent)] border border-[var(--app-accent-border)] shadow-sm'
              : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
          }`}
        >
          <Youtube className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Enlace YouTube</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {activeTab === 'youtube' ? (
          <div className="space-y-3">
            <div>
              <label
                htmlFor="home-yt-url-input"
                className="mb-1.5 block text-xs font-medium text-[var(--app-text)]"
              >
                Pega el enlace del video de YouTube
              </label>
              <div className="relative">
                <Link2
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-soft)]"
                  aria-hidden="true"
                />
                <input
                  id="home-yt-url-input"
                  type="url"
                  inputMode="url"
                  value={youtubeUrl}
                  onChange={(e) => {
                    setYoutubeUrl(e.target.value);
                    setErrorMessage(null);
                  }}
                  disabled={isAnalyzing}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full min-h-[46px] rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-bg)] pl-10 pr-3.5 py-2.5 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-soft)] focus:border-[var(--app-accent)] focus:outline-none"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--app-text-soft)]">
                Compatible con youtube.com, youtu.be, YouTube Music y Shorts.
              </p>
            </div>

            {detectedYtId && (
              <div className="flex items-center gap-3 rounded-xl border border-[var(--app-accent-border)] bg-[var(--app-surface-elevated)] p-2.5">
                <img
                  src={getYouTubeThumbnailUrl(detectedYtId)}
                  alt="Vista previa del video de YouTube"
                  className="h-14 w-24 shrink-0 rounded-lg object-cover bg-black"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--app-accent)]">
                    <Youtube className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Video listo para analizar</span>
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--app-text-muted)]">
                    ID: {detectedYtId}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                void handleFilePick(e.dataTransfer.files?.[0]);
              }}
              className={`relative overflow-hidden rounded-xl border border-dashed px-4 py-6 text-center transition-colors ${
                isDragging
                  ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                  : selectedFile
                    ? 'border-[var(--app-accent-border)] bg-[var(--app-surface-elevated)]'
                    : 'border-[var(--app-border-strong)] bg-[var(--app-bg)]/60 hover:border-[var(--app-accent-border)]'
              }`}
            >
              <input
                id="home-audio-file-input-primary"
                type="file"
                accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.flac,.opus,.3gp,.amr,.webm"
                disabled={isAnalyzing}
                onChange={(e) => {
                  void handleFilePick(e.target.files?.[0]);
                  e.currentTarget.value = '';
                }}
                aria-label="Seleccionar archivo de música desde tu teléfono"
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              />

              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <FileAudio className="h-8 w-8 text-[var(--app-accent)]" aria-hidden="true" />
                  <div className="font-medium text-sm text-[var(--app-text)] break-all">
                    {selectedFile.name}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--app-text-muted)] font-mono tabular-nums">
                    <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                    {detectedDuration !== null && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{formatTime(detectedDuration)}</span>
                      </>
                    )}
                  </div>
                  {!isAnalyzing && (
                    <span className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-[var(--app-accent-border)] bg-[var(--app-accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--app-accent)]">
                      Toca aquí para cambiar canción
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--app-accent-border)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
                    <Upload className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="text-sm font-semibold text-[var(--app-text)]">
                    Elige una canción de tu teléfono
                  </div>
                  <span className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[var(--app-accent)] px-4 py-2 text-xs font-semibold text-[var(--app-accent-contrast)] shadow-sm">
                    <FileAudio className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Seleccionar MP3 / M4A / Audio</span>
                  </span>
                  <div className="text-[11px] text-[var(--app-text-soft)]">
                    MP3, M4A, WAV, AAC, OGG, FLAC · Hasta 120 MB
                  </div>
                </div>
              )}
            </div>

            {/* Android folder fallback */}
            <div className="relative overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)]/60">
              <input
                id="home-audio-file-input-android-explorer"
                type="file"
                accept="*/*"
                disabled={isAnalyzing}
                onChange={(e) => {
                  void handleFilePick(e.target.files?.[0]);
                  e.currentTarget.value = '';
                }}
                aria-label="Explorar carpetas Descargas o Música en Android"
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              />
              <div className="flex min-h-[44px] items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-[var(--app-text-muted)]">
                <FolderOpen className="h-4 w-4 shrink-0 text-[var(--app-accent)]" aria-hidden="true" />
                <span>¿No ves tus archivos en Android? Explorar carpetas</span>
              </div>
            </div>
          </div>
        )}

        {/* Optional Lyrics Input */}
        <div>
          <button
            type="button"
            onClick={() => setShowLyricsBox((prev) => !prev)}
            className="min-h-[38px] text-left text-xs font-medium text-[var(--app-text-muted)] underline underline-offset-4 hover:text-[var(--app-accent)]"
          >
            {showLyricsBox
              ? 'Ocultar letra de referencia'
              : '¿Tienes la letra? Pégala aquí para mayor exactitud (opcional)'}
          </button>

          {showLyricsBox && (
            <textarea
              rows={4}
              value={providedLyrics}
              onChange={(e) => setProvidedLyrics(e.target.value)}
              disabled={isAnalyzing}
              placeholder="Pega aquí las estrofas de la canción..."
              className="mt-2 w-full rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-bg)] px-3.5 py-2.5 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-soft)] focus:border-[var(--app-accent)] focus:outline-none"
            />
          )}
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Submit / Status */}
        <div className="space-y-2.5 pt-1">
          {isAnalyzing && statusStep && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-[var(--app-accent-border)] bg-[var(--app-accent-soft)] px-3.5 py-2.5 text-xs font-medium text-[var(--app-accent)]">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
              <span>{statusStep}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--app-accent)] px-5 py-3 text-sm font-semibold text-[var(--app-accent-contrast)] shadow-md transition-opacity hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isAnalyzing
              ? 'Analizando canción...'
              : activeTab === 'youtube'
                ? 'Analizar YouTube y abrir herramientas'
                : 'Analizar música y abrir herramientas'}
          </button>
        </div>
      </form>
    </div>
  );
}
