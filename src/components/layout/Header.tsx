import React from 'react';
import { GpsStatus } from '../../types';
import { formatCurrency } from '../../utils/format';
import { CalculationResults } from '../../types';
import { CalendarIcon, MoonIcon, RobotIcon, ShieldIcon, SunIcon } from '../icons';
import { Theme } from '../../hooks/useTheme';
import { useZoom } from '../../hooks/useZoom';
import { Card, IconButton } from '../ui';
import { DigitalClock } from './DigitalClock';

interface TabHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  theme: Theme;
  onToggleTheme: () => void;
  zoom: ReturnType<typeof useZoom>;
}

/** Título grande de cada pestaña, con los botones de tamaño (− +) y de tema claro/oscuro. */
export const TabHeader: React.FC<TabHeaderProps> = ({ title, subtitle, theme, onToggleTheme, zoom }) => (
  <div className="flex items-start justify-between gap-3 mb-4">
    <div className="min-w-0">
      <h1 className="text-2xl font-extrabold tracking-tight text-main leading-tight truncate">{title}</h1>
      {subtitle && <div className="text-xs text-muted mt-1">{subtitle}</div>}
    </div>
    <div className="flex items-center gap-2 shrink-0">
      <ZoomControl {...zoom} />
      <IconButton title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} onClick={onToggleTheme}>
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </IconButton>
    </div>
  </div>
);

/** "Viernes 27 nov": corta para que quepa junto al reloj. */
const shortToday = () => {
  const now = new Date();
  const weekday = now.toLocaleDateString('es-CO', { weekday: 'long' });
  const month = now.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
  return `${weekday} ${now.getDate()} ${month}`;
};

/** Fecha de hoy + reloj, debajo del título "Hoy". */
export const TodaySubtitle: React.FC = () => (
  <div className="flex items-center gap-2">
    <span className="first-letter:uppercase truncate">{shortToday()}</span>
    <DigitalClock />
  </div>
);

interface TodayTopProps {
  results: CalculationResults;
  gpsStatus: GpsStatus;
  onOpenRobot: () => void;
  onSendPreop: () => void;
  onOpenCalendar: () => void;
}

const quickClass =
  'flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border text-xs font-bold transition-all active:scale-95';

/** Parte de arriba de la pestaña "Hoy": 3 botones rápidos y la tarjeta con la Entrega. */
export const TodayTop: React.FC<TodayTopProps> = ({ results, gpsStatus, onOpenRobot, onSendPreop, onOpenCalendar }) => {
  const isNegative = results.amountToSettle < 0;
  const entregaText = formatCurrency(results.amountToSettle);
  // Las cifras largas bajan de tamaño para que siempre quepan en pantallas angostas.
  const entregaSize = entregaText.length > 12 ? 'text-2xl' : entregaText.length > 10 ? 'text-3xl' : 'text-4xl';

  return (
    <div className="mb-5">
      <div className="flex gap-2 mb-4">
        <button onClick={onOpenRobot} className={`${quickClass} !flex-none px-4 text-violet bg-violet/10 border-violet/30`}>
          <RobotIcon />
          <span className="truncate">{gpsStatus === 'loading' ? 'Buscando...' : 'GPS'}</span>
        </button>
        <button onClick={onSendPreop} className={`${quickClass} !flex-[1.3] text-good bg-good/10 border-good/30`}>
          <ShieldIcon />
          <span className="truncate">Preoperacional</span>
        </button>
        <button onClick={onOpenCalendar} className={`${quickClass} text-brand bg-brand/10 border-brand/30`}>
          <CalendarIcon />
          <span className="truncate">Calendario</span>
        </button>
      </div>

      <Card className="p-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted">Entrega</p>
            <p className={`tabular whitespace-nowrap font-extrabold tracking-tight leading-tight transition-colors ${entregaSize} ${isNegative ? 'text-bad' : 'text-brand'}`}>
              {entregaText}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted">Mi sueldo</p>
            <p className="tabular font-bold text-lg text-good whitespace-nowrap">{formatCurrency(results.myEarnings)}</p>
          </div>
        </div>
        <p className="text-xs text-faint mt-1">
          {isNegative ? 'Los gastos superan lo recaudado' : 'Lo que entregas al propietario'}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-line/50 text-xs text-muted">
          <span>Gastos <b className="tabular text-warn text-sm">{formatCurrency(results.totalExpenses)}</b></span>
          <span>Recaudado <b className="tabular text-info text-sm">{formatCurrency(results.totalRevenue)}</b></span>
        </div>
      </Card>
    </div>
  );
};

const zoomButtonClass =
  'w-8 h-9 flex items-center justify-center text-lg font-bold leading-none transition-colors active:scale-90 hover:text-main disabled:opacity-30 disabled:cursor-not-allowed';

/** Botones − y + para achicar o agrandar toda la app. Tocar el porcentaje la deja normal. */
const ZoomControl: React.FC<ReturnType<typeof useZoom>> = ({ zoom, zoomIn, zoomOut, resetZoom, canZoomIn, canZoomOut }) => (
  <div className="flex items-center rounded-lg bg-raised/40 text-muted">
    <button className={zoomButtonClass} onClick={zoomOut} disabled={!canZoomOut} title="Achicar la app" aria-label="Achicar la app">
      −
    </button>
    <button
      className={`tabular text-[11px] font-semibold min-w-[2.25rem] h-9 transition-colors ${zoom === 1 ? '' : 'text-brand'}`}
      onClick={resetZoom}
      title="Tamaño normal"
      aria-label="Volver al tamaño normal"
    >
      {Math.round(zoom * 100)}%
    </button>
    <button className={zoomButtonClass} onClick={zoomIn} disabled={!canZoomIn} title="Agrandar la app" aria-label="Agrandar la app">
      +
    </button>
  </div>
);
