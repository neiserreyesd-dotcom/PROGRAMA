import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface RawLine {
  text?: string;
  startTime?: number;
  endTime?: number;
}

interface RawStanza {
  label?: string;
  type?: string;
  startTime?: number;
  endTime?: number;
  chords?: string[];
  energy?: number;
  singingTip?: string;
  lines?: RawLine[];
}

interface RawSongAnalysis {
  title?: string;
  artist?: string;
  bpm?: number;
  musicalKey?: string;
  timeSignature?: string;
  genre?: string;
  mood?: string;
  vocalRange?: string;
  summary?: string;
  stanzas?: RawStanza[];
}

const VALID_STANZA_TYPES = new Set([
  'intro',
  'verse',
  'prechorus',
  'chorus',
  'bridge',
  'solo',
  'outro',
]);

const ANALYSIS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Título de la canción.' },
    artist: { type: Type.STRING, description: 'Intérprete o artista si se identifica.' },
    bpm: { type: Type.NUMBER, description: 'Tempo estimado en pulsos por minuto.' },
    musicalKey: { type: Type.STRING, description: 'Tonalidad estimada en español.' },
    timeSignature: { type: Type.STRING, description: 'Compás, por ejemplo 4/4.' },
    genre: { type: Type.STRING, description: 'Género o estilo musical.' },
    mood: { type: Type.STRING, description: 'Carácter o atmósfera emocional.' },
    vocalRange: { type: Type.STRING, description: 'Tesitura o registro vocal sugerido.' },
    summary: {
      type: Type.STRING,
      description: 'Resumen musical y guía breve de interpretación vocal en 2 frases.',
    },
    stanzas: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: {
            type: Type.STRING,
            description: 'Nombre de la sección: Intro, Estrofa 1, Pre-Coro, Coro, Puente, Outro.',
          },
          type: {
            type: Type.STRING,
            description: 'Uno de: intro, verse, prechorus, chorus, bridge, solo, outro.',
          },
          startTime: { type: Type.NUMBER },
          endTime: { type: Type.NUMBER },
          chords: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          energy: { type: Type.NUMBER, description: 'Intensidad del 1 al 10.' },
          singingTip: {
            type: Type.STRING,
            description: 'Indicación práctica para cantar esta estrofa.',
          },
          lines: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                startTime: { type: Type.NUMBER },
                endTime: { type: Type.NUMBER },
              },
              required: ['text', 'startTime', 'endTime'],
            },
          },
        },
        required: ['label', 'type', 'startTime', 'endTime', 'lines'],
      },
    },
  },
  required: ['title', 'bpm', 'musicalKey', 'summary', 'stanzas'],
};

interface YouTubeCaptionLine {
  startTime: number;
  endTime: number;
  text: string;
}

