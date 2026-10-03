/** Festivos de Colombia (Ley 51 de 1983, "Ley Emiliani"). */

export interface Holiday {
  date: Date;
  name: string;
  /** Fecha original cuando el festivo se corrió al lunes (Ley Emiliani). */
  movedFrom?: Date;
}

/** Domingo de Pascua (algoritmo de Meeus/Butcher). */
const easterSunday = (year: number): Date => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** Si el día no cae lunes, el festivo se corre al lunes siguiente. */
const nextMonday = (date: Date) => addDays(date, (8 - date.getDay()) % 7);

export const getColombianHolidays = (year: number): Holiday[] => {
  const easter = easterSunday(year);
  const fixed = (month: number, day: number, name: string): Holiday => ({ date: new Date(year, month - 1, day), name });
  const shift = (original: Date, name: string): Holiday => {
    const date = nextMonday(original);
    return date.getTime() === original.getTime() ? { date, name } : { date, name, movedFrom: original };
  };
  const moved = (month: number, day: number, name: string) => shift(new Date(year, month - 1, day), name);
  const fromEaster = (days: number, name: string, move = false): Holiday =>
    move ? shift(addDays(easter, days), name) : { date: addDays(easter, days), name };

  return [
    fixed(1, 1, 'Año Nuevo'),
    moved(1, 6, 'Reyes Magos'),
    moved(3, 19, 'San José'),
    fromEaster(-3, 'Jueves Santo'),
    fromEaster(-2, 'Viernes Santo'),
    fixed(5, 1, 'Día del Trabajo'),
    fromEaster(39, 'Ascensión del Señor', true),
    fromEaster(60, 'Corpus Christi', true),
    fromEaster(68, 'Sagrado Corazón', true),
    moved(6, 29, 'San Pedro y San Pablo'),
    fixed(7, 20, 'Día de la Independencia'),
    fixed(8, 7, 'Batalla de Boyacá'),
    moved(8, 15, 'Asunción de la Virgen'),
    moved(10, 12, 'Día de la Raza'),
    moved(11, 1, 'Todos los Santos'),
    moved(11, 11, 'Independencia de Cartagena'),
    fixed(12, 8, 'Inmaculada Concepción'),
    fixed(12, 25, 'Navidad'),
  ].sort((x, y) => x.date.getTime() - y.date.getTime());
};

export const dateKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
