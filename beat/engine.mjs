export const steps = 16;
export const minBpm = 50;
export const maxBpm = 190;
export const voices = [
  { id: 'kick', name: '底鼓', short: 'BD' },
  { id: 'snare', name: '军鼓', short: 'SD' },
  { id: 'hat', name: '闭镲', short: 'HH' },
  { id: 'clap', name: '拍手', short: 'CP' },
  { id: 'rim', name: '边击', short: 'RS' },
];

const mask = positions => positions.reduce((bits, n) => bits | (1 << (n - 1)), 0);
export const presets = [
  { name: '纸带放克', bpm: 104, rows: [[1, 7, 11], [5, 13], [1, 3, 5, 7, 9, 11, 13, 15, 16], [13], [4, 12]].map(mask) },
  { name: '夜车四拍', bpm: 126, rows: [[1, 5, 9, 13], [5, 13], [3, 7, 11, 14, 15], [5, 13], [8, 16]].map(mask) },
  { name: '对岸回声', bpm: 82, rows: [[1, 8, 10], [9], [1, 4, 7, 10, 13, 16], [9], [6, 12, 15]].map(mask) },
];

export function hasHit(rows, voice, step) {
  return Boolean(rows[voice] & (1 << step));
}

function randomSource(text) {
  let state = 2166136261;
  for (const char of text) state = Math.imul(state ^ char.codePointAt(0), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let n = Math.imul(state ^ (state >>> 15), state | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededGroove(seed) {
  const random = randomSource(String(seed));
  const base = presets[Math.floor(random() * presets.length)];
  const rows = [...base.rows];
  // Keep the downbeat and the main snare. Decorate their spaces instead.
  const variations = [[2, 6, 10, 14], [3, 11, 15], [1, 5, 9, 13, 15], [4, 12], [2, 6, 9, 14]];
  variations.forEach((candidates, voice) => {
    for (const step of candidates) if (random() < 0.34) rows[voice] ^= 1 << step;
  });
  return { rows, bpm: base.bpm + Math.round(random() * 12) - 6 };
}

export function encodeGroove(rows, bpm) {
  return bpm + '.' + rows.map(row => row.toString(16).padStart(4, '0')).join('');
}

export function decodeGroove(value) {
  const match = /^(\d{2,3})\.([0-9a-f]{20})$/i.exec(value ?? '');
  if (!match) return null;
  const bpm = Number(match[1]);
  if (bpm < minBpm || bpm > maxBpm) return null;
  return { bpm, rows: match[2].match(/.{4}/g).map(hex => parseInt(hex, 16)) };
}

const tau = Math.PI * 2;
const lengths = [0.34, 0.22, 0.075, 0.24, 0.12];
export function makeKit(rate) {
  return voices.map(({ id }, voice) => {
    const noise = randomSource(id);
    let low = 0;
    const sample = new Float32Array(Math.ceil(lengths[voice] * rate));
    for (let i = 0; i < sample.length; i++) {
      const t = i / rate;
      const n = noise() * 2 - 1;
      low += (1 - Math.exp(-tau * 1800 / rate)) * (n - low);
      const high = n - low;
      let y;
      switch (id) {
        case 'kick': {
          const phase = tau * (47 * t + 3.5 * (1 - Math.exp(-t * 36)));
          y = 0.92 * Math.sin(phase) * Math.exp(-t * 14);
          break;
        }
        case 'snare':
          y = 0.58 * high * Math.exp(-t * 23) + 0.36 * Math.sin(tau * 178 * t) * Math.exp(-t * 38);
          break;
        case 'hat':
          y = 0.30 * high * Math.exp(-t * 72);
          break;
        case 'clap': {
          const burst = offset => t < offset ? 0 : Math.exp(-(t - offset) * 185);
          y = high * (0.32 * (burst(0) + burst(0.013) + burst(0.027)) + 0.23 * Math.exp(-t * 20));
          break;
        }
        case 'rim':
          y = 0.34 * (Math.sin(tau * 695 * t) + 0.4 * Math.sin(tau * 1128 * t)) * Math.exp(-t * 65);
          break;
      }
      const edge = Math.min(1, i / (rate * 0.001), (sample.length - 1 - i) / (rate * 0.008));
      sample[i] = y * edge;
    }
    return sample;
  });
}

export function renderLoop(rows, bpm, rate, kit = makeKit(rate)) {
  const bar = new Float32Array(Math.round(rate * 240 / bpm));
  for (let voice = 0; voice < voices.length; voice++) {
    for (let step = 0; step < steps; step++) {
      if (!hasHit(rows, voice, step)) continue;
      const start = Math.round(step * bar.length / steps);
      const hit = kit[voice];
      const velocity = step % 4 === 0 ? 1 : step % 2 === 0 ? 0.88 : 0.74;
      // The exported bar tiles seamlessly, including decay from the last step.
      for (let i = 0; i < hit.length; i++) bar[(start + i) % bar.length] += velocity * hit[i];
    }
  }
  for (let i = 0; i < bar.length; i++) bar[i] = 0.94 * Math.tanh(bar[i]);
  return bar;
}

export function encodeWave(samples, rate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const label = (pos, str) => [...str].forEach((c, i) => view.setUint8(pos + i, c.charCodeAt(0)));
  label(0, 'RIFF');
  view.setUint32(4, buffer.byteLength - 8, true);
  label(8, 'WAVE');
  label(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  label(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(s * (s < 0 ? 32768 : 32767)), true);
  }
  return buffer;
}
