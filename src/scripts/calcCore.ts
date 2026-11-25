/** Чистая формула калькулятора потерь (README §3, этап 4). Покрыта тестами. */

export interface CalcInput {
  lines: number;   // число линий
  shifts: number;  // смен в сутки
  days: number;    // рабочих дней в году
  rate: number;    // номинальная выработка линии, ед./час
  margin: number;  // маржа на единицу, €
  oee: number;     // текущий OEE, %
}

export const HOURS_PER_SHIFT = 8;
export const DELTA_LOW = 5;    // п. п.
export const DELTA_HIGH = 10;  // п. п.
export const OEE_CAP = 85;     // %, выше рост не считаем

/** ΔOEE в п. п. с учётом потолка: не выше OEE_CAP − текущий OEE и не меньше 0. */
export function effectiveDelta(delta: number, oee: number): number {
  return Math.max(0, Math.min(delta, OEE_CAP - oee));
}

/** Доп. маржа в год, € = линии × смены × 8 × дни × выработка × маржа × ΔOEE. */
export function extraMargin(i: CalcInput, deltaPp: number): number {
  const d = effectiveDelta(deltaPp, i.oee) / 100;
  return i.lines * i.shifts * HOURS_PER_SHIFT * i.days * i.rate * i.margin * d;
}

export interface CalcResult { low: number; high: number; capped: boolean; atCap: boolean }

export function calculate(i: CalcInput): CalcResult {
  return {
    low: extraMargin(i, DELTA_LOW),
    high: extraMargin(i, DELTA_HIGH),
    capped: i.oee + DELTA_HIGH > OEE_CAP,
    atCap: i.oee >= OEE_CAP,
  };
}

/** Округление для показа: до 100 € до 10 тыс., дальше до 1 000 €. */
export function roundEuro(v: number): number {
  if (v <= 0) return 0;
  const step = v < 10_000 ? 100 : 1_000;
  return Math.round(v / step) * step;
}

/** «72 000» — разделитель разрядов неразрывный пробел. */
export function formatEuro(v: number): string {
  return String(roundEuro(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Разбор ввода: допускает запятую и пробелы. NaN, если не число. */
export function parseNum(raw: string): number {
  const s = raw.replace(/[\s ]/g, '').replace(',', '.');
  if (s === '' || !/^-?\d*\.?\d+$|^-?\d+\.?$/.test(s)) return NaN;
  return Number(s);
}

/** «€ 72 000 – 144 000»; если границы совпали после округления — одно число. */
export function formatRange(low: number, high: number): string {
  const a = formatEuro(low), b = formatEuro(high);
  return a === b ? `€ ${a}` : `€ ${a} – ${b}`;
}
