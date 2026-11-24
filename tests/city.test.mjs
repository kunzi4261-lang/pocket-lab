import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cleanSeed, DEFAULT_SEED, WIDTH, HEIGHT, MOODS, renderCity} from '../city/harbor.mjs';

const digest = image => createHash('sha256').update(image.pixels).digest('hex');

test('two users opening the same Chinese seed get the same opaque raster', () => {
  const first = renderCity(' 南港 ', 'day');
  assert.equal(first.width, WIDTH);
  assert.equal(first.height, HEIGHT);
  assert.equal(first.pixels.length, WIDTH * HEIGHT * 4);
  for (let i = 3; i < first.pixels.length; i += 4) assert.equal(first.pixels[i], 255);
  assert.equal(digest(first), digest(renderCity('南港', 'day')));
});

test('each seed and each supported time produce a distinct city image', () => {
  const variants = MOODS.map(mood => digest(renderCity('南港', mood)));
  assert.equal(new Set(variants).size, MOODS.length);
  assert.ok(!variants.includes(digest(renderCity('北港', 'day'))));
});

test('an empty seed and an unknown mood fall back to the default scene', () => {
  assert.equal(cleanSeed('  '), DEFAULT_SEED);
  assert.equal(digest(renderCity('', 'typo')), digest(renderCity()));
});

test('normalization preserves a complete Unicode seed through URL encoding', () => {
  assert.equal(cleanSeed('  Cafe\u0301  '), 'Café');
  const seed = cleanSeed('🌉'.repeat(80));
  assert.equal(Array.from(seed).length, 64);
  assert.equal(new URLSearchParams(new URLSearchParams({seed}).toString()).get('seed'), seed);
});
