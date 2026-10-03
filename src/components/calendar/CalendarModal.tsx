import React, { useMemo, useState } from 'react';
import { dateKey, getColombianHolidays } from '../../utils/holidays';
import { CalendarIcon, ChevronDownIcon } from '../icons';
import { ModalShell } from '../ui';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

interface CalendarModalProps {
  onClose: () => void;
}

/** Calendario mes a mes con los festivos de Colombia marcados en rojo y su nombre debajo. */
export const CalendarModal: React.FC<CalendarModalProps> = ({ onClose }) => {
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const holidays = useMemo(() => getColombianHolidays(view.year), [view.year]);
  const holidayByDay = useMemo(() => new Map(holidays.map(h => [dateKey(h.date), h.name])), [holidays]);
  const monthHolidays = holidays.filter(h => h.date.getMonth() === view.month);

  // Celdas del mes: espacios vacíos hasta el primer día (la semana empieza el lunes) y luego los días.
  const firstWeekday = (new Date(view.year, view.month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const changeMonth = (delta: number) => setView(prev => {
    const date = new Date(prev.year, prev.month + delta, 1);
    return { year: date.getFullYear(), month: date.getMonth() };
  });
  const isCurrentMonth = view.year === today.getFullYear() && view.month === today.getMonth();

  return (
    <ModalShell title="Calendario" subtitle="Festivos de Colombia" icon={<CalendarIcon />} tone="brand" onClose={onClose}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <button onClick={() => changeMonth(-1)} aria-label="Mes anterior" className="h-11 w-11 rounded-xl bg-raised/60 text-main flex items-center justify-center active:scale-95 transition-all">
          <ChevronDownIcon className="rotate-90" />
        </button>
        <div className="text-center min-w-0">
          <p className="text-xl font-extrabold text-main">{MONTHS[view.month]}</p>
          <p className="text-sm text-muted tabular">{view.year}</p>
        </div>
        <button onClick={() => changeMonth(1)} aria-label="Mes siguiente" className="h-11 w-11 rounded-xl bg-raised/60 text-main flex items-center justify-center active:scale-95 transition-all">
          <ChevronDownIcon className="-rotate-90" />
        </button>
      </div>

      {/* Meses del año para saltar directo a cualquiera. */}
      <div className="grid grid-cols-6 gap-1 mb-4">
        {MONTHS.map((name, index) => (
          <button
            key={name}
            onClick={() => setView(prev => ({ ...prev, month: index }))}
            className={`py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${index === view.month ? 'bg-brand text-on-brand' : 'bg-raised/40 text-muted'}`}
          >
            {name.slice(0, 3)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map(day => (
          <div key={day} className={`text-[11px] font-bold uppercase pb-1 ${day === 'Do' ? 'text-bad' : 'text-muted'}`}>{day}</div>
        ))}
        {cells.map((day, index) => {
          if (day === null) return <div key={`empty-${index}`} />;
          const date = new Date(view.year, view.month, day);
          const isHoliday = holidayByDay.has(dateKey(date));
          const isSunday = date.getDay() === 0;
          const isToday = isCurrentMonth && day === today.getDate();
          const style = isToday
            ? 'bg-brand text-on-brand font-extrabold'
            : isHoliday
              ? 'bg-bad text-white font-extrabold'
              : isSunday
                ? 'text-bad/80 font-semibold'
                : 'text-main';
          return (
            <div key={day} className={`aspect-square rounded-xl flex items-center justify-center text-base tabular ${style}`}>
              {day}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-bad" />Festivo</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-brand" />Hoy</span>
      </div>

      <div className="mt-4 rounded-xl bg-field/50 border border-line/50 p-3">
        <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Festivos de {MONTHS[view.month].toLowerCase()}</p>
        {monthHolidays.length === 0 ? (
          <p className="text-sm text-faint">Este mes no tiene festivos.</p>
        ) : (
          <ul className="space-y-1.5">
            {monthHolidays.map(h => (
              <li key={h.name} className="flex items-center gap-3 text-sm">
                <span className="tabular font-extrabold text-bad w-16 shrink-0">
                  {h.date.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '')} {h.date.getDate()}
                </span>
                <span className="text-main">{h.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!isCurrentMonth && (
        <button
          onClick={() => setView({ year: today.getFullYear(), month: today.getMonth() })}
          className="mt-4 w-full py-2.5 rounded-xl border border-brand/40 text-brand font-semibold text-sm active:scale-95 transition-all"
        >
          Volver a hoy
        </button>
      )}
    </ModalShell>
  );
};
