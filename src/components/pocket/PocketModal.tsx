import React, { useState } from 'react';
import { PocketMove } from '../../types';
import { formatCurrency, formatNumberWithDots, formatTimestamp, parseFormattedNumber } from '../../utils/format';
import { TrashIcon, WalletIcon } from '../icons';
import { EmptyState, ModalShell, inputClass } from '../ui';

interface PocketModalProps {
  moves: PocketMove[];
  onAdd: (concept: string, amount: number) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/**
 * "Mi Bolsillo": tu plata personal. Al guardar un día entra solo tu sueldo (15% + $100 por pasajero),
 * y aquí mismo anotas lo que sumas o lo que gastas. Arriba siempre ves cuánto te queda.
 */
export const PocketModal: React.FC<PocketModalProps> = ({ moves, onAdd, onDelete, onClose }) => {
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');

  const total = moves.reduce((sum, move) => sum + move.amount, 0);
  const amountValue = Number(parseFormattedNumber(amount)) || 0;
  const totalSize = formatCurrency(total).length > 12 ? 'text-3xl' : 'text-4xl';

  const add = (sign: 1 | -1) => {
    if (amountValue <= 0) return;
    onAdd(concept.trim() || (sign === 1 ? 'Ingreso' : 'Gasto'), sign * amountValue);
    setAmount('');
    setConcept('');
  };

  return (
    <ModalShell title="Mi Bolsillo" subtitle="Tu plata personal" tone="good" icon={<WalletIcon />} onClose={onClose}>
      <div className="text-center mb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">Te queda</p>
        <p className={`tabular font-extrabold tracking-tight ${totalSize} ${total < 0 ? 'text-bad' : 'text-good'}`}>
          {formatCurrency(total)}
        </p>
      </div>

      <div className="p-3 rounded-xl bg-field/50 border border-line/50 space-y-2 mb-5">
        <input
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={e => setAmount(formatNumberWithDots(e.target.value).slice(0, 11))}
          className={`${inputClass} tabular text-lg font-bold text-center`}
          placeholder="$ Valor"
          aria-label="Valor"
        />
        <input
          type="text"
          value={concept}
          onChange={e => setConcept(e.target.value)}
          className={inputClass}
          placeholder="¿En qué? (ej: huevos)"
          aria-label="Concepto"
          maxLength={40}
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => add(-1)}
            disabled={amountValue <= 0}
            className="py-3 rounded-xl font-bold bg-bad/15 text-bad border border-bad/30 active:scale-95 transition-all disabled:opacity-40"
          >
            − Gasté
          </button>
          <button
            onClick={() => add(1)}
            disabled={amountValue <= 0}
            className="py-3 rounded-xl font-bold bg-good/15 text-good border border-good/30 active:scale-95 transition-all disabled:opacity-40"
          >
            + Sumar
          </button>
        </div>
      </div>

      {moves.length === 0 ? (
        <EmptyState icon={<WalletIcon />}>Cuando guardes un día, tu sueldo aparecerá aquí.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {moves.map(move => (
            <li key={move.id} className="flex items-center gap-3 p-3 rounded-xl bg-raised/30 border border-line/40">
              <div className="flex-grow min-w-0">
                <p className="text-sm font-semibold text-main truncate">{move.concept}</p>
                <p className="text-[11px] text-faint">{formatTimestamp(move.timestamp)}</p>
              </div>
              <p className={`tabular font-bold whitespace-nowrap ${move.amount < 0 ? 'text-bad' : 'text-good'}`}>
                {move.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(move.amount))}
              </p>
              <button
                onClick={() => onDelete(move.id)}
                className="p-2 rounded-lg text-faint hover:text-bad hover:bg-bad/15 transition-colors"
                aria-label={`Borrar ${move.concept}`}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  );
};
