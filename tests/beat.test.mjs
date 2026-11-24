import test from 'node:test';
import assert from 'node:assert/strict';
import { presets, voices, hasHit, seededGroove, encodeGroove, decodeGroove, makeKit, renderLoop, encodeWave } from '../beat/engine.mjs';

test('seeded variations repeat exactly; custom score and tempo survive a permalink', () => {
  assert.deepEqual(seededGroove('纸带 42'), seededGroove('纸带 42'));
  assert.notDeepEqual(seededGroove('纸带 42'), seededGroove('纸带 41'));
  const edited = { rows: [0, 65535, 0x8000, 1, 19], bpm: 190 };
  assert.deepEqual(decodeGroove(encodeGroove(edited.rows, edited.bpm)), edited);
  assert.equal(hasHit(edited.rows, 2, 15), true);
  assert.equal(hasHit(edited.rows, 2, 14), false);
  for (const bad of [null, '190.bad', '49.00000000000000000000', '300.00000000000000000000']) {
    assert.equal(decodeGroove(bad), null);
  }
});

test('all voices produce distinct finite audio and silence stays silent', () => {
  const rate = 22050;
  const kit = makeKit(rate);
  assert.equal(kit.length, voices.length);
  assert.deepEqual(kit, makeKit(rate));
  const lengths = new Set();
  for (const hit of kit) {
    lengths.add(hit.length);
    assert.ok(hit.every(Number.isFinite));
    assert.ok(hit.some(sample => Math.abs(sample) > 0.05));
  }
  assert.equal(lengths.size, voices.length);
  assert.ok(renderLoop([0, 0, 0, 0, 0], 190, rate, kit).every(s => s === 0));
});

test('dense mixes stay below full scale and the last hit decays across the loop seam', () => {
  const rate = 22050;
  const kit = makeKit(rate);
  const dense = renderLoop(voices.map(() => 65535), 190, rate, kit);
  assert.equal(dense.length, Math.round(rate * 240 / 190));
  assert.ok(dense.every(s => Number.isFinite(s) && Math.abs(s) < 0.95));
  const last = renderLoop([1 << 15, 0, 0, 0, 0], 190, rate, kit);
  assert.ok(last.slice(0, 64).some(s => Math.abs(s) > 0.001));
  assert.ok(last.slice(Math.floor(last.length / 2), Math.floor(last.length * 0.9)).every(s => s === 0));
});

test('WAV contains the edited one-bar PCM in little-endian mono at the requested rate', () => {
  const rate = 44100;
  const { bpm, rows } = presets[0];
  const audio = renderLoop(rows, bpm, rate);
  const edited = [...rows];
  edited[0] ^= 1;
  const output = renderLoop(edited, bpm, rate);
  assert.notDeepEqual(audio, output);
  const wav = Buffer.from(encodeWave(output, rate));
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.readUInt16LE(20), 1);
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(24), rate);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.length, 44 + 2 * Math.round(rate * 240 / bpm));
  assert.equal(wav.readUInt32LE(40), wav.length - 44);
  for (let i = 0; i < output.length; i += 101) {
    const s = output[i];
    assert.equal(wav.readInt16LE(44 + 2 * i), Math.round(s * (s < 0 ? 32768 : 32767)) || 0);
  }
});
