import type { Line, Word } from './lyrics.ts';

/** Native absolute millisecond windows only; never estimate from line duration. */
export function nativeWordLines(input: unknown, duration: number): Line[] {
  if (!Array.isArray(input) || input.length > 10000) return [];
  const validTime = (time: unknown): time is number => typeof time === 'number' && Number.isFinite(time) && time >= 0 && time <= (duration + 2) * 1000;
  const compact = (text: string) => text.replace(/\s/g, '');
  const lines: Line[] = [];
  for (const row of input) {
    if (!row || typeof row.text !== 'string' || !row.text.trim() || !validTime(row.start) || !validTime(row.end) || row.end < row.start) continue;
    const line: Line = { text: row.text, time: row.start / 1000, end: row.end / 1000 };
    if (Array.isArray(row.words) && row.words.length && row.words.length <= 1000) {
      const words: Word[] = [];
      for (const word of row.words) {
        if (!word || typeof word.text !== 'string' || !word.text.trim() || !validTime(word.start) || !validTime(word.end) || word.end < word.start || word.start < row.start || word.end > row.end || word.start < (words.at(-1)?.time ?? 0) * 1000) break;
        words.push({ text: word.text, time: word.start / 1000, end: word.end / 1000 });
      }
      if (words.length === row.words.length && compact(words.map(word => word.text).join('')) === compact(row.text)) line.words = words;
    }
    lines.push(line);
  }
  return lines.sort((a,b) => a.time-b.time);
}
