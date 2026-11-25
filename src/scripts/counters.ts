import { onVisible, reducedMotion } from './onVisible';

const DURATION = 1200;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function run(el: HTMLElement): void {
  const to = Number(el.dataset.count);
  const from = Number(el.dataset.from || 0);
  const dec = Number(el.dataset.decimals || 0);
  const pre = el.dataset.prefix || '';
  const suf = el.dataset.suffix || '';
  const delay = Number(el.dataset.delay || 0);
  const fmt = (v: number) => `${pre}${v.toFixed(dec).replace('.', ',')}${suf}`;
  el.textContent = fmt(from);
  let t0 = 0;
  const frame = (ts: number) => {
    if (!t0) t0 = ts;
    const k = Math.min(1, (ts - t0) / DURATION);
    el.textContent = fmt(from + (to - from) * easeOut(k));
    if (k < 1) requestAnimationFrame(frame);
  };
  setTimeout(() => requestAnimationFrame(frame), delay);
}

if (!reducedMotion()) {
  document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => onVisible(el, () => run(el), 0.6));
}
