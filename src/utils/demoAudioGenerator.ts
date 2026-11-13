import { SongAnalysis, SongTrack } from '../types/song';

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

interface SynthTrackSpec {
  id: string;
  analysis: SongAnalysis;
  chordProgression: number[][]; // MIDI notes per bar
  bassNotes: number[]; // MIDI note per bar
  melodyPattern: Array<{ barOffset: number; beat: number; dur: number; midi: number }>;
  groove: 'ballad' | 'synth';
}

function encodeWavStereo(left: Float32Array, right: Float32Array, sampleRate: number): Blob {
  const numSamples = left.length;
  const buffer = new ArrayBuffer(44 + numSamples * 4);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 4, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 2, true); // Stereo
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 4, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    view.setInt16(offset + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    offset += 4;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function synthesizeTrack(spec: SynthTrackSpec): string {
  const sampleRate = 22050;
  const duration = spec.analysis.durationSec;
  const totalSamples = Math.floor(sampleRate * duration);
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  const beatDur = 60 / spec.analysis.bpm;
  const barDur = beatDur * 4;
  const totalBars = Math.ceil(duration / barDur);

  // Add warm stereo electric piano chords & bass per bar
  for (let bar = 0; bar < totalBars; bar++) {
    const barStart = bar * barDur;
    const chord = spec.chordProgression[bar % spec.chordProgression.length];
    const bassMidi = spec.bassNotes[bar % spec.bassNotes.length];
    const barEnd = Math.min(duration, barStart + barDur);
    const startSample = Math.floor(barStart * sampleRate);
    const endSample = Math.floor(barEnd * sampleRate);

    // Check stanza energy at bar midpoint for dynamics
    const midTime = barStart + barDur * 0.5;
    const activeStanza = spec.analysis.stanzas.find(
      (s) => midTime >= s.startTime && midTime <= s.endTime,
    );
    const energyScale = activeStanza ? 0.5 + (activeStanza.energy / 10) * 0.55 : 0.65;

    for (let i = startSample; i < endSample; i++) {
      const t = i / sampleRate;
      const localT = t - barStart;
      const env =
        Math.min(1, localT / 0.04) *
        Math.exp(-localT * (spec.groove === 'ballad' ? 0.65 : 1.1)) *
        energyScale;

      // Warm Rhodes-like chord voices with subtle stereo spread
      let chordL = 0;
      let chordR = 0;
      for (let c = 0; c < chord.length; c++) {
        const freq = midiToFreq(chord[c]);
        const osc =
          Math.sin(2 * Math.PI * freq * t) * 0.65 +
          Math.sin(2 * Math.PI * freq * 2 * t) * 0.14 * Math.exp(-localT * 3.0);
        const pan = (c / Math.max(1, chord.length - 1)) * 0.5 - 0.25;
        chordL += osc * (0.5 - pan);
        chordR += osc * (0.5 + pan);
      }
      chordL = (chordL / chord.length) * 0.26 * env;
      chordR = (chordR / chord.length) * 0.26 * env;

      // Deep warm bass on beat 1 & beat 3
      const beatPos = (localT % (beatDur * 2)) / (beatDur * 2);
      const bassEnv = Math.min(1, (localT % (beatDur * 2)) / 0.02) * Math.exp(-beatPos * 2.2);
      const bassFreq = midiToFreq(bassMidi);
      const bassSample =
        (Math.sin(2 * Math.PI * bassFreq * t) * 0.75 +
          Math.sin(2 * Math.PI * bassFreq * 2 * t) * 0.18) *
        0.22 *
        bassEnv *
        energyScale;

      left[i] += chordL + bassSample;
      right[i] += chordR + bassSample;
    }

    // Percussion groove per beat
    for (let beat = 0; beat < 4; beat++) {
      const beatStart = barStart + beat * beatDur;
      if (beatStart >= duration) break;
      const bStartSample = Math.floor(beatStart * sampleRate);

      // Kick on 0 & 2
      if (beat === 0 || beat === 2) {
        const kickLen = Math.floor(sampleRate * 0.22);
        for (let k = 0; k < kickLen && bStartSample + k < totalSamples; k++) {
          const kt = k / sampleRate;
          const kickFreq = 120 * Math.exp(-kt * 28) + 46;
          const kickEnv = Math.exp(-kt * 16) * 0.34 * energyScale;
          const s = Math.sin(2 * Math.PI * kickFreq * kt) * kickEnv;
          left[bStartSample + k] += s;
          right[bStartSample + k] += s;
        }
      }

      // Soft snare/clap on 1 & 3 (skip intro)
      if ((beat === 1 || beat === 3) && bar >= 1) {
        const snareLen = Math.floor(sampleRate * 0.14);
        for (let k = 0; k < snareLen && bStartSample + k < totalSamples; k++) {
          const kt = k / sampleRate;
          const env = Math.exp(-kt * 26) * (spec.groove === 'synth' ? 0.16 : 0.1) * energyScale;
          const noise = Math.sin(k * 12.9898) * 43758.5453;
          const rand = (noise - Math.floor(noise)) * 2 - 1;
          const body = Math.sin(2 * Math.PI * 185 * kt) * Math.exp(-kt * 32) * 0.5;
          const s = (rand * 0.5 + body) * env;
          left[bStartSample + k] += s * 0.92;
          right[bStartSample + k] += s * 1.08;
        }
      }

      // Crisp 8th-note hi-hat
      for (let sub = 0; sub < 2; sub++) {
        const hatStart = bStartSample + Math.floor(sub * beatDur * 0.5 * sampleRate);
        const hatLen = Math.floor(sampleRate * 0.045);
        for (let k = 0; k < hatLen && hatStart + k < totalSamples; k++) {
          const kt = k / sampleRate;
          const env = Math.exp(-kt * 75) * (sub === 0 ? 0.055 : 0.032) * energyScale;
          const n = Math.sin((hatStart + k) * 78.233) * 19341.123;
          const rand = (n - Math.floor(n)) * 2 - 1;
          left[hatStart + k] += rand * env * 0.85;
          right[hatStart + k] += rand * env * 1.15;
        }
      }
    }
  }

  // Center-panned vocal guide melody so karaoke vocal-reduction filter can attenuate it cleanly!
  for (let bar = 0; bar < totalBars; bar++) {
    for (const note of spec.melodyPattern) {
      if (bar % 4 !== note.barOffset) continue;
      // Skip intro bar 0 & 1
      if (bar < 2) continue;
      const startSec = bar * barDur + note.beat * beatDur;
      const durSec = note.dur * beatDur;
      if (startSec >= duration) continue;
      const startIdx = Math.floor(startSec * sampleRate);
      const len = Math.floor(durSec * sampleRate);
      const freq = midiToFreq(note.midi);

      for (let k = 0; k < len && startIdx + k < totalSamples; k++) {
        const kt = k / sampleRate;
        const env =
          Math.min(1, kt / 0.025) *
          Math.min(1, (durSec - kt) / 0.06) *
          0.16;
        // Soft flute/voice-like timbre centered in L+R
        const tone =
          (Math.sin(2 * Math.PI * freq * kt) * 0.78 +
            Math.sin(2 * Math.PI * freq * 2 * kt) * 0.16 +
            Math.sin(2 * Math.PI * freq * 3 * kt) * 0.06) *
          env;
        left[startIdx + k] += tone;
        right[startIdx + k] += tone;
      }
    }
  }

  // Fade out last 1.5s smoothly
  const fadeSamples = Math.floor(sampleRate * 1.5);
  for (let i = 0; i < fadeSamples && totalSamples - 1 - i >= 0; i++) {
    const g = i / fadeSamples;
    left[totalSamples - 1 - i] *= g;
    right[totalSamples - 1 - i] *= g;
  }

  const blob = encodeWavStereo(left, right, sampleRate);
  return URL.createObjectURL(blob);
}

const DEMO_SPECS: SynthTrackSpec[] = [
  {
    id: 'demo-luz-de-medianoche',
    groove: 'ballad',
    // Am - F - C - G
    chordProgression: [
      [57, 60, 64, 67],
      [53, 57, 60, 64],
      [60, 64, 67, 71],
      [55, 59, 62, 67],
    ],
    bassNotes: [33, 29, 36, 31],
    melodyPattern: [
      { barOffset: 0, beat: 0, dur: 1.5, midi: 69 },
      { barOffset: 0, beat: 1.5, dur: 1.0, midi: 72 },
      { barOffset: 0, beat: 2.5, dur: 1.5, midi: 71 },
      { barOffset: 1, beat: 0, dur: 2.0, midi: 69 },
      { barOffset: 1, beat: 2.5, dur: 1.5, midi: 67 },
      { barOffset: 2, beat: 0, dur: 1.5, midi: 64 },
      { barOffset: 2, beat: 1.5, dur: 1.5, midi: 67 },
      { barOffset: 2, beat: 3.0, dur: 1.0, midi: 69 },
      { barOffset: 3, beat: 0, dur: 3.0, midi: 67 },
    ],
    analysis: {
      title: 'Luz de Medianoche',
      artist: 'Pista de demostración · Acústica',
      durationSec: 60,
      bpm: 96,
      musicalKey: 'La menor',
      timeSignature: '4/4',
      genre: 'Balada Indie',
      mood: 'Íntima y luminosa',
      vocalRange: 'Mezzo / Tenor',
      summary:
        'Progresión cálida en La menor con dinámica creciente hacia el coro. Ideal para practicar control de respiración y frases largas.',
      stanzas: [
        {
          id: 'demo1-intro',
          label: 'Intro',
          type: 'intro',
          startTime: 0,
          endTime: 5.0,
          chords: ['Am7', 'Fmaj7'],
          energy: 3,
          singingTip: 'Escucha el pulso de cuatro tiempos antes de entrar.',
          lines: [
            { id: 'd1-l0', text: '(Instrumental)', startTime: 0, endTime: 5.0 },
          ],
        },
        {
          id: 'demo1-estrofa1',
          label: 'Estrofa 1',
          type: 'verse',
          startTime: 5.0,
          endTime: 20.0,
          chords: ['Am7', 'Fmaj7', 'Cmaj7', 'G'],
          energy: 5,
          singingTip: 'Voz cercana y suave, articulando cada consonante sin forzar.',
          lines: [
            {
              id: 'd1-l1',
              text: 'Cuando la ciudad apaga su ruido',
              startTime: 5.0,
              endTime: 8.75,
            },
            {
              id: 'd1-l2',
              text: 'queda una brasa encendida en el cristal',
              startTime: 8.75,
              endTime: 12.5,
            },
            {
              id: 'd1-l3',
              text: 'guardo en el aire el tiempo suspendido',
              startTime: 12.5,
              endTime: 16.25,
            },
            {
              id: 'd1-l4',
              text: 'mientras la noche empieza a respirar',
              startTime: 16.25,
              endTime: 20.0,
            },
          ],
        },
        {
          id: 'demo1-precoro',
          label: 'Pre-Coro',
          type: 'prechorus',
          startTime: 20.0,
          endTime: 30.0,
          chords: ['Fmaj7', 'G', 'Am7'],
          energy: 7,
          singingTip: 'Sube gradualmente la intensidad preparando el coro.',
          lines: [
            {
              id: 'd1-l5',
              text: 'Y cada sombra dibuja un sendero',
              startTime: 20.0,
              endTime: 25.0,
            },
            {
              id: 'd1-l6',
              text: 'donde tu voz vuelve a sonar primero',
              startTime: 25.0,
              endTime: 30.0,
            },
          ],
        },
        {
          id: 'demo1-coro',
          label: 'Coro',
          type: 'chorus',
          startTime: 30.0,
          endTime: 45.0,
          chords: ['F', 'C', 'G', 'Am'],
          energy: 9,
          singingTip: 'Abre el registro vocal con proyección firme y sostén el final.',
          lines: [
            {
              id: 'd1-l7',
              text: 'Canta conmigo en la luz de medianoche',
              startTime: 30.0,
              endTime: 33.75,
            },
            {
              id: 'd1-l8',
              text: 'deja que el eco atraviese la pared',
              startTime: 33.75,
              endTime: 37.5,
            },
            {
              id: 'd1-l9',
              text: 'somos el fuego que vence al reproche',
              startTime: 37.5,
              endTime: 41.25,
            },
            {
              id: 'd1-l10',
              text: 'y en este acorde volvemos a nacer',
              startTime: 41.25,
              endTime: 45.0,
            },
          ],
        },
        {
          id: 'demo1-outro',
          label: 'Coro Final · Outro',
          type: 'outro',
          startTime: 45.0,
          endTime: 60.0,
          chords: ['Am', 'F', 'C', 'G'],
          energy: 6,
          singingTip: 'Desciende la intensidad en la última línea hacia el silencio.',
          lines: [
            {
              id: 'd1-l11',
              text: 'Luz de medianoche sobre nuestra voz',
              startTime: 45.0,
              endTime: 50.0,
            },
            {
              id: 'd1-l12',
              text: 'hasta que el alba despierte a los dos',
              startTime: 50.0,
              endTime: 55.0,
            },
            {
              id: 'd1-l13',
              text: '(Desvanecimiento instrumental)',
              startTime: 55.0,
              endTime: 60.0,
            },
          ],
        },
      ],
    },
  },
  {
    id: 'demo-pulso-urbano',
    groove: 'synth',
    // Em - C - G - D
    chordProgression: [
      [52, 55, 59, 62],
      [48, 52, 55, 60],
      [55, 59, 62, 67],
      [50, 54, 57, 62],
    ],
    bassNotes: [28, 24, 31, 26],
    melodyPattern: [
      { barOffset: 0, beat: 0, dur: 1.0, midi: 71 },
      { barOffset: 0, beat: 1, dur: 1.0, midi: 74 },
      { barOffset: 0, beat: 2, dur: 2.0, midi: 71 },
      { barOffset: 1, beat: 0, dur: 1.5, midi: 72 },
      { barOffset: 1, beat: 2, dur: 1.5, midi: 69 },
      { barOffset: 2, beat: 0, dur: 1.0, midi: 67 },
      { barOffset: 2, beat: 1.5, dur: 1.5, midi: 71 },
      { barOffset: 3, beat: 0, dur: 2.5, midi: 69 },
    ],
    analysis: {
      title: 'Pulso de Neón',
      artist: 'Pista de demostración · Synth',
      durationSec: 48,
      bpm: 112,
      musicalKey: 'Mi menor',
      timeSignature: '4/4',
      genre: 'Synth-Pop',
      mood: 'Rítmica y nocturna',
      vocalRange: 'Alto / Tenor',
      summary:
        'Base rítmica constante a 112 BPM en Mi menor. Diseñada para trabajar precisión rítmica y entradas rápidas en tiempo fuerte.',
      stanzas: [
        {
          id: 'demo2-intro',
          label: 'Intro',
          type: 'intro',
          startTime: 0,
          endTime: 4.3,
          chords: ['Em', 'C'],
          energy: 4,
          singingTip: 'Marca el pulso con el cuerpo antes de la primera estrofa.',
          lines: [
            { id: 'd2-l0', text: '(Instrumental)', startTime: 0, endTime: 4.3 },
          ],
        },
        {
          id: 'demo2-estrofa1',
          label: 'Estrofa 1',
          type: 'verse',
          startTime: 4.3,
          endTime: 18.0,
          chords: ['Em', 'C', 'G', 'D'],
          energy: 6,
          singingTip: 'Fraseo ágil y staccato ligero siguiendo el bombo.',
          lines: [
            {
              id: 'd2-l1',
              text: 'Luces reflejadas en el pavimento gris',
              startTime: 4.3,
              endTime: 8.8,
            },
            {
              id: 'd2-l2',
              text: 'el reloj acelera cada paso que das',
              startTime: 8.8,
              endTime: 13.4,
            },
            {
              id: 'd2-l3',
              text: 'sube la frecuencia y no mires atrás',
              startTime: 13.4,
              endTime: 18.0,
            },
          ],
        },
        {
          id: 'demo2-coro',
          label: 'Coro',
          type: 'chorus',
          startTime: 18.0,
          endTime: 34.0,
          chords: ['C', 'G', 'D', 'Em'],
          energy: 9,
          singingTip: 'Ataque limpio en el primer tiempo de cada verso.',
          lines: [
            {
              id: 'd2-l4',
              text: 'Siente el pulso de neón latiendo aquí',
              startTime: 18.0,
              endTime: 22.0,
            },
            {
              id: 'd2-l5',
              text: 'cada nota encuentra su camino hacia ti',
              startTime: 22.0,
              endTime: 26.0,
            },
            {
              id: 'd2-l6',
              text: 'cambia el ritmo, suelta el aire y canta hoy',
              startTime: 26.0,
              endTime: 30.0,
            },
            {
              id: 'd2-l7',
              text: 'en esta frecuencia sé exactamente quién soy',
              startTime: 30.0,
              endTime: 34.0,
            },
          ],
        },
        {
          id: 'demo2-puente',
          label: 'Puente · Cierre',
          type: 'bridge',
          startTime: 34.0,
          endTime: 48.0,
          chords: ['Am', 'Em', 'D'],
          energy: 7,
          singingTip: 'Mantén la afinación estable en las notas largas finales.',
          lines: [
            {
              id: 'd2-l8',
              text: 'Respiramos al compás del sintetizador',
              startTime: 34.0,
              endTime: 39.0,
            },
            {
              id: 'd2-l9',
              text: 'hasta apagar la última estela de color',
              startTime: 39.0,
              endTime: 44.0,
            },
            {
              id: 'd2-l10',
              text: '(Cierre instrumental)',
              startTime: 44.0,
              endTime: 48.0,
            },
          ],
        },
      ],
    },
  },
];

let cachedDemoTracks: SongTrack[] | null = null;

export function getDemoTracks(): SongTrack[] {
  if (cachedDemoTracks) return cachedDemoTracks;
  cachedDemoTracks = DEMO_SPECS.map((spec, idx) => ({
    id: spec.id,
    isDemo: true,
    createdAt: Date.now() - idx * 1000,
    audioUrl: synthesizeTrack(spec),
    analysis: spec.analysis,
  }));
  return cachedDemoTracks;
}
