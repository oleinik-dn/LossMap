# UTM-метки

Каждая ссылка на сайт в письме, сообщении или рекламе — со своей меткой. Тогда в Cal.com и в первом сообщении мессенджера видно, откуда пришёл человек.

| Канал | Пример ссылки |
|---|---|
| Холодные письма | `https://lossmap.pro/?utm_source=email&utm_campaign=wave-1` |
| WhatsApp | `https://lossmap.pro/?utm_source=whatsapp&utm_campaign=kz-1` |
| Telegram | `https://lossmap.pro/?utm_source=telegram&utm_campaign=kz-1` |
| LinkedIn | `https://lossmap.pro/?utm_source=linkedin&utm_campaign=wave-1` |
| Реклама | `https://lossmap.pro/?utm_source=ads&utm_medium=cpc&utm_campaign=<кампания>` |

`utm_campaign` — номер волны писем или название кампании.

## Что делает сайт (`src/scripts/utm.ts`)

- Берёт `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` из адреса и хранит их в `sessionStorage` до конца визита (переходы по якорям и страницам их не теряют).
- Дописывает метки ко всем ссылкам Cal.com (кнопки записи — атрибут `data-cal`).
- В первое сообщение WhatsApp и Telegram (`data-msg`) добавляет короткую метку: `[источник: email / wave-1]`.
- Cookies не использует.
