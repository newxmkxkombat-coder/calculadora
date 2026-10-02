import React from 'react';
import { FormData } from '../../types';
import { IconBadge, Tone } from '../ui';

interface InputControlProps {
  label: string;
  name: keyof FormData;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  icon: React.ReactNode;
  tone?: Tone;
  unit?: string;
  disabled?: boolean;
  /** Para campos en dos columnas: en pantallas angostas oculta el icono y deja todo el ancho al número. */
  compact?: boolean;
}

/** Campo numérico grande: etiqueta arriba, valor destacado, unidad al lado del número. */
export const InputControl = React.forwardRef<HTMLInputElement, InputControlProps>(
  ({ label, name, value, onChange, onFocus, placeholder = '0', icon, tone = 'brand', unit, disabled = false, compact = false }, ref) => (
    <label
      htmlFor={name}
      className={`bg-field/70 p-3 rounded-2xl flex items-center gap-3 border border-line/60 transition-all duration-200 cursor-text min-w-0 ${!disabled ? 'focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25 focus-within:bg-field' : 'opacity-70'}`}
    >
      <IconBadge tone={tone} className={compact ? 'hidden min-[420px]:inline-flex' : ''}>{icon}</IconBadge>
      <span className="flex-grow min-w-0">
        <span className="block text-xs font-medium text-muted leading-tight mb-0.5 truncate">{label}</span>
        <span className="flex items-baseline gap-1">
          <input
            ref={ref}
            type="text"
            inputMode="numeric"
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="tabular min-w-0 flex-1 w-full bg-transparent text-main placeholder:text-faint/60 focus:outline-none text-xl font-bold disabled:text-muted"
            onFocus={e => {
              e.target.select();
              onFocus?.(e);
            }}
            autoComplete="off"
            disabled={disabled}
          />
          {unit && <span className="shrink-0 text-faint text-base font-semibold">{unit}</span>}
        </span>
      </span>
    </label>
  )
);
InputControl.displayName = 'InputControl';
