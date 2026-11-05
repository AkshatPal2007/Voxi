import {test} from 'node:test';
import assert from 'node:assert/strict';
import {frameDue,advanceFrameClock} from './frame-pacing.ts';
import {wordEmphasis} from './word-motion.ts';
test('60 Hz displays retain every frame; high refresh is capped near 60',()=>{
  for (const hz of [60,120,144]) {
    let last=-1,count=0;
    for(let i=0;i<hz;i++) { const now=i*1000/hz; if(frameDue(now,last)){count++;last=advanceFrameClock(now,last);} }
    assert.ok(count>=59 && count<=61,`${hz} Hz rendered ${count}`);
    if(hz===60) assert.equal(count,60);
  }
});
test('word size releases continuously across a boundary and repeats after seeks',()=>{
  const word={text:'hold',time:1,end:2};
  assert.equal(wordEmphasis(word,.9,false),1);
  assert.equal(wordEmphasis(word,1.3,false),1.3);
  assert.ok(Math.abs(wordEmphasis(word,1.999,false)-wordEmphasis(word,2.001,false))<.001);
  assert.ok(wordEmphasis(word,2.07,false)>1);
  assert.equal(wordEmphasis(word,2.2,false),1);
  assert.equal(wordEmphasis(word,2.07,false),wordEmphasis(word,2.07,false));
  assert.equal(wordEmphasis(word,2.01,true),1);
});
