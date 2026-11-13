import { Play, Repeat, Share2 } from 'lucide-react';
import { SongTrack, Stanza } from '../types/song';
import { transposeChord, transposeMusicalKey } from '../utils/chordTransposer';
import { formatTime } from '../utils/time';

interface StructureViewProps {
  track: SongTrack;
  activeStanzaId: string | null;
  loopStanzaId: string | null;
  transposeSemitones?: number;
  onJumpToStanza: (startTime: number) => void;
  onToggleLoopStanza: (stanzaId: string) => void;
  onShareStanza: (stanza: Stanza) => void;
}

export function StructureView({
  track,
  activeStanzaId,
  loopStanzaId,
  transposeSemitones = 0,
  onJumpToStanza,
  onToggleLoopStanza,
  onShareStanza,
}: StructureViewProps) {
  const { analysis } = track;
  const transposedKey = transposeMusicalKey(analysis.musicalKey, transposeSemitones);

  const metrics = [
    { label: 'Tempo', value: `${analysis.bpm} BPM` },
    { label: 'Tonalidad', value: transposedKey },
    { label: 'Compás', value: analysis.timeSignature },
    { label: 'Género', value: analysis.genre },
    { label: 'Registro vocal', value: analysis.vocalRange },
  ];

  return (
    <section className="mx-auto max-w-[1160px] px-3.5 pt-6 pb-36 sm:px-6 sm:pt-8 sm:pb-40">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h2 className="font-display text-xl font-bold tracking-tight text-[var(--app-text)] sm:text-3xl">
          Análisis musical y estructura
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--app-text-muted)]">
          {analysis.summary}
        </p>
      </div>

      {/* Musical Profile Grid */}
      <div className="mb-8 sm:mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-border)] sm:grid-cols-3 lg:grid-cols-5 shadow-sm">
        {metrics.map((metric, idx) => (
          <div
            key={metric.label}
            className={`bg-[var(--app-surface)] px-4 py-3.5 sm:px-5 sm:py-4 ${
              idx === metrics.length - 1 ? 'col-span-2 sm:col-span-1' : ''
            }`}
          >
            <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--app-text-soft)]">
              {metric.label}
            </div>
            <div className="mt-1 font-display text-base sm:text-lg font-semibold text-[var(--app-text)] tabular-nums truncate">
              {metric.value}
            </div>
          </div>
        ))}
      </div>

      {/* Stanza Cards Breakdown */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-[var(--app-text)]">
          Mapa de estrofas ({analysis.stanzas.length})
        </h3>
        <span className="text-xs text-[var(--app-text-muted)]">
          Carácter: {analysis.mood}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {analysis.stanzas.map((stanza, idx) => {
          const isActive = activeStanzaId === stanza.id;
          const isLooped = loopStanzaId === stanza.id;
          const displayChords = stanza.chords.map((c) =>
            transposeChord(c, transposeSemitones),
          );

          return (
            <article
              key={stanza.id}
              style={
                isActive
                  ? {
                      backgroundImage:
                        'linear-gradient(180deg, var(--app-accent-glow) 0%, transparent 110px)',
                    }
                  : undefined
              }
              className={`flex flex-col justify-between rounded-2xl p-4 sm:p-5 transition-all border ${
                isActive
                  ? 'bg-[var(--app-surface)] border-[var(--app-accent-border)] shadow-lg'
                  : 'bg-[var(--app-surface)]/90 border-[var(--app-border)] hover:border-[var(--app-border-strong)]'
              }`}
            >
              <div>
                {/* Stanza Header */}
                <div className="flex items-start justify-between gap-3 border-b border-[var(--app-border)] pb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[var(--app-text-soft)] tabular-nums">
                        {String(idx + 1).padStart(2, '0')}.
                      </span>
                      <h4
                        className={`font-display text-base font-semibold truncate ${
                          isActive ? 'text-[var(--app-accent)]' : 'text-[var(--app-text)]'
                        }`}
                      >
                        {stanza.label}
                      </h4>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--app-text-muted)]">
                      <span className="font-mono tabular-nums">
                        {formatTime(stanza.startTime)} – {formatTime(stanza.endTime)}
                      </span>
                      {displayChords.length > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-[var(--app-text)]">
                            {displayChords.join(' - ')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Energy indicator (1-10) */}
                  <div className="text-right shrink-0">
                    <div className="text-[11px] text-[var(--app-text-muted)]">Energía</div>
                    <div
                      className="mt-1 flex items-center gap-0.5"
                      aria-label={`Energía ${stanza.energy} de 10`}
                    >
                      {Array.from({ length: 10 }).map((_, barIdx) => (
                        <span
                          key={barIdx}
                          className={`h-2.5 w-1.5 rounded-[1px] ${
                            barIdx < stanza.energy
                              ? isActive
                                ? 'bg-[var(--app-accent)]'
                                : 'bg-[var(--app-accent)] opacity-60'
                              : 'bg-[var(--app-border)]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Singing Tip */}
                {stanza.singingTip && (
                  <p className="mt-3 text-xs leading-relaxed text-[var(--app-accent)]">
                    {stanza.singingTip}
                  </p>
                )}

                {/* Lyrics Lines */}
                <div className="mt-3 space-y-1.5 text-sm leading-relaxed text-[var(--lyric-text)]">
                  {stanza.lines.map((line) => (
                    <p key={line.id} className="flex gap-2.5">
                      <span className="font-mono text-[11px] text-[var(--app-text-soft)] tabular-nums pt-0.5 shrink-0">
                        {formatTime(line.startTime)}
                      </span>
                      <span
                        className={
                          line.text.startsWith('(') ? 'italic text-[var(--app-text-muted)]' : ''
                        }
                      >
                        {line.text}
                      </span>
                    </p>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 flex flex-wrap items-center gap-2 pt-3 border-t border-[var(--app-border)]">
                <button
                  type="button"
                  onClick={() => onJumpToStanza(stanza.startTime)}
                  className="inline-flex min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-lg bg-[var(--app-surface-elevated)] px-3.5 py-2 sm:py-1.5 text-xs font-medium text-[var(--app-text)] transition-colors hover:opacity-90 whitespace-nowrap"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Cantar desde aquí</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleLoopStanza(stanza.id)}
                  className={`inline-flex min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 sm:py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    isLooped
                      ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border border-[var(--app-accent-border)]'
                      : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-surface-elevated)]'
                  }`}
                >
                  <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isLooped ? 'Bucle activo' : 'Practicar en bucle'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onShareStanza(stanza)}
                  aria-label={`Compartir ${stanza.label}`}
                  className="inline-flex min-h-[44px] sm:min-h-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 sm:py-1.5 text-xs font-medium text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-accent)] whitespace-nowrap"
                >
                  <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Compartir</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

