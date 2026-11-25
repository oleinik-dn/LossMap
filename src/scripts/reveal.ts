import { onVisible } from './onVisible';
// [data-reveal] получает класс .is-in один раз при появлении. CSS-анимации завязаны на .is-in
// и включаются только при html.js (без JS сразу финальное состояние).
document.querySelectorAll('[data-reveal]').forEach((el) => onVisible(el, () => el.classList.add('is-in')));
