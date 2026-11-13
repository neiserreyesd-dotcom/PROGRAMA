import { Music, Play, Trash2, Upload, Youtube } from 'lucide-react';
import { SongTrack } from '../types/song';
import { PlayHistoryEntry } from '../utils/playHistory';
import { formatTime } from '../utils/time';
import { getYouTubeThumbnailUrl } from '../utils/youtube';
import { RecentHistorySection } from './RecentHistorySection';

interface LibraryViewProps {
  tracks: SongTrack[];
  activeTrackId: string;
  history: PlayHistoryEntry[];
  onSelectTrack: (trackId: string) => void;
  onSelectFromHistory: (trackId: string, resumeAtSec?: number) => void;
  onRemoveHistory: (trackId: string) => void;
  onClearHistory: () => void;
  onDeleteTrack: (trackId: string) => void;
  onOpenAnalyzer: (initialTab?: 'audio' | 'youtube') => void;
}

export function LibraryView({
  tracks,
  activeTrackId,
  history,
  onSelectTrack,
  onSelectFromHistory,
  onRemoveHistory,
  onClearHistory,
  onDeleteTrack,
  onOpenAnalyzer,
}: LibraryViewProps) {
  const userTracks = tracks.filter((t) => !t.isDemo);
  const demoTracks = tracks.filter((t) => t.isDemo);

  const renderTrackRow = (track: SongTrack) => {
    const isActive = track.id === activeTrackId;
    const isYouTube = track.sourceType === 'youtube' && Boolean(track.youtubeVideoId);
    return (
      <div
        key={track.id}
        className={`flex flex-col gap-3.5 rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 transition-all sm:flex-row sm:items-center sm:justify-between border ${
          isActive
            ? 'bg-[var(--app-surface)] border-[var(--app-accent-border)] shadow-lg'
            : 'bg-[var(--app-surface)]/85 border-[var(--app-border)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface)]'
        }`}
      >
        <div className="min-w-0 flex-1 flex items-center gap-3.5">
          {isYouTube && track.youtubeVideoId ? (
            <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg border border-[var(--app-border)] bg-black">
              <img
                src={getYouTubeThumbnailUrl(track.youtubeVideoId)}
                alt={track.analysis.title}
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded bg-black/75">
                <Youtube className="h-2.5 w-2.5 text-[var(--app-accent)]" aria-hidden="true" />
              </span>
            </div>
          ) : (
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                isActive
                  ? 'border-[var(--app-accent-border)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                  : 'border-[var(--app-border)] bg-[var(--app-surface-elevated)] text-[var(--app-text-muted)]'
              }`}
            >
              <Music className="h-5 w-5" aria-hidden="true" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-base font-semibold text-[var(--app-text)]">
              {track.analysis.title}
            </h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--app-text-muted)]">
              <span className="text-[var(--app-text)]/80">{track.analysis.artist}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{track.analysis.bpm} BPM</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{track.analysis.musicalKey}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {track.analysis.stanzas.length} estrofas
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {formatTime(track.analysis.durationSec)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onSelectTrack(track.id)}
            className={`inline-flex min-h-[42px] sm:min-h-0 flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
              isActive
                ? 'bg-[var(--app-accent)] text-[var(--app-accent-contrast)] hover:opacity-90'
                : 'border border-[var(--app-border-strong)] bg-[var(--app-surface-elevated)] text-[var(--app-text)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent)]'
            }`}
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isActive ? 'En reproducción' : 'Cantar canción'}</span>
          </button>

          {!track.isDemo && (
            <button
              type="button"
              onClick={() => onDeleteTrack(track.id)}
              aria-label="Eliminar canción"
              title="Eliminar canción"
              className="flex min-h-[42px] min-w-[42px] sm:min-h-0 sm:min-w-0 items-center justify-center rounded-xl p-2 text-[var(--app-text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="mx-auto max-w-[1160px] px-3.5 pt-6 pb-36 sm:px-6 sm:pt-8 sm:pb-40">
      <div className="mb-6 sm:mb-8 flex flex-col gap-4 border-b border-[var(--app-border)] pb-5 sm:pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-[var(--app-text)] sm:text-3xl">
            Biblioteca de canciones
          </h2>
          <p className="mt-1.5 text-sm text-[var(--app-text-muted)]">
            Tus canciones y videos analizados se guardan localmente en este navegador para cantar cuando quieras.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onOpenAnalyzer('audio')}
            className="inline-flex min-h-[44px] sm:min-h-0 items-center justify-center gap-2 rounded-lg bg-[var(--app-accent)] px-3.5 py-2.5 text-xs font-semibold text-[var(--app-accent-contrast)] transition-opacity hover:opacity-90 whitespace-nowrap"
          >
            <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Importar música</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenAnalyzer('youtube')}
            className="inline-flex min-h-[44px] sm:min-h-0 items-center justify-center gap-2 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-elevated)] px-3.5 py-2.5 text-xs font-semibold text-[var(--app-text)] transition-colors hover:border-[var(--app-accent-border)] whitespace-nowrap"
          >
            <Youtube className="h-4 w-4 shrink-0 text-[var(--app-accent)]" aria-hidden="true" />
            <span>YouTube</span>
          </button>
        </div>
      </div>

      {/* Recently Played History */}
      <RecentHistorySection
        entries={history}
        availableTracks={tracks}
        activeTrackId={activeTrackId}
        variant="list"
        onSelectFromHistory={onSelectFromHistory}
        onRemoveEntry={onRemoveHistory}
        onClearHistory={onClearHistory}
      />

      {/* User Analyzed Tracks */}
      <div className="mb-10">
        <h3 className="mb-3 text-sm font-semibold text-[var(--app-text)]">
          Tus canciones analizadas ({userTracks.length})
        </h3>
        {userTracks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface)] px-5 py-8 sm:px-6 sm:py-10 text-center">
            <p className="text-sm text-[var(--app-text)]">
              Aún no has analizado una canción propia o un enlace de YouTube.
            </p>
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">
              Abre un video de YouTube o sube un MP3, WAV o M4A para extraer estrofas, letra sincronizada y tonalidad.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => onOpenAnalyzer('audio')}
                className="inline-flex min-h-[44px] sm:min-h-0 items-center gap-2 rounded-lg bg-[var(--app-accent)] px-4 py-2.5 sm:py-2 text-xs font-semibold text-[var(--app-accent-contrast)] transition-opacity hover:opacity-90"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Importar música del teléfono</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAnalyzer('youtube')}
                className="inline-flex min-h-[44px] sm:min-h-0 items-center gap-2 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-elevated)] px-4 py-2.5 sm:py-2 text-xs font-semibold text-[var(--app-text)] transition-opacity hover:opacity-90"
              >
                <Youtube className="h-3.5 w-3.5 text-[var(--app-accent)]" aria-hidden="true" />
                <span>Abrir video YouTube</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">{userTracks.map(renderTrackRow)}</div>
        )}
      </div>

      {/* Built-in Demo Tracks */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[var(--app-text)]">
          Pistas de demostración ({demoTracks.length})
        </h3>
        <div className="space-y-3">{demoTracks.map(renderTrackRow)}</div>
      </div>
    </section>
  );
}

