import { SongAnalysis, Stanza } from '../types/song';
import { formatTime } from './time';

export type ShareAspectRatio = '4:5' | '9:16' | '16:9';
export type ShareTheme = 'stage' | 'warm' | 'editorial';

export interface ShareCardOptions {
  analysis: SongAnalysis;
  stanza: Stanza;
  activeLineId?: string | null;
  aspectRatio: ShareAspectRatio;
  theme: ShareTheme;
  includeMetadata: boolean;
}

const DIMENSIONS: Record<ShareAspectRatio, { width: number; height: number }> = {
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1200, height: 675 },
};

interface Palette {
  bgTop: string;
  bgBottom: string;
  glow: string;
  cardBg: string;
  cardBorder: string;
  divider: string;
  labelColor: string;
  metaColor: string;
  activeLine: string;
  lyricColor: string;
  instrumentalColor: string;
  titleColor: string;
  artistColor: string;
  waveActive: string;
  waveMuted: string;
}

const PALETTES: Record<ShareTheme, Palette> = {
  stage: {
    bgTop: '#0C0E12',
    bgBottom: '#12151E',
    glow: 'rgba(245, 158, 11, 0.14)',
    cardBg: '#151822',
    cardBorder: 'rgba(251, 191, 36, 0.30)',
    divider: 'rgba(255, 255, 255, 0.08)',
    labelColor: '#FCD34D',
    metaColor: '#9CA3AF',
    activeLine: '#FDE68A',
    lyricColor: '#E5E7EB',
    instrumentalColor: '#71717A',
    titleColor: '#FFFFFF',
    artistColor: '#9CA3AF',
    waveActive: 'rgba(251, 191, 36, 0.65)',
    waveMuted: 'rgba(255, 255, 255, 0.14)',
  },
  warm: {
    bgTop: '#160E09',
    bgBottom: '#23150C',
    glow: 'rgba(245, 158, 11, 0.22)',
    cardBg: '#1D130C',
    cardBorder: 'rgba(251, 191, 36, 0.36)',
    divider: 'rgba(253, 230, 138, 0.12)',
    labelColor: '#FBBF24',
    metaColor: '#D6B89C',
    activeLine: '#FEF3C7',
    lyricColor: '#F5E6D3',
    instrumentalColor: '#A8896C',
    titleColor: '#FFFBEB',
    artistColor: '#D6B89C',
    waveActive: 'rgba(251, 191, 36, 0.72)',
    waveMuted: 'rgba(253, 230, 138, 0.18)',
  },
  editorial: {
    bgTop: '#F5F2EB',
    bgBottom: '#ECE7DC',
    glow: 'rgba(180, 83, 9, 0.09)',
    cardBg: '#FAF8F3',
    cardBorder: 'rgba(17, 19, 24, 0.12)',
    divider: 'rgba(17, 19, 24, 0.09)',
    labelColor: '#B45309',
    metaColor: '#52525B',
    activeLine: '#92400E',
    lyricColor: '#18181B',
    instrumentalColor: '#71717A',
    titleColor: '#111318',
    artistColor: '#52525B',
    waveActive: 'rgba(180, 83, 9, 0.7)',
    waveMuted: 'rgba(17, 19, 24, 0.14)',
  },
};

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function renderStanzaShareBlob(
  options: ShareCardOptions,
): Promise<Blob> {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const { analysis, stanza, activeLineId, aspectRatio, theme, includeMetadata } = options;
  const { width, height } = DIMENSIONS[aspectRatio];
  const palette = PALETTES[theme];

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el lienzo de imagen.');
  }

  // 1. Background Gradient & Ambient Spotlight
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, palette.bgTop);
  bgGrad.addColorStop(1, palette.bgBottom);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width * 0.5,
    height * 0.35,
    40,
    width * 0.5,
    height * 0.35,
    Math.max(width, height) * 0.65,
  );
  glow.addColorStop(0, palette.glow);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // 2. Outer Card Container
  const outerMarginX = aspectRatio === '16:9' ? 64 : 68;
  const outerMarginY = aspectRatio === '9:16' ? 140 : aspectRatio === '16:9' ? 48 : 88;
  const cardX = outerMarginX;
  const cardY = outerMarginY;
  const cardW = width - outerMarginX * 2;
  const cardH = height - outerMarginY * 2;
  const cardPadX = aspectRatio === '16:9' ? 56 : 64;
  const cardPadY = aspectRatio === '16:9' ? 44 : 60;

  ctx.save();
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 32);
  ctx.fillStyle = palette.cardBg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = palette.cardBorder;
  ctx.stroke();
  ctx.restore();

  const innerX = cardX + cardPadX;
  const innerW = cardW - cardPadX * 2;

  // 3. Stanza Header (Label · Time · Chords)
  const headerY = cardY + cardPadY + 28;
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 28px "Outfit", system-ui, sans-serif';
  ctx.fillStyle = palette.labelColor;
  ctx.fillText(stanza.label, innerX, headerY);
  const labelW = ctx.measureText(stanza.label).width;

  const metaParts: string[] = [
    `${formatTime(stanza.startTime)} – ${formatTime(stanza.endTime)}`,
  ];
  if (includeMetadata && stanza.chords.length > 0) {
    metaParts.push(stanza.chords.slice(0, 4).join(' · '));
  }
  const metaText = `  ·  ${metaParts.join('  ·  ')}`;
  ctx.font = '400 22px "JetBrains Mono", monospace';
  ctx.fillStyle = palette.metaColor;
  ctx.fillText(metaText, innerX + labelW, headerY - 1);

  // Header Divider
  const dividerTopY = headerY + 26;
  ctx.strokeStyle = palette.divider;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(innerX, dividerTopY);
  ctx.lineTo(innerX + innerW, dividerTopY);
  ctx.stroke();

  // 4. Footer Area Reservation (Song Title, Artist, Energy Wave, Estrofa Wordmark)
  const footerHeight = aspectRatio === '16:9' ? 110 : 148;
  const footerTopY = cardY + cardH - cardPadY - footerHeight;

  // 5. Lyric Lines (Auto-fit font size so all lines fit inside available height cleanly)
  const lyricsTopY = dividerTopY + (aspectRatio === '16:9' ? 32 : 48);
  const lyricsBottomY = footerTopY - (aspectRatio === '16:9' ? 24 : 40);
  const availableLyricsH = Math.max(120, lyricsBottomY - lyricsTopY);

  const visibleLines = stanza.lines.length > 0
    ? stanza.lines
    : [{ id: 'empty', text: '(Instrumental)', startTime: stanza.startTime, endTime: stanza.endTime }];

  let fontSize = aspectRatio === '16:9' ? 42 : aspectRatio === '9:16' ? 54 : 48;
  const minFontSize = 24;
  let wrappedLayout: Array<{
    isActive: boolean;
    isInstrumental: boolean;
    subLines: string[];
  }> = [];
  let lineHeight = fontSize * 1.28;
  let stanzaLineGap = fontSize * 0.48;

  while (fontSize >= minFontSize) {
    lineHeight = fontSize * 1.26;
    stanzaLineGap = fontSize * 0.42;
    let totalH = 0;
    const attempt: typeof wrappedLayout = [];

    for (const line of visibleLines) {
      const isActive = Boolean(activeLineId && line.id === activeLineId);
      const isInstrumental = line.text.startsWith('(') && line.text.endsWith(')');
      ctx.font = `${isActive ? 700 : 500} ${fontSize}px "Outfit", system-ui, sans-serif`;
      const subLines = wrapText(ctx, line.text, innerW);
      attempt.push({ isActive, isInstrumental, subLines });
      totalH += subLines.length * lineHeight + stanzaLineGap;
    }
    totalH -= stanzaLineGap;

    if (totalH <= availableLyricsH || fontSize === minFontSize) {
      wrappedLayout = attempt;
      break;
    }
    fontSize -= 2;
  }

  // Compute actual total height to vertically center nicely in the stanza box
  const totalRenderedH = wrappedLayout.reduce(
    (acc, item, idx) =>
      acc +
      item.subLines.length * lineHeight +
      (idx < wrappedLayout.length - 1 ? stanzaLineGap : 0),
    0,
  );
  let cursorY =
    lyricsTopY + Math.max(0, (availableLyricsH - totalRenderedH) * 0.42) + fontSize;

  for (const item of wrappedLayout) {
    ctx.font = `${item.isActive ? 700 : 500} ${fontSize}px "Outfit", system-ui, sans-serif`;
    ctx.fillStyle = item.isInstrumental
      ? palette.instrumentalColor
      : item.isActive
        ? palette.activeLine
        : palette.lyricColor;

    for (const sub of item.subLines) {
      if (cursorY <= lyricsBottomY + 8) {
        ctx.fillText(sub, innerX, cursorY);
      }
      cursorY += lineHeight;
    }
    cursorY += stanzaLineGap;
  }

  // 6. Harmonic Energy Strip above Footer
  const waveY = footerTopY + 14;
  const barCount = 48;
  const barGap = 6;
  const barW = (innerW - barGap * (barCount - 1)) / barCount;
  const energyRatio = Math.min(1, Math.max(0.25, stanza.energy / 10));

  for (let i = 0; i < barCount; i++) {
    const seed =
      Math.abs(Math.sin(i * 0.47 + stanza.startTime * 0.3)) * 0.65 +
      Math.abs(Math.cos(i * 0.23 + analysis.bpm * 0.05)) * 0.35;
    const h = 6 + seed * 22 * energyRatio;
    const progress = i / barCount;
    ctx.fillStyle = progress <= energyRatio ? palette.waveActive : palette.waveMuted;
    ctx.fillRect(innerX + i * (barW + barGap), waveY + (28 - h), barW, h);
  }

  // Footer Divider
  const footerDivY = waveY + 42;
  ctx.strokeStyle = palette.divider;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(innerX, footerDivY);
  ctx.lineTo(innerX + innerW, footerDivY);
  ctx.stroke();

  // 7. Footer Song & Brand Lockup
  const titleY = footerDivY + 42;
  ctx.font = '700 30px "Outfit", system-ui, sans-serif';
  ctx.fillStyle = palette.titleColor;
  const maxTitleW = innerW - 180;
  let titleText = analysis.title;
  while (titleText.length > 3 && ctx.measureText(titleText).width > maxTitleW) {
    titleText = `${titleText.slice(0, -2)}…`;
  }
  ctx.fillText(titleText, innerX, titleY);

  const subtitleParts = [analysis.artist];
  if (includeMetadata) {
    subtitleParts.push(`${analysis.bpm} BPM`, analysis.musicalKey);
  }
  ctx.font = '400 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = palette.artistColor;
  let subText = subtitleParts.join(' · ');
  while (subText.length > 3 && ctx.measureText(subText).width > maxTitleW) {
    subText = `${subText.slice(0, -2)}…`;
  }
  ctx.fillText(subText, innerX, titleY + 32);

  // Estrofa Wordmark on Right
  ctx.save();
  ctx.textAlign = 'right';
  ctx.font = '700 28px "Outfit", system-ui, sans-serif';
  ctx.fillStyle = palette.labelColor;
  ctx.fillText('Estrofa', innerX + innerW, titleY + 12);
  ctx.restore();

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('No se pudo generar la imagen PNG.'));
      },
      'image/png',
      1,
    );
  });
}
