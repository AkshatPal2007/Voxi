import type { Line, Word } from './lyrics.ts';

export type StagedWord = Word & { phrase: number; featured: boolean; line?: boolean };
export function phrasePlan(seed: string, phrase: number) {
  let hash = 2166136261;
  for (const char of `${seed}:${phrase}`) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  // Avalanche nearby phrase numbers so successive phrases have distinct staging.
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x7feb352d); hash ^= hash >>> 15;
  const value = (hash >>> 0) / 4294967295;
  const families = ['curved', 'curved', 'hinge', 'fan', 'expand'] as const;
  return { family: families[(hash >>> 0) % families.length], side: value < .5 ? -1 : 1, curvature: .65 + value * .6, tilt: (value - .5) * .055 };
}
export function stageWords(lines: Line[]): StagedWord[] {
  return lines.flatMap((line, phrase) => {
    const words = line.words ?? [];
    // A line remains one timed unit. Never manufacture word timestamps.
    if (!words.length) return [{ text: line.text, time: line.time, end: line.end, phrase, featured: false, line: true }];
    // One accent at most every three phrases, and only on an actual held word.
    let feature = -1, longest = .85;
    if (phrase % 3 === 1) words.forEach((word, i) => {
      const duration = word.end === undefined ? 0 : word.end - word.time;
      if (duration > longest) { longest = duration; feature = i; }
    });
    return words.map((word, i) => ({...word,phrase,featured:i === feature}));
  }).sort((a,b)=>a.time-b.time);
}
export function playbackCursor(words: Word[], target: number, position: number, reduced: boolean) {
  if (reduced || target < 0) return target;
  const next = words[target+1]?.time ?? Infinity;
  const duration = Math.max(.035, Math.min(.24,(next-words[target].time)*.7));
  const progress = Math.min(1,Math.max(0,(position-words[target].time)/duration));
  return target - Math.pow(1-progress,3);
}
/** Smooth onset and release, evaluated from playback time so seeking is deterministic. */
export function wordEmphasis(word: Word, position: number, reduced: boolean, next = Infinity) {
  if (position < word.time) return 1;
  const end = word.end ?? next;
  if (reduced) return position < end ? 1.25 : 1;
  const onset = Math.min(1, (position-word.time)/.12);
  const rise = 1-Math.pow(1-onset,3);
  const release = Math.max(0,Math.min(1,(position-end)/.14));
  const fade = 1-release*release*(3-2*release);
  return 1+.3*rise*fade;
}
export function wordPose(index: number, cursor: number, style: string, reduced: boolean, seed = '', phrase = 0, adaptive = true) {
  if (reduced) return { x: 0, rotation: 0, depth: 1 };
  const distance = Math.max(-3,Math.min(3,index-cursor));
  const plan = phrasePlan(seed,phrase);
  const bend = style === 'ship' ? 30 : style === 'visual' ? 20 : 24;
  const family = adaptive ? plan.family : 'curved';
  const curve = distance * distance * bend * plan.curvature;
  return {
    x: distance === 0 ? 0 : plan.side * (family === 'hinge' ? distance * 65 : family === 'fan' ? Math.sin(distance * .65) * 165 : family === 'expand' ? distance * 22 : curve),
    rotation: (adaptive ? plan.tilt : 0) + distance * (family === 'fan' ? .085 : family === 'hinge' ? -.045 : .018) * plan.side,
    depth: 1 - Math.min(2,Math.abs(distance)) * (family === 'expand' ? .21 : .12),
  };
}
