import { ANCHOR_DATE, ROUTE_SEQUENCE } from '../constants';

/** La ruta alterna cada día (60 / 29) a partir de la fecha ancla. */
export const calculateRouteForDate = (dateString: string): string => {
  const date = new Date(dateString);
  const anchor = new Date(ANCHOR_DATE);
  anchor.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const dayDiff = Math.floor((target.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
  const index = (dayDiff % ROUTE_SEQUENCE.length + ROUTE_SEQUENCE.length) % ROUTE_SEQUENCE.length;
  return ROUTE_SEQUENCE[index];
};
