import { parseDocument } from 'yaml';
export type Word = { time: number; text: string; end?: number };
export type Line = { time: number; text: string; end?: number; words?: Word[] };

/** Missing word ends get a static highlight, never a fabricated duration. */
export function wordProgress(word: Word, position: number): number {
  if (position < word.time) return 0;
  if (word.end === undefined || word.end === word.time) return 1;
  return Math.max(0, Math.min(1, (position - word.time) / (word.end - word.time)));
}

export function parseLyricsfile(source: string): Line[] {
  if (source.length > 2_000_000) throw new Error('Lyricsfile exceeds 2 MB.');
  const doc = parseDocument(source, { uniqueKeys: true, customTags: [] });
  if (doc.errors.length) throw new Error('Invalid Lyricsfile YAML.');
  const data = doc.toJS({ maxAliasCount: 0 });
  if (!data || data.version !== '1.0' || !Array.isArray(data.lines)) throw new Error('Unsupported Lyricsfile version or lines.');
  const valid = (item: any) => item && typeof item.text === 'string' && Number.isInteger(item.start_ms) && item.start_ms >= 0 &&
    (item.end_ms === undefined || Number.isInteger(item.end_ms) && item.end_ms >= item.start_ms);
  return data.lines.filter(valid).slice(0, 10000).map((item: any): Line => {
    const words: Word[] = Array.isArray(item.words) ? item.words.filter(valid).map((word: any) => ({ text: word.text, time: word.start_ms / 1000, ...(word.end_ms === undefined ? {} : { end: word.end_ms / 1000 }) })).sort((a: Word, b: Word) => a.time - b.time) : [];
    const usable = words.length && words.map(word => word.text).join('') === item.text && words.every(word => word.time >= item.start_ms / 1000 && (item.end_ms === undefined || (word.end ?? word.time) <= item.end_ms / 1000));
    return { time: item.start_ms / 1000, text: item.text, ...(item.end_ms === undefined ? {} : { end: item.end_ms / 1000 }), ...(usable ? { words } : {}) };
  }).sort((a: Line, b: Line) => a.time - b.time);
}

export function motionUnits(lines: Line[]): Word[] {
  return lines.flatMap(line => line.words?.length ? line.words : [{ time: line.time, text: line.text, end: line.end }]).sort((a, b) => a.time - b.time);
}

/** Standard LRC gives line starts, never invented word timings. */
export function parseLrc(source: string): Line[] {
  const lines: Line[] = [];
  for (const row of source.split(/\r?\n/)) {
    const stamps = [...row.matchAll(/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const content = row.replace(/\[[^\]]*\]/g, '').trim();
    const words: Word[] = [];
    const tokens = [...content.matchAll(/<(\d+):(\d{2})(?:\.(\d{1,3}))?>([^<]*)/g)];
    for (const token of tokens) {
      if (Number(token[2]) >= 60) continue;
      const time = Number(token[1]) * 60 + Number(token[2]) + Number(`0.${token[3] ?? '0'}`);
      if (words.length) words[words.length - 1].end = time;
      if (token[4]) words.push({ time, text: token[4] });
    }
    const text = content.replace(/<[^>]*>/g, '').trim();
    if (!text) continue;
    for (const stamp of stamps) {
      const seconds = Number(stamp[2]);
      if (seconds >= 60) continue;
      const fraction = Number(`0.${stamp[3] ?? '0'}`);
      lines.push({ time: Number(stamp[1]) * 60 + seconds + fraction, text, ...(stamps.length === 1 && words.length ? { words } : {}) });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

export function activeLine(lines: Line[], position: number): number {
  let low = 0, high = lines.length - 1, result = -1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (lines[mid].time <= position) { result = mid; low = mid + 1; }
    else high = mid - 1;
  }
  return result;
}
