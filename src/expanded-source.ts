import { parseTtml } from './word-catalog.ts';
import { safeAutomaticMatch, type LyricRecord, type TrackIdentity } from './lyric-source.ts';

/** Only raw source TTML is accepted: do not trust a generated karaoke label. */
export function parseExpandedResult(data: any, track: TrackIdentity): LyricRecord | undefined {
  const root = data?.data ?? data;
  const metadata = root?.metadata;
  const primary = root?.primary;
  if (!metadata || !primary || !['word', 'syllable'].includes(primary.syncLevel) || typeof primary.ttml !== 'string' || primary.nativeWordTiming === false) return;
  const record: LyricRecord = {
    id: -1000001, trackName: metadata.title, artistName: metadata.artist,
    albumName: metadata.album ?? '', duration: Number(metadata.duration),
    syncedLyrics: null, instrumental: false, provider: `LiriQo · ${primary.upstreamProvider ?? primary.provider}`,
  };
  if (typeof record.trackName !== 'string' || typeof record.artistName !== 'string' || !Number.isFinite(record.duration) || !safeAutomaticMatch(track, record)) return;
  const { lines } = parseTtml(primary.ttml);
  if (!lines.length || !lines.some(line => line.words?.length) || lines.some(line => (line.end ?? 0) > record.duration + 2)) return;
  return { ...record, wordLines: lines, hasWordSync: true };
}

export async function findExpandedWords(track: TrackIdentity, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<LyricRecord | undefined> {
  const params = new URLSearchParams({ title: track.title, artist: track.artist, duration: String(track.duration) });
  const response = await fetcher(`https://api.liriqo-alfarrizi.my.id/v1/lyrics?${params}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`LiriQo lookup failed (HTTP ${response.status}).`);
  const data = await response.json();
  return parseExpandedResult(data, track) ?? parseExpandedFallback(data, track);
}

export function parseExpandedFallback(data: any, track: TrackIdentity): LyricRecord | undefined {
  const root = data?.data ?? data, meta = root?.metadata;
  if (!meta || typeof meta.title !== 'string' || typeof meta.artist !== 'string') return;
  const record: LyricRecord = {id:-1000002,trackName:meta.title,artistName:meta.artist,albumName:meta.album??'',duration:Number(meta.duration),syncedLyrics:null,instrumental:false};
  if (!Number.isFinite(record.duration) || !safeAutomaticMatch(track,record)) return;
  const candidates = [root.primary,...(Array.isArray(root.tracks)?root.tracks:[])].filter(Boolean);
  const line = candidates.find(item => item.syncLevel === 'line' && Array.isArray(item.timed) && item.timed.length);
  if (line) {
    const lines = line.timed.filter((item:any)=>typeof item.text==='string' && Number.isFinite(item.start) && item.start>=0 && item.start<=record.duration*1000)
      .map((item:any)=>({text:item.text,time:item.start/1000})).sort((a:any,b:any)=>a.time-b.time);
    if (lines.length) return {...record,wordLines:lines,plainLyrics:line.plain??null,provider:`LiriQo · ${line.upstreamProvider??line.provider}`};
  }
  const plain = candidates.find(item => typeof item.plain==='string' && item.plain.trim());
  if (plain) return {...record,plainLyrics:plain.plain,provider:`LiriQo · ${plain.upstreamProvider??plain.provider}`};
}
