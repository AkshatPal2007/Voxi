import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLyrics, rankCandidates, safeAutomaticMatch, type LyricRecord } from './lyric-source.ts';

const track = { id: 'MSEdge', title: 'Night Garden (From the Film) (Official Audio)', artist: 'Mira and Sol', album: '', duration: 158 };
const record: LyricRecord = { id: 1, trackName: 'Night Garden', artistName: 'Mira', albumName: 'Film', duration: 158, syncedLyrics: '[00:01]An original test line', instrumental: false };
function mockFetch(body: unknown, status = 200): typeof fetch { return (async () => new Response(JSON.stringify(body), { status })) as typeof fetch; }

test('Edge searches cleaned title and primary artist rather than exact browser signature', async () => {
  let requested = '';
  const result = await resolveLyrics(track, { signal: new AbortController().signal, fetcher: (async (url) => {
    requested = String(url); return new Response(JSON.stringify([{ ...record, id: 2, duration: 162 }, record]));
  }) as typeof fetch });
  const url = new URL(requested);
  assert.equal(url.pathname, '/api/search');
  assert.equal(url.searchParams.get('track_name'), 'Night Garden');
  assert.equal(url.searchParams.get('artist_name'), 'Mira');
  assert.equal(result.record?.id, 1);
});
test('matching rejects wrong artist, title, recording version and significant duration mismatch', () => {
  const records = [record, { ...record, id: 2, artistName: 'Other' }, { ...record, id: 3, trackName: 'Night Garden (Live)' }, { ...record, id: 4, trackName: 'Other Garden' }];
  assert.deepEqual(rankCandidates(track, records).map(r => r.id), [1]);
  assert.equal(safeAutomaticMatch(track, { ...record, duration: 180 }), false);
  assert.equal(safeAutomaticMatch({ ...track, duration: 0 }, record), false);
  assert.equal(safeAutomaticMatch({ ...track, title: 'Night Garden (Live Official Video)' }, record), false);
});
test('different durations remain manual candidates without a false automatic match', async () => {
  const result = await resolveLyrics(track, { signal: new AbortController().signal, fetcher: mockFetch([{ ...record, duration: 180 }]) });
  assert.equal(result.record, undefined); assert.equal(result.candidates.length, 1);
});
test('Spotify keeps exact lookup and falls back to search on a missing record', async () => {
  const paths: string[] = [];
  const result = await resolveLyrics({ ...track, id: 'Spotify' }, { signal: new AbortController().signal, fetcher: (async (url) => {
    paths.push(new URL(String(url)).pathname);
    return paths.length === 1 ? new Response('{}', { status: 404 }) : new Response(JSON.stringify([record]));
  }) as typeof fetch });
  assert.deepEqual(paths, ['/api/get', '/api/search']); assert.equal(result.record?.id, 1);
});

test('Spotify continues past a line-only exact result and selects real word data over a better album match', async () => {
  const paths: string[] = [];
  const exact = { ...record, albumName:'Exact album' };
  const words = { ...record, id: 9, albumName:'Other release', duration:159, syncedLyrics:'[00:01]<00:01.00>Stay <00:01.40>here<00:02.00>' };
  const result = await resolveLyrics({ ...track, id:'Spotify', album:'Exact album' }, {signal:new AbortController().signal, fetcher:(async (url) => {
    paths.push(new URL(String(url)).pathname);
    return new Response(JSON.stringify(paths.length === 1 ? exact : [exact, words]));
  }) as typeof fetch});
  assert.deepEqual(paths, ['/api/get','/api/search']);
  assert.equal(result.record?.id, 9);
});
test('service failure is distinct from no lyrics and does not fan out more requests', async () => {
  await assert.rejects(resolveLyrics(track, { signal: new AbortController().signal, fetcher: mockFetch({}, 500) }), /temporarily unavailable/);
  const missing = await resolveLyrics(track, { signal: new AbortController().signal, fetcher: mockFetch([]) });
  assert.equal(missing.record, undefined); assert.equal(missing.candidates.length, 0);
});
test('aborted track change does not start another lookup', async () => {
  const controller = new AbortController(); controller.abort(); let called = false;
  await assert.rejects(resolveLyrics(track, { signal: controller.signal, fetcher: (async () => { called = true; return new Response('[]'); }) as typeof fetch }));
  assert.equal(called, false);
});
