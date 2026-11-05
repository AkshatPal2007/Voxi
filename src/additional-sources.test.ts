import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAdditionalLookup, parseLrcmux, parseBetterLyrics } from './additional-sources.ts';

const track = {id:'Spotify',title:'Original fixture',artist:'Test artist',album:'Test album',duration:20};
const fixture = {track,meta:{level:'word',source:{name:'Test provider'}},lines:[{text:'Stay here',start:1000,end:4000,words:[{text:'Stay ',start:1000,end:2200},{text:'here',start:2800,end:4000}]}]};
// lrcmux uses title and artist rather than Windows' track id.
const data = {...fixture,track:{title:track.title,artist:track.artist,album:track.album,duration:track.duration}};
const ttml = '<tt><body dur="20s"><div><p begin="1s" end="4s"><span begin="1s" end="2.2s">Stay </span><span begin="2.8s" end="4s">here</span></p></div></body></tt>';

test('additional native words preserve gaps and reject wrong recordings or invalid windows', () => {
  assert.equal(parseLrcmux(data,track)?.wordLines?.[0].words?.[1].time,2.8);
  assert.equal(parseLrcmux(data,{...track,artist:'Other artist'}),undefined);
  assert.equal(parseLrcmux({...data,meta:{level:'line'}},track),undefined);
  assert.equal(parseLrcmux({...data,lines:[{...data.lines[0],words:[{text:'Stay here',start:1000,end:5000}]}]},track),undefined);
  assert.equal(parseBetterLyrics({ttml,score:.5},track),undefined);
  assert.equal(parseBetterLyrics({ttml}, {...track,duration:200}),undefined);
  assert.equal(parseBetterLyrics({ttml},track)?.hasWordSync,true);
});

test('catalog lookup falls back once, caches success, and never retries authorization or rate errors',async () => {
  const calls:string[]=[];
  const lookup=createAdditionalLookup(async source=>{calls.push(source);return source==='lrcmux'?{status:404,body:''}:{status:200,body:JSON.stringify({ttml})}});
  const signal=new AbortController().signal;
  assert.equal((await lookup(track,signal))?.provider,'Better Lyrics · TTML');
  await lookup(track,signal);
  assert.deepEqual(calls,['lrcmux','betterlyrics']);
  const failures:string[]=[];
  await assert.rejects(createAdditionalLookup(async source=>{failures.push(source);return {status:source==='lrcmux'?429:401,body:''}})(track,signal),/429.*401/);
  assert.deepEqual(failures,['lrcmux','betterlyrics']);
});

test('a track change cancels parsing and prevents the next catalog request',async () => {
  const controller=new AbortController();
  const calls:string[]=[];
  const lookup=createAdditionalLookup(async source=>{calls.push(source);controller.abort();return {status:404,body:''}});
  await assert.rejects(lookup(track,controller.signal),{name:'AbortError'});
  assert.deepEqual(calls,['lrcmux']);
});
