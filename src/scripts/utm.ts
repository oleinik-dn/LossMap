import { parseUtm, hasUtm, withUtm, withSourceTag, type Utm } from './utmCore';

// Берёт utm_* из адреса, хранит в sessionStorage на время визита,
// дописывает к ссылкам Cal.com ([data-cal]) и метку источника — в сообщения WhatsApp/Telegram ([data-msg]).
const KEY = 'lm_utm';

function load(): Utm {
  const fromUrl = parseUtm(location.search);
  try {
    if (hasUtm(fromUrl)) { sessionStorage.setItem(KEY, JSON.stringify(fromUrl)); return fromUrl; }
    const saved = sessionStorage.getItem(KEY);
    return saved ? (JSON.parse(saved) as Utm) : {};
  } catch {
    return fromUrl;
  }
}

const utm = load();
if (hasUtm(utm)) {
  document.querySelectorAll<HTMLAnchorElement>('a[data-cal]').forEach((a) => { a.href = withUtm(a.href, utm); });
  document.querySelectorAll<HTMLAnchorElement>('a[data-msg]').forEach((a) => { a.href = withSourceTag(a.href, utm); });
}
