import { invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { activeLine, parseLrc, parseLyricsfile, type Line } from './lyrics';
import { resolveLyrics, recordLines, hasRealWords, type LyricRecord } from './lyric-source';
import { findWordCatalog, parseTtml } from './word-catalog';
import { findExpandedWords } from './expanded-source';
import { choosePlayer, playerLabel } from './player-selection';
import { createAlbumArt } from './album-art';
import './style.css';
import './motion.css';
import './minimal.css';
import './blue-glass.css';

type Session = { id: string; title: string; artist: string; album: string; playing: boolean; position: number; duration: number; rate: number };
const native = isTauri();
const root = document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML = `
  <aside>
    <a class="brand" href="#" aria-label="Voxi home"><svg class="brand-wave" aria-hidden="true" viewBox="0 0 64 32"><path d="M3 23C13 23 14 7 23 7S36 26 44 26 53 10 61 9"/></svg>voxi</a>
    <div class="section-label">LISTEN</div>
    <button class="nav active" id="nav-stage" aria-current="page">Listening room</button>
    <button class="nav" id="nav-connections">Settings</button>
    <div class="sidebar-bottom">Voxi for Windows</div>
  </aside>
  <main>
    <header><h1 id="page-title">Listening room</h1><button id="fullscreen" class="outline" title="Enter fullscreen. Press Escape to return.">Fullscreen</button></header>
    <section id="connections" hidden class="connections"><h2>Your music, your space.</h2><p>Automatic detection follows the player that starts playing. Choose a player below to keep a specific connection.</p><p id="bridge-status"></p><button id="refresh" class="outline">Refresh players</button></section>
    <section id="room">
      <div class="stage" id="stage"><div class="stage-noise"></div>
        <div class="side-lights" aria-hidden="true"><div class="side-light side-light-left"><i></i><i></i><b></b></div><div class="side-light side-light-right"><i></i><i></i><b></b></div></div>
        <svg class="light-ribbons" viewBox="0 0 1200 600" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="ribbon-fill" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#327cdd" stop-opacity="0"/><stop offset=".52" stop-color="#3d8ff4" stop-opacity=".17"/><stop offset="1" stop-color="#8fd6ff" stop-opacity="0"/></linearGradient><linearGradient id="ribbon-edge"><stop stop-color="#357cf4" stop-opacity="0"/><stop offset=".48" stop-color="#b2e6ff"/><stop offset=".62" stop-color="#4da3ff" stop-opacity=".5"/><stop offset="1" stop-color="#246ac8" stop-opacity="0"/></linearGradient><filter id="ribbon-glow" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="9"/></filter></defs><path fill="url(#ribbon-fill)" d="M-80 270C230 310 290 30 650-50L300-80C270 160 150 230-80 270ZM480 660C770 590 860 455 1260 340L1260 660Z"/><g fill="none" stroke="url(#ribbon-edge)"><path class="ribbon-halo" d="M-80 270C230 310 290 30 650-50M480 660C770 590 860 455 1260 340M180 485C530 335 710 540 1130 470"/><path d="M-80 270C230 310 290 30 650-50M480 660C770 590 860 455 1260 340M180 485C530 335 710 540 1130 470"/></g></svg>
        <div class="stage-top"><span class="pill"><span class="online-dot"></span> <span id="source-label">AUTO DETECT</span></span><div class="stage-indicators"><span id="sync-label">WAITING FOR MUSIC</span><button id="exit-fullscreen" class="outline">Exit fullscreen</button></div></div>
        <div id="lyric-stack" class="lyric-stack" aria-live="off"></div>
        <div id="plain-lyrics" class="plain-lyrics" tabindex="0" aria-label="Lyrics without timestamps, scroll to read"></div>
        <div class="word-unavailable" role="status">No word timings returned by the enabled sources.<small>Enable the expanded source below, retry, or import timed lyrics.</small></div>
      </div>
      <div class="player"><div class="album-cover" id="album-cover"><svg aria-hidden="true" viewBox="0 0 64 32"><path d="M3 23C13 23 14 7 23 7S36 26 44 26 53 10 61 9"/></svg><img hidden alt="Current track artwork" decoding="async"></div><div class="track"><strong id="track-title"></strong><span id="track-artist"></span></div><div class="transport"><button id="previous" aria-label="Previous track">⏮</button><button class="play" id="toggle" aria-label="Play or pause">▶</button><button id="next" aria-label="Next track">⏭</button></div><div class="timeline"><span id="elapsed">0:00</span><progress id="progress" value="0" max="1" aria-label="Track progress"></progress><span id="duration">0:00</span></div></div>
      <div class="display-controls"><span>Display</span><div class="styles" role="group" aria-label="Display style"><button data-style="ship" class="selected">Ship</button><button data-style="lens">Fisheye</button><button data-style="lens-visual">Fisheye Visual</button><button data-style="visual">Visual</button></div><label>Motion <select id="motion-mode"><option value="adaptive">Adaptive</option><option value="calm">Calm</option></select></label></div>
    </section>
    <footer><label>Player <select id="sources" aria-label="Music source"><option value="auto">Automatic detection</option></select></label><label>Accent <input id="accent" type="color" value="#a5cee8" aria-label="Accent color"></label><label class="pin"><input id="pin" type="checkbox"> Always on top</label><label class="pin"><input id="motion" type="checkbox"> Reduce motion</label><label class="import">Import lyrics<input id="lrc" type="file" accept=".lrc,.txt,.yaml,.yml,.ttml"></label></footer>
    <div class="lyric-tools"><button id="retry-lyrics" class="outline">Retry lyrics</button><label id="match-label" hidden>Recording <select id="lyric-matches" aria-label="Choose lyric recording"></select></label><label><input id="expanded-provider" type="checkbox"> Expanded word source (LiriQo)</label></div>
    <p class="provider-note">Expanded search is on by default and sends the selected song’s title, artist and duration to LiriQo to search additional sources. Turn it off above at any time. Community service; availability can vary.</p>
    <p id="status" role="status"></p>
  </main>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
$('stage').insertAdjacentHTML('afterbegin','<div class="album-ambient" aria-hidden="true"></div><div class="album-ambient" aria-hidden="true"></div>');
document.querySelector('footer')!.insertAdjacentHTML('beforeend','<label class="pin"><input id="album-ambience" type="checkbox"> Album ambience <small>Experimental</small></label><label>Ambience strength <input id="ambience-strength" type="range" min="10" max="60" value="35" aria-label="Album ambience strength"><output id="ambience-value">35%</output></label>');
for (const element of document.querySelectorAll('footer,.lyric-tools,.provider-note')) $('connections').append(element);
const motionMode = $<HTMLSelectElement>('motion-mode');
motionMode.value = localStorage.getItem('voxi-motion-mode') === 'calm' ? 'calm' : 'adaptive';
motionMode.addEventListener('change', () => localStorage.setItem('voxi-motion-mode', motionMode.value));
$<HTMLInputElement>('expanded-provider').checked = localStorage.getItem('voxi-expanded-provider') !== 'false';
let lyricStage: ReturnType<typeof import('./lyric-stage').createLyricStage> | undefined;
let pageDisposed = false;
void import('./lyric-stage').then(({ createLyricStage }) => {
  if (pageDisposed) return;
  lyricStage = createLyricStage($('stage')); syncMotion();
}).catch(() => { $('stage').dataset.rendering = 'fallback'; });
const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
let userReducedMotion = localStorage.getItem('voxi-reduced-motion') === 'true';
function syncMotion() {
  document.body.classList.toggle('reduce-motion', userReducedMotion || systemMotion.matches);
  $<HTMLInputElement>('motion').checked = userReducedMotion || systemMotion.matches;
}
systemMotion.addEventListener('change', syncMotion);
const lyricRows = new Map<number, HTMLDivElement>();
let renderedLyrics: Line[] | undefined;
let sessions: Session[] = [];
let playerMode = localStorage.getItem('voxi-player-mode') || 'auto';
let selected = '';
let lyrics: Line[] = [];
let trackKey = '';
let lyricsRequest = 0;
let abortLyrics: AbortController | undefined;
let lastLine = -99;
let timestamp = performance.now();
const idleSession = (): Session => ({ id: '', title: 'Play something you love', artist: 'Open Spotify or your music browser', album: '', playing: false, position: 0, duration: 0, rate: 1 });
let current: Session = idleSession();
let offset = 0;
let lyricState = 'WAITING FOR MUSIC';
let lyricCandidates: LyricRecord[] = [];
let plainLyrics = '';
const albumArt = createAlbumArt($('album-cover'),$('stage'),track=>native ? invoke<string|null>('media_artwork',track) : Promise.resolve(null),()=>userReducedMotion||systemMotion.matches);
const ambience=$<HTMLInputElement>('album-ambience'),strength=$<HTMLInputElement>('ambience-strength');
ambience.checked=localStorage.getItem('voxi-album-ambience')==='true';
const savedStrength=Number(localStorage.getItem('voxi-ambience-strength')??35);
strength.value=String(Number.isFinite(savedStrength)?Math.max(10,Math.min(60,savedStrength)):35);
function configureAmbience(){
  strength.disabled=!ambience.checked;
  $('ambience-value').textContent=`${strength.value}%`;
  albumArt.configure(ambience.checked,Number(strength.value)/100);
}
ambience.addEventListener('change',()=>{localStorage.setItem('voxi-album-ambience',String(ambience.checked));configureAmbience();});
strength.addEventListener('change',()=>{localStorage.setItem('voxi-ambience-strength',strength.value);configureAmbience();});
configureAmbience();

function status(text: string) { $('status').textContent = text; }
function clearLyrics() {
  plainLyrics = ''; $('plain-lyrics').textContent = '';
  lyrics = []; lastLine = -99;
  lyricStage?.clear();
  $('lyric-stack').replaceChildren(); lyricRows.clear(); renderedLyrics = undefined;
  $('stage').dataset.timing = 'loading';
}
function clock(seconds: number) { const s = Math.max(0, Math.floor(seconds)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

function showTrack() {
  void albumArt.track(current);
  $('stage').dataset.playing = String(current.playing);
  $('track-title').textContent = current.title || 'Untitled media';
  $('track-artist').textContent = current.artist || current.id;
  $('source-label').textContent = current.id ? playerLabel(current.id).toUpperCase() : 'AUTO DETECT';
  $('toggle').textContent = current.playing ? 'Ⅱ' : '▶';
  for (const id of ['toggle','previous','next']) $<HTMLButtonElement>(id).disabled = !current.id;
  $('sync-label').textContent = lyricState;
}

async function loadLyrics(track: Session) {
  const request = ++lyricsRequest;
  abortLyrics?.abort();
  abortLyrics = new AbortController();
  const signal = abortLyrics.signal;
  clearLyrics();
  lyricCandidates = []; $('match-label').hidden = true;
  lyricState = 'FINDING LYRICS'; showTrack();
  if (!track.artist || !track.title) {
    lyricState = 'TRACK METADATA INCOMPLETE'; showTrack();
    status('This player has not shared an artist and title. You can import an LRC file.'); return;
  }
  try {
    const [lookup, catalog, expanded] = await Promise.allSettled([
      resolveLyrics(track, { signal, onStatus: message => { if (request === lyricsRequest) status(message); } }),
      findWordCatalog(track, signal),
      $<HTMLInputElement>('expanded-provider').checked ? findExpandedWords(track, signal) : Promise.resolve(undefined),
    ]);
    if (request !== lyricsRequest) return;
    const extras = [expanded.status === 'fulfilled' ? expanded.value : undefined, catalog.status === 'fulfilled' ? catalog.value : undefined].filter((item): item is LyricRecord => !!item);
    const wordRecord = extras.find(hasRealWords) ?? extras[0];
    if (lookup.status === 'rejected' && !wordRecord) throw lookup.reason;
    const result = lookup.status === 'fulfilled' ? lookup.value : { record: undefined as LyricRecord | undefined, candidates: [] as LyricRecord[], searched: true };
    if (wordRecord && (!result.record || !hasRealWords(result.record) && (hasRealWords(wordRecord) || !recordLines(result.record).length))) { result.record = wordRecord; result.candidates.unshift(wordRecord); }
    if (request !== lyricsRequest) return;
    lyricCandidates = result.candidates;
    const picker = $<HTMLSelectElement>('lyric-matches');
    picker.replaceChildren(new Option('Choose a recording…', ''), ...lyricCandidates.map(record => new Option(`${record.trackName} · ${record.artistName} · ${record.albumName} (${clock(record.duration)})`, String(record.id))));
    $('match-label').hidden = !lyricCandidates.length;
    if (result.record) { applyLyricRecord(result.record, false); picker.value = String(result.record.id); }
    else {
      lyricState = lyricCandidates.length ? 'CHOOSE A RECORDING' : 'NO MATCHING LYRICS';
      status(lyricCandidates.length ? 'Possible recordings found, but the duration differs. Choose one to try, or import an LRC file.' : 'No matching timed lyrics returned by the enabled sources. This does not establish that timings are unavailable elsewhere.');
    }
    if (expanded.status === 'rejected' && !signal.aborted) status(`${$('status').textContent} Expanded source failed: ${String(expanded.reason)} Retry later; this is not a confirmed absence of word data.`);
  } catch (error) {
    if (request !== lyricsRequest) return;
    lyricState = 'LYRICS UNAVAILABLE';
    status(error instanceof Error && error.name === 'TimeoutError' ? 'Lyrics lookup timed out. Use Retry lyrics.' : `Provider request failed; availability is unknown. ${String(error)}`);
  }
  lastLine = -99;
  showTrack();
}

function applyLyricRecord(record: LyricRecord, manual: boolean) {
  plainLyrics = record.plainLyrics ?? '';
  $('plain-lyrics').textContent = plainLyrics;
  $('plain-lyrics').scrollTop = 0;
  lyrics = recordLines(record);
  lastLine = -99;
  const wordTimed = lyrics.some(line => line.words?.length);
  lyricState = record.instrumental ? 'INSTRUMENTAL' : wordTimed ? `${record.provider ?? 'LRCLIB'} · WORD TIMINGS` : lyrics.length ? `${record.provider ?? 'LRCLIB'} · LINE SYNC` : plainLyrics.trim() ? 'LYRICS · MANUAL SCROLL' : 'LYRICS UNAVAILABLE';
  status(`${manual ? 'Manually selected' : 'Matched'}: ${record.trackName} · ${record.artistName} (${clock(record.duration)}). ${wordTimed ? 'Word timestamps available; untimed lines retain line sync.' : 'Only line timing available for this recording.'} ${manual ? 'Timing may differ.' : ''}`);
  showTrack();
}

function activate() {
  lyricsRequest++; abortLyrics?.abort();
  const track = sessions.find(s => s.id === selected);
  if (!track) {
    clearLyrics(); trackKey = ''; current = idleSession(); offset = 0;
    lyricState = 'WAITING FOR MUSIC';
    status('Start music in Spotify or a browser. Voxi follows Windows media playback automatically.');
    showTrack(); return;
  }
  current = track; offset = current.position; timestamp = performance.now();
  lastLine = -99;
  if (trackKey !== `${track.id}|${track.title}|${track.artist}|${track.album}`) {
    trackKey = `${track.id}|${track.title}|${track.artist}|${track.album}`;
    void loadLyrics(track);
  }
  showTrack();
}

async function poll() {
  if (!native) { $('bridge-status').textContent = 'Browser preview: use npm run desktop for real Windows connections.'; return; }
  try {
    const next = await invoke<Session[]>('media_sessions');
    const previous = sessions;
    const changed = sessions.map(s => s.id).join() !== next.map(s => s.id).join();
    sessions = next;
    if (changed) {
      const select = $<HTMLSelectElement>('sources');
      select.replaceChildren(new Option('Automatic detection', 'auto'), ...sessions.map(s => new Option(playerLabel(s.id), s.id)));
      if (playerMode !== 'auto' && !sessions.some(s => s.id === playerMode)) select.add(new Option(`${playerLabel(playerMode)} (disconnected)`, playerMode));
      select.value = playerMode;
    }
    const chosen = playerMode === 'auto' ? choosePlayer(sessions,selected,previous) : sessions.find(s => s.id === playerMode);
    const nextId = chosen?.id ?? '';
    if (nextId !== selected) { selected = nextId; trackKey = ''; activate(); }
    $('bridge-status').textContent = `Windows media bridge connected · ${sessions.length} player(s) found.`;
    if (selected) {
      const track = sessions.find(s => s.id === selected);
      if (track) {
        const key = `${track.id}|${track.title}|${track.artist}|${track.album}`;
        current = track;
        if (key !== trackKey) { trackKey = key; void loadLyrics(track); }
        offset = current.position; timestamp = performance.now(); showTrack();
      } else {
        lyricsRequest++; abortLyrics?.abort(); clearLyrics();
        trackKey = ''; lyricCandidates = []; $('match-label').hidden = true;
        current.playing = false; lyricState = 'PLAYER DISCONNECTED'; showTrack();
        status('Player disconnected. Play music again or choose another source.');
      }
    }
  } catch (error) { $('bridge-status').textContent = `Bridge error: ${String(error)}`; status(`Windows media bridge: ${String(error)}`); }
}

function renderFrame(now: number) {
  let position = offset + (current.playing ? (now - timestamp) / 1000 * current.rate : 0);
  position = Math.max(0, Math.min(position, current.duration || position));
  $('stage').dataset.timing = lyrics.some(line => line.words?.length) ? 'word' : lyrics.length ? 'line' : plainLyrics.trim() ? 'plain' : 'empty';
  lyricStage?.render(lyrics, position, $('stage').dataset.style ?? 'lens-visual', userReducedMotion || systemMotion.matches, $<HTMLInputElement>('accent').value, `${current.id}|${current.title}|${current.artist}`, motionMode.value === 'adaptive');
  const index = activeLine(lyrics, position);
  if (index !== lastLine) {
    lastLine = index;
    const stack = $('lyric-stack');
    if (renderedLyrics !== lyrics) { stack.replaceChildren(); lyricRows.clear(); renderedLyrics = lyrics; }
    if (!lyrics.length) {
      stack.replaceChildren(); lyricRows.clear();
      const line = document.createElement('div'); line.className = 'lyric current'; line.textContent = current.title || 'A moment for the music'; stack.append(line);
      line.style.setProperty('--row', '0');
    } else {
      for (const [key, row] of lyricRows) {
        if (Math.abs(key - index) > 3) { row.remove(); lyricRows.delete(key); }
      }
      for (let i = Math.max(0, index - 2); i <= Math.min(lyrics.length - 1, index + 3); i++) {
        let line = lyricRows.get(i);
        if (!line) {
          line = document.createElement('div'); line.className = 'lyric entering'; line.textContent = lyrics[i].text;
          line.style.setProperty('--row', String(i - index)); stack.append(line); lyricRows.set(i, line);
          // Commit initial transform so a newly arriving row has an entry transition.
          void line.offsetWidth;
        }
        line.className = `lyric ${i === index ? 'current' : i < index ? 'past' : 'upcoming'}`;
        line.style.setProperty('--row', String(i - index));
        line.style.setProperty('--distance', String(Math.abs(i - index)));
      }
    }
  }
  $('elapsed').textContent = clock(position); $('duration').textContent = clock(current.duration);
  $<HTMLProgressElement>('progress').value = current.duration ? position / current.duration : 0;
  requestAnimationFrame(renderFrame);
}

$('sources').addEventListener('change', () => {
  playerMode = $<HTMLSelectElement>('sources').value;
  localStorage.setItem('voxi-player-mode',playerMode);
  selected = playerMode === 'auto' ? choosePlayer(sessions,selected,[])?.id ?? '' : playerMode;
  trackKey = ''; activate();
});
for (const [id, action] of [['toggle', 'toggle'], ['previous', 'previous'], ['next', 'next']]) {
  $(id).addEventListener('click', async () => {
    if (!selected) return;
    try { const ok = await invoke<boolean>('media_control', { id: selected, action }); if (!ok) status('This player declined the media command.'); await poll(); }
    catch (error) { status(String(error)); }
  });
}
document.querySelectorAll<HTMLButtonElement>('[data-style]').forEach(button => button.addEventListener('click', () => {
  document.querySelector('.styles .selected')?.classList.remove('selected'); button.classList.add('selected');
  document.querySelectorAll<HTMLButtonElement>('[data-style]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  $('stage').dataset.style = button.dataset.style; localStorage.setItem('voxi-style', button.dataset.style!);
}));
const savedStyle = localStorage.getItem('voxi-style');
// Apply the new default once to existing installations, then remember later choices.
const styleDefaultApplied = localStorage.getItem('voxi-fisheye-default') === 'true';
const initialStyle = styleDefaultApplied && savedStyle && ['ship', 'lens', 'lens-visual', 'visual'].includes(savedStyle) ? savedStyle : 'lens-visual';
document.querySelector<HTMLButtonElement>(`[data-style="${initialStyle}"]`)?.click();
localStorage.setItem('voxi-fisheye-default', 'true');
const savedAccent = localStorage.getItem('voxi-accent');
if (savedAccent && /^#[\da-f]{6}$/i.test(savedAccent)) { document.documentElement.style.setProperty('--accent', savedAccent); $<HTMLInputElement>('accent').value = savedAccent; }
$('accent').addEventListener('input', () => { const value = $<HTMLInputElement>('accent').value; document.documentElement.style.setProperty('--accent', value); localStorage.setItem('voxi-accent', value); });
$('motion').addEventListener('change', () => { userReducedMotion = $<HTMLInputElement>('motion').checked; localStorage.setItem('voxi-reduced-motion', String(userReducedMotion)); syncMotion(); });
$('pin').addEventListener('change', async () => {
  const checkbox = $<HTMLInputElement>('pin');
  if (!native) { checkbox.checked = false; status('Always on top is available in the Windows app.'); return; }
  try { await getCurrentWindow().setAlwaysOnTop(checkbox.checked); } catch (error) { checkbox.checked = false; status(String(error)); }
});
async function fullscreen() {
  try {
    if (native) { const win = getCurrentWindow(); const next = !await win.isFullscreen(); await win.setFullscreen(next); document.body.classList.toggle('immersive', next); }
    else if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (error) { status(String(error)); }
}
$('fullscreen').addEventListener('click', fullscreen);
$('exit-fullscreen').addEventListener('click', fullscreen);
document.addEventListener('fullscreenchange', () => document.body.classList.toggle('immersive', !!document.fullscreenElement));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && native && document.body.classList.contains('immersive')) void fullscreen(); });
function showPage(settings: boolean) {
  $('connections').hidden = !settings; $('room').hidden = settings;
  $('nav-stage').classList.toggle('active', !settings); $('nav-connections').classList.toggle('active', settings);
  $('page-title').textContent = settings ? 'Settings' : 'Listening room';
  $('fullscreen').hidden = settings;
  $('nav-stage').setAttribute('aria-current', settings ? 'false' : 'page');
  $('nav-connections').setAttribute('aria-current', settings ? 'page' : 'false');
}
$('nav-connections').addEventListener('click', () => showPage(true));
$('nav-stage').addEventListener('click', () => showPage(false));
document.querySelector('.brand')?.addEventListener('click', event => { event.preventDefault(); showPage(false); });
$('refresh').addEventListener('click', () => void poll());
$('retry-lyrics').addEventListener('click', () => {
  if (!selected) { status('Start music in a player to look up its lyrics.'); return; }
  void loadLyrics({ ...current });
});
$('expanded-provider').addEventListener('change', () => {
  localStorage.setItem('voxi-expanded-provider', String($<HTMLInputElement>('expanded-provider').checked));
  if (selected) void loadLyrics({ ...current });
});
$('lyric-matches').addEventListener('change', () => {
  const record = lyricCandidates.find(item => String(item.id) === $<HTMLSelectElement>('lyric-matches').value);
  if (record) applyLyricRecord(record, true);
});
$('lrc').addEventListener('change', async () => {
  const file = $<HTMLInputElement>('lrc').files?.[0]; if (!file) return;
  if (file.size > 2_000_000) { status('Please choose an LRC file smaller than 2 MB.'); return; }
  lyricsRequest++; abortLyrics?.abort();
  lyricCandidates = []; $('match-label').hidden = true;
  try { const source = await file.text(); lyrics = /\.ttml$/i.test(file.name) ? parseTtml(source).lines : /\.ya?ml$/i.test(file.name) ? parseLyricsfile(source) : parseLrc(source); }
  catch (error) { status(String(error)); return; }
  lastLine = -99;
  lyricState = lyrics.some(line => line.words?.length) ? 'IMPORTED · WORD SYNC' : lyrics.length ? 'IMPORTED · LINE SYNC' : 'NO TIMESTAMPS'; showTrack();
  status(lyrics.length ? `Loaded ${lyrics.length} timed lines from ${file.name}.` : 'No valid timed lines found.');
});
activate(); void poll();
syncMotion();
const sceneSettings = new MutationObserver(syncMotion);
sceneSettings.observe($('toggle'), { childList: true });
$('accent').addEventListener('input', syncMotion);
window.addEventListener('pagehide', () => { pageDisposed = true; albumArt.dispose(); lyricStage?.dispose(); sceneSettings.disconnect(); systemMotion.removeEventListener('change', syncMotion); }, { once: true });
// Schedule after completion so slow native calls cannot accumulate.
async function schedulePoll() { await poll(); setTimeout(schedulePoll, 500); }
setTimeout(schedulePoll, 1000);
requestAnimationFrame(renderFrame);
