import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLrc, parseLyricsfile, motionUnits, activeLine, wordProgress } from './lyrics.ts';

test('word sweep follows supplied duration across pause and backward seek', () => {
  const word = { text: 'Stay', time: 2, end: 4 };
  assert.equal(wordProgress(word, 1), 0);
  assert.equal(wordProgress(word, 3), .5);
  assert.equal(wordProgress(word, 3), .5);
  assert.equal(wordProgress(word, 2.5), .25);
  assert.equal(wordProgress(word, 5), 1);
  assert.equal(wordProgress({ text: 'No end', time: 2 }, 2.1), 1);
});

test('enhanced LRC retains supplied word boundaries and silence', () => {
  const lines = parseLrc('[00:02]<00:02.00>Stay <00:02.60>here<00:03.50>\n[00:05]Line only');
  assert.deepEqual(lines[0].words, [{time:2,text:'Stay ',end:2.6},{time:2.6,text:'here',end:3.5}]);
  assert.equal(motionUnits(lines).length, 3);
  assert.equal(activeLine(motionUnits(lines), 2.7), 1);
  assert.equal(activeLine(motionUnits(lines), 2.1), 0);
});
test('Lyricsfile word data is validated without inventing missing word timings', () => {
  const lines = parseLyricsfile(`version: '1.0'\nlines:\n  - text: 'Stay here'\n    start_ms: 2000\n    end_ms: 3500\n    words:\n      - {text: 'Stay ', start_ms: 2000, end_ms: 2600}\n      - {text: 'here', start_ms: 2600, end_ms: 3500}\n  - {text: 'Another line', start_ms: 5000}`);
  assert.equal(lines[0].words?.[1].time, 2.6);
  assert.equal(lines[1].words, undefined);
  assert.throws(() => parseLyricsfile(`version: '9.0'\nlines: []`));
  assert.throws(() => parseLyricsfile(`version: '1.0'\nversion: '1.0'\nlines: []`));
  const invalid = parseLyricsfile(`version: '1.0'\nlines:\n  - text: 'Keep full line'\n    start_ms: 0\n    words: [{text: 'Wrong', start_ms: 0}]`);
  assert.equal(invalid[0].words, undefined);
});

test('LRC supports repeated timestamps, fractions and out-of-order lines', () => {
  assert.deepEqual(parseLrc('[ar:Test]\n[00:04.125]Later\n[00:01.5][00:03.00]Again\n[00:99]Bad'), [
    { time: 1.5, text: 'Again' }, { time: 3, text: 'Again' }, { time: 4.125, text: 'Later' }
  ]);
});
test('lyric selection handles intro, boundaries, backward seeking and empty data', () => {
  const lines = parseLrc('[00:02]First\n[00:05]Second');
  assert.equal(activeLine(lines, 0), -1);
  assert.equal(activeLine(lines, 5), 1);
  assert.equal(activeLine(lines, 3), 0);
  assert.equal(activeLine([], 10), -1);
});
