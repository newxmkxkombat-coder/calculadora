import React, { useMemo, useState } from 'react';
import { HistoryEntry } from '../../types';
import { formatCurrency, parseFormattedNumber } from '../../utils/format';
import { ChevronDownIcon, ClipboardCheckIcon, TrashIcon } from '../icons';
import { GoalProgress } from '../summary/GoalProgress';
import { Button, Card, EmptyState, IconBadge } from '../ui';
import { HistoryList } from './HistoryList';

interface HistorySectionProps {
  history: HistoryEntry[];
  passengerGoal: number;
  onGoalChange: (goal: number) => void;
  onClearAll: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onCopy: (entry: HistoryEntry) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onChangeTimestamp: (id: string, isoTimestamp: string) => void;
}

export const HistorySection: React.FC<HistorySectionProps> = ({ history, passengerGoal, onGoalChange, onClearAll, ...listHandlers }) => {
  const [isListOpen, setIsListOpen] = useState(false);

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

  return (
    <Card className="mt-6">
      <div className="flex items-center gap-3 p-4 sm:p-5">
        <IconBadge tone="violet"><ClipboardCheckIcon /></IconBadge>
        <h2 className="text-base sm:text-lg font-bold text-main flex-grow">Historial</h2>
        <Button variant="danger" small onClick={onClearAll} disabled={history.length === 0}>
          <TrashIcon /> <span className="hidden sm:inline">Borrar historial</span>
        </Button>
      </div>

      <div className="border-t border-line/50 p-4 sm:p-5 space-y-5">
        {history.length === 0 ? (
          <EmptyState icon={<ClipboardCheckIcon />}>Aún no hay cálculos guardados. Llena el día y toca “Guardar registro”.</EmptyState>
        ) : (
          <>
            <GoalProgress totalPassengers={totals.passengers} goal={passengerGoal} onGoalChange={onGoalChange} />

            <div className="rounded-2xl bg-field/50 border border-line/50 p-4 sm:p-5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-4 text-center">Total del historial</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                <Total label="Pasajeros" value={totals.passengers.toLocaleString('es-CO')} tone="text-brand" />
                <div>
                  <Total label="Ganancia" value={formatCurrency(totals.earnings)} tone="text-good" />
                  <p className="tabular text-[11px] text-info mt-1">{formatCurrency(totals.fixed)} fija</p>
                  <p className="tabular text-[11px] text-brand">{formatCurrency(totals.perPassenger)} por pasajero</p>
                </div>
                <Total label="Gastos" value={formatCurrency(totals.expenses)} tone="text-warn" />
                <Total label="Recaudado" value={formatCurrency(totals.delivered)} tone="text-info" />
                <Total label="En empresa" value={formatCurrency(totals.settled)} tone="text-violet" />
              </div>
            </div>

            <div>
              <button
                onClick={() => setIsListOpen(o => !o)}
                aria-expanded={isListOpen}
                className="w-full flex justify-between items-center text-left p-3 rounded-xl bg-field/50 border border-line/50 hover:bg-raised/40 transition-colors"
              >
                <span className="flex items-center gap-3">
                  <span className="font-bold text-main">Registros diarios</span>
                  <span className="text-xs bg-raised/70 text-muted font-semibold px-2 py-0.5 rounded-full">{history.length}</span>
                </span>
                <ChevronDownIcon className={`text-muted transition-transform duration-300 ${isListOpen ? 'rotate-180' : ''}`} />
              </button>
              <div className="collapsible" data-open={isListOpen}>
                <div><div className="pt-4"><HistoryList history={history} {...listHandlers} /></div></div>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

const Total: React.FC<{ label: string; value: string; tone: string }> = ({ label, value, tone }) => (
  <div>
    <p className="text-xs text-muted">{label}</p>
    <p className={`tabular text-lg font-extrabold ${tone}`}>{value}</p>
  </div>
);
