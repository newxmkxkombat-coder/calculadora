import React from 'react';
import { IconBadge } from '../ui';

interface RouteSelectorProps {
  label: string;
  value: string;
  onChange: (route: string) => void;
  icon: React.ReactNode;
  options: string[];
}

/** Selector de ruta tipo "segmentos": una sola opción activa. */
export const RouteSelector: React.FC<RouteSelectorProps> = ({ label, value, onChange, icon, options }) => (
  <div className="p-3 rounded-2xl border border-line/60 bg-field/70">
    <div className="flex items-center gap-3 mb-3">
      <IconBadge tone="info">{icon}</IconBadge>
      <span className="text-xs font-medium text-muted">{label}</span>
    </div>
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2 p-1 bg-app/40 rounded-xl">
      {options.map(option => {
        const selected = value === option;
        return (
          <div key={option}>
            <input
              type="radio"
              id={`route-${option}`}
              name="route"
              value={option}
              checked={selected}
              onChange={() => onChange(option)}
              className="hidden peer route-checkbox"
            />
            <label
              htmlFor={`route-${option}`}
              className={`block text-center py-2.5 rounded-lg cursor-pointer font-bold text-sm transition-all duration-200 ${selected ? 'bg-brand text-on-brand shadow-md' : 'text-muted hover:text-main hover:bg-raised/40'}`}
            >
              Ruta {option}
            </label>
          </div>
        );
      })}
    </div>
  </div>
);
