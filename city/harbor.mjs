// An indexed-colour raster keeps the scene reproducible across browsers.
// Colours are grouped by purpose so all three hours share the same geography.
export const WIDTH = 448;
export const HEIGHT = 248;
export const DEFAULT_SEED = 'HARBOUR-021';
export const MOODS = ['day', 'dusk', 'night'];

const palettes = {
  dusk: {
    sky: ['#66629c', '#8c79ad', '#b486ad', '#d192a5', '#ed9d96', '#f8ae8e', '#ffc08d', '#ffd69a'],
    cloud: '#bc89a4', brightCloud: '#ffd0ab', sun: '#ffecab', star: '#ffe4bd',
    hills: '#c3899e', far: '#9a7992', farLight: '#c69ba7', mid: '#705d80', midLight: '#ab8096',
    front: ['#585276', '#97667d', '#74617f', '#ab7885', '#646785'],
    side: '#514966', shadow: '#403c58', glass: '#8c8096', glint: '#e2a49f', lit: '#ffd295',
    neon: '#ffc16e', accent: '#dc766e', water: '#897a98', wave: '#a98da3', reflection: '#f6b394',
    pier: '#53485f', girder: '#39384e', dark: '#282c40', edge: '#9a7777',
    train: '#e7be9b', stripe: '#cb7069', carriage: '#4c566d', lamp: '#ffe3a1',
  },
  day: {
    sky: ['#5996b6', '#69a7c1', '#82b9cc', '#9acada', '#b0d6dc', '#c5e2de', '#d9e9db', '#ecebd7'],
    cloud: '#c1dfe3', brightCloud: '#f6f5df', sun: '#fff6c3', star: '#e9f5ed',
    hills: '#9ebdbd', far: '#8ba8b1', farLight: '#b4c8c8', mid: '#678998', midLight: '#a7bbc0',
    front: ['#66858c', '#ab9b88', '#8e9c9e', '#687d88', '#bbab94'],
    side: '#586a7a', shadow: '#434f62', glass: '#8ca8b0', glint: '#e6d6ad', lit: '#f1d7a7',
    neon: '#ffd969', accent: '#c2785b', water: '#739eae', wave: '#a1c2c9', reflection: '#e2e1c5',
    pier: '#627783', girder: '#3f505e', dark: '#2f414f', edge: '#aba291',
    train: '#ebdfbb', stripe: '#d8875d', carriage: '#486678', lamp: '#ffe7a9',
  },
  night: {
    sky: ['#171b3b', '#21284c', '#283258', '#333c66', '#424971', '#52557d', '#665f84', '#806c90'],
    cloud: '#3b426a', brightCloud: '#6e6786', sun: '#ffe6a9', star: '#bfc9ea',
    hills: '#525273', far: '#454463', farLight: '#7e6c89', mid: '#383952', midLight: '#6c637b',
    front: ['#353a54', '#48415c', '#34354d', '#424760', '#4a475c'],
    side: '#292e47', shadow: '#25283b', glass: '#585e77', glint: '#a892a9', lit: '#f5c87d',
    neon: '#67e1db', accent: '#eb7c91', water: '#363e60', wave: '#525677', reflection: '#d3ac87',
    pier: '#34364d', girder: '#282b40', dark: '#1c2032', edge: '#696079',
    train: '#878495', stripe: '#c27780', carriage: '#333b52', lamp: '#ffdc89',
  },
};

export function cleanSeed(value) {
  const normalized = String(value || '').normalize('NFC').trim();
  return Array.from(normalized).slice(0, 64).join('') || DEFAULT_SEED;
}

