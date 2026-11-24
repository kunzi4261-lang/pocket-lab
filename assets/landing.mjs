import { drawCity, DEFAULT_SEED } from '../city/harbor.mjs';
import { presets, voices, steps, hasHit, renderLoop } from '../beat/engine.mjs';

const cityCanvas = document.querySelector('#city-preview');
const moods = [...document.querySelectorAll('[data-mood]')];
function previewCity(button) {
  const mood = button.dataset.mood;
  drawCity(cityCanvas, DEFAULT_SEED, mood);
  cityCanvas.setAttribute('aria-label', `种子 ${DEFAULT_SEED} 生成的${button.textContent}港湾`);
  for (const item of moods) item.setAttribute('aria-pressed', String(item === button));
  const params = new URLSearchParams({ seed: DEFAULT_SEED, mood });
  for (const id of ['city-open', 'city-title-link']) {
    document.getElementById(id).href = 'city/?' + params;
  }
}
for (const mood of moods) mood.addEventListener('click', () => previewCity(mood));
previewCity(moods.find(item => item.getAttribute('aria-pressed') === 'true'));

const groove = presets[0];
document.getElementById('bpm').textContent = groove.bpm;
document.getElementById('preset-name').textContent = groove.name;
const legend = document.querySelector('.voices');
for (const voice of voices) {
  const item = document.createElement('li');
  item.append(document.createElement('i'), `${voice.short} ${voice.name}`);
  legend.append(item);
}

const dial = document.getElementById('beat-preview');
const pen = dial.getContext('2d');
const tau = 2 * Math.PI;
function drawDial(playhead = -1) {
  const size = dial.width;
  pen.setTransform(size / 400, 0, 0, size / 400, size / 2, size / 2);
  pen.clearRect(-200, -200, 400, 400);
  // The outer lane matches the first voice; each quarter of the dial is one beat.
  for (let voice = 0; voice < voices.length; voice++) {
    const radius = 169 - voice * 24;
    for (let step = 0; step < steps; step++) {
      const hit = hasHit(groove.rows, voice, step);
      const start = -Math.PI / 2 + tau * step / steps;
      pen.beginPath();
      pen.arc(0, 0, radius, start + .016, start + tau / steps - .016);
      pen.lineWidth = 19;
      pen.strokeStyle = step === playhead ? (hit ? '#fff2cc' : '#ffc899') : hit ? '#29251e' : '#dc6030';
      pen.stroke();
    }
  }
  for (let index = 0; index < steps * 4; index++) {
    const angle = tau * index / (steps * 4) - Math.PI / 2;
    const long = index % 16 === 0;
    const outer = long ? 197 : 188;
    pen.beginPath();
    pen.moveTo(182 * Math.cos(angle), 182 * Math.sin(angle));
    pen.lineTo(outer * Math.cos(angle), outer * Math.sin(angle));
    pen.lineWidth = long ? 3 : 1.4;
    pen.strokeStyle = long ? '#29251e' : '#aa4a28';
    pen.stroke();
  }
  pen.fillStyle = '#29251e';
  pen.textAlign = 'center';
  pen.font = 'bold 49px ui-monospace, Consolas, monospace';
  pen.fillText(playhead === -1 ? '16' : String(playhead + 1).padStart(2, '0'), 0, 7);
  pen.font = 'bold 14px ui-monospace, Consolas, monospace';
  pen.fillText(playhead === -1 ? 'STEPS' : 'STEP', 0, 31);
  Array.from(legend.children).forEach((item, voice) => {
    item.classList.toggle('active', playhead !== -1 && hasHit(groove.rows, voice, playhead));
  });
}
drawDial();

const audition = document.getElementById('audition');
const label = document.getElementById('audition-label');
const feedback = document.getElementById('feedback');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let audio;
let buffer;
let source;
let frame;
let playing = false;
let generation = 0;
function stop() {
  generation++;
  playing = false;
  cancelAnimationFrame(frame);
  if (source) {
    source.onended = null;
    source.stop();
    source.disconnect();
    source = null;
  }
  audition.setAttribute('aria-pressed', 'false');
  label.textContent = '试听一圈';
  drawDial();
}

audition.addEventListener('click', async () => {
  if (playing) return stop();
  const current = ++generation;
  playing = true;
  audition.setAttribute('aria-pressed', 'true');
  label.textContent = '停止试听';
  feedback.textContent = '';
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    audio ??= new Audio();
    await audio.resume();
    if (generation !== current) return;
    if (!buffer) {
      const rate = 44100;
      const samples = renderLoop(groove.rows, groove.bpm, rate);
      buffer = audio.createBuffer(1, samples.length, rate);
      buffer.copyToChannel(samples, 0);
    }
    source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    source.onended = () => { if (generation === current) stop(); };
    const start = audio.currentTime;
    source.start(start);
    let lastStep = -1;
    function update() {
      if (generation !== current || reduceMotion.matches) return;
      const step = Math.min(steps - 1, Math.floor((audio.currentTime - start) * steps / buffer.duration));
      if (step !== lastStep) {
        drawDial(step);
        lastStep = step;
      }
      frame = requestAnimationFrame(update);
    }
    update();
  } catch {
    if (generation === current) {
      stop();
      feedback.textContent = '试听未能启动。请检查浏览器的音频权限，再点一次试听。';
    }
  }
});
window.addEventListener('pagehide', stop);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && playing) stop();
});
