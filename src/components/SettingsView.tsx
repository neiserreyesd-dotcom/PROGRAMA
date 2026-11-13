import { useRef, useState } from 'react';
import {
  Palette,
  Type as TypeIcon,
  Sliders,
  NotebookPen,
  RotateCcw,
  Download,
  Upload,
  Check,
  Volume2,
  FlipHorizontal2,
  Maximize,
  PictureInPicture2,
  EyeOff,
} from 'lucide-react';
import {
  AppSettings,
  KaraokeHighlightStyle,
  LyricFontId,
  LyricLineSpacing,
  LyricWeight,
  MetronomeSound,
  SongTrack,
  ThemeColors,
} from '../types/song';
import {
  DEFAULT_APP_SETTINGS,
  LYRIC_FONT_OPTIONS,
  THEME_PRESETS,
} from '../utils/appSettings';
import { formatSemitoneOffset, transposeChord } from '../utils/chordTransposer';

interface SettingsViewProps {
  settings: AppSettings;
  activeTrack: SongTrack;
  songNote: string;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onUpdateColors: (patch: Partial<ThemeColors>) => void;
  onResetSettings: () => void;
  onImportSettings: (incoming: AppSettings) => void;
  onUpdateSongNote: (note: string) => void;
  onOpenStage: () => void;
}

type SettingsTab = 'colors' | 'typography' | 'advanced' | 'notes';

const COLOR_SLOTS: Array<{ key: keyof ThemeColors; label: string; hint: string }> = [
  { key: 'accent', label: 'Color de acento', hint: 'Botones activos, barra de progreso y bordes de foco' },
  { key: 'lyricHighlight', label: 'Resaltado al cantar', hint: 'Color del barrido karaoke sobre el verso actual' },
  { key: 'background', label: 'Fondo general', hint: 'Lienzo principal detrás del escenario' },
  { key: 'surface', label: 'Tarjetas y estrofas', hint: 'Fondo de contenedores y bloques de letra' },
  { key: 'text', label: 'Texto de interfaz', hint: 'Títulos, menús y etiquetas de navegación' },
  { key: 'lyricText', label: 'Texto de la letra', hint: 'Color base de los versos por cantar' },
];

