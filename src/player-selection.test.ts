import {test} from 'node:test';
import assert from 'node:assert/strict';
import {choosePlayer} from './player-selection.ts';
const spotify={id:'Spotify',playing:false,title:'Song A'};
const edge={id:'MSEdge',playing:true,title:'Song B'};
test('automatic selection follows playing Edge ahead of paused Spotify',()=>{
  assert.equal(choosePlayer([spotify,edge],'Spotify',[spotify])?.id,'MSEdge');
});
test('newly started player wins, stable simultaneous players do not flicker',()=>{
  const activeSpotify={...spotify,playing:true};
  assert.equal(choosePlayer([activeSpotify,edge],'MSEdge',[spotify,edge])?.id,'Spotify');
  assert.equal(choosePlayer([edge,activeSpotify],'MSEdge',[activeSpotify,edge])?.id,'MSEdge');
  assert.equal(choosePlayer([edge,activeSpotify],'',[])?.id,'Spotify');
});
test('pause retains the selected track; disconnect selects another or becomes idle',()=>{
  assert.equal(choosePlayer([spotify,{...edge,playing:false}],'MSEdge',[edge])?.id,'MSEdge');
  assert.equal(choosePlayer([spotify],'MSEdge',[edge])?.id,'Spotify');
  assert.equal(choosePlayer([],'MSEdge',[edge]),undefined);
  assert.equal(choosePlayer([{...edge,title:''}],'',[]),undefined);
});
