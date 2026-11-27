import React, { useState } from 'react';
import { FormData } from '../../types';
import { SHOW_ROUTE_SELECTOR } from '../../constants';
import { BriefcaseIcon, ChevronDownIcon, FuelIcon, MoneyIcon, PercentageIcon, RouteIcon, SettingsIcon, UsersIcon, WrenchIcon } from '../icons';
import { Card, IconBadge, SectionTitle, Tone } from '../ui';
import { RouteSelector } from './RouteSelector';

interface DayFormProps {
  formData: FormData;
  fuelInputRef: React.RefObject<HTMLInputElement>;
  isEditing: boolean;
  onChange: (e: { target: { name: string; value: string } }) => void;
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
}

interface RowProps {
  label: string;
  name: keyof FormData;
  value: string;
  icon: React.ReactNode;
  tone: Tone;
  /** "$" va antes del número, "%" después. */
  unit?: '$' | '%';
  onChange: DayFormProps['onChange'];
  onFocus: DayFormProps['onFocus'];
}

/** Ancho justo para el número, así el "$" queda pegadito (los puntos son más angostos que los dígitos). */
const numberWidth = (value: string) => {
  const dots = (value.match(/\./g) || []).length;
  const digits = Math.max(value.length - dots, 1);
  return `${Math.min(digits + dots * 0.4 + 0.2, 10)}ch`;
};

/** Una fila de la lista: icono + nombre a la izquierda, el número grande a la derecha. Toda la fila se puede tocar. */
const Row = React.forwardRef<HTMLInputElement, RowProps>(({ label, name, value, icon, tone, unit, onChange, onFocus }, ref) => (
  <label htmlFor={name} className="flex items-center gap-3 px-4 py-3 cursor-text transition-colors focus-within:bg-brand/5">
    <IconBadge tone={tone}>{icon}</IconBadge>
    <span className="flex-1 min-w-0 text-sm text-muted truncate">{label}</span>
    <span className="flex items-baseline gap-1 shrink-0">
      {unit === '$' && <span className="text-sm font-semibold text-faint">$</span>}
      <input
        ref={ref}
        id={name}
        name={name}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={onChange}
        placeholder="0"
        autoComplete="off"
        onFocus={e => {
          e.target.select();
          onFocus(e);
        }}
        style={{ width: numberWidth(value) }}
        className="tabular bg-transparent text-right text-xl font-extrabold text-main placeholder:text-faint/60 focus:outline-none"
      />
      {unit === '%' && <span className="text-sm font-semibold text-faint">%</span>}
    </span>
  </label>
));
Row.displayName = 'Row';

/**
 * "Lo de hoy": arriba lo que cambia cada día (pasajeros, combustible, taller).
 * Lo que casi nunca cambia (pasaje, comisiones, gastos administrativos) queda guardado en una fila que se abre al tocarla.
 */
export const DayForm: React.FC<DayFormProps> = ({ formData, fuelInputRef, isEditing, onChange, onFocus }) => {
  const [showFixed, setShowFixed] = useState(false);
  const rowProps = { onChange, onFocus };

  return (
    <main className="space-y-3">
      {isEditing && (
        <div className="px-4 py-3 rounded-xl border border-warn/40 bg-warn/10 text-sm text-warn font-medium">
          Estás editando un registro guardado. Toca “Actualizar registro” para aplicar los cambios.
        </div>
      )}

      <SectionTitle tone="brand">Lo de hoy</SectionTitle>

      <Card className="overflow-hidden divide-y divide-line/50">
        <Row label="Pasajeros" name="numPassengers" value={formData.numPassengers} icon={<UsersIcon />} tone="violet" {...rowProps} />
        <Row ref={fuelInputRef} label="Combustible" name="fuelExpenses" value={formData.fuelExpenses} icon={<FuelIcon />} tone="warn" unit="$" {...rowProps} />
        <Row label="Taller (lavada, engrase…)" name="variableExpenses" value={formData.variableExpenses} icon={<WrenchIcon />} tone="warn" unit="$" {...rowProps} />

        <button
          type="button"
          onClick={() => setShowFixed(open => !open)}
          aria-expanded={showFixed}
          className="w-full flex items-center gap-3 px-4 py-3 text-left"
        >
          <IconBadge tone="neutral"><SettingsIcon /></IconBadge>
          <span className="flex-1 min-w-0 text-sm text-muted truncate">Pasaje, comisión y admin.</span>
          <ChevronDownIcon className={`text-faint transition-transform duration-300 ${showFixed ? 'rotate-180' : ''}`} />
        </button>

        <div className="collapsible !border-t-0" data-open={showFixed}>
          <div>
            <div className="divide-y divide-line/50 border-t border-line/50 bg-app/30">
              <Row label="Valor pasaje" name="fareValue" value={formData.fareValue} icon={<MoneyIcon />} tone="good" unit="$" {...rowProps} />
              <Row label="Comisión fija" name="fixedCommission" value={formData.fixedCommission} icon={<PercentageIcon />} tone="info" unit="%" {...rowProps} />
              <Row label="Comisión por pasajero" name="commissionPerPassenger" value={formData.commissionPerPassenger} icon={<MoneyIcon />} tone="good" unit="$" {...rowProps} />
              <Row label="Gastos administrativos" name="administrativeExpenses" value={formData.administrativeExpenses} icon={<BriefcaseIcon />} tone="warn" unit="$" {...rowProps} />
              {SHOW_ROUTE_SELECTOR && (
                <div className="p-4">
                  <RouteSelector label="Ruta actual" value={formData.route} onChange={route => onChange({ target: { name: 'route', value: route } })} icon={<RouteIcon />} options={['60', '29']} />
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </main>
  );
};
