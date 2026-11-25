/** UTM-метки: чистые функции (покрыты тестами). DOM-часть — utm.ts. */

export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
export type Utm = Partial<Record<(typeof UTM_KEYS)[number], string>>;

/** utm_* из строки запроса. Пустые значения отбрасываются, длина ограничена. */
export function parseUtm(search: string): Utm {
  const q = new URLSearchParams(search);
  const out: Utm = {};
  for (const k of UTM_KEYS) {
    const v = q.get(k)?.trim();
    if (v) out[k] = v.slice(0, 100);
  }
  return out;
}

export const hasUtm = (u: Utm): boolean => Object.keys(u).length > 0;

/** Дописывает utm_* к ссылке (Cal.com). Существующие параметры ссылки не трогает. */
export function withUtm(href: string, u: Utm): string {
  if (!hasUtm(u) || !/^https?:\/\//.test(href)) return href;
  const url = new URL(href);
  for (const [k, v] of Object.entries(u)) if (!url.searchParams.has(k)) url.searchParams.set(k, v!);
  return url.toString();
}

/** Короткая метка источника для первого сообщения: «[источник: email / wave-3]». */
export function sourceTag(u: Utm): string {
  const parts = [u.utm_source, u.utm_campaign].filter(Boolean);
  return parts.length ? `[источник: ${parts.join(' / ')}]` : '';
}

/** Добавляет метку источника в параметр text ссылки WhatsApp/Telegram. */
export function withSourceTag(href: string, u: Utm): string {
  const tag = sourceTag(u);
  if (!tag || !/^https?:\/\//.test(href)) return href;
  const url = new URL(href);
  const text = url.searchParams.get('text') ?? '';
  if (text.includes(tag)) return href;
  url.searchParams.set('text', text ? `${text} ${tag}` : tag);
  // Пробел как %20, а не «+»: так его гарантированно понимают WhatsApp и Telegram.
  return url.toString().replace(/\+/g, '%20');
}
