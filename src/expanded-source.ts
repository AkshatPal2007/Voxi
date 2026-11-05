import { parseTtml } from './word-catalog.ts';
import { safeAutomaticMatch, type LyricRecord, type TrackIdentity } from './lyric-source.ts';
import { nativeWordLines } from './native-words.ts';

/** Inspect every candidate; require actual TTML or explicitly native word windows. */
export function parseExpandedResult(data: any, track: TrackIdentity): LyricRecord | undefined {
  const root = data?.data ?? data;
  const metadata = root?.metadata;
  if (!metadata) return;
  const record: LyricRecord = {
    id: -1000001, trackName: metadata.title, artistName: metadata.artist,
    albumName: metadata.album ?? '', duration: Number(metadata.duration),
    syncedLyrics: null, instrumental: false,
  };
  if (typeof record.trackName !== 'string' || typeof record.artistName !== 'string' || !Number.isFinite(record.duration) || !safeAutomaticMatch(track, record)) return;
  for (const candidate of [root.primary,...(Array.isArray(root.tracks) ? root.tracks : [])]) {
    if (!candidate || !['word','syllable'].includes(candidate.syncLevel) || candidate.nativeWordTiming === false) continue;
    let lines;
    if (typeof candidate.ttml === 'string') {
      try { lines = parseTtml(candidate.ttml).lines; } catch { /* Try native normalized windows. */ }
    }
    if (!lines?.some(line => line.words?.length) && (candidate.nativeWordTiming === true || candidate.nativeRichsync === true)) {
      const timed = Array.isArray(candidate.timed) ? candidate.timed.map((line:any) => ({...line,words:line.words ?? candidate.words?.[line.id]})) : [];
      lines = nativeWordLines(timed,record.duration);
    }
    if (!lines?.some(line => line.words?.length) || lines.some(line => (line.end ?? 0) > record.duration + 2)) continue;
    return {...record,wordLines:lines,hasWordSync:true,provider:`LiriQo · ${candidate.upstreamProvider ?? candidate.provider}`};
  }
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
