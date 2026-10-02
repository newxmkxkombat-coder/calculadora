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
}

/** Campo numérico grande: etiqueta arriba, valor destacado, unidad a la derecha. */
export const InputControl = React.forwardRef<HTMLInputElement, InputControlProps>(
  ({ label, name, value, onChange, onFocus, placeholder = '0', icon, tone = 'brand', unit, disabled = false }, ref) => (
    <label
      htmlFor={name}
      className={`bg-field/70 p-3 rounded-2xl flex items-center gap-3 border border-line/60 transition-all duration-200 cursor-text ${!disabled ? 'focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25 focus-within:bg-field' : 'opacity-70'}`}
    >
      <IconBadge tone={tone}>{icon}</IconBadge>
      <span className="flex-grow min-w-0">
        <span className="block text-xs font-medium text-muted leading-tight mb-0.5 truncate">{label}</span>
        <span className="relative block">
          <input
            ref={ref}
            type="text"
            inputMode="numeric"
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={`tabular w-full bg-transparent text-main placeholder:text-faint/60 focus:outline-none text-xl font-bold disabled:text-muted ${unit ? 'pr-6' : ''}`}
            onFocus={e => {
              e.target.select();
              onFocus?.(e);
            }}
            autoComplete="off"
            disabled={disabled}
          />
          {unit && (
            <span className="absolute inset-y-0 right-0 flex items-center text-faint pointer-events-none text-base font-semibold">
              {unit}
            </span>
          )}
        </span>
      </span>
    </label>
  )
);
InputControl.displayName = 'InputControl';
