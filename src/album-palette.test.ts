import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractPalette} from './album-palette.ts';
test('palette ignores transparent, near-black and near-white pixels',()=>{
  assert.equal(extractPalette(new Uint8ClampedArray([0,0,0,255,255,255,255,255,220,40,60,0])),undefined);
});
test('dominant artwork colors retain a distinct secondary color',()=>{
  const pixels=new Uint8ClampedArray([...Array(8).fill([210,45,70,255]).flat(),30,150,200,255]);
  assert.deepEqual(extractPalette(pixels),{primary:'210, 45, 70',secondary:'30, 150, 200'});
  assert.deepEqual(extractPalette(new Uint8ClampedArray([128,128,128,255])),{primary:'128, 128, 128',secondary:'128, 128, 128'});
});
