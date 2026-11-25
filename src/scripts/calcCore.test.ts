import { describe, it, expect } from 'vitest';
import { calculate, extraMargin, effectiveDelta, roundEuro, formatEuro, parseNum } from './calcCore';

const base = { lines: 2, shifts: 2, days: 300, rate: 3000, margin: 0.05, oee: 60 };

describe('формула', () => {
  it('считает по README: линии × смены × 8 × дни × выработка × маржа × ΔOEE', () => {
    // 2×2×8×300×3000×0,05 = 1 440 000; ×5% = 72 000; ×10% = 144 000
    expect(extraMargin(base, 5)).toBeCloseTo(72_000, 6);
    expect(extraMargin(base, 10)).toBeCloseTo(144_000, 6);
    const r = calculate(base);
    expect(r.low).toBeCloseTo(72_000, 6);
    expect(r.high).toBeCloseTo(144_000, 6);
    expect(r.capped).toBe(false);
  });

  it('линейна по каждому множителю', () => {
    expect(extraMargin({ ...base, lines: 4 }, 5)).toBeCloseTo(2 * extraMargin(base, 5), 6);
    expect(extraMargin({ ...base, shifts: 3 }, 5)).toBeCloseTo(1.5 * extraMargin(base, 5), 6);
  });

  it('ограничивает рост потолком 85%', () => {
    expect(effectiveDelta(10, 80)).toBe(5);
    expect(effectiveDelta(5, 82)).toBe(3);
    expect(effectiveDelta(10, 90)).toBe(0);
    const r = calculate({ ...base, oee: 80 });
    expect(r.low).toBeCloseTo(r.high, 6); // обе границы упираются в 5 п. п.
    expect(r.capped).toBe(true);
    expect(calculate({ ...base, oee: 85 }).atCap).toBe(true);
    expect(calculate({ ...base, oee: 85 }).high).toBe(0);
  });
});

describe('форматирование', () => {
  it('округляет', () => {
    expect(roundEuro(72_340)).toBe(72_000);
    expect(roundEuro(4_349)).toBe(4_300);
    expect(roundEuro(-5)).toBe(0);
  });
  it('разделяет разряды неразрывным пробелом', () => {
    expect(formatEuro(1_234_567)).toBe('1 235 000');
    expect(formatEuro(900)).toBe('900');
  });
});

describe('разбор ввода', () => {
  it('понимает запятую и пробелы', () => {
    expect(parseNum('0,05')).toBe(0.05);
    expect(parseNum('3 000')).toBe(3000);
    expect(parseNum('12.')).toBe(12);
  });
  it('отклоняет мусор', () => {
    expect(parseNum('')).toBeNaN();
    expect(parseNum('abc')).toBeNaN();
    expect(parseNum('1,2,3')).toBeNaN();
  });
});

import { formatRange } from './calcCore';
describe('диапазон', () => {
  it('показывает одно число, если границы совпали', () => {
    expect(formatRange(72_000, 144_000)).toBe('€ 72 000 – 144 000');
    expect(formatRange(288_000, 288_000)).toBe('€ 288 000');
  });
});
