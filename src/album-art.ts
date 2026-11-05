import {extractPalette,type Palette} from './album-palette.ts';
type Track={id:string;title:string;artist:string;album:string};
type Artwork={url:string;palette?:Palette};

export function createAlbumArt(cover:HTMLElement,stage:HTMLElement,request:(track:Track)=>Promise<string|null>, reduced:()=>boolean) {
  const cache=new Map<string,Artwork>();
  const image=cover.querySelector('img')!;
  const layers=[...stage.querySelectorAll<HTMLElement>('.album-ambient')];
  let key='',generation=0,current:Artwork|undefined,active=0,enabled=false,intensity=.35,disposed=false;
  let busy=false,attempts=0,retryAt=0;
  const paint=()=>{
    const palette=enabled ? current?.palette : undefined;
    if(palette)stage.style.setProperty('--album-primary',palette.primary);
    else stage.style.removeProperty('--album-primary');
    const next=1-active;
    const layer=layers[next];
    layer.style.transitionDuration=reduced()?'0s':'1.5s';
    layers[active].style.transitionDuration=layer.style.transitionDuration;
    layer.style.background=palette ? `radial-gradient(ellipse at 8% 62%,rgba(${palette.primary},${intensity}),transparent 58%),radial-gradient(ellipse at 95% 25%,rgba(${palette.secondary},${intensity*.85}),transparent 58%)` : 'none';
    layer.style.opacity='1';layers[active].style.opacity='0'; active=next;
  };
  const show=(art?:Artwork)=>{
    current=art;
    if(art) { image.src=art.url;image.hidden=false;cover.classList.add('has-art'); }
    else { image.hidden=true;image.removeAttribute('src');cover.classList.remove('has-art'); }
    paint();
  };
  return {
    async track(track:Track) {
      const next=track.id ? JSON.stringify([track.id,track.title,track.artist,track.album]) : '';
      if(disposed) return;
      if(next===key) {
        if(!next||current||busy||attempts>=3||performance.now()<retryAt)return;
      } else { attempts=0;key=next;show(); }
      const token=++generation;
      if(!next) return;
      if(cache.has(next)) { show(cache.get(next));return; }
      busy=true;attempts++;
      try {
        const url=await request({...track});
        if(disposed||token!==generation||!url) return;
        const decoded=new Image();decoded.src=url;await decoded.decode();
        if(disposed||token!==generation) return;
        const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
        const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
        ctx.drawImage(decoded,0,0,32,32);
        const art={url,palette:extractPalette(ctx.getImageData(0,0,32,32).data)};
        canvas.width=canvas.height=0;
        cache.set(next,art);while(cache.size>4)cache.delete(cache.keys().next().value!);
        show(art);
      } catch { if(!disposed&&token===generation)show(); }
      finally { if(token===generation){busy=false;retryAt=performance.now()+1500;} }
    },
    configure(on:boolean,strength:number) { enabled=on;intensity=Math.max(.1,Math.min(.6,strength));paint(); },
    dispose(){disposed=true;generation++;cache.clear();image.removeAttribute('src');},
  };
}
