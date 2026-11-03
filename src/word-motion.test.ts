import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wordPose, phrasePlan, playbackCursor, stageWords } from './word-motion.ts';
test('phrase staging is deterministic, centered at focus and bounded', () => {
  assert.deepEqual(phrasePlan('song',2),phrasePlan('song',2));
  assert.notDeepEqual(phrasePlan('song',2),phrasePlan('song',3));
  assert.equal(wordPose(3,3,'ship',false,'song',2).x,0);
  assert.deepEqual(wordPose(3,2,'ship',true),{x:0,rotation:0,depth:1});
  for(let i=0;i<20;i++) assert.ok(Math.abs(wordPose(i,10,'ship',false,'song',2).x)<=340);
});
test('playback cursor reproduces pauses and seeks without delayed word identity', () => {
  const words=[{text:'one',time:1},{text:'two',time:2}];
  assert.equal(playbackCursor(words,1,2.2,false),1);
  assert.equal(playbackCursor(words,1,2.08,false),playbackCursor(words,1,2.08,false));
  assert.equal(playbackCursor(words,0,1.2,false),0);
  assert.equal(playbackCursor(words,1,2,true),1);
});
test('adaptive phrases use multiple bounded compositions and calm keeps a curve', () => {
  const families = new Set(Array.from({length:60},(_,i)=>phrasePlan('fixture',i).family));
  assert.equal(families.size,4);
  for(let phrase=0;phrase<60;phrase++) for(let i=0;i<8;i++) {
    const pose=wordPose(i,3,'ship',false,'fixture',phrase);
    assert.ok(Number.isFinite(pose.x) && Math.abs(pose.x)<=340);
    assert.ok(pose.depth>=.5 && Math.abs(pose.rotation)<.3);
    assert.equal(wordPose(3,3,'ship',false,'fixture',phrase).x,0);
  }
  const calm=wordPose(5,3,'ship',false,'fixture',2,false);
  assert.equal(calm.depth,.76);
});
test('orbit focus requires a supplied hold and observes phrase cooldown', () => {
  const lines=Array.from({length:5},(_,i)=>({text:'hold',time:i*3,words:[{text:'hold',time:i*3,end:i*3+1.5}]}));
  assert.deepEqual(stageWords(lines).filter(word=>word.featured).map(word=>word.phrase),[1,4]);
  assert.equal(stageWords([{text:'unknown',time:0,words:[{text:'unknown',time:0}]}]).some(word=>word.featured),false);
});