function extractYouTubeVideoIdServer(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const vParam = url.searchParams.get('v');
      if (vParam && /^[A-Za-z0-9_-]{11}$/.test(vParam)) return vParam;

      const segments = url.pathname.split('/').filter(Boolean);
      if (
        segments.length >= 2 &&
        (segments[0] === 'embed' ||
          segments[0] === 'shorts' ||
          segments[0] === 'live' ||
          segments[0] === 'v')
      ) {
        const candidate = segments[1];
        return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function extractJsonObjectAfterToken(source: string, token: string): Record<string, unknown> | null {
  const idx = source.indexOf(token);
  if (idx === -1) return null;

  const startBrace = source.indexOf('{', idx + token.length);
  if (startBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startBrace; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(startBrace, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

async function fetchYouTubeContext(videoId: string): Promise<{
  title: string;
  author: string;
  durationSec: number;
  shortDescription: string;
  captions: YouTubeCaptionLine[];
}> {
  let title = '';
  let author = '';
  let durationSec = 210;
  let shortDescription = '';
  const captions: YouTubeCaptionLine[] = [];

  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (oembedRes.ok) {
      const oembed = (await oembedRes.json()) as { title?: string; author_name?: string };
      title = (oembed.title ?? '').trim();
      author = (oembed.author_name ?? '').trim();
    }
  } catch {
    // Continue to watch page fallback
  }

  try {
    const watchRes = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=es`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (watchRes.ok) {
      const html = await watchRes.text();
      const playerResp =
        extractJsonObjectAfterToken(html, 'var ytInitialPlayerResponse = ') ??
        extractJsonObjectAfterToken(html, 'ytInitialPlayerResponse = ');

      if (playerResp) {
        const videoDetails = playerResp.videoDetails as
          | {
              title?: string;
              author?: string;
              lengthSeconds?: string;
              shortDescription?: string;
            }
          | undefined;

        if (videoDetails) {
          if (!title && videoDetails.title) title = videoDetails.title.trim();
          if (!author && videoDetails.author) author = videoDetails.author.trim();
          if (videoDetails.lengthSeconds) {
            const parsedLen = Number(videoDetails.lengthSeconds);
            if (Number.isFinite(parsedLen) && parsedLen > 0) durationSec = parsedLen;
          }
          if (videoDetails.shortDescription) {
            shortDescription = videoDetails.shortDescription.slice(0, 2200);
          }
        }

        const captionsRoot = playerResp.captions as
          | {
              playerCaptionsTracklistRenderer?: {
                captionTracks?: Array<{
                  baseUrl?: string;
                  languageCode?: string;
                  kind?: string;
                }>;
              };
            }
          | undefined;

        const tracks = captionsRoot?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
        const preferredTrack =
          tracks.find((t) => t.kind !== 'asr' && t.baseUrl) ??
          tracks.find((t) => Boolean(t.baseUrl));

        if (preferredTrack?.baseUrl) {
          const json3Url = preferredTrack.baseUrl.includes('fmt=')
            ? preferredTrack.baseUrl.replace(/fmt=[^&]+/, 'fmt=json3')
            : `${preferredTrack.baseUrl}&fmt=json3`;

          const capRes = await fetch(json3Url, { signal: AbortSignal.timeout(6000) });
          if (capRes.ok) {
            const capData = (await capRes.json()) as {
              events?: Array<{
                tStartMs?: number;
                dDurationMs?: number;
                segs?: Array<{ utf8?: string }>;
              }>;
            };

            for (const ev of capData.events ?? []) {
              if (!Array.isArray(ev.segs) || typeof ev.tStartMs !== 'number') continue;
              const rawLine = ev.segs
                .map((s) => s.utf8 ?? '')
                .join('')
                .replace(/\s+/g, ' ')
                .trim();

              if (!rawLine || rawLine === '♪' || rawLine === '[Música]' || rawLine === '[Music]') {
                continue;
              }
              const startTime = Number((ev.tStartMs / 1000).toFixed(2));
              const durMs = typeof ev.dDurationMs === 'number' && ev.dDurationMs > 300 ? ev.dDurationMs : 2800;
              const endTime = Number(((ev.tStartMs + durMs) / 1000).toFixed(2));
              captions.push({ startTime, endTime, text: rawLine });
            }
          }
        }
      }
    }
  } catch {
    // Gracefully rely on oEmbed + Gemini search grounding
  }

  return {
    title: title || `Video de YouTube (${videoId})`,
    author: author || 'Canal de YouTube',
    durationSec,
    shortDescription,
    captions,
  };
}

function normalizeAnalysis(raw: RawSongAnalysis, fallbackTitle: string, durationSec: number) {
  const safeDuration = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 180;
  const stanzasInput = Array.isArray(raw.stanzas) ? raw.stanzas : [];

  let cursor = 0;
  const stanzas = stanzasInput.map((stanza, sIdx) => {
    const rawLines = Array.isArray(stanza.lines) ? stanza.lines : [];
    const lines = rawLines.map((line, lIdx) => {
      const start = Math.max(cursor, Math.min(safeDuration - 0.5, Number(line.startTime ?? cursor)));
      const rawEnd = Number(line.endTime ?? start + 3);
      const end = Math.max(start + 0.4, Math.min(safeDuration, rawEnd));
      cursor = end;
      return {
        id: `s-${sIdx}-l-${lIdx}`,
        text: (line.text ?? '').trim() || '(Instrumental)',
        startTime: Number(start.toFixed(2)),
        endTime: Number(end.toFixed(2)),
      };
    });

    const firstLineStart = lines[0]?.startTime;
    const lastLineEnd = lines[lines.length - 1]?.endTime;
    const stanzaStart = Number(
      Math.max(
        0,
        Math.min(
          safeDuration - 0.5,
          firstLineStart !== undefined ? firstLineStart : Number(stanza.startTime ?? 0),
        ),
      ).toFixed(2),
    );
    const stanzaEnd = Number(
      Math.max(
        stanzaStart + 0.5,
        Math.min(
          safeDuration,
          lastLineEnd !== undefined ? lastLineEnd : Number(stanza.endTime ?? stanzaStart + 8),
        ),
      ).toFixed(2),
    );

    const type = VALID_STANZA_TYPES.has(String(stanza.type)) ? String(stanza.type) : 'verse';
    const energy = Math.min(10, Math.max(1, Math.round(Number(stanza.energy ?? 5))));

    return {
      id: `stanza-${sIdx}`,
      label: (stanza.label ?? '').trim() || `Estrofa ${sIdx + 1}`,
      type,
      startTime: stanzaStart,
      endTime: stanzaEnd,
      chords: Array.isArray(stanza.chords) ? stanza.chords.slice(0, 8) : [],
      energy,
      singingTip: (stanza.singingTip ?? '').trim() || 'Mantén una respiración constante y sigue el pulso.',
      lines,
    };
  });

  return {
    title: (raw.title ?? '').trim() || fallbackTitle,
    artist: (raw.artist ?? '').trim() || 'Artista no especificado',
    durationSec: Number(safeDuration.toFixed(2)),
    bpm: Math.max(40, Math.min(240, Math.round(Number(raw.bpm ?? 100)))),
    musicalKey: (raw.musicalKey ?? '').trim() || 'Do mayor',
    timeSignature: (raw.timeSignature ?? '').trim() || '4/4',
    genre: (raw.genre ?? '').trim() || 'Música contemporánea',
    mood: (raw.mood ?? '').trim() || 'Expresiva',
    vocalRange: (raw.vocalRange ?? '').trim() || 'Registro medio',
    summary:
      (raw.summary ?? '').trim() ||
      'Estructura vocal analizada por secciones para facilitar la lectura y el canto en tiempo real.',
    stanzas,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '45mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post(
    '/api/analyze-song',
    express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '120mb' }),
    async (req, res) => {
      let uploadedFileName: string | null = null;
      try {
        let audioBuffer: Buffer | null = null;
        let mimeType = '';
        let fileName = '';
        let durationSec = 180;
        let providedLyrics = '';

        if (Buffer.isBuffer(req.body)) {
          audioBuffer = req.body;
          mimeType = String(req.headers['x-mime-type'] || 'audio/mp3');
          fileName = decodeURIComponent(String(req.headers['x-file-name'] || 'Cancion'));
          durationSec = Number(req.headers['x-duration-sec'] || 180);
          const lyricsB64 = String(req.headers['x-provided-lyrics-b64'] || '');
          if (lyricsB64) {
            providedLyrics = Buffer.from(lyricsB64, 'base64').toString('utf8');
          }
        } else {
          const body = (req.body ?? {}) as {
            audioBase64?: string;
            mimeType?: string;
            fileName?: string;
            durationSec?: number;
            providedLyrics?: string;
          };
          if (body.audioBase64) {
            audioBuffer = Buffer.from(body.audioBase64, 'base64');
          }
          mimeType = body.mimeType || 'audio/mp3';
          fileName = body.fileName || 'Canción analizada';
          durationSec = Number(body.durationSec || 180);
          providedLyrics = body.providedLyrics || '';
        }

        if (!audioBuffer || audioBuffer.length === 0 || !mimeType) {
          res.status(400).json({ error: 'Falta el archivo de audio para analizar.' });
          return;
        }

        if (!process.env.GEMINI_API_KEY) {
          res.status(500).json({
            error: 'No se encontró GEMINI_API_KEY en el servidor. Configúrala en Settings > Secrets.',
          });
          return;
        }

        const cleanTitle = (fileName || 'Canción analizada')
          .replace(/\.[^/.]+$/, '')
          .replace(/[_-]+/g, ' ')
          .trim();

        const safeDuration = Number(durationSec) > 0 ? Number(durationSec) : 180;

        const lyricsGuidance = providedLyrics.trim()
          ? `\nEl usuario proporcionó la letra de referencia para alinearla con precisión al audio:\n"""\n${providedLyrics.trim()}\n"""\nRespeta esa letra exacta, divídela en estrofas musicales coherentes y asigna los tiempos reales en segundos (startTime, endTime) escuchando cuándo se canta cada verso en el audio.`
          : `\nTranscribe fielmente toda la letra cantada en su idioma original escuchando el audio completo, y agrúpala en estrofas musicales coherentes (Intro, Estrofa 1, Pre-Coro, Coro, Estrofa 2, Puente, Outro, etc.). Si hay tramos instrumentales largos (intro, solo, outro), inclúyelos como estrofas con una línea "(Instrumental)" para que el cantante vea el conteo.`;

        const promptText = `Eres un productor musical y director vocal experto. Analiza el archivo de audio completo (${cleanTitle}, duración total aproximada: ${safeDuration.toFixed(1)} segundos).
${lyricsGuidance}

Reglas estrictas para las marcas de tiempo:
1. Todos los valores startTime y endTime deben expresarse en segundos decimales (por ejemplo 12.4) dentro del rango 0 a ${safeDuration.toFixed(1)}.
2. Los tiempos deben ser estrictamente crecientes y sincronizados con el momento exacto en que la voz canta cada frase.
3. Cada estrofa debe reflejar claramente la estructura de la canción (intro, verse, prechorus, chorus, bridge, solo, outro) con un título claro en español (ej. "Estrofa 1", "Coro", "Puente") y un consejo vocal breve y práctico para cantarla.
4. Estima el BPM, la tonalidad musical en español (ej. "La menor", "Sol mayor"), el compás, los acordes principales de cada estrofa (ej. ["Am", "F", "C", "G"]), el nivel de energía (1 a 10) y el registro vocal recomendado.`;

        const INLINE_THRESHOLD_BYTES = 14 * 1024 * 1024;
        let audioPart:
          | { inlineData: { mimeType: string; data: string } }
          | { fileData: { fileUri: string; mimeType: string } };

        if (audioBuffer.length <= INLINE_THRESHOLD_BYTES) {
          audioPart = {
            inlineData: {
              mimeType,
              data: audioBuffer.toString('base64'),
            },
          };
        } else {
          const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
          let uploaded = await ai.files.upload({
            file: blob,
            config: { mimeType },
          });
          uploadedFileName = uploaded.name ?? null;

          // Poll briefly if Gemini needs a moment to process large audio
          let attempts = 0;
          while (uploaded.state === 'PROCESSING' && uploaded.name && attempts < 15) {
            await new Promise((r) => setTimeout(r, 1500));
            uploaded = await ai.files.get({ name: uploaded.name });
            attempts += 1;
          }

          if (uploaded.state === 'FAILED' || !uploaded.uri) {
            throw new Error('No se pudo procesar el archivo de audio grande en el servicio de análisis.');
          }

          audioPart = {
            fileData: {
              fileUri: uploaded.uri,
              mimeType: uploaded.mimeType || mimeType,
            },
          };
        }

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: {
            parts: [audioPart, { text: promptText }],
          },
          config: {
            systemInstruction:
              'Analiza música y voz con precisión temporal para canto en tiempo real. Devuelve únicamente JSON válido según el esquema solicitado.',
            responseMimeType: 'application/json',
            responseSchema: ANALYSIS_RESPONSE_SCHEMA,
          },
        });

        const rawText = (response.text ?? '{}').trim();
        let parsed: RawSongAnalysis;
        try {
          parsed = JSON.parse(rawText) as RawSongAnalysis;
        } catch {
          res.status(502).json({
            error: 'La respuesta del análisis musical no tuvo el formato esperado. Intenta de nuevo.',
          });
          return;
        }

        const analysis = normalizeAnalysis(parsed, cleanTitle, safeDuration);
        res.json({ analysis });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error inesperado al analizar el audio.';
        console.error('Error in /api/analyze-song:', error);

        if (message.includes('403') || message.includes('PERMISSION_DENIED') || message.includes('API_KEY_INVALID')) {
          res.status(403).json({
            error: 'Verifica tu clave GEMINI_API_KEY en el panel Settings > Secrets.',
          });
          return;
        }
        if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
          res.status(429).json({
            error: 'Se alcanzó el límite temporal de solicitudes. Espera unos segundos e inténtalo de nuevo.',
          });
          return;
        }

        res.status(500).json({ error: `No se pudo completar el análisis: ${message}` });
      } finally {
        if (uploadedFileName) {
          void ai.files.delete({ name: uploadedFileName }).catch(() => {
            // Best-effort cleanup of temporary Gemini file
          });
        }
      }
    },
  );

  app.post('/api/analyze-youtube', async (req, res) => {
    try {
      const body = (req.body ?? {}) as {
        youtubeUrl?: string;
        providedLyrics?: string;
      };
      const youtubeUrl = String(body.youtubeUrl ?? '').trim();
      const providedLyrics = String(body.providedLyrics ?? '').trim();

      const videoId = extractYouTubeVideoIdServer(youtubeUrl);
      if (!videoId) {
        res.status(400).json({
          error: 'Introduce un enlace válido de YouTube (por ejemplo https://www.youtube.com/watch?v=...).',
        });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({
          error: 'No se encontró GEMINI_API_KEY en el servidor. Configúrala en Settings > Secrets.',
        });
        return;
      }

      const yt = await fetchYouTubeContext(videoId);
      const safeDuration = yt.durationSec > 10 ? yt.durationSec : 210;
      const hasUsableCaptions = yt.captions.length >= 4;

      let structuredPrompt = '';

      if (hasUsableCaptions && !providedLyrics) {
        const captionsDump = yt.captions
          .slice(0, 260)
          .map((c) => `[${c.startTime.toFixed(2)} - ${c.endTime.toFixed(2)}] ${c.text}`)
          .join('\n');

        structuredPrompt = `Eres un productor musical y director vocal experto.
Debes estructurar esta canción de YouTube para canto en tiempo real con estrofas destacadas:
- Título del video: ${yt.title}
- Canal / Artista: ${yt.author}
- Duración total: ${safeDuration.toFixed(1)} segundos

El video incluye estos subtítulos reales cronometrados (en segundos):
${captionsDump}

Instrucciones estrictas:
1. Conserva los versos y sus tiempos reales (startTime y endTime en segundos, estrictamente crecientes entre 0 y ${safeDuration.toFixed(1)}) basándote fielmente en los subtítulos cronometrados.
2. Agrúpalos en estrofas musicales claras en español ("Intro", "Estrofa 1", "Pre-Coro", "Coro", "Estrofa 2", "Puente", "Outro", etc.). Si hay un tramo inicial sin voz > 4s, añade una estrofa "Intro" con "(Instrumental)".
3. Identifica el título real de la canción y su artista limpio (sin palabras como "Official Video", "Lyrics", "HD"), estima el BPM, la tonalidad en español (ej. "La menor"), acordes por estrofa, nivel de energía (1-10), registro vocal y un consejo vocal breve por estrofa.`;
      } else {
        let lyricsSourceText = providedLyrics;

        if (!lyricsSourceText) {
          // Step 1: Search grounding to retrieve lyrics and musical metadata for this YouTube song
          const searchPrompt = `Busca la letra completa oficial en su idioma original y los datos musicales (artista real, título exacto de la canción, BPM aproximado y tonalidad musical) para este video de YouTube:
Título del video: "${yt.title}"
Canal: "${yt.author}"
URL: https://www.youtube.com/watch?v=${videoId}
${yt.shortDescription ? `Descripción del video:\n${yt.shortDescription.slice(0, 1000)}` : ''}

Devuelve:
1. Artista y título limpio de la canción.
2. BPM aproximado, tonalidad y género.
3. La letra completa organizada por estrofas (Intro si aplica, Estrofa 1, Pre-Coro, Coro, Estrofa 2, Puente, Outro).`;

          const groundedRes = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: searchPrompt,
            config: {
              tools: [{ googleSearch: {} }],
            },
          });

          lyricsSourceText = (groundedRes.text ?? '').trim();
        }

        const captionAnchors =
          hasUsableCaptions
            ? `\nAdemás, como referencia temporal real del video, estos son algunos fragmentos cronometrados detectados:\n${yt.captions
                .slice(0, 90)
                .map((c) => `[${c.startTime.toFixed(1)}s] ${c.text}`)
                .join('\n')}`
            : '';

        structuredPrompt = `Eres un productor musical y director vocal experto.
Prepara esta canción de YouTube para cantarla en tiempo real con el video reproduciéndose de 0 a ${safeDuration.toFixed(1)} segundos:
- Título del video: ${yt.title}
- Canal: ${yt.author}
- Duración del video: ${safeDuration.toFixed(1)} segundos

Letra e información de referencia:
"""
${lyricsSourceText || yt.shortDescription || yt.title}
"""
${captionAnchors}

Reglas estrictas:
1. Organiza la letra en estrofas musicales coherentes ("Intro", "Estrofa 1", "Pre-Coro", "Coro", "Estrofa 2", "Puente", "Outro", etc.) con versos claros para leer mientras suena el video.
2. Asigna tiempos realistas y estrictamente crecientes (startTime y endTime en segundos, desde ~4-12s si hay intro instrumental hasta ~${Math.max(15, safeDuration - 5).toFixed(1)}s) distribuidos proporcionalmente a lo largo de la duración real del video (${safeDuration.toFixed(1)}s)${hasUsableCaptions ? ', alineando con los tiempos reales de referencia proporcionados' : ''}.
3. Incluye una estrofa "Intro" con "(Instrumental)" si la voz entra después de los primeros segundos.
4. Estima el título limpio, artista real, BPM, tonalidad en español, compás, género, atmósfera, registro vocal, acordes principales por estrofa, energía (1-10) y consejo breve para cantar cada estrofa.`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: structuredPrompt,
        config: {
          systemInstruction:
            'Analiza canciones y sincroniza su letra por estrofas para canto en tiempo real junto a un video de YouTube. Devuelve únicamente JSON válido según el esquema.',
          responseMimeType: 'application/json',
          responseSchema: ANALYSIS_RESPONSE_SCHEMA,
        },
      });

      const rawText = (response.text ?? '{}').trim();
      let parsed: RawSongAnalysis;
      try {
        parsed = JSON.parse(rawText) as RawSongAnalysis;
      } catch {
        res.status(502).json({
          error: 'La respuesta del análisis de YouTube no tuvo el formato esperado. Intenta de nuevo.',
        });
        return;
      }

      const analysis = normalizeAnalysis(parsed, yt.title, safeDuration);
      res.json({ videoId, analysis });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al analizar el enlace de YouTube.';
      console.error('Error in /api/analyze-youtube:', error);

      if (message.includes('403') || message.includes('PERMISSION_DENIED') || message.includes('API_KEY_INVALID')) {
        res.status(403).json({
          error: 'Verifica tu clave GEMINI_API_KEY en el panel Settings > Secrets.',
        });
        return;
      }
      if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
        res.status(429).json({
          error: 'Se alcanzó el límite temporal de solicitudes. Espera unos segundos e inténtalo de nuevo.',
        });
        return;
      }

      res.status(500).json({ error: `No se pudo analizar el video de YouTube: ${message}` });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Estrofa server listening on http://localhost:${PORT}`);
  });
}

startServer();
