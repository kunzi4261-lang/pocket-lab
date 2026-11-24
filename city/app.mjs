import {WIDTH, HEIGHT, MOODS, cleanSeed, drawCity} from './harbor.mjs';

const byId = id => document.getElementById(id);
const canvas = byId('view'), seedField = byId('seed'), status = byId('status');
const moodNames = {day: '白昼', dusk: '黄昏', night: '入夜'};
let seed, mood;

function currentUrl() {
  const url = new URL(location.href);
  url.search = new URLSearchParams({seed, mood}).toString();
  url.hash = '';
  return url.href;
}

function show(updateUrl = true) {
  drawCity(canvas, seed, mood);
  byId('caption').textContent = seed + ' / ' + moodNames[mood];
  canvas.setAttribute('aria-label', seed + '，' + moodNames[mood] + '的像素港湾，远方是天际线，前方有电车和港口。');
  byId('fallback').hidden = true;
  status.textContent = '';
  if (updateUrl) history.replaceState(null, '', currentUrl());
}

function restore() {
  const params = new URLSearchParams(location.search);
  seed = cleanSeed(params.get('seed'));
  mood = MOODS.includes(params.get('mood')) ? params.get('mood') : 'dusk';
  seedField.value = seed;
  document.querySelector('input[name="mood"][value="' + mood + '"]').checked = true;
  show(false);
}

byId('seed-form').addEventListener('submit', event => {
  event.preventDefault();
  seed = cleanSeed(seedField.value);
  seedField.value = seed;
  show();
  status.textContent = '已生成 ' + seed + '。';
});
document.querySelectorAll('input[name="mood"]').forEach(radio => {
  radio.addEventListener('change', () => {
    mood = radio.value;
    show();
  });
});
byId('reroll').addEventListener('click', () => {
  const n = crypto.getRandomValues(new Uint32Array(1))[0];
  seed = 'PORT-' + n.toString(36).padStart(7, '0').toUpperCase();
  seedField.value = seed;
  show();
  status.textContent = '已生成 ' + seed + '。';
});

byId('share').addEventListener('click', async () => {
  const url = currentUrl();
  try {
    await navigator.clipboard.writeText(url);
    byId('fallback').hidden = true;
    status.textContent = '链接已复制，打开即可看到这座城市。';
  } catch {
    const fallback = byId('fallback');
    fallback.value = url;
    fallback.hidden = false;
    fallback.focus();
    fallback.select();
    status.textContent = '请复制下方链接。';
  }
});

byId('download').addEventListener('click', () => {
  const out = document.createElement('canvas');
  out.width = WIDTH * 4;
  out.height = HEIGHT * 4;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  const filename = 'pixel-harbor-' + seed.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 64) + '-' + mood + '.png';
  out.toBlob(blob => {
    if (!blob) {
      status.textContent = '图片导出失败，请再试一次。';
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    status.textContent = '已导出 1792 × 992 PNG。';
  }, 'image/png');
});

window.addEventListener('popstate', restore);
restore();
