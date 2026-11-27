import React from 'react';
import { CheckIcon, ClipboardCheckIcon, GridIcon, HomeIcon, WalletIcon } from '../icons';

export type TabKey = 'hoy' | 'registros' | 'bolsillo' | 'mas';

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: 'hoy', label: 'Hoy', icon: <HomeIcon /> },
  { key: 'registros', label: 'Registros', icon: <ClipboardCheckIcon /> },
  { key: 'bolsillo', label: 'Mi Bolsillo', icon: <WalletIcon /> },
  { key: 'mas', label: 'Más', icon: <GridIcon /> },
];

interface ActionBarProps {
  tab: TabKey;
  onTabChange: (tab: TabKey) => void;
  isEditing: boolean;
  isSaving: boolean;
  hidden: boolean;
  onSave: () => void;
  onClear: () => void;
}

/**
 * Parte fija de abajo: los botones Guardar/Limpiar (solo en la pestaña "Hoy")
 * y la barra de pestañas. Todo se esconde mientras el teclado está abierto.
 */
export const ActionBar: React.FC<ActionBarProps> = ({ tab, onTabChange, isEditing, isSaving, hidden, onSave, onClear }) => (
  <div
    className={`fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ${hidden ? 'translate-y-full' : 'translate-y-0'}`}
  >
    {tab === 'hoy' && (
      <div className="bg-gradient-to-t from-app via-app/80 to-transparent pt-6">
      <div className="max-w-4xl mx-auto flex gap-3 px-4 pb-3">
        <button
          onClick={onClear}
          disabled={isSaving}
          className="px-5 py-3.5 rounded-2xl font-semibold text-sm text-main bg-card/95 backdrop-blur-xl border border-line/60 transition-all active:scale-[0.97] disabled:opacity-50"
          aria-label={isEditing ? 'Cancelar edición' : 'Limpiar formulario'}
        >
          {isEditing ? 'Cancelar' : 'Limpiar'}
        </button>
        <button
          onClick={onSave}
          disabled={isSaving}
          className={`flex-grow flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-extrabold text-[15px] transition-all duration-300 active:scale-[0.98] ${isSaving ? 'bg-good text-on-brand scale-[1.02]' : 'bg-brand text-on-brand shadow-lg shadow-brand/30 hover:brightness-110'}`}
          aria-label={isEditing ? 'Actualizar datos' : 'Guardar datos'}
        >
          {isSaving ? <><CheckIcon /> ¡Guardado!</> : <><CheckIcon /> {isEditing ? 'Actualizar registro' : 'Guardar día'}</>}
        </button>
      </div>
      </div>
    )}

    <nav className="bg-card/95 backdrop-blur-xl border-t border-line/60" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-4xl mx-auto grid grid-cols-4">
        {TABS.map(t => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => onTabChange(t.key)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center gap-1 pt-2 pb-2.5 text-[11px] font-semibold transition-colors ${active ? 'text-brand' : 'text-faint hover:text-muted'}`}
            >
              <span className={`flex items-center justify-center w-14 h-8 rounded-full transition-colors ${active ? 'bg-brand/15' : ''}`}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  </div>
);
