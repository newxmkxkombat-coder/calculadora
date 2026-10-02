import React, { useEffect, useMemo, useState } from 'react';
import { HistoryEntry } from '../../types';
import { formatCurrency, formatTimestamp, parseFormattedNumber } from '../../utils/format';
import { ChevronDownIcon, ClipboardCheckIcon, SearchIcon, TrashIcon } from '../icons';
import { GoalProgress } from '../summary/GoalProgress';
import { Button, Card, EmptyState, IconBadge, inputClass } from '../ui';
import { HistoryList } from './HistoryList';

const PAGE_SIZE = 20;

interface HistorySectionProps {
  history: HistoryEntry[];
  passengerGoal: number;
  isOpen: boolean;
  onToggle: () => void;
  onGoalChange: (goal: number) => void;
  onClearAll: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onCopy: (entry: HistoryEntry) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onChangeTimestamp: (id: string, isoTimestamp: string) => void;
}

/** Texto en el que se busca: fecha (numérica y con nombre del mes/día), pasajeros y montos. */
const searchableText = (entry: HistoryEntry): string => {
  const date = new Date(entry.timestamp);
  const longDate = date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return [
    formatTimestamp(entry.timestamp),
    longDate,
    parseFormattedNumber(entry.formData.numPassengers),
    Math.round(entry.results.myEarnings),
    Math.round(entry.results.totalDeliveredAmount || 0),
  ].join(' ').toLowerCase();
};

export const HistorySection: React.FC<HistorySectionProps> = ({ history, passengerGoal, isOpen, onToggle, onGoalChange, onClearAll, ...listHandlers }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const term = searchTerm.trim().toLowerCase();
  const isSearching = term.length > 0;

  const filtered = useMemo(
    () => (isSearching ? history.filter(entry => searchableText(entry).includes(term)) : history),
    [history, term, isSearching]
  );

  useEffect(() => setVisibleCount(PAGE_SIZE), [term]);

  const visible = filtered.slice(0, visibleCount);
  const remaining = filtered.length - visible.length;

  const totals = useMemo(() => history.reduce((acc, entry) => {
    acc.earnings += entry.results.myEarnings;
    acc.expenses += entry.results.totalExpenses;
    acc.settled += entry.results.amountToSettle;
    acc.delivered += entry.results.totalDeliveredAmount || 0;
    acc.passengers += parseFloat(parseFormattedNumber(entry.formData.numPassengers)) || 0;
    acc.fixed += entry.results.fixedCommissionValue || 0;
    acc.perPassenger += entry.results.perPassengerCommissionValue || 0;
    return acc;
  }, { earnings: 0, expenses: 0, settled: 0, delivered: 0, passengers: 0, fixed: 0, perPassenger: 0 }), [history]);

  // Porcentaje fijo y valor por pasajero del registro más reciente, para saber de dónde sale cada parte.
  const rates = useMemo(() => {
    const latest = history[0]?.formData;
    return {
      fixed: latest?.fixedCommission || '0',
      perPassenger: formatCurrency(Number(parseFormattedNumber(latest?.commissionPerPassenger || '0'))),
    };
  }, [history]);

  return (
    <>
      <Card className="mt-6">
        {/* Toda la franja es un botón: al tocarla se abre o se cierra la lista */}
        <button
          id="registros"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="w-full flex items-center gap-3 text-left p-4 sm:p-5 scroll-mt-4"
        >
          <IconBadge tone="violet"><ClipboardCheckIcon /></IconBadge>
          <h2 className="text-base sm:text-lg font-bold text-main">Registros diarios</h2>
          {history.length > 0 && <span className="text-xs bg-raised/70 text-muted font-semibold px-2 py-0.5 rounded-full">{history.length}</span>}
          <span className="flex-grow" />
          <ChevronDownIcon className={`text-muted transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <div className="collapsible" data-open={isOpen}>
          <div>
            <div className="border-t border-line/50 p-4 sm:p-5 space-y-4">
              {history.length === 0 ? (
                <EmptyState icon={<ClipboardCheckIcon />}>Aún no hay cálculos guardados. Llena el día y toca “Guardar registro”.</EmptyState>
              ) : (
                <>
                  {/* Arriba del buscador para que se vea sin bajar hasta el final de la lista */}
                  <div className="flex justify-end">
                    <Button variant="danger" small onClick={onClearAll}><TrashIcon /> Borrar todo el historial</Button>
                  </div>

                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3"><SearchIcon /></span>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Buscar por fecha, mes, pasajeros o monto..."
                      className={`${inputClass} !pl-10`}
                      aria-label="Buscar en los registros"
                    />
                  </div>

                  {filtered.length === 0 ? (
                    <EmptyState icon={<SearchIcon />}>No se encontraron registros para “{searchTerm}”.</EmptyState>
                  ) : (
                    <>
                      {isSearching && <p className="text-xs text-muted">{filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}</p>}
                      <HistoryList history={visible} totalCount={history.length} canReorder={!isSearching} {...listHandlers} />
                      {remaining > 0 && (
                        <Button className="w-full" onClick={() => setVisibleCount(c => c + PAGE_SIZE)}>
                          Ver {Math.min(PAGE_SIZE, remaining)} más ({remaining} restantes)
                        </Button>
                      )}
                    </>
                  )}

                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {history.length > 0 && (
        <Card className="mt-6 p-4 sm:p-5 space-y-5">
          <div className="rounded-2xl bg-field/50 border border-line/50 p-4 sm:p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-4 text-center">Total del historial</h3>
            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <Total label="Pasajeros" value={totals.passengers.toLocaleString('es-CO')} tone="text-brand" />
              <div>
                <Total label="Ganancia" value={formatCurrency(totals.earnings)} tone="text-good" />
                {/* Cada parte en dos renglones (valor y de dónde sale) para que quepa en pantallas angostas. */}
                <p className="tabular text-[11px] text-info mt-1 leading-tight">
                  {formatCurrency(totals.fixed)}
                  <span className="block text-[10px] text-muted">{rates.fixed}% fijo</span>
                </p>
                <p className="tabular text-[11px] text-brand mt-1 leading-tight">
                  {formatCurrency(totals.perPassenger)}
                  <span className="block text-[10px] text-muted">{rates.perPassenger} por pasajero</span>
                </p>
              </div>
              <Total label="Gastos" value={formatCurrency(totals.expenses)} tone="text-warn" />
              <Total label="Recaudado" value={formatCurrency(totals.delivered)} tone="text-info" />
              <Total label="En empresa" value={formatCurrency(totals.settled)} tone="text-violet" />
            </div>
          </div>

          <GoalProgress totalPassengers={totals.passengers} goal={passengerGoal} onGoalChange={onGoalChange} />
        </Card>
      )}
    </>
  );
};

/** Las cifras muy largas bajan de tamaño para que siempre quepan en su casilla. */
const totalSize = (value: string) => (value.length > 12 ? 'text-sm' : value.length > 10 ? 'text-base' : 'text-lg');

const Total: React.FC<{ label: string; value: string; tone: string }> = ({ label, value, tone }) => (
  <div className="min-w-0">
    <p className="text-xs text-muted">{label}</p>
    <p className={`tabular whitespace-nowrap font-extrabold ${totalSize(value)} ${tone}`}>{value}</p>
  </div>
);
