import React from 'react';
import { FormData } from '../../types';
import { BriefcaseIcon, FuelIcon, MoneyIcon, PercentageIcon, RouteIcon, UsersIcon, WrenchIcon } from '../icons';
import { Card, SectionTitle } from '../ui';
import { InputControl } from './InputControl';
import { RouteSelector } from './RouteSelector';

interface DayFormProps {
  formData: FormData;
  fuelInputRef: React.RefObject<HTMLInputElement>;
  isEditing: boolean;
  onChange: (e: { target: { name: string; value: string } }) => void;
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export const DayForm: React.FC<DayFormProps> = ({ formData, fuelInputRef, isEditing, onChange, onFocus }) => (
  <main className="space-y-6">
    {isEditing && (
      <div className="px-4 py-3 rounded-xl border border-warn/40 bg-warn/10 text-sm text-warn font-medium">
        Estás editando un registro guardado. Toca “Actualizar registro” para aplicar los cambios.
      </div>
    )}

    <Card className="p-4 sm:p-5">
      <SectionTitle tone="brand">Datos del día</SectionTitle>
      <div className="space-y-3 mt-4">
        <InputControl label="Número de pasajeros" name="numPassengers" value={formData.numPassengers} onChange={onChange} onFocus={onFocus} icon={<UsersIcon />} />
        <div className="grid grid-cols-2 gap-3">
          <InputControl label="Valor pasaje" name="fareValue" value={formData.fareValue} onChange={onChange} onFocus={onFocus} icon={<MoneyIcon />} tone="good" unit="$" />
          <InputControl label="Comisión fija" name="fixedCommission" value={formData.fixedCommission} onChange={onChange} onFocus={onFocus} icon={<PercentageIcon />} tone="info" unit="%" />
        </div>
        <InputControl label="Comisión por pasajero" name="commissionPerPassenger" value={formData.commissionPerPassenger} onChange={onChange} onFocus={onFocus} icon={<MoneyIcon />} tone="good" unit="$" />
        <RouteSelector label="Ruta actual" value={formData.route} onChange={route => onChange({ target: { name: 'route', value: route } })} icon={<RouteIcon />} options={['60', '29']} />
      </div>
    </Card>

    <Card className="p-4 sm:p-5">
      <SectionTitle tone="warn">Gastos del día</SectionTitle>
      <div className="space-y-3 mt-4">
        <InputControl ref={fuelInputRef} label="Combustible" name="fuelExpenses" value={formData.fuelExpenses} onChange={onChange} onFocus={onFocus} icon={<FuelIcon />} tone="warn" unit="$" />
        <InputControl label="Taller (lavada, engrase, etc.)" name="variableExpenses" value={formData.variableExpenses} onChange={onChange} onFocus={onFocus} icon={<WrenchIcon />} tone="warn" unit="$" placeholder="Valor total" />
        <InputControl label="Gastos administrativos" name="administrativeExpenses" value={formData.administrativeExpenses} onChange={onChange} onFocus={onFocus} icon={<BriefcaseIcon />} tone="warn" unit="$" />
      </div>
    </Card>
  </main>
);
