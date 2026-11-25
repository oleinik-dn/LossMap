import { describe, it, expect } from 'vitest';
import { parseUtm, withUtm, sourceTag, withSourceTag } from './utmCore';

describe('UTM', () => {
  it('берёт только utm_* и отбрасывает пустые', () => {
    expect(parseUtm('?utm_source=email&utm_campaign=wave-3&utm_medium=&x=1'))
      .toEqual({ utm_source: 'email', utm_campaign: 'wave-3' });
    expect(parseUtm('')).toEqual({});
  });

  it('дописывает метки к ссылке Cal.com, не ломая её параметры', () => {
    const u = { utm_source: 'linkedin', utm_campaign: 'w1' };
    expect(withUtm('https://cal.com/lossmap/razbor', u)).toBe('https://cal.com/lossmap/razbor?utm_source=linkedin&utm_campaign=w1');
    expect(withUtm('https://cal.com/x?utm_source=keep', u)).toBe('https://cal.com/x?utm_source=keep&utm_campaign=w1');
    expect(withUtm('#contact', u)).toBe('#contact');
    expect(withUtm('https://cal.com/x', {})).toBe('https://cal.com/x');
  });

  it('добавляет метку источника в первое сообщение', () => {
    const u = { utm_source: 'whatsapp', utm_campaign: 'kz-1' };
    expect(sourceTag(u)).toBe('[источник: whatsapp / kz-1]');
    const out = withSourceTag('https://wa.me/77001234567?text=' + encodeURIComponent('Здравствуйте!'), u);
    expect(new URL(out).searchParams.get('text')).toBe('Здравствуйте! [источник: whatsapp / kz-1]');
    expect(out).not.toContain('+');
    expect(withSourceTag(out, u)).toBe(out); // повторно не дублирует
    expect(withSourceTag('#contact', u)).toBe('#contact');
  });
});
