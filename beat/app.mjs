import { voices, presets, steps, minBpm, maxBpm, hasHit, seededGroove, decodeGroove, encodeGroove, makeKit, renderLoop, encodeWave } from './engine.mjs';

const byId = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const given = decodeGroove(query.get('score')) ?? (query.has('seed') ? seededGroove(query.get('seed')) : null);
let rows = [...(given ?? presets[0]).rows];
let bpm = (given ?? presets[0]).bpm;
const rate = 44100;
const kit = makeKit(rate);
let samples;
let context;
let current;
let frame;
let lastStep = -1;
let starting = false;
let request = 0;
let page = 0;
let focusVoice = 0;
let focusStep = 0;
let cells = [];
let numbers = [];
const small = matchMedia('(max-width: 760px)');
const canvas = byId('wave');
const select = byId('preset');

presets.forEach((preset, i) => select.add(new Option(preset.name, String(i))));
const custom = new Option('自定义', 'custom');
custom.disabled = true;
select.add(custom);

function updateLinks() {
  const url = new URL(location.href);
  url.searchParams.delete('seed');
  url.searchParams.set('score', encodeGroove(rows, bpm));
  history.replaceState(null, '', url);
}

function showWave() {
  const width = Math.max(1, Math.round(canvas.clientWidth * devicePixelRatio));
  const height = Math.max(1, Math.round(canvas.clientHeight * devicePixelRatio));
  canvas.width = width;
  canvas.height = height;
  const pen = canvas.getContext('2d');
  const mid = height / 2;
  pen.fillStyle = '#45493f';
  pen.fillRect(0, Math.floor(mid), width, 1);
  for (let step = 0; step < steps; step++) {
    pen.fillRect(Math.floor(width * step / steps), step % 4 ? height * 0.25 : 0, 1, step % 4 ? height * 0.5 : height);
  }
  const pitch = Math.max(2, Math.round(3 * devicePixelRatio));
  pen.fillStyle = '#ffb076';
  for (let x = 0; x < width; x += pitch) {
    const begin = Math.floor(x * samples.length / width);
    const end = Math.min(samples.length, Math.floor((x + pitch) * samples.length / width));
    let peak = 0;
    for (let i = begin; i < end; i++) peak = Math.max(peak, Math.abs(samples[i]));
    const size = Math.min(mid, peak * mid * 1.35);
    pen.fillRect(x, mid - size, Math.max(1, pitch - devicePixelRatio), Math.max(1, size * 2));
  }
}

function positionAt(time) {
  if (!current) return 0;
  return ((current.offset + Math.max(0, time - current.when)) % current.duration) / current.duration;
}

function endSource(track, when) {
  const gain = track.gain.gain;
  // Some engines have no cancelAndHoldAtTime. Calculate the short fade-in ourselves.
  const level = Math.max(0, Math.min(1, (when - track.when) / 0.012));
  gain.cancelScheduledValues(when);
  gain.setValueAtTime(level, when);
  gain.linearRampToValueAtTime(0, when + 0.012);
  track.source.stop(when + 0.014);
}

function installSource() {
  const buffer = context.createBuffer(1, samples.length, rate);
  buffer.copyToChannel(samples, 0);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const gain = context.createGain();
  const when = context.currentTime + 0.01;
  const offset = positionAt(when) * buffer.duration;
  if (current) endSource(current, when);
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(1, when + 0.012);
  source.connect(gain).connect(context.destination);
  source.onended = () => { source.disconnect(); gain.disconnect(); };
  source.start(when, offset);
  current = { source, gain, duration: buffer.duration, offset, when };
}

function updateHead(step) {
  if (lastStep === step) return;
  for (const { button, column } of cells) button.classList.toggle('current', column === step);
  for (const { element, column } of numbers) element.classList.toggle('current', column === step);
  byId('counter').textContent = String(Math.max(0, step) + 1).padStart(2, '0') + ' / 16';
  lastStep = step;
}

function animate() {
  if (!current) return;
  const fraction = positionAt(context.currentTime);
  byId('needle').hidden = false;
  byId('needle').style.left = (fraction * 100) + '%';
  updateHead(Math.floor(fraction * steps));
  frame = requestAnimationFrame(animate);
}

function drawPads() {
  for (const { button, voice, column } of cells) {
    button.setAttribute('aria-pressed', String(hasHit(rows, voice, column)));
    button.tabIndex = voice === focusVoice && column === focusStep ? 0 : -1;
  }
}

function refresh(writeUrl = true) {
  samples = renderLoop(rows, bpm, rate, kit);
  if (current) installSource();
  byId('bpm').value = bpm;
  const i = presets.findIndex(p => p.bpm === bpm && p.rows.every((r, v) => r === rows[v]));
  select.value = i < 0 ? 'custom' : String(i);
  if (writeUrl) {
    updateLinks();
    byId('sharebox').hidden = true;
    byId('status').textContent = '';
  }
  showWave();
  drawPads();
}

