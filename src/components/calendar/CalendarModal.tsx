import React, { useMemo, useState } from 'react';
import { dateKey, getColombianHolidays, Holiday } from '../../utils/holidays';
import { CalendarIcon, ChevronDownIcon } from '../icons';
import { ModalShell } from '../ui';

const YEARS = [2026, 2027];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const weekdayName = (date: Date) => date.toLocaleDateString('es-CO', { weekday: 'long' });
const shortDate = (date: Date) => date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '');

interface CalendarModalProps {
  onClose: () => void;
}

/** Calendario 2026–2027, mes a mes, con los festivos de Colombia en rojo y su nombre debajo. */
export const CalendarModal: React.FC<CalendarModalProps> = ({ onClose }) => {
  const today = startOfDay(new Date());
  const initialYear = YEARS.includes(today.getFullYear()) ? today.getFullYear() : YEARS[0];
  const [view, setView] = useState({ year: initialYear, month: initialYear === today.getFullYear() ? today.getMonth() : 0 });

  const holidaysByYear = useMemo(() => new Map(YEARS.map(year => [year, getColombianHolidays(year)])), []);
  const allHolidays = useMemo(() => YEARS.flatMap(year => holidaysByYear.get(year)!), [holidaysByYear]);
  const holidayByDay = useMemo(() => new Map(allHolidays.map(h => [dateKey(h.date), h])), [allHolidays]);

  const yearHolidays = holidaysByYear.get(view.year)!;
  const monthHolidays = yearHolidays.filter(h => h.date.getMonth() === view.month);
  const nextHoliday = allHolidays.find(h => h.date.getTime() >= today.getTime());

  // Celdas del mes: espacios vacíos hasta el primer día (la semana empieza el lunes) y luego los días.
  const firstWeekday = (new Date(view.year, view.month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const isFirstMonth = view.year === YEARS[0] && view.month === 0;
  const isLastMonth = view.year === YEARS[YEARS.length - 1] && view.month === 11;
  const changeMonth = (delta: number) => setView(prev => {
    const date = new Date(prev.year, prev.month + delta, 1);
    return { year: date.getFullYear(), month: date.getMonth() };
  });

  return (
    <ModalShell title="Calendario" subtitle="Festivos de Colombia" icon={<CalendarIcon />} tone="brand" onClose={onClose}>
      {nextHoliday && <NextHolidayBanner holiday={nextHoliday} today={today} />}

      {/* Año */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-field border border-line/60 mb-4">
        {YEARS.map(year => (
          <button
            key={year}
            onClick={() => setView({ year, month: year === today.getFullYear() ? today.getMonth() : 0 })}
            className={`py-2 rounded-lg text-sm font-bold tabular transition-colors ${year === view.year ? 'bg-brand text-on-brand shadow' : 'text-muted'}`}
          >
            {year}
            <span className={`ml-1.5 text-[11px] font-semibold ${year === view.year ? 'opacity-80' : 'text-faint'}`}>
              · {holidaysByYear.get(year)!.length} festivos
            </span>
          </button>
        ))}
      </div>

      {/* Mes */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <MonthArrow label="Mes anterior" disabled={isFirstMonth} onClick={() => changeMonth(-1)} rotate="rotate-90" />
        <div className="text-center">
          <p className="text-2xl font-extrabold tracking-tight text-main leading-none">{MONTHS[view.month]}</p>
          <p className="text-xs text-muted tabular mt-1">{view.year}</p>
        </div>
        <MonthArrow label="Mes siguiente" disabled={isLastMonth} onClick={() => changeMonth(1)} rotate="-rotate-90" />
      </div>

      <div className="grid grid-cols-6 gap-1 mb-4">
        {MONTHS.map((name, index) => {
          const hasHoliday = yearHolidays.some(h => h.date.getMonth() === index);
          const active = index === view.month;
          return (
            <button
              key={name}
              onClick={() => setView(prev => ({ ...prev, month: index }))}
              className={`relative py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${active ? 'bg-main text-card' : 'bg-raised/40 text-muted'}`}
            >
              {name.slice(0, 3)}
              {hasHoliday && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-bad" />}
            </button>
          );
        })}
      </div>

      {/* Días */}
      <div className="rounded-2xl bg-field/60 border border-line/50 p-2">
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {WEEKDAYS.map(day => (
            <div key={day} className={`text-[10px] font-bold uppercase tracking-wide py-1 ${day === 'Dom' ? 'text-bad' : 'text-muted'}`}>{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, index) => {
            if (day === null) return <div key={`empty-${index}`} />;
            const date = new Date(view.year, view.month, day);
            const holiday = holidayByDay.get(dateKey(date));
            const isSunday = date.getDay() === 0;
            const isToday = date.getTime() === today.getTime();
            const base = 'relative h-12 rounded-xl flex flex-col items-center justify-center tabular';
            const look = holiday
              ? 'bg-bad text-white shadow-md shadow-bad/30'
              : isSunday
                ? 'text-bad'
                : 'text-main';
            return (
              <div key={day} className={`${base} ${look} ${isToday ? 'ring-2 ring-brand ring-offset-2 ring-offset-card' : ''}`}>
                <span className={`text-base leading-none ${holiday || isToday ? 'font-extrabold' : 'font-medium'}`}>{day}</span>
                {holiday && <span className="text-[7px] font-bold uppercase tracking-wider leading-none mt-1 opacity-90">Festivo</span>}
                {isToday && !holiday && <span className="text-[7px] font-bold uppercase tracking-wider leading-none mt-1 text-brand">Hoy</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 px-1 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-bad" />Festivo</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded ring-2 ring-brand" />Hoy</span>
        <span className="flex items-center gap-1.5"><span className="font-bold text-bad">D</span>Domingo</span>
      </div>

      {/* Festivos del mes */}
      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">
          Festivos de {MONTHS[view.month].toLowerCase()}
        </p>
        {monthHolidays.length === 0 ? (
          <p className="text-sm text-faint rounded-xl border border-dashed border-line/60 px-3 py-3 text-center">
            {MONTHS[view.month]} no tiene festivos.
          </p>
        ) : (
          <ul className="space-y-2">
            {monthHolidays.map(h => <HolidayRow key={dateKey(h.date) + h.name} holiday={h} />)}
          </ul>
        )}
      </div>
    </ModalShell>
  );
};

const MonthArrow: React.FC<{ label: string; disabled: boolean; onClick: () => void; rotate: string }> = ({ label, disabled, onClick, rotate }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className="h-11 w-11 rounded-xl bg-raised/60 text-main flex items-center justify-center active:scale-95 transition-all disabled:opacity-30"
  >
    <ChevronDownIcon className={rotate} />
  </button>
);

const HolidayRow: React.FC<{ holiday: Holiday }> = ({ holiday }) => (
  <li className="flex items-center gap-3 rounded-xl bg-bad/10 border border-bad/25 p-2.5">
    <div className="h-12 w-12 shrink-0 rounded-lg bg-bad text-white flex flex-col items-center justify-center leading-none">
      <span className="text-lg font-extrabold tabular">{holiday.date.getDate()}</span>
      <span className="text-[9px] font-bold uppercase mt-0.5">{weekdayName(holiday.date).slice(0, 3)}</span>
    </div>
    <div className="min-w-0">
      <p className="text-sm font-bold text-main">{holiday.name}</p>
      <p className="text-xs text-muted first-letter:uppercase">
        {weekdayName(holiday.date)}
        {holiday.movedFrom && ` · se pasó del ${shortDate(holiday.movedFrom)}`}
      </p>
    </div>
  </li>
);

const NextHolidayBanner: React.FC<{ holiday: Holiday; today: Date }> = ({ holiday, today }) => {
  const days = Math.round((holiday.date.getTime() - today.getTime()) / DAY_MS);
  const when = days === 0 ? 'Hoy es festivo' : days === 1 ? 'Mañana' : `En ${days} días`;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-bad/20 to-bad/5 border border-bad/30 p-3 mb-4">
      <div className="h-11 w-11 shrink-0 rounded-xl bg-bad text-white flex flex-col items-center justify-center leading-none">
        <span className="text-base font-extrabold tabular">{holiday.date.getDate()}</span>
        <span className="text-[8px] font-bold uppercase mt-0.5">{MONTHS[holiday.date.getMonth()].slice(0, 3)}</span>
      </div>
      <div className="min-w-0 flex-grow">
        <p className="text-[10px] font-bold uppercase tracking-widest text-bad">Próximo festivo</p>
        <p className="text-sm font-bold text-main truncate">{holiday.name}</p>
        <p className="text-xs text-muted first-letter:uppercase">{weekdayName(holiday.date)} · {when.toLowerCase()}</p>
      </div>
    </div>
  );
};
