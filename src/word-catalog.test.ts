import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTtml, ttmlTime } from './word-catalog.ts';
test('TTML keeps real word timing and joins adjacent syllables without including translation', () => {
  const { lines, duration } = parseTtml(`<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><body dur="00:10.000"><div><p begin="2s" end="4s"><span begin="2s" end="2.5s">signif</span><span begin="2.5s" end="3s">icant</span> <span begin="3s" end="4s">lover</span><span ttm:role="x-translation"><span begin="2s" end="4s">Other language</span></span></p></div></body></tt>`);
  assert.equal(duration, 10);
  assert.deepEqual(lines[0].words, [{text:'significant',time:2,end:3},{text:'lover',time:3,end:4}]);
  assert.equal(ttmlTime('01:02.250'), 62.25);
  assert.throws(() => parseTtml('<!DOCTYPE tt><tt/>'));
});
