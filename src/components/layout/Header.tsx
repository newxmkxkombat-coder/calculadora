import React from 'react';
import { GpsStatus } from '../../types';
import { formatCurrency } from '../../utils/format';
import { CalculationResults } from '../../types';
import { CalendarIcon, ClipboardCheckIcon, MoonIcon, RobotIcon, ShieldIcon, SunIcon } from '../icons';
import { Theme } from '../../hooks/useTheme';
import { Card, IconButton } from '../ui';
import { DigitalClock } from './DigitalClock';

interface HeaderProps {
  results: CalculationResults;
  gpsStatus: GpsStatus;
  theme: Theme;
  onToggleTheme: () => void;
  onOpenRobot: () => void;
  onGoToRecords: () => void;
  isSendingPreop: boolean;
  onSendPreop: () => void;
}

const chipClass =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all active:scale-95';

/** Barra superior + tarjeta principal con la Entrega y el resumen del día. */
export const Header: React.FC<HeaderProps> = ({ results, gpsStatus, theme, onToggleTheme, onOpenRobot, onGoToRecords, isSendingPreop, onSendPreop }) => {
  const isNegative = results.amountToSettle < 0;
  const entregaText = formatCurrency(results.amountToSettle);
  // Las cifras largas bajan de tamaño para que siempre quepan en pantallas angostas.
  const entregaSize = entregaText.length > 12 ? 'text-2xl sm:text-5xl' : entregaText.length > 9 ? 'text-3xl sm:text-5xl' : 'text-4xl sm:text-5xl';
  const today = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <header className="mb-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold tracking-tight text-main leading-tight">Mi Ganancia</h1>
          <p className="text-xs text-muted first-letter:uppercase truncate">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <DigitalClock />
          <IconButton title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} onClick={onToggleTheme}>
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </IconButton>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={onOpenRobot} className={`${chipClass} text-violet bg-violet/10 border-violet/30 hover:bg-violet/20`}>
          <RobotIcon />
          {gpsStatus === 'loading' ? 'Sincronizando...' : 'Pasajeros GPS'}
        </button>
        <button
          onClick={onGoToRecords}
          className={`${chipClass} text-info bg-info/10 border-info/30 hover:bg-info/20`}
        >
          <ClipboardCheckIcon />
          Registros
        </button>
        <a
          href="https://newxmkxkombat-coder.github.io/calendario/"
          target="_blank"
          rel="noopener noreferrer"
          className={`${chipClass} text-brand bg-brand/10 border-brand/30 hover:bg-brand/20`}
        >
          <CalendarIcon />
          Calendario
        </a>
        <button
          onClick={onSendPreop}
          disabled={isSendingPreop}
          className={`${chipClass} text-good bg-good/10 border-good/30 hover:bg-good/20 disabled:opacity-60`}
        >
          <ShieldIcon />
          {isSendingPreop ? 'Enviando...' : 'Preoperacional'}
        </button>
      </div>

      <Card className="overflow-hidden">
        <div className={`px-5 pt-5 pb-4 text-center bg-gradient-to-b ${isNegative ? 'from-bad/10' : 'from-brand/10'} to-transparent`}>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted mb-1">
            <ClipboardCheckIcon />
            Entrega
          </div>
          <p className={`tabular whitespace-nowrap font-extrabold tracking-tight transition-colors ${entregaSize} ${isNegative ? 'text-bad' : 'text-brand'}`}>
            {entregaText}
          </p>
          <p className="text-xs text-faint mt-1">
            {isNegative ? 'Los gastos superan lo recaudado' : 'Lo que entregas al propietario'}
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line/50 border-t border-line/50">
          <Stat label="Mi sueldo" value={formatCurrency(results.myEarnings)} className="text-good" />
          <Stat label="Gastos" value={formatCurrency(results.totalExpenses)} className="text-warn" />
          <Stat label="Recaudado" value={formatCurrency(results.totalRevenue)} className="text-info" />
        </div>
      </Card>
    </header>
  );
};

const statSize = (value: string) => (value.length > 11 ? 'text-xs sm:text-lg' : value.length > 9 ? 'text-sm sm:text-lg' : 'text-base sm:text-lg');

const Stat: React.FC<{ label: string; value: string; className: string }> = ({ label, value, className }) => (
  <div className="py-3 px-1 text-center min-w-0">
    <p className="text-[11px] font-medium text-muted">{label}</p>
    <p className={`tabular font-bold whitespace-nowrap ${statSize(value)} ${className}`}>{value}</p>
  </div>
);
