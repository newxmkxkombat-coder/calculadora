import React, { useMemo, useState } from 'react';
import { HistoryEntry } from '../../types';
import { formatCurrency } from '../../utils/format';
import { PeriodKey, lastSevenDays, totalsForPeriod } from '../../utils/period';
import { ChartIcon } from '../icons';
import { Card, IconBadge } from '../ui';

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'week', label: '7 días' },
  { key: 'month', label: 'Este mes' },
  { key: 'all', label: 'Todo' },
];

/** Resumen por periodo + gráfico de barras de la ganancia de los últimos 7 días. */
export const PeriodSummary: React.FC<{ history: HistoryEntry[] }> = ({ history }) => {
  const [period, setPeriod] = useState<PeriodKey>('week');

  const totals = useMemo(() => totalsForPeriod(history, period), [history, period]);
  const bars = useMemo(() => lastSevenDays(history), [history]);
  const maxEarnings = Math.max(...bars.map(b => b.earnings), 1);
  const average = totals.days > 0 ? totals.earnings / totals.days : 0;

  return (
    <Card className="mt-6 p-4 sm:p-5">
      <div className="flex items-center gap-3 mb-4">
        <IconBadge tone="good"><ChartIcon /></IconBadge>
        <h2 className="text-base sm:text-lg font-bold text-main flex-grow">Resumen</h2>
      </div>

      <div role="tablist" aria-label="Periodo" className="grid grid-cols-3 gap-1 p-1 bg-app/40 rounded-xl mb-4">
        {PERIODS.map(p => (
          <button
            key={p.key}
            role="tab"
            aria-selected={period === p.key}
            onClick={() => setPeriod(p.key)}
            className={`py-2 rounded-lg text-sm font-semibold transition-all ${period === p.key ? 'bg-raised text-main shadow' : 'text-muted hover:text-main'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {history.length === 0 ? (
        <p className="text-center text-sm text-faint py-6">Guarda tu primer día para ver aquí tus totales.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
            <Metric label="Ganancia" value={formatCurrency(totals.earnings)} tone="text-good" big />
            <Metric label="Pasajeros" value={totals.passengers.toLocaleString('es-CO')} tone="text-brand" big />
            <Metric label="Gastos" value={formatCurrency(totals.expenses)} tone="text-warn" />
            <Metric label="Recaudado" value={formatCurrency(totals.delivered)} tone="text-info" />
          </div>
          <p className="text-xs text-faint mt-3 text-center">
            {totals.days} {totals.days === 1 ? 'día trabajado' : 'días trabajados'}
            {totals.days > 0 && <> · promedio {formatCurrency(average)} por día</>}
          </p>
        </>
      )}

      <div className="mt-5 pt-4 border-t border-line/50">
        <p className="text-xs font-semibold text-muted mb-3">Ganancia de los últimos 7 días</p>
        <div className="flex items-end gap-2 h-28" role="img" aria-label="Gráfico de ganancia por día">
          {bars.map(bar => (
            <div key={bar.key} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5 min-w-0" title={`${bar.label}: ${formatCurrency(bar.earnings)} · ${bar.passengers} pasajeros`}>
              <div className="w-full flex-grow flex items-end">
                <div
                  className={`w-full rounded-t-md transition-all duration-500 ${bar.earnings > 0 ? (bar.isToday ? 'bg-brand' : 'bg-good/70') : 'bg-raised/50'}`}
                  style={{ height: bar.earnings > 0 ? `${Math.max(6, (bar.earnings / maxEarnings) * 100)}%` : '4px' }}
                />
              </div>
              <span className={`text-[10px] capitalize ${bar.isToday ? 'text-brand font-bold' : 'text-faint'}`}>{bar.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

/** El tamaño de la cifra baja un poco si es muy larga, para que nunca se corte. */
const sizeFor = (value: string, big?: boolean) => {
  if (value.length > 12) return 'text-sm';
  if (value.length > 10) return 'text-base';
  return big ? 'text-xl' : 'text-base';
};

const Metric: React.FC<{ label: string; value: string; tone: string; big?: boolean }> = ({ label, value, tone, big }) => (
  <div className="p-3 rounded-xl bg-field/50 border border-line/40 min-w-0">
    <p className="text-[11px] text-muted">{label}</p>
    <p className={`tabular font-extrabold whitespace-nowrap ${sizeFor(value, big)} ${tone}`}>{value}</p>
  </div>
);
