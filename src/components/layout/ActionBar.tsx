import React from 'react';
import { CheckIcon } from '../icons';

interface ActionBarProps {
  isEditing: boolean;
  isSaving: boolean;
  hidden: boolean;
  onSave: () => void;
  onClear: () => void;
}

/** Barra fija inferior con Guardar y Limpiar. Se oculta mientras el teclado está abierto. */
export const ActionBar: React.FC<ActionBarProps> = ({ isEditing, isSaving, hidden, onSave, onClear }) => (
  <div
    className={`fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ${hidden ? 'translate-y-full' : 'translate-y-0'}`}
    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
  >
    <div className="bg-app/85 backdrop-blur-xl border-t border-line/50">
      <div className="max-w-4xl mx-auto flex gap-3 px-4 py-3">
        <button
          onClick={onClear}
          disabled={isSaving}
          className="px-5 py-3 rounded-xl font-semibold text-sm text-main bg-raised/60 border border-line/60 hover:bg-raised transition-all active:scale-[0.97] disabled:opacity-50"
          aria-label={isEditing ? 'Cancelar edición' : 'Limpiar formulario'}
        >
          {isEditing ? 'Cancelar' : 'Limpiar'}
        </button>
        <button
          onClick={onSave}
          disabled={isSaving}
          className={`flex-grow flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-300 active:scale-[0.98] ${isSaving ? 'bg-good text-on-brand scale-[1.02]' : 'bg-brand text-on-brand shadow-lg shadow-brand/25 hover:brightness-110'}`}
          aria-label={isEditing ? 'Actualizar datos' : 'Guardar datos'}
        >
          {isSaving ? <><CheckIcon /> ¡Guardado!</> : isEditing ? 'Actualizar registro' : 'Guardar registro'}
        </button>
      </div>
    </div>
  </div>
);
