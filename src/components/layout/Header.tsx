import React from 'react';
import { GpsStatus } from '../../types';
import { formatCurrency } from '../../utils/format';
import { CalculationResults } from '../../types';
import { CalendarIcon, MoonIcon, RobotIcon, SettingsIcon, ShieldIcon, SunIcon } from '../icons';
import { Theme } from '../../hooks/useTheme';
import { useZoom } from '../../hooks/useZoom';
import { Card, IconBadge } from '../ui';

/** Título de las pestañas Registros y Más. ("Hoy" no lleva título, para dejar más espacio.) */
export const TabHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="mb-3">
    <h1 className="text-2xl font-extrabold tracking-tight text-main leading-tight truncate">{title}</h1>
    {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
  </div>
);

interface SettingsCardProps {
  theme: Theme;
  onToggleTheme: () => void;
  zoom: ReturnType<typeof useZoom>;
}

/** Ajustes (en la pestaña Más): tamaño de toda la app y modo claro/oscuro. */
export const SettingsCard: React.FC<SettingsCardProps> = ({ theme, onToggleTheme, zoom }) => (
  <Card className="mt-6 divide-y divide-line/50">
    <div className="flex items-center gap-3 p-4">
      <IconBadge tone="neutral"><SettingsIcon /></IconBadge>
      <h2 className="text-base sm:text-lg font-bold text-main">Ajustes</h2>
    </div>
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-main">Tamaño de la app</p>
        <p className="text-xs text-muted">Toca el % para volver a lo normal</p>
      </div>
      <ZoomControl {...zoom} />
    </div>
    <button onClick={onToggleTheme} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-main">Modo de pantalla</p>
        <p className="text-xs text-muted">{theme === 'dark' ? 'Ahora: oscuro' : 'Ahora: claro'}</p>
      </div>
      <span className="inline-flex items-center gap-2 px-3 h-9 rounded-lg bg-raised/40 text-muted text-xs font-semibold">
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        {theme === 'dark' ? 'Cambiar a claro' : 'Cambiar a oscuro'}
      </span>
    </button>
  </Card>
);

interface TodayTopProps {
  results: CalculationResults;
  gpsStatus: GpsStatus;
  onOpenRobot: () => void;
  onSendPreop: () => void;
  onOpenCalendar: () => void;
}

const quickClass =
  'fit-quick max-[380px]:[&_svg]:hidden flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95';

/** Parte de arriba de la pestaña "Hoy": 3 botones rápidos y la tarjeta con la Entrega. */
export const TodayTop: React.FC<TodayTopProps> = ({ results, gpsStatus, onOpenRobot, onSendPreop, onOpenCalendar }) => {
  const isNegative = results.amountToSettle < 0;
  const entregaText = formatCurrency(results.amountToSettle);
  // Las cifras largas bajan de tamaño para que siempre quepan en pantallas angostas.
  const entregaSize = entregaText.length > 12 ? 'text-2xl' : entregaText.length > 10 ? 'text-3xl' : 'text-4xl';

  return (
    <div className="mb-3">
      <div className="flex gap-2 mb-3">
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

      <Card className="fit-card px-4 py-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted">Entrega</p>
            <p className={`fit-big tabular whitespace-nowrap font-extrabold tracking-tight leading-tight transition-colors ${entregaSize} ${isNegative ? 'text-bad' : 'text-brand'}`}>
              {entregaText}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted">Mi sueldo</p>
            <p className="tabular font-bold text-lg text-good whitespace-nowrap">{formatCurrency(results.myEarnings)}</p>
          </div>
        </div>
        {/* Solo avisa cuando algo anda mal, para ahorrar espacio en la pantalla. */}
        {isNegative && <p className="text-xs text-bad mt-1">Los gastos superan lo recaudado</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 pt-2 border-t border-line/50 text-xs text-muted">
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
