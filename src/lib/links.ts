import site from '../content/ru/site.json';

/** Значение из контента ещё не заполнено: «[ВСТАВИТЬ: …]». */
export const isPlaceholder = (v: string | undefined | null): boolean =>
  !v || v.trim().startsWith('[ВСТАВИТЬ');

const c = site.contacts;

/** Ссылка на Cal.com; пока плейсхолдер — якорь на финальный блок. */
export const calUrl = isPlaceholder(site.links.cal) ? '#contact' : site.links.cal;

export const whatsappUrl = isPlaceholder(c.whatsappNumber)
  ? '#contact'
  : `https://wa.me/${c.whatsappNumber}?text=${encodeURIComponent(c.whatsappText)}`;

export const telegramUrl = isPlaceholder(c.telegramUser)
  ? '#contact'
  : `https://t.me/${c.telegramUser}?text=${encodeURIComponent(c.telegramText)}`;

export const emailUrl = isPlaceholder(c.email) ? '#contact' : `mailto:${c.email}`;

export { site };
