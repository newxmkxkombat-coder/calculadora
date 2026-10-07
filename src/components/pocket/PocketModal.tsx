import React, { useState } from 'react';
import { PocketMove } from '../../types';
import { formatCurrency, formatNumberWithDots, formatTimestamp, parseFormattedNumber } from '../../utils/format';
import { ParsedExpense, getMonthTotals, monthName, parseExpensesMessage, pocketToWhatsappText } from '../../utils/pocket';
import { CopyIcon, TrashIcon, WalletIcon, XIcon } from '../icons';
import { Button, EmptyState, ModalShell, inputClass } from '../ui';

interface PocketModalProps {
  moves: PocketMove[];
  onAdd: (items: { concept: string; amount: number }[]) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/**
 * "Mi Bolsillo": tu plata personal. Al guardar un día entra solo tu sueldo (15% + $100 por pasajero),
 * y aquí mismo anotas lo que sumas o lo que gastas. Arriba siempre ves cuánto te queda
 * y cuánto entró y cuánto gastaste en el mes. También puedes pegar un mensaje de WhatsApp
 * ("gasté 10 mil en jabón") para que la app saque los gastos sola.
 */
export const PocketModal: React.FC<PocketModalProps> = ({ moves, onAdd, onDelete, onClose }) => {
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [found, setFound] = useState<ParsedExpense[] | null>(null);

  const total = moves.reduce((sum, move) => sum + move.amount, 0);
  const amountValue = Number(parseFormattedNumber(amount)) || 0;
  const totalSize = formatCurrency(total).length > 12 ? 'text-3xl' : 'text-4xl';
  const month = getMonthTotals(moves);
  const foundTotal = (found || []).reduce((sum, item) => sum + item.amount, 0);

  const add = (sign: 1 | -1) => {
    if (amountValue <= 0) return;
    onAdd([{ concept: concept.trim() || (sign === 1 ? 'Ingreso' : 'Gasto'), amount: sign * amountValue }]);
    setAmount('');
    setConcept('');
  };

  const share = () => {
    navigator.clipboard.writeText(pocketToWhatsappText(moves))
      .then(() => alert('¡Cuentas del mes copiadas! Ya puedes pegarlas en WhatsApp.'))
      .catch(() => alert('No se pudo copiar. Intenta de nuevo.'));
  };

  // Intenta pegar lo que copiaste; si el celular no deja, se pega a mano en el cuadro.
  const pasteFromClipboard = () => {
    navigator.clipboard?.readText?.()
      .then(text => { if (text) setMessage(text); })
      .catch(() => alert('Mantén presionado el cuadro y toca "Pegar".'));
  };

  const readMessage = () => setFound(parseExpensesMessage(message));

  const closePaste = () => {
    setIsPasteOpen(false);
    setMessage('');
    setFound(null);
  };

  const discountFound = () => {
    if (!found || found.length === 0) return;
    onAdd(found.map(item => ({ concept: item.concept, amount: -item.amount })));
    closePaste();
  };

  return (
    <ModalShell
      title="Mi Bolsillo"
      subtitle="Tu plata personal"
      tone="good"
      icon={<WalletIcon />}
      onClose={onClose}
      headerExtra={<Button variant="secondary" small onClick={share} disabled={moves.length === 0}><CopyIcon /> Compartir</Button>}
    >
      <div className="text-center mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">Te queda</p>
        <p className={`tabular font-extrabold tracking-tight ${totalSize} ${total < 0 ? 'text-bad' : 'text-good'}`}>
          {formatCurrency(total)}
        </p>
      </div>

      <div className="mb-5 rounded-xl border border-line/50 overflow-hidden">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted text-center py-1.5 bg-raised/30">{monthName()}</p>
        <div className="grid grid-cols-2 divide-x divide-line/50">
          <div className="py-2.5 text-center">
            <p className="text-[11px] font-medium text-muted">Entró</p>
            <p className="tabular font-bold text-good">{formatCurrency(month.income)}</p>
          </div>
          <div className="py-2.5 text-center">
            <p className="text-[11px] font-medium text-muted">Gastaste</p>
            <p className="tabular font-bold text-bad">{formatCurrency(month.spent)}</p>
          </div>
        </div>
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

      {!isPasteOpen ? (
        <button
          onClick={() => setIsPasteOpen(true)}
          className="w-full mb-5 py-2.5 rounded-xl text-sm font-semibold text-info bg-info/10 border border-info/30 active:scale-95 transition-all"
        >
          📋 Pegar mensaje de gastos
        </button>
      ) : (
        <div className="p-3 rounded-xl bg-info/5 border border-info/30 space-y-2 mb-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-info">Pega aquí el mensaje de WhatsApp</p>
            <button onClick={closePaste} className="p-1 rounded-lg text-faint hover:text-main" aria-label="Cerrar"><XIcon /></button>
          </div>
          <textarea
            value={message}
            onChange={e => { setMessage(e.target.value); setFound(null); }}
            rows={4}
            className={`${inputClass} text-sm resize-none`}
            placeholder={'Ej: Amor, gasté 10 mil en un desodorante. Gasté 30 mil en jabón.'}
            aria-label="Mensaje de gastos"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" small onClick={pasteFromClipboard}>Pegar</Button>
            <Button variant="primary" small onClick={readMessage} disabled={!message.trim()}>Leer mensaje</Button>
          </div>

          {found && found.length === 0 && (
            <p className="text-xs text-bad text-center py-1">No encontré valores en el mensaje. Revisa que diga cuánto (ej: "10 mil").</p>
          )}
          {found && found.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-xs text-muted">Encontré estos gastos:</p>
              {found.map((item, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-raised/40">
                  <span className="flex-grow text-sm text-main truncate">{item.concept}</span>
                  <span className="tabular text-sm font-bold text-bad whitespace-nowrap">−{formatCurrency(item.amount)}</span>
                  <button
                    onClick={() => setFound(found.filter((_, j) => j !== i))}
                    className="p-1 rounded text-faint hover:text-bad"
                    aria-label={`Quitar ${item.concept}`}
                  >
                    <XIcon />
                  </button>
                </div>
              ))}
              <button
                onClick={discountFound}
                className="w-full py-3 rounded-xl font-bold bg-bad/15 text-bad border border-bad/30 active:scale-95 transition-all"
              >
                Descontar todo ({formatCurrency(foundTotal)})
              </button>
            </div>
          )}
        </div>
      )}

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
