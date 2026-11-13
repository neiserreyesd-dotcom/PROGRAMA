import { MetronomeSound } from '../types/song';

export function playMetronomeClick(
  ctx: AudioContext,
  isDownbeat: boolean,
  soundStyle: MetronomeSound,
  volume: number,
): void {
  if (soundStyle === 'visual' || volume <= 0) return;

  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  if (soundStyle === 'wood') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isDownbeat ? 1180 : 840, now);
    osc.frequency.exponentialRampToValueAtTime(isDownbeat ? 520 : 390, now + 0.045);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(Math.min(0.9, volume * (isDownbeat ? 0.55 : 0.35)), now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
  } else {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isDownbeat ? 1600 : 1080, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(Math.min(0.9, volume * (isDownbeat ? 0.45 : 0.28)), now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
  }

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.07);
}

export function getBeatsPerBar(timeSignature: string): number {
  const num = parseInt(timeSignature.split('/')[0] ?? '4', 10);
  if (Number.isFinite(num) && num >= 2 && num <= 12) return num;
  return 4;
}
