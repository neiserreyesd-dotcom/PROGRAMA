import { History, Play, RotateCcw, Trash2, X } from 'lucide-react';
import { SongTrack } from '../types/song';
import { formatRelativeTimeEs, PlayHistoryEntry } from '../utils/playHistory';
import { formatTime } from '../utils/time';

interface RecentHistorySectionProps {
  entries: PlayHistoryEntry[];
  availableTracks: SongTrack[];
  activeTrackId: string;
  variant?: 'list' | 'strip';
  onSelectFromHistory: (trackId: string, resumeAtSec?: number) => void;
  onRemoveEntry: (trackId: string) => void;
  onClearHistory: () => void;
}

export function RecentHistorySection({
  entries,
  availableTracks,
  activeTrackId,
  variant = 'list',
  onSelectFromHistory,
  onRemoveEntry,
  onClearHistory,
}: RecentHistorySectionProps) {
  const trackIds = new Set(availableTracks.map((t) => t.id));
  const validEntries = entries.filter((e) => trackIds.has(e.trackId));

  if (variant === 'strip') {
    const quickEntries = validEntries.filter((e) => e.trackId !== activeTrackId);
    if (quickEntries.length === 0) return null;

    return (
      <div className="mb-4 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--app-text-muted)] whitespace-nowrap shrink-0">
          <History className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Recientes:</span>
        </span>
        {quickEntries.slice(0, 5).map((entry) => (
          <button
            key={entry.trackId}
            type="button"
            onClick={() =>
              onSelectFromHistory(
                entry.trackId,
                entry.lastPositionSec > 2 && entry.lastPositionSec < entry.durationSec - 2
                  ? entry.lastPositionSec
                  : 0,
              )
            }
            className="inline-flex min-h-[38px] sm:min-h-0 items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-xs text-[var(--app-text)] transition-colors hover:border-[var(--app-accent)] whitespace-nowrap shrink-0"
          >
            <Play className="h-3 w-3 text-[var(--app-accent)]" aria-hidden="true" />
            <span className="max-w-[150px] truncate font-medium">{entry.title}</span>
            {entry.lastPositionSec > 2 && entry.lastPositionSec < entry.durationSec - 2 && (
              <span className="font-mono text-[11px] tabular-nums text-[var(--app-text-muted)]">
                {formatTime(entry.lastPositionSec)}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="mb-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text)]">
          <History className="h-4 w-4 text-[var(--app-accent)]" aria-hidden="true" />
          <span>Escuchadas recientemente ({validEntries.length})</span>
        </h3>

        {validEntries.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="inline-flex min-h-[36px] sm:min-h-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text)] whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Limpiar historial</span>
          </button>
        )}
      </div>

      {validEntries.length === 0 ? (
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-5 py-6 text-sm text-[var(--app-text-muted)]">
          Aún no hay canciones reproducidas en tu historial. Pulsa reproducir en cualquier tema para verlo aquí.
        </div>
      ) : (
        <div className="divide-y divide-[var(--app-border)] overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
          {validEntries.map((entry) => {
            const isActive = entry.trackId === activeTrackId;
            const canResume =
              entry.lastPositionSec > 2 &&
              entry.lastPositionSec < entry.durationSec - 2;
            const progressPct = Math.min(
              100,
              Math.max(0, (entry.lastPositionSec / Math.max(1, entry.durationSec)) * 100),
            );

            return (
              <div
                key={entry.trackId}
                className={`flex flex-col gap-3 px-4 py-3.5 sm:px-5 sm:flex-row sm:items-center sm:justify-between transition-colors ${
                  isActive ? 'bg-[var(--app-accent-soft)]' : 'hover:bg-[var(--app-surface-elevated)]/40'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`truncate font-display text-sm sm:text-base font-semibold ${
                        isActive ? 'text-[var(--app-accent)]' : 'text-[var(--app-text)]'
                      }`}
                    >
                      {entry.title}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--app-text-muted)]">
                    <span className="truncate max-w-[180px] sm:max-w-none">{entry.artist}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{entry.bpm} BPM</span>
                    <span aria-hidden="true">·</span>
                    <span>{entry.musicalKey}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[var(--app-text-soft)]">
                      {formatRelativeTimeEs(entry.lastPlayedAt)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-[var(--app-text-soft)]">
                      {entry.playCount} {entry.playCount === 1 ? 'reproducción' : 'reproducciones'}
                    </span>
                  </div>

                  {canResume && (
                    <div className="mt-2 flex items-center gap-2.5 max-w-xs">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--app-border)]">
                        <div
                          style={{ width: `${progressPct}%` }}
                          className="h-full bg-[var(--app-accent)]"
                        />
                      </div>
                      <span className="font-mono text-[11px] tabular-nums text-[var(--app-text-muted)] shrink-0">
                        {formatTime(entry.lastPositionSec)} / {formatTime(entry.durationSec)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {canResume && (
                    <button
                      type="button"
                      onClick={() => onSelectFromHistory(entry.trackId, entry.lastPositionSec)}
                      className="inline-flex min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-lg bg-[var(--app-accent-soft)] border border-[var(--app-accent-border)] px-3 py-2 sm:py-1.5 text-xs font-semibold text-[var(--app-accent)] transition-opacity hover:opacity-90 whitespace-nowrap"
                    >
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Continuar {formatTime(entry.lastPositionSec)}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectFromHistory(entry.trackId, 0)}
                    className="inline-flex min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-lg bg-[var(--app-surface-elevated)] px-3 py-2 sm:py-1.5 text-xs font-medium text-[var(--app-text)] transition-opacity hover:opacity-90 whitespace-nowrap"
                  >
                    {canResume ? (
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {canResume ? (
                      <>
                        <span className="sm:hidden">Reiniciar</span>
                        <span className="hidden sm:inline">Desde el inicio</span>
                      </>
                    ) : (
                      <span>{isActive ? 'Reiniciar' : 'Reproducir'}</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onRemoveEntry(entry.trackId)}
                    aria-label={`Quitar ${entry.title} del historial`}
                    title="Quitar del historial"
                    className="flex min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 items-center justify-center rounded-lg p-2 text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

