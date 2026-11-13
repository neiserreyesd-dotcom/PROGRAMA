import { useEffect, useState } from 'react';
import { Check, Copy, Download, Share2, X } from 'lucide-react';
import { SongAnalysis, Stanza } from '../types/song';
import {
  renderStanzaShareBlob,
  ShareAspectRatio,
  ShareTheme,
} from '../utils/stanzaImageRenderer';

interface ShareStanzaModalProps {
  isOpen: boolean;
  analysis: SongAnalysis;
  stanza: Stanza | null;
  activeLineId?: string | null;
  onClose: () => void;
}

const ASPECT_OPTIONS: Array<{ id: ShareAspectRatio; label: string; hint: string }> = [
  { id: '4:5', label: 'Retrato 4:5', hint: 'Feed' },
  { id: '9:16', label: 'Vertical 9:16', hint: 'Stories' },
  { id: '16:9', label: 'Horizontal 16:9', hint: 'X / Web' },
];

const THEME_OPTIONS: Array<{ id: ShareTheme; label: string }> = [
  { id: 'stage', label: 'Escenario' },
  { id: 'warm', label: 'Ámbar' },
  { id: 'editorial', label: 'Editorial' },
];

export function ShareStanzaModal({
  isOpen,
  analysis,
  stanza,
  activeLineId,
  onClose,
}: ShareStanzaModalProps) {
  const [aspectRatio, setAspectRatio] = useState<ShareAspectRatio>('4:5');
  const [theme, setTheme] = useState<ShareTheme>('stage');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !stanza) return;
    let cancelled = false;
    let createdUrl: string | null = null;

    setIsGenerating(true);
    setShareFeedback(null);

    void renderStanzaShareBlob({
      analysis,
      stanza,
      activeLineId,
      aspectRatio,
      theme,
      includeMetadata,
    })
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setImageBlob(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return createdUrl;
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setShareFeedback(
            err instanceof Error ? err.message : 'No se pudo generar la captura.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsGenerating(false);
      });

    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [isOpen, analysis, stanza, activeLineId, aspectRatio, theme, includeMetadata]);

  if (!isOpen || !stanza) return null;

  const safeFileSlug = `${analysis.title}-${stanza.label}`
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñ]+/gi, '-')
    .replace(/^-|-$/g, '');
  const fileName = `${safeFileSlug || 'estrofa'}.png`;

  const handleDownload = () => {
    if (!imageBlob) return;
    const url = URL.createObjectURL(imageBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShareFeedback('Imagen descargada');
    window.setTimeout(() => setShareFeedback(null), 2000);
  };

  const handleCopyImage = async () => {
    if (!imageBlob) return;
    try {
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': imageBlob }),
        ]);
        setCopiedFeedback(true);
        window.setTimeout(() => setCopiedFeedback(false), 1800);
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  const handleNativeShare = async () => {
    if (!imageBlob) return;
    const file = new File([imageBlob], fileName, { type: 'image/png' });
    const shareText = `“${stanza.lines[0]?.text ?? stanza.label}” — ${analysis.title}`;

    if (
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          title: `${analysis.title} · ${stanza.label}`,
          text: shareText,
          files: [file],
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    handleDownload();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-4 pt-3.5 pb-safe sm:p-6 shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--app-border-strong)] sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--app-border)] pb-3.5">
          <div>
            <h2
              id="share-modal-title"
              className="font-display text-lg sm:text-xl font-bold text-[var(--app-text)]"
            >
              Compartir estrofa
            </h2>
            <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
              {stanza.label} · {analysis.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="flex min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 items-center justify-center rounded-lg p-1.5 text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Preview + Controls */}
        <div className="mt-5 grid gap-6 md:grid-cols-[1.15fr_0.85fr] md:items-start">
          {/* Dynamic Image Preview */}
          <div className="flex items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] p-4 min-h-[260px]">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={`Captura de ${stanza.label} de ${analysis.title}`}
                className={`max-h-[42dvh] sm:max-h-[420px] w-auto rounded-lg object-contain shadow-xl transition-opacity duration-150 ${
                  isGenerating ? 'opacity-60' : 'opacity-100'
                }`}
              />
            ) : (
              <div className="text-xs text-[var(--app-text-soft)]">Generando vista previa...</div>
            )}
          </div>

          {/* Customization & Export Controls */}
          <div className="space-y-5 pb-4 sm:pb-0">
            {/* Format Selector */}
            <div>
              <div className="mb-2 text-xs font-medium text-[var(--app-text-muted)]">
                Formato para redes
              </div>
              <div className="grid grid-cols-3 gap-2">
                {ASPECT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAspectRatio(opt.id)}
                    className={`min-h-[44px] rounded-lg px-2 py-2 text-center transition-colors ${
                      aspectRatio === opt.id
                        ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border border-[var(--app-accent-border)]'
                        : 'bg-[var(--app-surface-elevated)] text-[var(--app-text)] border border-[var(--app-border)] hover:border-[var(--app-border-strong)]'
                    }`}
                  >
                    <div className="text-xs font-semibold leading-tight">{opt.id}</div>
                    <div className="mt-0.5 text-[10px] text-[var(--app-text-muted)]">{opt.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Selector */}
            <div>
              <div className="mb-2 text-xs font-medium text-[var(--app-text-muted)]">
                Estilo visual
              </div>
              <div className="grid grid-cols-3 gap-2">
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTheme(opt.id)}
                    className={`min-h-[44px] rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                      theme === opt.id
                        ? 'bg-[var(--app-accent)] text-[var(--app-accent-contrast)] font-semibold'
                        : 'bg-[var(--app-surface-elevated)] text-[var(--app-text)] border border-[var(--app-border)] hover:border-[var(--app-border-strong)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Metadata Toggle */}
            <label className="flex min-h-[44px] cursor-pointer items-center justify-between rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-elevated)] px-3.5 py-2">
              <span className="text-xs font-medium text-[var(--app-text)]">
                Mostrar acordes, BPM y tonalidad
              </span>
              <input
                type="checkbox"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
                className="h-4 w-4 accent-[var(--app-accent)] cursor-pointer"
              />
            </label>

            {/* Share Actions */}
            <div className="space-y-2.5 pt-2 border-t border-[var(--app-border)]">
              <button
                type="button"
                onClick={() => void handleNativeShare()}
                disabled={!imageBlob || isGenerating}
                className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-lg bg-[var(--app-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--app-accent-contrast)] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Share2 className="h-4 w-4" aria-hidden="true" />
                <span>Compartir en redes</span>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!imageBlob || isGenerating}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-elevated)] px-3 py-2 text-xs font-semibold text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface)] disabled:opacity-40 whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Descargar PNG</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleCopyImage()}
                  disabled={!imageBlob || isGenerating}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-elevated)] px-3 py-2 text-xs font-semibold text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface)] disabled:opacity-40 whitespace-nowrap"
                >
                  {copiedFeedback ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                      <span>Copiada</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Copiar imagen</span>
                    </>
                  )}
                </button>
              </div>

              {shareFeedback && (
                <p className="text-center text-xs text-emerald-500">{shareFeedback}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
