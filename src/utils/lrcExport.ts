import { SongAnalysis } from '../types/song';

function toLrcTag(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const centis = Math.floor((safe % 1) * 100);
  return `[${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}]`;
}

export function exportAnalysisToLrc(analysis: SongAnalysis): void {
  const lines: string[] = [
    `[ti:${analysis.title}]`,
    `[ar:${analysis.artist}]`,
    `[by:Estrofa]`,
    '',
  ];

  for (const stanza of analysis.stanzas) {
    lines.push(`[${stanza.label}]`);
    for (const line of stanza.lines) {
      lines.push(`${toLrcTag(line.startTime)} ${line.text}`);
    }
    lines.push('');
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = analysis.title
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñ]+/gi, '-')
    .replace(/^-|-$/g, '');
  a.download = `${safeName || 'letra-sincronizada'}.lrc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
