export type Palette = { primary: string; secondary: string };
export function extractPalette(pixels: Uint8ClampedArray): Palette | undefined {
  const buckets = new Map<number,{r:number;g:number;b:number;n:number;score:number}>();
  for(let i=0;i+3<pixels.length;i+=4) {
    if(pixels[i+3]<180) continue;
    const [r,g,b]=[pixels[i],pixels[i+1],pixels[i+2]];
    const max=Math.max(r,g,b),min=Math.min(r,g,b);
    if(max<28 || min>235) continue;
    const key=(r>>5)*64+(g>>5)*8+(b>>5);
    const item=buckets.get(key) ?? {r:0,g:0,b:0,n:0,score:0};
    item.r+=r;item.g+=g;item.b+=b;item.n++;item.score+=.2+(max-min)/255;
    buckets.set(key,item);
  }
  const colors=[...buckets.values()].sort((a,b)=>b.score-a.score).map(v=>[v.r/v.n,v.g/v.n,v.b/v.n]);
  if(!colors.length) return undefined;
  const primary=colors[0];
  const secondary=colors.find(c=>Math.hypot(...c.map((v,i)=>v-primary[i]))>85) ?? primary;
  const rgb=(c:number[])=>c.map(v=>Math.round(v)).join(', ');
  return {primary:rgb(primary),secondary:rgb(secondary)};
}