function resetGrid(moveFocus = false) {
  const range = small.matches ? Array.from({ length: 8 }, (_, i) => i + page * 8) : Array.from({ length: steps }, (_, i) => i);
  if (!range.includes(focusStep)) focusStep = range[0];
  const grid = byId('grid');
  grid.replaceChildren();
  cells = [];
  numbers = [];
  const ruler = document.createElement('div');
  ruler.className = 'row ruler';
  ruler.setAttribute('aria-hidden', 'true');
  ruler.append(document.createElement('span'));
  for (const column of range) {
    const element = document.createElement('span');
    element.className = 'number' + (column % 4 === 0 ? ' beat-start' : '');
    element.textContent = String(column + 1).padStart(2, '0');
    ruler.append(element);
    numbers.push({ element, column });
  }
  grid.append(ruler);
  voices.forEach((v, voice) => {
    const row = document.createElement('div');
    row.className = 'row';
    const label = document.createElement('div');
    label.className = 'voice';
    const strong = document.createElement('strong');
    strong.textContent = v.name;
    const short = document.createElement('small');
    short.textContent = v.short;
    label.append(strong, short);
    row.append(label);
    for (const column of range) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pad' + (Math.floor(column / 4) % 2 ? ' alt' : '');
      button.setAttribute('aria-label', v.name + '，第 ' + (column + 1) + ' 步');
      button.addEventListener('focus', () => {
        focusStep = column;
        focusVoice = voice;
        drawPads();
      });
      button.addEventListener('click', () => {
        rows[voice] ^= 1 << column;
        refresh();
      });
      button.addEventListener('keydown', event => {
        const delta = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[event.key];
        if (!delta) return;
        event.preventDefault();
        focusVoice = (voice + delta[0] + voices.length) % voices.length;
        focusStep = (column + delta[1] + steps) % steps;
        if (small.matches && page !== Math.floor(focusStep / 8)) {
          page = Math.floor(focusStep / 8);
          resetGrid(true);
        } else {
          cells.find(c => c.voice === focusVoice && c.column === focusStep).button.focus();
        }
      });
      row.append(button);
      cells.push({ button, voice, column });
    }
    grid.append(row);
  });
  byId('first').setAttribute('aria-pressed', String(page === 0));
  byId('last').setAttribute('aria-pressed', String(page === 1));
  drawPads();
  lastStep = -2;
  updateHead(current ? Math.floor(positionAt(context.currentTime) * steps) : -1);
  if (moveFocus) cells.find(c => c.voice === focusVoice && c.column === focusStep).button.focus();
}

function transportUI() {
  const button = byId('play');
  button.classList.toggle('playing', Boolean(current || starting));
  button.querySelector('span').textContent = current || starting ? '停止' : '播放';
}

function stop() {
  request++;
  starting = false;
  if (current) endSource(current, context.currentTime);
  current = null;
  cancelAnimationFrame(frame);
  byId('needle').hidden = true;
  updateHead(-1);
  transportUI();
}

byId('play').addEventListener('click', async () => {
  if (current || starting) { stop(); return; }
  const attempt = ++request;
  starting = true;
  transportUI();
  try {
    context ??= new AudioContext();
    await context.resume();
    if (attempt !== request) return;
    starting = false;
    installSource();
    transportUI();
    animate();
    byId('status').textContent = '';
  } catch {
    if (attempt !== request) return;
    stop();
    byId('status').textContent = '浏览器暂时无法播放声音，仍可导出 WAV。';
  }
});

function setTempo(value) {
  bpm = Number.isFinite(value) ? Math.max(minBpm, Math.min(maxBpm, Math.round(value))) : bpm;
  refresh();
}
byId('bpm').addEventListener('change', e => setTempo(e.target.valueAsNumber));
byId('slower').addEventListener('click', () => setTempo(bpm - 1));
byId('faster').addEventListener('click', () => setTempo(bpm + 1));
select.addEventListener('change', () => {
  const p = presets[Number(select.value)];
  if (!p) return;
  rows = [...p.rows];
  bpm = p.bpm;
  refresh();
});
byId('shuffle').addEventListener('click', () => {
  const p = seededGroove(crypto.getRandomValues(new Uint32Array(1))[0]);
  rows = p.rows;
  bpm = p.bpm;
  refresh();
});
for (const [index, id] of ['first', 'last'].entries()) {
  byId(id).addEventListener('click', () => { page = index; resetGrid(); });
}
byId('export').addEventListener('click', () => {
  const objectURL = URL.createObjectURL(new Blob([encodeWave(samples, rate)], { type: 'audio/wav' }));
  const link = document.createElement('a');
  link.href = objectURL;
  link.download = 'beat-press-' + bpm + 'bpm.wav';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectURL), 15000);
  byId('status').textContent = '已生成一小节 WAV。';
});
byId('share').addEventListener('click', async () => {
  updateLinks();
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    byId('status').textContent = '鼓谱链接已复制。';
  } catch {
    byId('sharebox').hidden = false;
    byId('share-url').value = url;
    byId('share-url').select();
    byId('status').textContent = '复制下方链接即可分享当前鼓谱。';
  }
});
window.addEventListener('pagehide', stop);
small.addEventListener('change', () => { page = Math.floor(focusStep / 8); resetGrid(); });
window.addEventListener('resize', showWave);
resetGrid();
refresh(false);
