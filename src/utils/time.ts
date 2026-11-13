import { LyricLine, SongAnalysis, Stanza } from '../types/song';

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatTimePrecise(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00.0';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
}

export interface PlaybackLocation {
  stanza: Stanza | null;
  stanzaIndex: number;
  line: LyricLine | null;
  lineIndexInStanza: number;
  lineProgress: number; // 0 to 1
  nextVocalStart: number | null;
  countdownSeconds: number | null;
}

export function getPlaybackLocation(
  analysis: SongAnalysis,
  adjustedTime: number,
): PlaybackLocation {
  const { stanzas } = analysis;
  if (!stanzas.length) {
    return {
      stanza: null,
      stanzaIndex: -1,
      line: null,
      lineIndexInStanza: -1,
      lineProgress: 0,
      nextVocalStart: null,
      countdownSeconds: null,
    };
  }

  let stanzaIndex = stanzas.findIndex(
    (s) => adjustedTime >= s.startTime && adjustedTime <= s.endTime,
  );

  // If between stanzas, check which stanza is closest upcoming or just finished
  if (stanzaIndex === -1) {
    const upcomingIdx = stanzas.findIndex((s) => adjustedTime < s.startTime);
    if (upcomingIdx !== -1) {
      // If we are close (within 0.6s) or in an intro before first stanza
      stanzaIndex = upcomingIdx === 0 ? 0 : upcomingIdx - 1;
    } else {
      stanzaIndex = stanzas.length - 1;
    }
  }

  const stanza = stanzas[stanzaIndex] ?? null;
  let line: LyricLine | null = null;
  let lineIndexInStanza = -1;
  let lineProgress = 0;

  if (stanza) {
    lineIndexInStanza = stanza.lines.findIndex(
      (l) => adjustedTime >= l.startTime && adjustedTime <= l.endTime,
    );

    if (lineIndexInStanza !== -1) {
      line = stanza.lines[lineIndexInStanza];
      const span = Math.max(0.1, line.endTime - line.startTime);
      lineProgress = Math.min(1, Math.max(0, (adjustedTime - line.startTime) / span));
    }
  }

  // Find next non-instrumental line for countdown indicator during long gaps
  let nextVocalStart: number | null = null;
  let countdownSeconds: number | null = null;

  if (!line || line.text === '(Instrumental)') {
    for (const s of stanzas) {
      for (const l of s.lines) {
        if (l.text !== '(Instrumental)' && l.startTime > adjustedTime) {
          nextVocalStart = l.startTime;
          const remaining = l.startTime - adjustedTime;
          if (remaining <= 4.0 && remaining > 0.1) {
            countdownSeconds = Math.ceil(remaining);
          }
          break;
        }
      }
      if (nextVocalStart !== null) break;
    }
  }

  return {
    stanza,
    stanzaIndex,
    line,
    lineIndexInStanza,
    lineProgress,
    nextVocalStart,
    countdownSeconds,
  };
}
