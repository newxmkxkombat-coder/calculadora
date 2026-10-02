import { HistoryEntry } from '../types';
import { getLocalDateString, parseFormattedNumber } from './format';

export type PeriodKey = 'week' | 'month' | 'all';

export interface PeriodTotals {
  days: number;
  passengers: number;
  earnings: number;
  expenses: number;
  delivered: number;
  settled: number;
}

/** Inicio del periodo (a medianoche local). 'all' no tiene inicio. */
const periodStart = (period: PeriodKey, now: Date): Date | null => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === 'week') {
    start.setDate(start.getDate() - 6);
    return start;
  }
  if (period === 'month') {
    start.setDate(1);
    return start;
  }
  return null;
};

const passengersOf = (entry: HistoryEntry) => parseFloat(parseFormattedNumber(entry.formData.numPassengers)) || 0;

export const totalsForPeriod = (history: HistoryEntry[], period: PeriodKey, now = new Date()): PeriodTotals => {
  const start = periodStart(period, now);
  const days = new Set<string>();
  const totals: PeriodTotals = { days: 0, passengers: 0, earnings: 0, expenses: 0, delivered: 0, settled: 0 };

  for (const entry of history) {
    const date = new Date(entry.timestamp);
    if (start && date < start) continue;
    days.add(getLocalDateString(date));
    totals.passengers += passengersOf(entry);
    totals.earnings += entry.results.myEarnings;
    totals.expenses += entry.results.totalExpenses;
    totals.delivered += entry.results.totalDeliveredAmount || 0;
    totals.settled += entry.results.amountToSettle;
  }
  totals.days = days.size;
  return totals;
};

export interface DayBar {
  key: string;
  label: string;
  earnings: number;
  passengers: number;
  isToday: boolean;
}

/** Ganancia y pasajeros de cada uno de los últimos 7 días (el más reciente al final). */
export const lastSevenDays = (history: HistoryEntry[], now = new Date()): DayBar[] => {
  const byDay = new Map<string, { earnings: number; passengers: number }>();
  for (const entry of history) {
    const key = getLocalDateString(new Date(entry.timestamp));
    const current = byDay.get(key) || { earnings: 0, passengers: 0 };
    current.earnings += entry.results.myEarnings;
    current.passengers += passengersOf(entry);
    byDay.set(key, current);
  }

  const todayKey = getLocalDateString(now);
  const bars: DayBar[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const key = getLocalDateString(day);
    const data = byDay.get(key) || { earnings: 0, passengers: 0 };
    bars.push({
      key,
      label: day.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', ''),
      earnings: data.earnings,
      passengers: data.passengers,
      isToday: key === todayKey,
    });
  }
  return bars;
};
