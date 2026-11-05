import { nativeWordLines } from './native-words.ts';
import { safeAutomaticMatch, type TrackIdentity, type LyricRecord } from './lyric-source.ts';
import { parseTtml } from './word-catalog.ts';

export type CatalogTransport = (source: 'lrcmux'|'betterlyrics', track: TrackIdentity) => Promise<{status:number;body:string}>;
export function parseLrcmux(data: any, track: TrackIdentity): LyricRecord | undefined {
  const meta = data?.track;
  if (!meta || data?.meta?.level !== 'word') return;
  const record: LyricRecord = {id:-1000003,trackName:meta.title,artistName:meta.artist,albumName:meta.album??'',duration:meta.duration,syncedLyrics:null,instrumental:false,provider:`lrcmux · ${data.meta.source?.name ?? data.meta.source?.id ?? 'native words'}`};
  if (typeof record.trackName !== 'string' || typeof record.artistName !== 'string' || !Number.isFinite(record.duration) || !safeAutomaticMatch(track,record)) return;
  const lines = nativeWordLines(data.lines,record.duration);
  if (lines.some(line => line.words?.length)) return {...record,wordLines:lines,hasWordSync:true};
}
export function parseBetterLyrics(data: any, track: TrackIdentity): LyricRecord | undefined {
  if (typeof data?.ttml !== 'string' || track.duration <= 0 || data.score !== undefined && (!Number.isFinite(data.score) || data.score < .9)) return;
  const {lines,duration} = parseTtml(data.ttml);
  if (Number.isFinite(duration) && Math.abs(duration-track.duration)>2 || !lines.some(line=>line.words?.length) || lines.some(line=>(line.end??0)>track.duration+2)) return;
  // This API does not echo track identity; matching is delegated to its exact
  // title/artist/album/duration query, with optional confidence and bounds checks.
  return {id:-1000004,trackName:track.title,artistName:track.artist,albumName:track.album,duration:track.duration,syncedLyrics:null,instrumental:false,provider:'Better Lyrics · TTML',hasWordSync:true,wordLines:lines};
}
export function createAdditionalLookup(transport: CatalogTransport) {
  const cache = new Map<string,LyricRecord>();
  return async (track: TrackIdentity, signal: AbortSignal): Promise<LyricRecord|undefined> => {
    signal.throwIfAborted();
    if (track.duration <= 0) return;
    const key = JSON.stringify([track.title,track.artist,track.album,track.duration]);
    if (cache.has(key)) return cache.get(key);
    const failures: string[] = [];
    for (const source of ['lrcmux','betterlyrics'] as const) {
      signal.throwIfAborted();
      try {
        const reply = await transport(source,track);
        signal.throwIfAborted();
        if (reply.status === 404) continue;
        if (reply.status !== 200) { failures.push(`${source} HTTP ${reply.status}`); continue; }
        if (reply.body.length > 2_000_000) throw new Error('Response too large');
        const data = JSON.parse(reply.body);
        const result = source === 'lrcmux' ? parseLrcmux(data,track) : parseBetterLyrics(data,track);
        if (result) {
          cache.set(key,result);
          if (cache.size>8) cache.delete(cache.keys().next().value!);
          return result;
        }
      } catch(error) {
        signal.throwIfAborted();
        failures.push(`${source}: ${String(error)}`);
      }
    }
    if (failures.length) throw new Error(failures.join('; '));
  };
}
