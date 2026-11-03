import { parseLrc, parseLyricsfile, type Line } from './lyrics.ts';
export type TrackIdentity = { id: string; title: string; artist: string; album: string; duration: number };
export type LyricRecord = {
  id: number; trackName: string; artistName: string; albumName: string;
  duration: number; syncedLyrics: string | null; instrumental: boolean;
  lyricsfile?: string;
  hasWordSync?: boolean;
  wordLines?: Line[];
  provider?: string;
  plainLyrics?: string | null;
};
export type LyricMatch = { record?: LyricRecord; candidates: LyricRecord[]; searched: boolean };
type LookupOptions = { signal: AbortSignal; fetcher?: typeof fetch; onStatus?: (message: string) => void };

export function recordLines(record: LyricRecord): Line[] {
  if (record.wordLines) return record.wordLines;
  const lrc = record.syncedLyrics ? parseLrc(record.syncedLyrics) : [];
  if (record.lyricsfile) {
    try { const lines = parseLyricsfile(record.lyricsfile); if (lines.length && (lines.some(line => line.words?.length) || !lrc.some(line => line.words?.length))) return lines; } catch { /* Use valid LRC. */ }
  }
  return lrc;
}
export function hasRealWords(record: LyricRecord): boolean { return recordLines(record).some(line => line.words?.length); }

export function normalize(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/&amp;/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

// Remove video labels; preserve version words for matching below.
export function cleanTitle(value: string): string {
  return value.replace(/\s*[([][^)\]]*\b(?:official (?:music )?(?:video|audio)|lyrics?|visuali[sz]er|hd|4k)[^)\]]*[)\]]/gi, '')
    .replace(/\s*[-|]\s*(?:official (?:music )?(?:video|audio)|lyrics?(?: video)?|visuali[sz]er)\s*$/gi, '').trim();
}
export function baseTitle(value: string): string {
  return cleanTitle(value).replace(/\s*[([][^)\]]*[)\]]/g, '').trim();
}
export function primaryArtist(value: string): string {
  return value.replace(/\s*-\s*Topic$/i, '').split(/\s+(?:and|feat\.?|ft\.?|featuring|x)\s+|\s*[&,;]\s*/i)[0].trim();
}
function versions(value: string): string {
  return (normalize(value).match(/\b(?:live|remix|acoustic|instrumental|karaoke|cover|sped|slowed|reverb|remaster(?:ed)?|demo|edit)\b/g) ?? []).sort().join('|');
}
function titleCompatible(track: string, candidate: string): boolean {
  return versions(track) === versions(candidate) && normalize(baseTitle(track)) === normalize(baseTitle(candidate));
}
function artistCompatible(track: string, candidate: string): boolean {
  return !!track.trim() && !!candidate.trim() && (
    normalize(track) === normalize(candidate) || normalize(primaryArtist(track)) === normalize(primaryArtist(candidate))
  );
}

export function rankCandidates(track: TrackIdentity, records: LyricRecord[]): LyricRecord[] {
  return records.filter(record => (record.instrumental || !!record.syncedLyrics?.trim() || !!record.lyricsfile || !!record.plainLyrics?.trim()) &&
    titleCompatible(track.title, record.trackName) && artistCompatible(track.artist, record.artistName))
    .sort((a, b) => {
      const score = (record: LyricRecord) =>
        (track.duration > 0 ? Math.abs(record.duration - track.duration) * 10 : 0) +
        (normalize(record.trackName) === normalize(cleanTitle(track.title)) ? 0 : 3) +
        (track.album && normalize(record.albumName) === normalize(track.album) ? -2 : 0);
      const aSafe = safeAutomaticMatch(track, a), bSafe = safeAutomaticMatch(track, b);
      if (aSafe && bSafe && hasRealWords(a) !== hasRealWords(b)) return Number(hasRealWords(b)) - Number(hasRealWords(a));
      if (aSafe && bSafe && !!recordLines(a).length !== !!recordLines(b).length) return Number(!!recordLines(b).length) - Number(!!recordLines(a).length);
      return score(a) - score(b) || a.id - b.id;
    });
}

