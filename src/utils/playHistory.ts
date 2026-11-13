import { SongTrack } from '../types/song';

export interface PlayHistoryEntry {
  trackId: string;
  title: string;
  artist: string;
  bpm: number;
  musicalKey: string;
  durationSec: number;
  lastPlayedAt: number;
  lastPositionSec: number;
  playCount: number;
}

const STORAGE_KEY = 'estrofa_recent_history_v1';
const MAX_HISTORY_ITEMS = 12;

export function loadPlayHistory(): PlayHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is PlayHistoryEntry =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as PlayHistoryEntry).trackId === 'string' &&
          typeof (item as PlayHistoryEntry).title === 'string',
      )
      .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
      .slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

function savePlayHistory(entries: PlayHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function recordTrackPlayed(
  prev: PlayHistoryEntry[],
  track: SongTrack,
  positionSec: number,
  incrementCount = true,
): PlayHistoryEntry[] {
  const existing = prev.find((e) => e.trackId === track.id);
  const now = Date.now();
  const safePos = Math.max(0, Math.min(track.analysis.durationSec, positionSec));

  const nextEntry: PlayHistoryEntry = {
    trackId: track.id,
    title: track.analysis.title,
    artist: track.analysis.artist,
    bpm: track.analysis.bpm,
    musicalKey: track.analysis.musicalKey,
    durationSec: track.analysis.durationSec,
    lastPlayedAt: now,
    lastPositionSec: safePos,
    playCount: existing
      ? existing.playCount + (incrementCount ? 1 : 0)
      : 1,
  };

  const next = [
    nextEntry,
    ...prev.filter((e) => e.trackId !== track.id),
  ].slice(0, MAX_HISTORY_ITEMS);

  savePlayHistory(next);
  return next;
}

export function updateHistoryProgress(
  prev: PlayHistoryEntry[],
  trackId: string,
  positionSec: number,
): PlayHistoryEntry[] {
  const idx = prev.findIndex((e) => e.trackId === trackId);
  if (idx === -1) return prev;
  const target = prev[idx];
  const next = prev.slice();
  next[idx] = {
    ...target,
    lastPositionSec: Math.max(0, Math.min(target.durationSec, positionSec)),
  };
  savePlayHistory(next);
  return next;
}

export function removeHistoryItem(
  prev: PlayHistoryEntry[],
  trackId: string,
): PlayHistoryEntry[] {
  const next = prev.filter((e) => e.trackId !== trackId);
  savePlayHistory(next);
  return next;
}

export function clearAllHistory(): PlayHistoryEntry[] {
  savePlayHistory([]);
  return [];
}

export function formatRelativeTimeEs(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return 'Hace un momento';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ayer';
  return `Hace ${diffDays} días`;
}