function random(seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0;
  return (min, max) => {
    h = (h + 0x6d2b79f5) >>> 0;
    let v = Math.imul(h ^ (h >>> 15), h | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return min + Math.floor((((v ^ (v >>> 14)) >>> 0) / 4294967296) * (max - min + 1));
  };
}

function raster() {
  const indices = new Uint8Array(WIDTH * HEIGHT);
  const colors = new Map();
  function ink(color) {
    if (!colors.has(color)) colors.set(color, colors.size);
    return colors.get(color);
  }
  function rect(x, y, w, h, color) {
    const left = Math.max(0, Math.floor(x)), right = Math.min(WIDTH, Math.floor(x + w));
    if (right <= left) return;
    const index = ink(color);
    for (let row = Math.max(0, Math.floor(y)); row < Math.min(HEIGHT, Math.floor(y + h)); row++) {
      indices.fill(index, row * WIDTH + left, row * WIDTH + right);
    }
  }
  function line(x, y, x2, y2, color) {
    const steps = Math.max(1, Math.abs(x2 - x), Math.abs(y2 - y));
    for (let i = 0; i <= steps; i++) {
      rect(Math.round(x + (x2 - x) * i / steps), Math.round(y + (y2 - y) * i / steps), 1, 1, color);
    }
  }
  function rgba() {
    const rgb = [...colors.keys()].map(value => Number.parseInt(value.slice(1), 16));
    const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
    for (let i = 0; i < indices.length; i++) {
      const c = rgb[indices[i]];
      pixels.set([(c >> 16) & 255, (c >> 8) & 255, c & 255, 255], i * 4);
    }
    return pixels;
  }
  return {rect, line, rgba};
}

function sky(d, p, r, mood) {
  for (let i = 0; i < p.sky.length; i++) {
    const a = Number.parseInt(p.sky[i].slice(1), 16);
    const b = Number.parseInt(p.sky[Math.min(i + 1, p.sky.length - 1)].slice(1), 16);
    for (let step = 0; step < 4; step++) {
      const mixed = [16, 8, 0].map(shift => {
        const start = (a >> shift) & 255, end = (b >> shift) & 255;
        return Math.round(start + (end - start) * step / 4).toString(16).padStart(2, '0');
      });
      d.rect(0, i * 20 + step * 5, WIDTH, 5, '#' + mixed.join(''));
    }
  }
  const sunX = r(85, 335), sunY = r(47, 78), radius = r(15, 23);
  if (mood === 'night') {
    for (let i = 0; i < 76; i++) d.rect(r(0, WIDTH - 1), r(4, 106), 1, 1, p.star);
  }
  for (let row = -radius; row <= radius; row++) {
    if (mood === 'dusk' && row > radius / 3 && row % 4 === 0) continue;
    const span = Math.floor(Math.sqrt(radius * radius - row * row));
    let left = -span;
    if (mood === 'night') {
      const dy = row + 4;
      if (Math.abs(dy) <= radius) left = Math.max(left, Math.floor(Math.sqrt(radius * radius - dy * dy)) - 9);
    }
    d.rect(sunX + left, sunY + row, span - left + 1, 1, p.sun);
  }
  for (let i = 0; i < 15; i++) {
    const x = r(-50, 419), y = r(12, 106), w = r(11, 65);
    d.rect(x, y, w, 2, p.cloud);
    d.rect(x + 4, y + 2, w + r(3, 13), 1, p.cloud);
    if (i % 4 === 0) {
      d.rect(x + 7, y - 2, Math.floor(w * .65), 2, p.cloud);
      d.rect(x + 11, y - 3, Math.floor(w * .32), 1, p.cloud);
    }
    if (i % 3 !== 0) d.rect(x + 4, y - 1, Math.floor(w / 2), 1, p.brightCloud);
  }
  return sunX;
}

const SHORE = 168;
function distance(d, p, r) {
  let height = 127;
  for (let x = -8; x < WIDTH; x += 5) {
    height = Math.max(108, Math.min(141, height + r(-3, 3)));
    d.rect(x, height, 5, SHORE - height, p.hills);
  }
  for (let layer = 0; layer < 2; layer++) {
    for (let x = -7; x < WIDTH;) {
      const w = r(4 + layer * 2, 13 + layer * 4);
      const y = r(94 - layer * 7, 149);
      const body = layer ? p.mid : p.far, light = layer ? p.midLight : p.farLight;
      d.rect(x, y, w, SHORE - y, body);
      d.rect(x + 2, y - r(1, 5), w - 4, 5, body);
      if (r(0, 2) === 0) d.rect(x + 3, y - 6, 1, 6, body);
      for (let row = y + 3; row < SHORE - 2; row += 5)
        for (let col = x + 2; col < x + w - 1; col += 3)
          if (r(0, 5) === 1) d.rect(col, row, 1 + layer, 1, light);
      x += w + r(0, 4);
    }
  }
}

function building(d, p, r, x, y, w, style, mood) {
  const body = p.front[r(0, p.front.length - 1)], side = r(3, 6);
  d.rect(x, y, w, SHORE - y, body);
  d.rect(x + w - side, y, side, SHORE - y, p.side);
  d.rect(x, y, w - side, 1, p.glint);
  // Each facade uses a consistent floor rhythm, glass band or vertical mullion.
  const step = r(4, 6);
  for (let row = y + 4; row < SHORE - 2; row += step) {
    if (style === 0) d.rect(x + 1, row, w - side - 2, 2, p.glass);
    if (style === 1) d.rect(x, row + 2, w, 1, p.side);
    for (let col = x + 2; col < x + w - side - 1; col += 4) {
      const light = r(0, 10);
      d.rect(col, row, 2, style === 2 ? 3 : 2, light < (mood === 'night' ? 5 : 2) ? p.lit : p.glass);
    }
    if (r(0, 3) < 2) d.rect(x + w - side + 1, row, 1, 2, p.glass);
  }
  if (style === 2) {
    d.rect(x, y + 2, 1, SHORE - y - 2, p.glint);
    d.rect(x + w - side - 2, y + 2, 1, SHORE - y - 2, p.side);
  }
  const cap = r(3, Math.max(4, w - 6));
  d.rect(x + 2, y - 3, cap, 3, p.side);
  d.rect(x + 2, y - 3, cap, 1, p.glass);
  if (r(0, 3) === 0) {
    d.rect(x + 4, y - 9, 1, 6, p.side);
    d.rect(x + 4, y - 10, 1, 1, p.neon);
  }
}

function skyline(d, p, r, mood) {
  // A stepped radio tower anchors the varied low-rise blocks.
  const towerX = r(44, 125), top = r(32, 56);
  building(d, p, r, towerX, top + 23, 30, 2, mood);
  building(d, p, r, towerX + 4, top + 10, 22, 0, mood);
  d.rect(towerX + 7, top + 4, 15, 6, p.side);
  d.rect(towerX + 10, top, 9, 6, p.mid);
  d.rect(towerX + 14, top - 9, 1, 10, p.side);
  d.rect(towerX + 14, top - 10, 1, 1, p.neon);
  d.rect(towerX + 5, top + 11, 15, 1, p.neon);

  for (let x = -6; x < WIDTH;) {
    const w = r(12, 30);
    const lowrise = Math.abs(x - towerX) < 35;
    const y = lowrise ? r(110, 140) : r(68, 142);
    building(d, p, r, x, y, w, r(0, 2), mood);
    if (w > 18 && r(0, 2) === 0) {
      const sy = y + r(7, 15);
      d.rect(x - 2, sy, 6, 17, p.shadow);
      d.rect(x - 2, sy, 5, 16, p.accent);
      for (let row = sy + 2; row < sy + 14; row += 4) {
        d.rect(x - 1, row, 3, 1, p.lit);
        d.rect(x, row + 1, 1, 2, p.lit);
      }
    }
    x += w + r(1, 6);
  }
  // Warehouses with rolling shutters and lit loading bays at the waterline.
  for (let x = -3; x < WIDTH;) {
    const w = r(14, 34), y = r(145, 157);
    d.rect(x, y, w, SHORE - y, p.shadow);
    d.rect(x - 1, y, w + 2, 2, p.edge);
    for (let bay = x + 3; bay < x + w - 4; bay += 7) {
      d.rect(bay, y + 4, 5, SHORE - y - 4, p.side);
      d.rect(bay, y + 4, 5, 1, r(0, 2) === 0 ? p.lit : p.glass);
    }
    x += w + r(2, 6);
  }
  d.rect(0, SHORE - 2, WIDTH, 2, p.pier);
}

function harbor(d, p, r, sunX) {
  d.rect(0, SHORE, WIDTH, HEIGHT - SHORE, p.water);
  // Vertical traces from the buildings break up into short horizontal ripples.
  for (let i = 0; i < 58; i++) {
    const x = r(0, WIDTH - 1), extent = r(3, 22);
    for (let y = 1; y < extent; y += r(2, 4)) {
      d.rect(x + r(-2, 2), SHORE + y, r(2, 7), 1, i % 3 === 0 ? p.glass : p.wave);
    }
  }
  for (let i = 0; i < 195; i++) {
    const x = r(-4, WIDTH - 1), y = r(SHORE + 1, HEIGHT - 1);
    d.rect(x, y, r(2, 10), 1, Math.abs(x - sunX) < (y - SHORE) * .7 + 7 ? p.reflection : p.wave);
  }
  // A harbour crane, gantry, winch and suspended hook.
  const cx = r(296, 375), deck = SHORE - 4, arm = r(31, 47);
  d.rect(cx - 8, deck, 24, 4, p.pier);
  d.rect(cx + 1, deck - 37, 3, 37, p.shadow);
  d.rect(cx + 8, deck - 36, 2, 36, p.shadow);
  for (let row = deck - 34; row < deck - 5; row += 8) {
    d.line(cx + 3, row, cx + 8, row + 7, p.shadow);
    d.line(cx + 8, row, cx + 3, row + 7, p.shadow);
  }
  d.rect(cx - 9, deck - 38, arm + 12, 3, p.shadow);
  d.rect(cx - 9, deck - 39, 9, 4, p.edge);
  d.line(cx + 4, deck - 46, cx + arm, deck - 38, p.shadow);
  d.line(cx + 4, deck - 46, cx - 6, deck - 38, p.shadow);
  d.rect(cx + arm - 4, deck - 36, 1, 15, p.shadow);
  d.rect(cx + arm - 5, deck - 21, 3, 2, p.shadow);
  // A single tug with a tiny two-colour pilot house.
  const bx = r(103, 290), by = r(184, 199);
  d.rect(bx - 6, by + 3, 37, 1, p.wave);
  d.rect(bx, by, 25, 2, p.shadow);
  d.rect(bx + 2, by + 2, 20, 1, p.shadow);
  d.rect(bx + 6, by - 5, 11, 5, p.train);
  d.rect(bx + 8, by - 4, 3, 2, p.carriage);
  d.rect(bx + 12, by - 4, 3, 2, p.carriage);
  d.rect(bx + 7, by - 7, 8, 2, p.accent);
  d.rect(bx + 18, by - 4, 2, 4, p.dark);
}

function railway(d, p, r) {
  const y = 218;
  for (let x = -9; x < WIDTH; x += 8) {
    d.rect(x, y + 1, 1, 3, p.girder);
  }
  d.rect(0, y, WIDTH, 1, p.edge);
  d.rect(0, y + 2, WIDTH, 1, p.pier);
  d.rect(0, y + 4, WIDTH, 2, p.pier);
  d.rect(0, y + 6, WIDTH, 6, p.girder);
  d.rect(0, y + 8, WIDTH, 1, p.edge);
  for (let x = -8; x < WIDTH; x += 63) {
    d.rect(x, y + 12, 7, 22, p.dark);
    d.rect(x - 4, y + 12, 15, 3, p.girder);
    d.line(x + 5, y + 19, x + 12, y + 12, p.girder);
    d.line(x - 7, y + 12, x, y + 19, p.girder);
  }
  // Overhead wire and cantilevers behind the train.
  const mast = r(12, 83);
  for (let x = mast - 111; x < WIDTH + 111; x += 111) {
    d.rect(x, y - 30, 2, 30, p.girder);
    d.rect(x - 2, y - 30, 12, 1, p.girder);
    d.line(x + 1, y - 25, x + 8, y - 30, p.girder);
    d.line(x + 8, y - 29, x + 61, y - 26, p.side);
    d.line(x + 61, y - 26, x + 119, y - 29, p.side);
  }
  const start = r(14, 156);
  for (let i = 0; i < 3; i++) {
    const x = start + i * 47;
    d.rect(x + 2, y - 13, 41, 1, p.edge);
    d.rect(x + 1, y - 12, 44, 11, p.train);
    d.rect(x + 3, y - 13, 8, 1, p.train);
    d.rect(x + 4, y - 15, 8, 2, p.edge);
    d.rect(x + 1, y - 5, 44, 2, p.stripe);
    d.rect(x + 1, y - 1, 44, 1, p.shadow);
    for (let win = x + 4; win < x + 41; win += 6) {
      d.rect(win, y - 10, 4, 4, p.carriage);
      if (r(0, 3) > 0) d.rect(win + 1, y - 10, 2, 2, p.lit);
    }
    d.rect(x + 13, y - 11, 1, 9, p.edge);
    d.rect(x + 32, y - 11, 1, 9, p.edge);
    d.rect(x + 5, y, 5, 2, p.dark);
    d.rect(x + 35, y, 5, 2, p.dark);
    if (i < 2) d.rect(x + 45, y - 8, 3, 5, p.dark);
    if (i === 2) d.rect(x + 43, y - 5, 2, 2, p.lamp);
  }
  // Foreground roofs introduce a final band of depth below the viaduct.
  for (let x = -15; x < WIDTH;) {
    const w = r(17, 49), roof = r(236, 252);
    d.rect(x, roof, w, HEIGHT - roof, p.dark);
    d.rect(x - 1, roof - 1, w + 2, 1, p.pier);
    if (r(0, 2) < 2) d.rect(x + 4, roof - 3, 6, 3, p.girder);
    x += w + r(2, 12);
  }
}

export function renderCity(seed = DEFAULT_SEED, mood = 'dusk') {
  const value = cleanSeed(seed);
  mood = MOODS.includes(mood) ? mood : 'dusk';
  const p = palettes[mood], d = raster();
  const layer = name => random(value + '/' + name);
  const sunX = sky(d, p, layer('sky'), mood);
  distance(d, p, layer('horizon'));
  skyline(d, p, layer('city'), mood);
  harbor(d, p, layer('harbor'), sunX);
  railway(d, p, layer('rail'));
  return {width: WIDTH, height: HEIGHT, pixels: d.rgba()};
}

export function drawCity(canvas, seed, mood) {
  const {width, height, pixels} = renderCity(seed, mood);
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(pixels, width, height), 0, 0);
}