export function SettingsView({
  settings,
  activeTrack,
  songNote,
  onUpdateSettings,
  onUpdateColors,
  onResetSettings,
  onImportSettings,
  onUpdateSongNote,
  onOpenStage,
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('colors');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fontDef =
    LYRIC_FONT_OPTIONS.find((f) => f.id === settings.lyricFont) ?? LYRIC_FONT_OPTIONS[0];

  const sampleStanza =
    activeTrack.analysis.stanzas.find((s) => s.lines.some((l) => !l.text.startsWith('('))) ??
    activeTrack.analysis.stanzas[0];

  const previewLine1 =
    sampleStanza?.lines[0]?.text ?? 'Canta cada verso siguiendo el pulso de tu voz';
  const previewLine2 =
    sampleStanza?.lines[1]?.text ?? 'Personaliza colores, fuentes y herramientas de estudio';
  const previewChords = (sampleStanza?.chords ?? ['Am', 'F', 'C', 'G']).map((c) =>
    transposeChord(c, settings.transposeSemitones),
  );

  const handleExportSettings = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'estrofa-ajustes.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<AppSettings>;
      if (!parsed || typeof parsed !== 'object' || !parsed.colors) {
        setImportStatus('El archivo no contiene un perfil válido de Estrofa.');
        return;
      }
      onImportSettings({
        ...DEFAULT_APP_SETTINGS,
        ...parsed,
        colors: {
          ...DEFAULT_APP_SETTINGS.colors,
          ...parsed.colors,
        },
      });
      setImportStatus('Perfil visual importado correctamente.');
    } catch {
      setImportStatus('No se pudo leer el archivo JSON.');
    }
  };

  const previewWeightClass =
    settings.lyricWeight === 'bold'
      ? 'font-bold'
      : settings.lyricWeight === 'medium'
        ? 'font-medium'
        : 'font-semibold';

  const previewLeadingClass =
    settings.lyricLineSpacing === 'compact'
      ? 'leading-tight'
      : settings.lyricLineSpacing === 'airy'
        ? 'leading-loose'
        : 'leading-snug';

  return (
    <section className="mx-auto max-w-[1200px] px-3.5 pt-6 pb-36 sm:px-6 sm:pt-8 sm:pb-40">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 border-b border-[var(--app-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-[var(--app-text)] sm:text-3xl">
            Ajustes y personalización
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--app-text-muted)]">
            Adapta cualquier color, tipografía de letra, modo claro u oscuro y herramientas avanzadas para tu estilo de canto.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onResetSettings}
            className="inline-flex min-h-[44px] sm:min-h-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-3.5 py-2 text-xs font-medium text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)] whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Restablecer</span>
          </button>

          <button
            type="button"
            onClick={onOpenStage}
            className="inline-flex min-h-[44px] sm:min-h-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--app-accent)] px-4 py-2 text-xs font-semibold text-[var(--app-accent-contrast)] transition-opacity hover:opacity-90 whitespace-nowrap"
          >
            <span>Ir al escenario</span>
          </button>
        </div>
      </div>

      {/* Category Tabs: 2x2 Grid on Mobile so all 4 tabs fit cleanly with zero cutoff */}
      <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5">
        {(
          [
            { id: 'colors', label: 'Colores y tema', icon: Palette },
            { id: 'typography', label: 'Tipografía', icon: TypeIcon },
            { id: 'advanced', label: 'Avanzado', icon: Sliders },
            { id: 'notes', label: 'Notas y perfil', icon: NotebookPen },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex min-h-[44px] sm:min-h-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border border-[var(--app-accent-border)]'
                  : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)] border border-transparent'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        {/* Left Main Controls Column */}
        <div className="space-y-5 sm:space-y-6 order-2 lg:order-1">
          {activeTab === 'colors' && (
            <>
              {/* Curated Theme Presets */}
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-6">
                <h3 className="font-display text-base font-semibold text-[var(--app-text)]">
                  Temas de ambiente
                </h3>
                <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                  Elige una paleta lista para escenario nocturno, estudio o modo claro de día.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {THEME_PRESETS.map((preset) => {
                    const isSelected = settings.themePreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          onUpdateSettings({
                            themePreset: preset.id,
                            colors: { ...preset.colors },
                          })
                        }
                        className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition-colors ${
                          isSelected
                            ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                            : 'border-[var(--app-border)] bg-[var(--app-bg)]/40 hover:border-[var(--app-border-strong)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[var(--app-text)]">
                            {preset.name}
                          </span>
                          {isSelected && (
                            <Check
                              className="h-4 w-4 text-[var(--app-accent)] shrink-0"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                          {preset.description}
                        </p>
                        <div className="mt-3 flex items-center gap-1.5">
                          {[
                            preset.colors.background,
                            preset.colors.surface,
                            preset.colors.accent,
                            preset.colors.lyricHighlight,
                            preset.colors.text,
                          ].map((swatch, idx) => (
                            <span
                              key={idx}
                              style={{ backgroundColor: swatch }}
                              className="h-4 w-4 rounded-full border border-black/25"
                            />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Full-Spectrum Color Pickers */}
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-6">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-semibold text-[var(--app-text)]">
                      Colores personalizados libres
                    </h3>
                    <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                      Cambia cada capa cromática de la app al tono exacto que prefieras.
                    </p>
                  </div>
                  {settings.themePreset === 'custom' && (
                    <span className="font-mono text-[11px] text-[var(--app-accent)] whitespace-nowrap">
                      Personalizado
                    </span>
                  )}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {COLOR_SLOTS.map((slot) => {
                    const currentHex = settings.colors[slot.key];
                    return (
                      <label
                        key={slot.key}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)]/45 px-3.5 py-3 transition-colors hover:border-[var(--app-border-strong)]"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[var(--app-text)]">
                            {slot.label}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
                            {slot.hint}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-[11px] uppercase tabular-nums text-[var(--app-text-muted)]">
                            {currentHex}
                          </span>
                          <input
                            type="color"
                            value={currentHex}
                            onChange={(e) => onUpdateColors({ [slot.key]: e.target.value })}
                            aria-label={slot.label}
                            className="h-9 w-11 cursor-pointer rounded-md border border-[var(--app-border-strong)] bg-transparent p-0.5"
                          />
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {activeTab === 'typography' && (
            <>
              {/* Font Families */}
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-6">
                <h3 className="font-display text-base font-semibold text-[var(--app-text)]">
                  Tipo de letra del teleprompter
                </h3>
                <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                  Selecciona la fuente con la que lees las estrofas mientras cantas.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {LYRIC_FONT_OPTIONS.map((font) => {
                    const selected = settings.lyricFont === font.id;
                    return (
                      <button
                        key={font.id}
                        type="button"
                        onClick={() => onUpdateSettings({ lyricFont: font.id as LyricFontId })}
                        className={`rounded-xl border p-3.5 text-left transition-colors ${
                          selected
                            ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                            : 'border-[var(--app-border)] bg-[var(--app-bg)]/40 hover:border-[var(--app-border-strong)]'
                        }`}
                      >
                        <div
                          style={{ fontFamily: font.cssFamily }}
                          className="text-lg font-semibold text-[var(--app-text)] truncate"
                        >
                          {font.label}
                        </div>
                        <div className="mt-1 text-xs text-[var(--app-text-muted)]">
                          {font.sample}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Size, Spacing, Weight, Alignment */}
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-6 space-y-5">
                <h3 className="font-display text-base font-semibold text-[var(--app-text)]">
                  Escala, alineación y estilo visual
                </h3>

                {/* Size Slider */}
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--app-text)]">
                      Tamaño de letra en escenario
                    </span>
                    <span className="font-mono tabular-nums text-[var(--app-accent)]">
                      {Math.round(settings.lyricSizeMultiplier * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.75}
                    max={1.6}
                    step={0.05}
                    value={settings.lyricSizeMultiplier}
                    onChange={(e) =>
                      onUpdateSettings({ lyricSizeMultiplier: Number(e.target.value) })
                    }
                    className="w-full accent-[var(--app-accent)] cursor-pointer"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      { label: 'Compacto', val: 0.85 },
                      { label: 'Estándar', val: 1.0 },
                      { label: 'Grande', val: 1.25 },
                      { label: 'Gigante', val: 1.5 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => onUpdateSettings({ lyricSizeMultiplier: preset.val })}
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                          Math.abs(settings.lyricSizeMultiplier - preset.val) < 0.03
                            ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                            : 'border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Past Stanza Opacity */}
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--app-text)]">
                      Visibilidad de estrofas inactivas
                    </span>
                    <span className="font-mono tabular-nums text-[var(--app-accent)]">
                      {Math.round(settings.pastStanzaOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={0.95}
                    step={0.05}
                    value={settings.pastStanzaOpacity}
                    onChange={(e) =>
                      onUpdateSettings({ pastStanzaOpacity: Number(e.target.value) })
                    }
                    className="w-full accent-[var(--app-accent)] cursor-pointer"
                  />
                </div>

                {/* Alignment, Spacing, Weight, Highlight Style */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs font-medium text-[var(--app-text)]">
                      Alineación de versos
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { id: 'left', label: 'Izquierda' },
                          { id: 'center', label: 'Centrado' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onUpdateSettings({ lyricAlign: opt.id })}
                          className={`min-h-[40px] sm:min-h-0 rounded-lg border px-3 py-2 text-xs font-medium ${
                            settings.lyricAlign === opt.id
                              ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                              : 'border-[var(--app-border)] text-[var(--app-text-muted)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-medium text-[var(--app-text)]">
                      Espaciado entre líneas
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'compact', label: 'Ajustado' },
                          { id: 'balanced', label: 'Normal' },
                          { id: 'airy', label: 'Amplio' },
                        ] as Array<{ id: LyricLineSpacing; label: string }>
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onUpdateSettings({ lyricLineSpacing: opt.id })}
                          className={`min-h-[40px] sm:min-h-0 rounded-lg border px-2 py-2 text-xs font-medium ${
                            settings.lyricLineSpacing === opt.id
                              ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                              : 'border-[var(--app-border)] text-[var(--app-text-muted)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-medium text-[var(--app-text)]">
                      Grosor de letra
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'medium', label: 'Medio' },
                          { id: 'semibold', label: 'Fuerte' },
                          { id: 'bold', label: 'Negrita' },
                        ] as Array<{ id: LyricWeight; label: string }>
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onUpdateSettings({ lyricWeight: opt.id })}
                          className={`min-h-[40px] sm:min-h-0 rounded-lg border px-2 py-2 text-xs font-medium ${
                            settings.lyricWeight === opt.id
                              ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                              : 'border-[var(--app-border)] text-[var(--app-text-muted)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-medium text-[var(--app-text)]">
                      Estilo de línea activa
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'sweep', label: 'Barrido' },
                          { id: 'solid', label: 'Sólido' },
                          { id: 'underline', label: 'Subrayado' },
                        ] as Array<{ id: KaraokeHighlightStyle; label: string }>
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onUpdateSettings({ highlightStyle: opt.id })}
                          className={`min-h-[40px] sm:min-h-0 rounded-lg border px-2 py-2 text-xs font-medium ${
                            settings.highlightStyle === opt.id
                              ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                              : 'border-[var(--app-border)] text-[var(--app-text-muted)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Visibility Toggles */}
                <div className="grid gap-2.5 sm:grid-cols-2 pt-2 border-t border-[var(--app-border)]">
                  {[
                    {
                      key: 'lyricUppercase' as const,
                      label: 'Mostrar versos en MAYÚSCULAS',
                      value: settings.lyricUppercase,
                    },
                    {
                      key: 'showTimestamps' as const,
                      label: 'Mostrar marcas de tiempo (mm:ss)',
                      value: settings.showTimestamps,
                    },
                    {
                      key: 'showChords' as const,
                      label: 'Mostrar acordes en cada estrofa',
                      value: settings.showChords,
                    },
                    {
                      key: 'showSingingTips' as const,
                      label: 'Mostrar consejos vocales en estrofa activa',
                      value: settings.showSingingTips,
                    },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)]/40 px-3.5 py-2.5"
                    >
                      <span className="text-xs font-medium text-[var(--app-text)]">
                        {item.label}
                      </span>
                      <input
                        type="checkbox"
                        checked={item.value}
                        onChange={(e) => onUpdateSettings({ [item.key]: e.target.checked })}
                        className="h-4 w-4 accent-[var(--app-accent)] cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'advanced' && (
            <>
              {/* Chord Transposer & Countdown */}
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-6 space-y-5">
                <div>
                  <h3 className="font-display text-base font-semibold text-[var(--app-text)]">
                    Transpositor de acordes y tonalidad
                  </h3>
                  <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                    Adapta todos los acordes y la tonalidad mostrada a tu registro vocal o al uso de cejilla.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings({
                          transposeSemitones: Math.max(-6, settings.transposeSemitones - 1),
                        })
                      }
                      className="min-h-[42px] sm:min-h-0 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-bg)]/50 px-3.5 py-2 font-mono text-xs font-semibold text-[var(--app-text)] hover:border-[var(--app-accent)]"
                    >
                      -1 semitono
                    </button>
                    <span className="min-w-[110px] text-center font-mono text-xs font-semibold tabular-nums text-[var(--app-accent)]">
                      {formatSemitoneOffset(settings.transposeSemitones)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings({
                          transposeSemitones: Math.min(6, settings.transposeSemitones + 1),
                        })
                      }
                      className="min-h-[42px] sm:min-h-0 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-bg)]/50 px-3.5 py-2 font-mono text-xs font-semibold text-[var(--app-text)] hover:border-[var(--app-accent)]"
                    >
                      +1 semitono
                    </button>
                    {settings.transposeSemitones !== 0 && (
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ transposeSemitones: 0 })}
                        className="text-xs text-[var(--app-text-muted)] underline underline-offset-4 hover:text-[var(--app-text)]"
                      >
                        Volver a original
                      </button>
                    )}
                  </div>
                </div>

                {/* Metronome Studio Settings */}
                <div className="border-t border-[var(--app-border)] pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-base font-semibold text-[var(--app-text)]">
                        Metrónomo sincronizado al BPM
                      </h3>
                      <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
                        Marca el pulso real ({activeTrack.analysis.bpm} BPM · {activeTrack.analysis.timeSignature}) visual o sonoro mientras cantas.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.metronomeEnabled}
                      onChange={(e) => onUpdateSettings({ metronomeEnabled: e.target.checked })}
                      aria-label="Activar metrónomo"
                      className="h-5 w-5 accent-[var(--app-accent)] cursor-pointer shrink-0"
                    />
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="mb-2 text-xs font-medium text-[var(--app-text)]">
                        Sonido del pulso
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            { id: 'wood', label: 'Madera' },
                            { id: 'click', label: 'Digital' },
                            { id: 'visual', label: 'Solo visual' },
                          ] as Array<{ id: MetronomeSound; label: string }>
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => onUpdateSettings({ metronomeSound: opt.id })}
                            className={`min-h-[40px] sm:min-h-0 rounded-lg border px-2 py-2 text-xs font-medium ${
                              settings.metronomeSound === opt.id
                                ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                                : 'border-[var(--app-border)] text-[var(--app-text-muted)]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs font-medium text-[var(--app-text)]">
                        <span className="inline-flex items-center gap-1.5">
                          <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Volumen del metrónomo
                        </span>
                        <span className="font-mono tabular-nums text-[var(--app-accent)]">
                          {Math.round(settings.metronomeVolume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={settings.metronomeVolume}
                        onChange={(e) =>
                          onUpdateSettings({ metronomeVolume: Number(e.target.value) })
                        }
                        className="w-full accent-[var(--app-accent)] cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Countdown & Playback Automation */}
                <div className="border-t border-[var(--app-border)] pt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs font-medium text-[var(--app-text)]">
                      Aviso antes de entrar la voz
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[0, 2, 3, 5].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => onUpdateSettings({ countdownSeconds: sec })}
                          className={`min-h-[40px] sm:min-h-0 rounded-lg border px-2 py-2 font-mono text-xs font-medium ${
                            settings.countdownSeconds === sec
                              ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                              : 'border-[var(--app-border)] text-[var(--app-text-muted)]'
                          }`}
                        >
                          {sec === 0 ? 'Off' : `${sec}s`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-[var(--app-text)]">
                      Reproducción automática
                    </div>
                    <label className="flex min-h-[40px] cursor-pointer items-center justify-between rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)]/40 px-3 py-1.5">
                      <span className="text-xs text-[var(--app-text)]">
                        Repetir canción al finalizar
                      </span>
                      <input
                        type="checkbox"
                        checked={settings.autoLoopTrack}
                        onChange={(e) =>
                          onUpdateSettings({
                            autoLoopTrack: e.target.checked,
                            autoNextTrack: e.target.checked ? false : settings.autoNextTrack,
                          })
                        }
                        className="h-4 w-4 accent-[var(--app-accent)] cursor-pointer"
                      />
                    </label>
                    <label className="flex min-h-[40px] cursor-pointer items-center justify-between rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)]/40 px-3 py-1.5">
                      <span className="text-xs text-[var(--app-text)]">
                        Pasar a la siguiente canción
                      </span>
                      <input
                        type="checkbox"
                        checked={settings.autoNextTrack}
                        onChange={(e) =>
                          onUpdateSettings({
                            autoNextTrack: e.target.checked,
                            autoLoopTrack: e.target.checked ? false : settings.autoLoopTrack,
                          })
                        }
                        className="h-4 w-4 accent-[var(--app-accent)] cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {/* Stage Hardware Modes */}
                <div className="border-t border-[var(--app-border)] pt-5 grid gap-3 sm:grid-cols-2">
                  <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)]/40 px-3.5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Maximize className="h-4 w-4 text-[var(--app-accent)] shrink-0" aria-hidden="true" />
                      <div>
                        <div className="text-xs font-semibold text-[var(--app-text)]">
                          Modo escenario enfocado
                        </div>
                        <div className="text-[11px] text-[var(--app-text-muted)]">
                          Oculta el historial y barras secundarias en vivo
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.focusStageMode}
                      onChange={(e) => onUpdateSettings({ focusStageMode: e.target.checked })}
                      className="h-4 w-4 accent-[var(--app-accent)] cursor-pointer"
                    />
                  </label>

                  <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)]/40 px-3.5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <FlipHorizontal2
                        className="h-4 w-4 text-[var(--app-accent)] shrink-0"
                        aria-hidden="true"
                      />
                      <div>
                        <div className="text-xs font-semibold text-[var(--app-text)]">
                          Modo espejo (Teleprompter)
                        </div>
                        <div className="text-[11px] text-[var(--app-text-muted)]">
                          Invierte horizontalmente las letras para cristal prompter
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.mirrorTeleprompter}
                      onChange={(e) =>
                        onUpdateSettings({ mirrorTeleprompter: e.target.checked })
                      }
                      className="h-4 w-4 accent-[var(--app-accent)] cursor-pointer"
                    />
                  </label>

                  <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)]/40 px-3.5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <PictureInPicture2
                        className="h-4 w-4 text-[var(--app-accent)] shrink-0"
                        aria-hidden="true"
                      />
                      <div>
                        <div className="text-xs font-semibold text-[var(--app-text)]">
                          Burbuja de letras en segundo plano
                        </div>
                        <div className="text-[11px] text-[var(--app-text-muted)]">
                          Muestra una burbuja flotante con la letra al navegar por la app
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.backgroundBubbleAuto}
                      onChange={(e) =>
                        onUpdateSettings({ backgroundBubbleAuto: e.target.checked })
                      }
                      className="h-4 w-4 accent-[var(--app-accent)] cursor-pointer"
                    />
                  </label>

                  <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)]/40 px-3.5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <EyeOff
                        className="h-4 w-4 text-[var(--app-accent)] shrink-0"
                        aria-hidden="true"
                      />
                      <div>
                        <div className="text-xs font-semibold text-[var(--app-text)]">
                          Solo letras en YouTube
                        </div>
                        <div className="text-[11px] text-[var(--app-text-muted)]">
                          Oculta el video y muestra únicamente la letra sincronizada
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.youtubeLyricsOnly}
                      onChange={(e) =>
                        onUpdateSettings({ youtubeLyricsOnly: e.target.checked })
                      }
                      className="h-4 w-4 accent-[var(--app-accent)] cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-6">
              {/* Per-Song Practice Notes */}
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-6">
                <h3 className="font-display text-base font-semibold text-[var(--app-text)]">
                  Cuaderno de ensayo · {activeTrack.analysis.title}
                </h3>
                <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                  Guarda tus apuntes de respiración, cejilla, entradas o matices para esta canción. Se guardan automáticamente por tema.
                </p>

                <textarea
                  rows={6}
                  value={songNote}
                  onChange={(e) => onUpdateSongNote(e.target.value)}
                  placeholder="Ej. Entrar suave en Estrofa 1, respirar antes del puente, subir intensidad en el segundo coro..."
                  className="mt-3 w-full rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-bg)] px-3.5 py-3 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-soft)] focus:border-[var(--app-accent)] focus:outline-none"
                />
              </div>

              {/* Export / Import Appearance Profile */}
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-6">
                <h3 className="font-display text-base font-semibold text-[var(--app-text)]">
                  Guardar o compartir tu configuración
                </h3>
                <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                  Descarga tu paleta de colores y tipografía en JSON para llevarla a otro teléfono o computadora.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleExportSettings}
                    className="inline-flex min-h-[42px] sm:min-h-0 items-center gap-2 rounded-lg bg-[var(--app-accent)] px-4 py-2 text-xs font-semibold text-[var(--app-accent-contrast)] hover:opacity-90"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Exportar ajustes (.json)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex min-h-[42px] sm:min-h-0 items-center gap-2 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-bg)]/50 px-4 py-2 text-xs font-medium text-[var(--app-text)] hover:border-[var(--app-accent)]"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Importar ajustes</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => void handleImportFile(e.target.files?.[0])}
                  />
                </div>

                {importStatus && (
                  <p className="mt-3 text-xs text-[var(--app-accent)]">{importStatus}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Live Preview Column (Top on phone screens so edits are immediately visible) */}
        <aside className="order-1 lg:order-2 lg:sticky lg:top-20">
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between text-xs text-[var(--app-text-muted)]">
              <span className="font-semibold text-[var(--app-text)]">
                Vista previa en vivo
              </span>
              <span className="font-mono">{fontDef.label}</span>
            </div>

            <div
              style={{
                backgroundColor: settings.colors.surface,
                borderColor: 'var(--app-accent-border)',
              }}
              className={`rounded-xl border p-4 sm:p-5 ${
                settings.lyricAlign === 'center' ? 'text-center' : 'text-left'
              } ${settings.mirrorTeleprompter ? '-scale-x-100' : ''}`}
            >
              <div
                className={`mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${
                  settings.lyricAlign === 'center' ? 'justify-center' : 'justify-start'
                }`}
              >
                <span className="font-semibold text-[var(--app-accent)]">
                  {sampleStanza?.label ?? 'Estrofa destacada'}
                </span>
                {settings.showTimestamps && (
                  <>
                    <span className="text-[var(--app-text-soft)]">·</span>
                    <span className="font-mono tabular-nums text-[var(--app-text-muted)]">
                      00:42
                    </span>
                  </>
                )}
                {settings.showChords && previewChords.length > 0 && (
                  <>
                    <span className="text-[var(--app-text-soft)]">·</span>
                    <span className="font-mono text-[var(--app-text-muted)]">
                      {previewChords.slice(0, 4).join(' · ')}
                    </span>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <p
                  style={{
                    fontFamily: fontDef.cssFamily,
                    fontSize: `${Math.round(18 * settings.lyricSizeMultiplier)}px`,
                    '--line-progress': '62%',
                  } as React.CSSProperties}
                  className={`${previewWeightClass} ${previewLeadingClass} ${
                    settings.lyricUppercase ? 'uppercase' : ''
                  } ${
                    settings.highlightStyle === 'sweep'
                      ? 'karaoke-line-active'
                      : settings.highlightStyle === 'underline'
                        ? 'text-[var(--lyric-highlight)] underline decoration-2 underline-offset-4'
                        : 'text-[var(--lyric-highlight)]'
                  }`}
                >
                  {previewLine1}
                </p>

                <p
                  style={{
                    fontFamily: fontDef.cssFamily,
                    fontSize: `${Math.round(18 * settings.lyricSizeMultiplier)}px`,
                    color: settings.colors.lyricText,
                  }}
                  className={`${previewWeightClass} ${previewLeadingClass} opacity-80 ${
                    settings.lyricUppercase ? 'uppercase' : ''
                  }`}
                >
                  {previewLine2}
                </p>
              </div>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
              Todos tus ajustes se guardan al instante en este dispositivo y se reflejan en el escenario, estructura y reproductor.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
