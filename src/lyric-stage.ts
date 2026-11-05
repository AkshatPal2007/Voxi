import * as THREE from 'three';
import { activeLine, type Line } from './lyrics';
import { wordPose, stageWords, playbackCursor, wordEmphasis, type StagedWord } from './word-motion';
import { frameDue, advanceFrameClock } from './frame-pacing';

const symbols: Record<string, string> = { time: '◷', minute: '◷', wait: '⌛', love: '♥', heart: '♥', night: '☾', moon: '☾', sun: '☀', light: '✦', star: '★', stars: '✦', rain: '☂', fire: '♨', world: '◎', music: '♫', home: '⌂', eyes: '◉', fly: '➶', quiet: '◌', color: '✿', away: '➜', space: '✧' };

/** Typography texture -> perspective/lens shader. All times come from playback. */
export function createLyricStage(host: HTMLElement) {
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
  catch { return { render: (_lines: Line[], _position: number, _style: string, _reduced: boolean, _accent: string, _seed = '', _adaptive = true) => {}, clear() {}, dispose() {} }; }
  const surface = document.createElement('canvas'); surface.width = 1200; surface.height = 900;
  const ctx = surface.getContext('2d')!;
  const texture = new THREE.CanvasTexture(surface);
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const uniforms = { ink: { value: texture }, lens: { value: 0 }, ship: { value: 0 } };
  const material = new THREE.ShaderMaterial({ transparent: true, depthTest: false, uniforms,
    vertexShader: `varying vec2 texUv; uniform float ship;
      void main(){texUv=uv; vec2 p=position.xy; float depth=1.+ship*p.y*.24;
      p.x+=ship*p.y*.13; p.y*=1.-ship*.10; gl_Position=vec4(p,0.,depth);}`,
    fragmentShader: `precision highp float; varying vec2 texUv; uniform sampler2D ink; uniform float lens;
      void main(){vec2 p=(texUv-.5)*2.; float r=dot(p,p); vec2 uv=.5+.5*p*mix(1.,.72+.36*r,lens);
      if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))discard;
      vec4 c=texture2D(ink,uv); float fade=1.-smoothstep(.70,1.,abs(p.y)); gl_FragColor=vec4(c.rgb,c.a*fade);}`,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const scene = new THREE.Scene(); scene.add(new THREE.Mesh(geometry, material));
  const camera = new THREE.Camera();
  const canvas = renderer.domElement; canvas.className = 'lyric-canvas'; canvas.setAttribute('aria-hidden', 'true'); host.prepend(canvas);
  canvas.style.visibility = 'hidden';
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  let source: Line[] | undefined, units: StagedWord[] = [], cursor = -1, last = -1, signature = '', visible = true, lost = false;
  const resize = new ResizeObserver(() => {
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    renderer.setSize(box.width, box.height, false);
    const height = Math.max(240, Math.min(1600, Math.round(1200 * box.height / box.width)));
    if (surface.height !== height) {
      texture.dispose(); surface.height = height; texture.needsUpdate = true;
    }
    last = -1;
  });
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; });
  resize.observe(host); observer.observe(host);
  const onLost = (event: Event) => { event.preventDefault(); lost = true; host.classList.remove('gpu-lyrics'); };
  const onRestored = () => { lost = false; signature = ''; last = -1; };
  canvas.addEventListener('webglcontextlost', onLost); canvas.addEventListener('webglcontextrestored', onRestored);
  function clear() {
    source = undefined; units = []; cursor = -1; signature = ''; last = -1;
    canvas.style.visibility = 'hidden';
    host.classList.remove('gpu-lyrics');
    ctx.clearRect(0, 0, surface.width, surface.height);
    if (!lost) renderer.clear();
  }
  return {
    clear,
    render(lines: Line[], position: number, style: string, reduced: boolean, accent: string, seed = '', adaptive = true) {
      // Clear old GPU pixels before visibility/throttle exits. WebGLRenderer sets
      // inline display:block, so the HTML hidden attribute alone is insufficient.
      if (source !== lines) { clear(); source = lines; units = stageWords(lines); cursor = activeLine(units, position); }
      if (!units.length) { host.classList.remove('gpu-lyrics'); return; }
      if (document.hidden || !visible || lost) return;
      canvas.style.visibility = 'visible';
      host.classList.add('gpu-lyrics');
      const now = performance.now();
      const target = activeLine(units, position);
      cursor = playbackCursor(units,target,position,reduced);
      const immersive = document.body.classList.contains('immersive');
      if (!frameDue(now,last)) return;
      const phrase = units[Math.max(0,target)].phrase;
      const phraseStart = lines[phrase].words?.[0]?.time ?? lines[phrase].time;
      const mix = reduced ? 1 : Math.min(1, Math.max(0, (position - phraseStart) / .45));
      const blend = mix * mix * (3 - 2 * mix);
      let envelopes = '';
      for (let i=Math.max(0,target-2);i<=Math.min(units.length-1,target+2);i++)
        envelopes += wordEmphasis(units[i],position,reduced,units[i+1]?.time).toFixed(4);
      const focus = units[target];
      const activeFocus = !!focus && position >= focus.time && (focus.end === undefined || position < focus.end);
      const orbit = focus?.featured && adaptive && !reduced && !immersive && activeFocus ? position.toFixed(3) : '';
      // Playback time alone is not a visual change. Holds and pauses reuse GPU pixels.
      const key = `${target}|${cursor.toFixed(4)}|${blend.toFixed(4)}|${envelopes}|${activeFocus}|${orbit}|${style}|${reduced}|${accent}|${seed}|${adaptive}|${immersive}`;
      if (last >= 0 && key === signature) return;
      last = advanceFrameClock(now,last); signature = key;
      uniforms.lens.value = style === 'lens' || style === 'lens-visual' ? 1 : 0;
      uniforms.ship.value = style === 'ship' ? 1 : 0;
      const height = surface.height;
      ctx.clearRect(0, 0, 1200, height);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = Math.max(0, target - 2); i <= Math.min(units.length - 1, target + 2); i++) {
        const word = units[i], distance = i - cursor;
        const y = height * .52 + distance * height * .23;
        const isWord = word.text.trim().split(/\s+/).length <= 3;
        const active = i === target && position >= word.time && (word.end === undefined || position < word.end);
        const emphasis = wordEmphasis(word,position,reduced,units[i+1]?.time);
        const size = (isWord ? height * .17 : height * .115) * emphasis;
        ctx.font = `italic 750 ${size}px "Segoe UI Variable", "Segoe UI", sans-serif`;
        const text = word.text.trim();
        const icon = style === 'visual' || style === 'lens-visual' ? symbols[text.toLowerCase().replace(/[^a-z]/g, '')] ?? '' : '';
        const label = text + (icon ? ` ${icon}` : '');
        const pose = wordPose(i, cursor, style, reduced, seed, phrase, adaptive);
        const previous = wordPose(i, cursor, style, reduced, seed, Math.max(0,phrase-1), adaptive);
        pose.x = previous.x + (pose.x-previous.x)*blend;
        pose.rotation = previous.rotation + (pose.rotation-previous.rotation)*blend;
        pose.depth = previous.depth + (pose.depth-previous.depth)*blend;
        const scale = Math.min(1, (1020 - Math.abs(pose.x) * 2) / Math.max(1, ctx.measureText(label).width));
        ctx.save(); ctx.translate(600 + pose.x, y); ctx.rotate(pose.rotation); ctx.scale(scale * pose.depth, scale * pose.depth);
        ctx.globalAlpha = Math.max(0, 1 - Math.abs(distance) * .24);
        ctx.fillStyle = accent;
        if (active) {
          ctx.globalAlpha = 1;
          if (word.featured && adaptive && !reduced && !immersive && word.end !== undefined) {
            const progress = Math.max(0,Math.min(1,(position-word.time)/(word.end-word.time)));
            const fade = Math.min(1,progress*8,(1-progress)*8);
            const radiusX = ctx.measureText(label).width*.56+22, radiusY = size*.58;
            ctx.save(); ctx.globalAlpha = fade*.65; ctx.strokeStyle = accent; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.ellipse(0,0,radiusX,radiusY,-.18,0,Math.PI*2); ctx.stroke();
            const angle = -.5 + progress*Math.PI*1.6;
            ctx.rotate(-.18); ctx.shadowBlur = 18; ctx.shadowColor = accent; ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(Math.cos(angle)*radiusX,Math.sin(angle)*radiusY,3.5,0,Math.PI*2); ctx.fill(); ctx.restore();
          }
          const highlight = ctx.createLinearGradient(-size*.7,-size*.5,size*.7,size*.5);
          highlight.addColorStop(0,accent); highlight.addColorStop(.5,'#f4fbff'); highlight.addColorStop(1,accent);
          ctx.fillStyle = highlight; ctx.shadowColor = accent; ctx.shadowBlur = reduced ? 0 : immersive ? 18 : 9;
        }
        ctx.fillText(label, 0, 0); ctx.restore();
      }
      texture.needsUpdate = true; renderer.render(scene, camera);
    },
    dispose() { resize.disconnect(); observer.disconnect(); canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRestored); geometry.dispose(); texture.dispose(); material.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); host.classList.remove('gpu-lyrics'); },
  };
}