export function safeAutomaticMatch(track: TrackIdentity, record: LyricRecord): boolean {
  return titleCompatible(track.title, record.trackName) && artistCompatible(track.artist, record.artistName) &&
    (track.duration > 0 ? Math.abs(record.duration - track.duration) <= 2 :
      normalize(cleanTitle(track.title)) === normalize(record.trackName) && normalize(track.artist) === normalize(record.artistName));
}

let providerBlockedUntil = 0;
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export async function resolveLyrics(track: TrackIdentity, options: LookupOptions): Promise<LyricMatch> {
  const { signal, onStatus } = options;
  const fetcher = options.fetcher ?? fetch;
  if (!track.title.trim() || !track.artist.trim()) throw new Error('Edge/player has not shared both a song title and artist. Import an LRC file for this media.');
  if (Date.now() < providerBlockedUntil) throw new Error(`Lyrics service asked us to wait. Retry in ${Math.ceil((providerBlockedUntil - Date.now()) / 1000)} seconds.`);
  async function request(path: string, params: URLSearchParams): Promise<Response> {
    signal.throwIfAborted();
    const response = await fetcher(`https://lrclib.net/api/${path}?${params}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      headers: { 'Lrclib-Client': 'Voxi/0.1.0 (local development prototype)' },
    });
    if (response.status === 429 || response.status === 503) {
      const retry = response.headers.get('Retry-After');
      const delay = retry && /^\d+$/.test(retry) ? Number(retry) * 1000 : retry ? Date.parse(retry) - Date.now() : response.status === 429 ? 60_000 : 1000;
      providerBlockedUntil = Date.now() + Math.max(1000, Number.isFinite(delay) ? delay : 1000);
    }
    return response;
  }
  function serviceError(response: Response): Error {
    if (response.status === 429) return new Error('Lyrics service rate limit reached. Wait before retrying.');
    if (response.status >= 500) return new Error('Lyrics service is temporarily unavailable. Use Retry lyrics in a moment.');
    return new Error(`Lyrics service returned HTTP ${response.status}.`);
  }
  const browser = /edge|chrome|firefox|brave|opera|vivaldi/i.test(track.id);
  let exact: LyricRecord | undefined;
  if (!browser) {
    onStatus?.('Looking up exact recording…');
    const params = new URLSearchParams({ track_name: track.title, artist_name: track.artist });
    if (track.album) params.set('album_name', track.album);
    if (track.duration >= 1 && track.duration <= 3600) params.set('duration', String(Math.round(track.duration)));
    const response = await request('get', params);
    if (response.ok) {
      const record = await response.json() as LyricRecord;
      if ((record.syncedLyrics || record.lyricsfile || record.plainLyrics || record.instrumental) && safeAutomaticMatch(track, record)) {
        if (hasRealWords(record) || record.instrumental) return { record, candidates: [record], searched: false };
        exact = record;
      }
    } else if (response.status !== 404) throw serviceError(response);
    await wait(250, signal);
  }
  // Browsers commonly supply video subtitles and joint artist credits. Search
  // without album/duration constraints, then validate the returned recording.
  onStatus?.('Matching browser/player metadata…');
  const params = new URLSearchParams({ track_name: baseTitle(track.title), artist_name: primaryArtist(track.artist) });
  onStatus?.('Searching for genuine word timings…');
  let response: Response;
  try { response = await request('search', params); }
  catch (error) { if (signal.aborted || !exact) throw error; return { record: exact, candidates: [exact], searched: true }; }
  if (!response.ok) { if (exact) return { record: exact, candidates: [exact], searched: true }; throw serviceError(response); }
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error('Lyrics service returned an invalid search response.');
  const records = data.filter((item): item is LyricRecord => !!item &&
    typeof item.id === 'number' && typeof item.trackName === 'string' && typeof item.artistName === 'string' &&
    typeof item.albumName === 'string' && typeof item.duration === 'number' && Number.isFinite(item.duration) &&
    (item.syncedLyrics === null || typeof item.syncedLyrics === 'string' || typeof item.lyricsfile === 'string'));
  const candidates = rankCandidates(track, [...(exact ? [exact] : []), ...records.filter(record => record.id !== exact?.id)]);
  return { record: candidates.find(record => safeAutomaticMatch(track, record)), candidates, searched: true };
}
