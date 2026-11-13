import { SongAnalysis, SongTrack } from '../types/song';

const DB_NAME = 'estrofa_library_v1';
const STORE_NAME = 'songs';

interface StoredSongRecord {
  id: string;
  sourceType?: 'audio' | 'youtube';
  youtubeVideoId?: string;
  fileName?: string;
  createdAt: number;
  audioBlob?: Blob;
  analysis: SongAnalysis;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAnalyzedSong(
  id: string,
  audioBlob: Blob,
  analysis: SongAnalysis,
  fileName?: string,
): Promise<SongTrack> {
  const createdAt = Date.now();
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({
        id,
        sourceType: 'audio',
        fileName,
        createdAt,
        audioBlob,
        analysis,
      } satisfies StoredSongRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB save failed, keeping song in session memory:', err);
  }

  return {
    id,
    isDemo: false,
    sourceType: 'audio',
    fileName,
    createdAt,
    audioUrl: URL.createObjectURL(audioBlob),
    analysis,
  };
}

export async function saveYouTubeSong(
  id: string,
  youtubeVideoId: string,
  analysis: SongAnalysis,
): Promise<SongTrack> {
  const createdAt = Date.now();
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({
        id,
        sourceType: 'youtube',
        youtubeVideoId,
        createdAt,
        analysis,
      } satisfies StoredSongRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB save failed for YouTube track:', err);
  }

  return {
    id,
    isDemo: false,
    sourceType: 'youtube',
    youtubeVideoId,
    createdAt,
    audioUrl: '',
    analysis,
  };
}

export async function updateSavedAnalysis(id: string, analysis: SongAnalysis): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result as StoredSongRecord | undefined;
        if (record) {
          record.analysis = analysis;
          store.put(record);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB update failed:', err);
  }
}

export async function loadSavedSongs(): Promise<SongTrack[]> {
  try {
    const db = await openDb();
    const records = await new Promise<StoredSongRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result as StoredSongRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });

    return records
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((rec) => ({
        id: rec.id,
        isDemo: false,
        sourceType: rec.sourceType ?? (rec.youtubeVideoId ? 'youtube' : 'audio'),
        youtubeVideoId: rec.youtubeVideoId,
        fileName: rec.fileName,
        createdAt: rec.createdAt,
        audioUrl: rec.audioBlob ? URL.createObjectURL(rec.audioBlob) : '',
        analysis: rec.analysis,
      }));
  } catch {
    return [];
  }
}

export async function deleteSavedSong(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB delete failed:', err);
  }
}
