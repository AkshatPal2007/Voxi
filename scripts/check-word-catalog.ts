// Public catalog fixture only; never reads the user's playback metadata.
import assert from 'node:assert/strict';
import { parseTtml, findWordCatalog } from '../src/word-catalog.ts';
const base = 'https://raw.githubusercontent.com/amll-dev/amll-ttml-db/main/';
const response = await fetch(`${base}metadata/raw-lyrics-index.jsonl`);
assert.ok(response.ok);
const entry = JSON.parse((await response.text()).split('\n')[0]);
const meta = new Map<string, string[]>(entry.metadata);
const ttml = await fetch(`${base}raw-lyrics/${entry.rawLyricFile}`);
assert.ok(ttml.ok);
const parsed = parseTtml(await ttml.text());
assert.ok(parsed.lines.some(line => line.words?.length));
const duration = Number.isFinite(parsed.duration) ? parsed.duration : Math.max(...parsed.lines.map(line => line.end ?? 0));
const result = await findWordCatalog({ id:'Spotify-public-fixture', title:meta.get('musicName')![0], artist:meta.get('artists')![0], album:meta.get('album')![0], duration }, new AbortController().signal);
assert.ok(result?.wordLines?.length);
console.log(JSON.stringify({provider:result.provider,lines:result.wordLines.length,words:result.wordLines.reduce((sum,line)=>sum+(line.words?.length??0),0),matched:true}));
