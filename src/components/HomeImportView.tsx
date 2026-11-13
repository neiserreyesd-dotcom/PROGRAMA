import { ArrowRight, Music, Play, Sparkles, Youtube } from 'lucide-react';
import { SongAnalysis, SongTrack } from '../types/song';
import { PlayHistoryEntry } from '../utils/playHistory';
import { formatTime } from '../utils/time';
import { getYouTubeThumbnailUrl } from '../utils/youtube';
import { RecentHistorySection } from './RecentHistorySection';
import { AnalyzerTab, SongImporterPanel } from './SongImporterPanel';

interface HomeImportViewProps {
  initialTab?: AnalyzerTab;
  hasLoadedSong: boolean;
  activeTrack: SongTrack;
  tracks: SongTrack[];
  history: PlayHistoryEntry[];
  onAnalyzed: (file: File, analysis: SongAnalysis) => Promise<void>;
  onAnalyzedYouTube: (videoId: string, analysis: SongAnalysis) => Promise<void>;
  onSelectTrack: (trackId: string) => void;
  onSelectFromHistory: (trackId: string, resumeAtSec?: number) => void;
  onRemoveHistory: (trackId: string) => void;
  onClearHistory: () => void;
  onResumeActiveStage: () => void;
}

export function HomeImportView({
  initialTab = 'audio',
  hasLoadedSong,
  activeTrack,
  tracks,
  history,
  onAnalyzed,
  onAnalyzedYouTube,
  onSelectTrack,
  onSelectFromHistory,
  onRemoveHistory,
  onClearHistory,
  onResumeActiveStage,
}: HomeImportViewProps) {
  const userTracks = tracks.filter((t) => !t.isDemo);
  const demoTracks = tracks.filter((t) => t.isDemo);

  return (
    <section
      className={`mx-auto max-w-[760px] px-3.5 pt-4 sm:px-6 sm:pt-7 ${
        hasLoadedSong ? 'pb-36 sm:pb-40' : 'pb-12'
      }`}
    >
      {/* Active song quick return card when user returns to Inicio after loading a song */}
      {hasLoadedSong && (
        <button
          type="button"
          onClick={onResumeActiveStage}
          className="mb-4 flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border border-[var(--app-accent-border)] bg-[var(--app-surface)] px-4 py-3 text-left transition-colors hover:bg-[var(--app-surface-elevated)]"
        >
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium text-[var(--app-accent)]">
              Sesión activa lista
            </div>
            <div className="truncate font-display text-sm font-semibold text-[var(--app-text)]">
              {activeTrack.analysis.title}
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--app-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--app-accent-contrast)] whitespace-nowrap shrink-0">
            <span>Abrir herramientas</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </button>
      )}

      {/* Home Title */}
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--app-text)] sm:text-3xl">
          Importa tu música o YouTube
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--app-text-muted)]">
          Sube una canción de tu teléfono o pega un enlace. Al terminar el análisis se abrirán automáticamente las letras y herramientas de canto.
        </p>
      </div>

      {/* Main Inline Importer Panel */}
      <SongImporterPanel
        initialTab={initialTab}
        onAnalyzed={onAnalyzed}
        onAnalyzedYouTube={onAnalyzedYouTube}
      />

      {/* Saved User Tracks (if any) */}
      {userTracks.length > 0 && (
        <div className="mt-7">
          <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--app-text-soft)]">
            Tus canciones guardadas ({userTracks.length})
          </h2>
          <div className="space-y-2">
            {userTracks.slice(0, 6).map((track) => {
              const isYouTube =
                track.sourceType === 'youtube' && Boolean(track.youtubeVideoId);
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => onSelectTrack(track.id)}
                  className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-2.5 text-left transition-colors hover:border-[var(--app-accent-border)]"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {isYouTube && track.youtubeVideoId ? (
                      <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded-lg bg-black">
                        <img
                          src={getYouTubeThumbnailUrl(track.youtubeVideoId)}
                          alt={track.analysis.title}
                          className="h-full w-full object-cover"
                        />
                        <Youtube
                          className="absolute bottom-0.5 right-0.5 h-3 w-3 text-[var(--app-accent)]"
                          aria-hidden="true"
                        />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-elevated)] text-[var(--app-accent)]">
                        <Music className="h-4 w-4" aria-hidden="true" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-sm font-semibold text-[var(--app-text)]">
                        {track.analysis.title}
                      </div>
                      <div className="truncate text-[11px] text-[var(--app-text-muted)]">
                        {track.analysis.artist} · {track.analysis.bpm} BPM ·{' '}
                        {formatTime(track.analysis.durationSec)}
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
                    <Play className="h-4 w-4 fill-current translate-x-0.5" aria-hidden="true" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recently Played History */}
      {history.length > 0 && (
        <div className="mt-7">
          <RecentHistorySection
            entries={history}
            availableTracks={tracks}
            activeTrackId={hasLoadedSong ? activeTrack.id : ''}
            variant="list"
            onSelectFromHistory={onSelectFromHistory}
            onRemoveEntry={onRemoveHistory}
            onClearHistory={onClearHistory}
          />
        </div>
      )}

      {/* Built-in Demo Tracks (Compact Try-Out Section) */}
      {demoTracks.length > 0 && (
        <div className="mt-7">
          <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--app-text-soft)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--app-accent)]" aria-hidden="true" />
            <span>¿Solo quieres probar las herramientas?</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {demoTracks.map((demo) => (
              <button
                key={demo.id}
                type="button"
                onClick={() => onSelectTrack(demo.id)}
                className="flex min-h-[52px] items-center justify-between gap-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/80 px-3.5 py-2.5 text-left transition-colors hover:border-[var(--app-accent-border)] hover:bg-[var(--app-surface)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-[var(--app-text)]">
                    {demo.analysis.title}
                  </div>
                  <div className="truncate text-[11px] text-[var(--app-text-muted)]">
                    {demo.analysis.genre} · {demo.analysis.bpm} BPM
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-elevated)] px-2.5 py-1 text-[11px] font-medium text-[var(--app-text)] whitespace-nowrap shrink-0">
                  <Play className="h-3 w-3 text-[var(--app-accent)]" aria-hidden="true" />
                  <span>Probar</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
