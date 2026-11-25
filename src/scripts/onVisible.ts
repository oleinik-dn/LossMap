/** Вызывает cb один раз, когда элемент появляется на экране. */
export function onVisible(el: Element, cb: () => void, threshold = 0.3): void {
  if (!('IntersectionObserver' in window)) { cb(); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { io.disconnect(); cb(); }
    }
  }, { threshold });
  io.observe(el);
}

export const reducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
