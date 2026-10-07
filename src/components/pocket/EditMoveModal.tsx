import React, { useState } from 'react';
import { PocketMove } from '../../types';
import { formatNumberWithDots, parseFormattedNumber } from '../../utils/format';
import { categoryEmoji } from '../../utils/categories';
import { EditIcon } from '../icons';
import { Button, ModalShell, inputClass, labelClass } from '../ui';

interface EditMoveModalProps {
  move: PocketMove;
  /** Grupo que tiene ahora el gasto (elegido a mano o adivinado). */
  currentCategory: string | null;
  categories: string[];
  onSave: (updated: PocketMove, groupChanged: boolean) => void;
  onAddCategory: (name: string) => void;
  onClose: () => void;
}

/** Cuadrito para corregir un movimiento: valor, nombre, si es gasto o ingreso, y su grupo. */
export const EditMoveModal: React.FC<EditMoveModalProps> = ({ move, currentCategory, categories, onSave, onAddCategory, onClose }) => {
  const [amount, setAmount] = useState(formatNumberWithDots(String(Math.abs(move.amount))));
  const [concept, setConcept] = useState(move.concept);
  const [isExpense, setIsExpense] = useState(move.amount < 0);
  const [category, setCategory] = useState(currentCategory || 'Otros');

  const amountValue = Number(parseFormattedNumber(amount)) || 0;

  const addCategory = () => {
    const name = window.prompt('Nombre del grupo nuevo (ej: Niños, Mascota):')?.trim();
    if (!name) return;
    const nice = name.charAt(0).toUpperCase() + name.slice(1);
    onAddCategory(nice);
    setCategory(nice);
  };

  const save = () => {
    if (amountValue <= 0) return;
    const groupChanged = isExpense && category !== currentCategory;
    onSave(
      {
        ...move,
        concept: concept.trim() || (isExpense ? 'Gasto' : 'Ingreso'),
        amount: isExpense ? -amountValue : amountValue,
        category: isExpense && (groupChanged || move.category) ? category : undefined,
      },
      groupChanged,
    );
    onClose();
  };

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full border text-xs font-semibold transition-all active:scale-95 ${active ? 'bg-good/20 text-good border-good/50' : 'bg-raised/40 text-muted border-line/50'}`;

  return (
    <ModalShell title="Corregir" subtitle="Cambia lo que quedó mal" tone="info" icon={<EditIcon />} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setIsExpense(true)} className={`py-2.5 rounded-xl font-bold border transition-all ${isExpense ? 'bg-bad/15 text-bad border-bad/40' : 'bg-raised/30 text-faint border-line/40'}`}>
            − Gasto
          </button>
          <button onClick={() => setIsExpense(false)} className={`py-2.5 rounded-xl font-bold border transition-all ${!isExpense ? 'bg-good/15 text-good border-good/40' : 'bg-raised/30 text-faint border-line/40'}`}>
            + Ingreso
          </button>
        </div>

        <div>
          <label className={labelClass}>Valor</label>
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={e => setAmount(formatNumberWithDots(e.target.value).slice(0, 11))}
            className={`${inputClass} tabular text-lg font-bold`}
            aria-label="Valor"
          />
        </div>

        <div>
          <label className={labelClass}>Nombre</label>
          <input type="text" value={concept} onChange={e => setConcept(e.target.value)} className={inputClass} maxLength={40} aria-label="Nombre" />
        </div>

        {isExpense && (
          <div>
            <label className={labelClass}>Grupo</label>
            <div className="flex flex-wrap gap-2">
              {categories.map(name => (
                <button key={name} onClick={() => setCategory(name)} className={chip(category === name)}>
                  {categoryEmoji(name)} {name}
                </button>
              ))}
              <button onClick={addCategory} className={`${chip(false)} border-dashed`}>+ Nuevo grupo</button>
            </div>
            <p className="text-[11px] text-faint mt-2">Si cambias el grupo, la app lo recordará para la próxima vez.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} disabled={amountValue <= 0}>Guardar</Button>
        </div>
      </div>
    </ModalShell>
  );
};
