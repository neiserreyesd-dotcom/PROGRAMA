import { useState } from 'react';
import { Clock, Download, Plus, Trash2, Play, Check } from 'lucide-react';
import { SongAnalysis, SongTrack } from '../types/song';
import { exportAnalysisToLrc } from '../utils/lrcExport';
import { formatTimePrecise } from '../utils/time';

interface SyncEditorViewProps {
  track: SongTrack;
  currentTime: number;
  onUpdateAnalysis: (updated: SongAnalysis) => void;
  onSeek: (timeSec: number) => void;
}

export function SyncEditorView({
  track,
  currentTime,
  onUpdateAnalysis,
  onSeek,
}: SyncEditorViewProps) {
  const { analysis } = track;
  const [savedFeedback, setSavedFeedback] = useState(false);

  const commitAnalysis = (next: SongAnalysis) => {
    onUpdateAnalysis(next);
    setSavedFeedback(true);
    window.setTimeout(() => setSavedFeedback(false), 1200);
  };

  const handleLineChange = (
    stanzaId: string,
    lineId: string,
    patch: { text?: string; startTime?: number; endTime?: number },
  ) => {
    const nextStanzas = analysis.stanzas.map((stanza) => {
      if (stanza.id !== stanzaId) return stanza;
      const nextLines = stanza.lines.map((line) =>
        line.id === lineId ? { ...line, ...patch } : line,
      );
      const startTime = nextLines.length
        ? Math.min(...nextLines.map((l) => l.startTime))
        : stanza.startTime;
      const endTime = nextLines.length
        ? Math.max(...nextLines.map((l) => l.endTime))
        : stanza.endTime;
      return { ...stanza, startTime, endTime, lines: nextLines };
    });
    commitAnalysis({ ...analysis, stanzas: nextStanzas });
  };

  const handleCaptureStart = (stanzaId: string, lineId: string) => {
    const captured = Number(currentTime.toFixed(2));
    const stanza = analysis.stanzas.find((s) => s.id === stanzaId);
    const line = stanza?.lines.find((l) => l.id === lineId);
    if (!line) return;
    const duration = Math.max(1.5, line.endTime - line.startTime);
    handleLineChange(stanzaId, lineId, {
      startTime: captured,
      endTime: Number(Math.min(analysis.durationSec, captured + duration).toFixed(2)),
    });
  };

  const handleCaptureEnd = (stanzaId: string, lineId: string) => {
    const captured = Number(currentTime.toFixed(2));
    const stanza = analysis.stanzas.find((s) => s.id === stanzaId);
    const line = stanza?.lines.find((l) => l.id === lineId);
    if (!line) return;
    handleLineChange(stanzaId, lineId, {
      endTime: Math.max(line.startTime + 0.4, captured),
    });
  };

  const handleAddLine = (stanzaId: string) => {
    const nextStanzas = analysis.stanzas.map((stanza) => {
      if (stanza.id !== stanzaId) return stanza;
      const lastEnd = stanza.lines[stanza.lines.length - 1]?.endTime ?? stanza.startTime;
      const newStart = Number(Math.min(analysis.durationSec - 1, lastEnd).toFixed(2));
      const newEnd = Number(Math.min(analysis.durationSec, newStart + 3).toFixed(2));
      return {
        ...stanza,
        endTime: Math.max(stanza.endTime, newEnd),
        lines: [
          ...stanza.lines,
          {
            id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            text: 'Nueva línea de letra',
            startTime: newStart,
            endTime: newEnd,
          },
        ],
      };
    });
    commitAnalysis({ ...analysis, stanzas: nextStanzas });
  };

  const handleDeleteLine = (stanzaId: string, lineId: string) => {
    const nextStanzas = analysis.stanzas.map((stanza) => {
      if (stanza.id !== stanzaId) return stanza;
      const nextLines = stanza.lines.filter((l) => l.id !== lineId);
      return { ...stanza, lines: nextLines };
    });
    commitAnalysis({ ...analysis, stanzas: nextStanzas });
  };

  const handleStanzaLabelChange = (stanzaId: string, label: string) => {
    const nextStanzas = analysis.stanzas.map((s) =>
      s.id === stanzaId ? { ...s, label } : s,
    );
    commitAnalysis({ ...analysis, stanzas: nextStanzas });
  };

  return (
    <section className="mx-auto max-w-[1160px] px-3.5 pt-6 pb-36 sm:px-6 sm:pt-8 sm:pb-40">
      <div className="mb-6 sm:mb-8 flex flex-col gap-4 border-b border-[var(--app-border)] pb-5 sm:pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-[var(--app-text)] sm:text-3xl">
            Editor de letra y sincronización
          </h2>
          <p className="mt-1.5 text-sm text-[var(--app-text-muted)]">
            Ajusta manualmente cualquier verso o usa «Capturar inicio» mientras suena la canción en{' '}
            <span className="font-mono tabular-nums text-[var(--app-accent)]">
              {formatTimePrecise(currentTime)}
            </span>
            .
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {savedFeedback && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Guardado</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => exportAnalysisToLrc(analysis)}
            className="inline-flex min-h-[44px] sm:min-h-0 items-center gap-2 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-elevated)] px-4 py-2 text-xs font-semibold text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface)] whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Exportar .LRC</span>
          </button>
        </div>
      </div>

      <div className="space-y-5 sm:space-y-6">
        {analysis.stanzas.map((stanza) => (
          <div
            key={stanza.id}
            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3.5 sm:p-5"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--app-border)] pb-3">
              <input
                type="text"
                value={stanza.label}
                onChange={(e) => handleStanzaLabelChange(stanza.id, e.target.value)}
                aria-label="Nombre de la estrofa"
                className="min-w-0 flex-1 bg-transparent font-display text-base font-semibold text-[var(--app-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--app-accent-border)] rounded px-1.5 py-1"
              />
              <button
                type="button"
                onClick={() => handleAddLine(stanza.id)}
                className="inline-flex min-h-[40px] sm:min-h-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-[var(--app-text-muted)] hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text)] whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Agregar línea</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {stanza.lines.map((line) => {
                const isNow =
                  currentTime >= line.startTime && currentTime <= line.endTime;
                return (
                  <div
                    key={line.id}
                    className={`flex flex-col gap-2.5 rounded-lg p-3 transition-colors lg:flex-row lg:items-center ${
                      isNow
                        ? 'bg-[var(--app-accent-soft)] border border-[var(--app-accent-border)]'
                        : 'bg-[var(--app-bg)]/60 border border-[var(--app-border)]'
                    }`}
                  >
                    <div className="grid grid-cols-[auto_1fr_1fr] sm:flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onSeek(line.startTime)}
                        aria-label="Reproducir desde esta línea"
                        title="Reproducir desde esta línea"
                        className="flex min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 items-center justify-center rounded border border-[var(--app-border)] sm:border-0 p-1.5 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text)]"
                      >
                        <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>

                      <label className="flex items-center justify-between sm:justify-start gap-1.5 text-[11px] text-[var(--app-text-soft)]">
                        <span>Inicio</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max={analysis.durationSec}
                          value={line.startTime}
                          onChange={(e) =>
                            handleLineChange(stanza.id, line.id, {
                              startTime: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="min-h-[38px] sm:min-h-0 w-full max-w-[72px] sm:w-16 rounded border border-[var(--app-border-strong)] bg-[var(--app-surface-elevated)] px-2 py-1 font-mono text-xs text-[var(--app-text)] tabular-nums focus:border-[var(--app-accent)] focus:outline-none"
                        />
                      </label>

                      <label className="flex items-center justify-between sm:justify-start gap-1.5 text-[11px] text-[var(--app-text-soft)]">
                        <span>Fin</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max={analysis.durationSec}
                          value={line.endTime}
                          onChange={(e) =>
                            handleLineChange(stanza.id, line.id, {
                              endTime: Math.max(
                                line.startTime + 0.2,
                                Number(e.target.value) || 0,
                              ),
                            })
                          }
                          className="min-h-[38px] sm:min-h-0 w-full max-w-[72px] sm:w-16 rounded border border-[var(--app-border-strong)] bg-[var(--app-surface-elevated)] px-2 py-1 font-mono text-xs text-[var(--app-text)] tabular-nums focus:border-[var(--app-accent)] focus:outline-none"
                        />
                      </label>
                    </div>

                    <input
                      type="text"
                      value={line.text}
                      onChange={(e) =>
                        handleLineChange(stanza.id, line.id, { text: e.target.value })
                      }
                      className="min-h-[42px] sm:min-h-0 w-full flex-1 rounded border border-[var(--app-border-strong)] bg-[var(--app-surface-elevated)] px-3 py-1.5 text-sm text-[var(--app-text)] focus:border-[var(--app-accent)] focus:outline-none"
                    />

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCaptureStart(stanza.id, line.id)}
                        className="inline-flex min-h-[42px] sm:min-h-0 flex-1 lg:flex-initial items-center justify-center gap-1 rounded border border-[var(--app-border-strong)] bg-[var(--app-surface-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--app-text)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent)] hover:border-[var(--app-accent-border)] whitespace-nowrap"
                      >
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        <span>Capturar inicio</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCaptureEnd(stanza.id, line.id)}
                        className="min-h-[42px] sm:min-h-0 flex-1 lg:flex-initial rounded border border-[var(--app-border-strong)] bg-[var(--app-surface-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--app-text)] hover:bg-[var(--app-surface)] whitespace-nowrap"
                      >
                        Capturar fin
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLine(stanza.id, line.id)}
                        aria-label="Eliminar línea"
                        title="Eliminar línea"
                        className="flex min-h-[42px] min-w-[42px] sm:min-h-0 sm:min-w-0 items-center justify-center rounded p-1.5 text-[var(--app-text-soft)] hover:bg-red-500/10 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
