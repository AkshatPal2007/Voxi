import { DOMParser } from '@xmldom/xmldom';
import { normalize, primaryArtist, type TrackIdentity, type LyricRecord } from './lyric-source.ts';
import type { Line, Word } from './lyrics.ts';

export function ttmlTime(value: string | null): number {
  if (!value) return NaN;
  if (/^\d+(?:\.\d+)?ms$/.test(value)) return Number(value.slice(0, -2)) / 1000;
  if (/^\d+(?:\.\d+)?s$/.test(value)) return Number(value.slice(0, -1));
  if (!/^\d+(?::\d{2}){0,2}(?:\.\d+)?$/.test(value)) return NaN;
  return value.split(':').reduce((sum, part) => sum * 60 + Number(part), 0);
}
export function parseTtml(source: string): { lines: Line[]; duration: number } {
  if (source.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('Unsupported TTML document.');
  const document = new DOMParser().parseFromString(source, 'application/xml');
  const lines: Line[] = [];
  for (const p of Array.from(document.getElementsByTagName('p'))) {
    const time = ttmlTime(p.getAttribute('begin')), end = ttmlTime(p.getAttribute('end'));
    if (!Number.isFinite(time) || !Number.isFinite(end) || end < time) continue;
    const words: Word[] = [];
    for (const span of Array.from(p.getElementsByTagName('span'))) {
      let auxiliary = false;
      for (let node = span; node !== p && node; node = node.parentNode as typeof span) {
        if (/translation|roman|bg/.test(node.getAttribute?.('ttm:role') ?? '')) auxiliary = true;
      }
      if (auxiliary || span.getElementsByTagName('span').length) continue;
      const start = ttmlTime(span.getAttribute('begin')), finish = ttmlTime(span.getAttribute('end'));
      const text = span.textContent ?? '';
      if (text.trim() && Number.isFinite(start) && Number.isFinite(finish) && start >= time && finish >= start && finish <= end) {
        const previous = words[words.length - 1];
        const spaceBefore = /^\s/.test(text) || (span.previousSibling?.nodeType === 3 && /\s/.test(span.previousSibling.textContent ?? ''));
        // TTML may split a Latin word into sung syllables. Rejoin only when
        // there is no source whitespace; never divide line time into words.
        if (previous && !spaceBefore && !/\s$/.test(previous.text) && /\p{Script=Latin}$/u.test(previous.text) && /^\p{Script=Latin}/u.test(text)) {
          previous.text += text; previous.end = finish;
        } else words.push({ text, time: start, end: finish });
      }
    }
    words.sort((a, b) => a.time - b.time);
    if (words.length) lines.push({ time, end, text: words.map(word => word.text).join(' '), words });
  }
  lines.sort((a, b) => a.time - b.time);
  const body = document.getElementsByTagName('body')[0];
  return { lines, duration: ttmlTime(body?.getAttribute('dur') ?? null) };
}

type Entry = { metadata: [string, string[]][]; rawLyricFile: string };
const root = 'https://raw.githubusercontent.com/amll-dev/amll-ttml-db/main/';
let indexPromise: Promise<Entry[]> | undefined;
/** Download the public index once; title/artist matching happens on this device. */
export async function findWordCatalog(track: TrackIdentity, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<LyricRecord | undefined> {
  if (!indexPromise) indexPromise = (async () => {
    const response = await fetcher(`${root}metadata/raw-lyrics-index.jsonl`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Word catalog unavailable');
    const text = await response.text();
    if (text.length > 10_000_000) throw new Error('Word catalog too large');
    return text.split('\n').filter(Boolean).map(line => JSON.parse(line) as Entry);
  })().catch(error => { indexPromise = undefined; throw error; });
  const entries = await indexPromise;
  signal.throwIfAborted();
  const matches = entries.filter(entry => {
    const meta = new Map(entry.metadata);
    return meta.get('musicName')?.some(title => normalize(title) === normalize(track.title)) &&
      meta.get('artists')?.some(artist => normalize(primaryArtist(artist)) === normalize(primaryArtist(track.artist)));
  }).reverse().slice(0, 3);
  for (const entry of matches) {
    signal.throwIfAborted();
    if (!/^[\w-]+\.ttml$/.test(entry.rawLyricFile)) continue;
    const response = await fetcher(`${root}raw-lyrics/${entry.rawLyricFile}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) });
    if (!response.ok) continue;
    const { lines, duration } = parseTtml(await response.text());
    if (!lines.length || lines.some(line => (line.end ?? 0) > track.duration + 2)) continue;
    const meta = new Map(entry.metadata);
    const albumMatches = !!track.album && meta.get('album')?.some(album => normalize(album) === normalize(track.album));
    if (Number.isFinite(duration) ? Math.abs(duration - track.duration) > 3 : !albumMatches) continue;
    return { id: -entries.indexOf(entry) - 1, trackName: track.title, artistName: track.artist, albumName: track.album, duration: track.duration, instrumental: false, syncedLyrics: null, wordLines: lines, hasWordSync: true, provider: 'AMLL TTML' };
  }
}
