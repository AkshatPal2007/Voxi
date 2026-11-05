import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAlbumArt} from './album-art.ts';
test('late artwork cannot replace the current track; disposal rejects pending artwork',async()=>{
  const makeStyle=()=>({transitionDuration:'',background:'',opacity:'',setProperty(){},removeProperty(){}});
  const img={src:'',hidden:true,removeAttribute(){this.src='';}};
  const cover={querySelector:()=>img,classList:{add(){},remove(){}}};
  const layers=[{style:makeStyle()},{style:makeStyle()}];
  const stage={querySelectorAll:()=>layers,style:makeStyle()};
  const pending=new Map<string,(url:string)=>void>();
  const originalImage=globalThis.Image,originalDocument=globalThis.document;
  Object.assign(globalThis,{
    Image:class {src='';decode(){return Promise.resolve();}},
    document:{createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray([120,60,180,255])})})})},
  });
  try {
    const art=createAlbumArt(cover as any,stage as any,t=>new Promise(resolve=>pending.set(t.title,resolve)),()=>true);
    const track=(title:string)=>({id:'spotify',title,artist:'fixture',album:''});
    const a=art.track(track('a')),b=art.track(track('b'));
    pending.get('b')!('data:b');await b;
    pending.get('a')!('data:a');await a;
    assert.equal(img.src,'data:b');
    art.configure(true,.35);
    assert.ok(layers.some(l=>l.style.background.includes('120, 60, 180')));
    assert.ok(layers.every(l=>l.style.transitionDuration==='0s'));
    art.configure(false,.35);
    assert.equal(layers.filter(l=>l.style.opacity==='1')[0].style.background,'none');
    const c=art.track(track('c'));art.dispose();pending.get('c')!('data:c');await c;
    assert.equal(img.src,'');
  } finally {Object.assign(globalThis,{Image:originalImage,document:originalDocument});}
});
