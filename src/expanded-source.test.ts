import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseExpandedResult, parseExpandedFallback } from './expanded-source.ts';

test('line and plain fallback retain their actual precision', () => {
  const line = parseExpandedFallback({metadata:{title:'Original test',artist:'Test artist',duration:20},primary:{syncLevel:'line',provider:'test',timed:[{text:'Original line',start:2500}]}},track);
  assert.deepEqual(line?.wordLines,[{text:'Original line',time:2.5}]);
  assert.equal(line?.hasWordSync,undefined);
  const plain = parseExpandedFallback({metadata:{title:'Original test',artist:'Test artist',duration:20},primary:{syncLevel:'plain',provider:'test',plain:'Original words\nAnother line'}},track);
  assert.equal(plain?.plainLyrics,'Original words\nAnother line');
});
const track = { id:'Spotify',title:'Original test',artist:'Test artist',album:'Test album',duration:20 };
const ttml = '<tt><body dur="20s"><div><p begin="2s" end="4s"><span begin="2s" end="3s">Stay</span> <span begin="3s" end="4s">here</span></p></div></body></tt>';
const fixture = {metadata:{title:track.title,artist:track.artist,album:track.album,duration:'20'},primary:{provider:'apple_music_liriqo',upstreamProvider:'Apple Music',syncLevel:'syllable',ttml}};
test('expanded provider preserves source TTML word times', () => {
  const record = parseExpandedResult(fixture, track);
  assert.equal(record?.wordLines?.[0].words?.[1].time, 3);
  assert.equal(record?.hasWordSync, true);
});
test('expanded provider rejects line-only, estimated, wrong recording and label-only karaoke', () => {
  assert.equal(parseExpandedResult({...fixture,primary:{...fixture.primary,syncLevel:'line'}},track),undefined);
  assert.equal(parseExpandedResult({...fixture,primary:{...fixture.primary,nativeWordTiming:false}},track),undefined);
  assert.equal(parseExpandedResult({...fixture,primary:{...fixture.primary,ttml:undefined}},track),undefined);
  assert.equal(parseExpandedResult(fixture,{...track,duration:100}),undefined);
  assert.equal(parseExpandedResult(fixture,{...track,artist:'Other artist'}),undefined);
});
