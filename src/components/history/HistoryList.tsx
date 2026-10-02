import React, { useState } from 'react';
import { HistoryEntry } from '../../types';
import { calculateRouteForDate } from '../../utils/route';
import { formatCurrency, formatTimestamp, parseFormattedNumber } from '../../utils/format';
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, ChevronDownIcon, CopyIcon, EditIcon, LoadIcon, TrashIcon, XIcon } from '../icons';
import { IconButton } from '../ui';

interface HistoryListProps {
  history: HistoryEntry[];
  /** Total de registros guardados (la lista puede mostrar solo una parte). */
  totalCount: number;
  /** Si es false (por ejemplo al buscar) se ocultan las flechas de mover. */
  canReorder: boolean;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onCopy: (entry: HistoryEntry) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onChangeTimestamp: (id: string, isoTimestamp: string) => void;
}

const toLocalInputValue = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const HistoryList: React.FC<HistoryListProps> = ({ history, totalCount, canReorder, onLoad, onDelete, onCopy, onMoveUp, onMoveDown, onChangeTimestamp }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempTimestamp, setTempTimestamp] = useState('');

  const startEdit = (entry: HistoryEntry) => {
    setEditingId(entry.id);
    setTempTimestamp(toLocalInputValue(entry.timestamp));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTempTimestamp('');
  };

  const saveEdit = (id: string) => {
    if (!tempTimestamp) return;
    onChangeTimestamp(id, new Date(tempTimestamp).toISOString());
    cancelEdit();
  };

  const timestampEditor = (entry: HistoryEntry) => (
    <div className="flex items-center gap-2">
      <input
        type="datetime-local"
        value={tempTimestamp}
        onChange={e => setTempTimestamp(e.target.value)}
        className="bg-field border border-line rounded-lg p-1.5 text-sm text-main focus:outline-none focus:border-brand w-full"
        aria-label="Editar fecha y hora"
      />
      <IconButton title="Guardar fecha y hora" tone="good" onClick={() => saveEdit(entry.id)}><CheckIcon /></IconButton>
      <IconButton title="Cancelar edición" tone="bad" onClick={cancelEdit}><XIcon /></IconButton>
    </div>
  );

  const actions = (entry: HistoryEntry, index: number) => (
    <div className="flex items-center gap-1.5">
      <IconButton title="Copiar para WhatsApp" tone="good" onClick={() => onCopy(entry)}><CopyIcon /></IconButton>
      {canReorder && <IconButton title="Mover hacia arriba" tone="info" onClick={() => onMoveUp(entry.id)} disabled={index === 0}><ArrowUpIcon /></IconButton>}
      {canReorder && <IconButton title="Mover hacia abajo" tone="info" onClick={() => onMoveDown(entry.id)} disabled={index === totalCount - 1}><ArrowDownIcon /></IconButton>}
      <IconButton title="Cargar este cálculo" tone="brand" onClick={() => onLoad(entry.id)}><LoadIcon /></IconButton>
      <IconButton title="Borrar este cálculo" tone="bad" onClick={() => onDelete(entry.id)}><TrashIcon /></IconButton>
    </div>
  );

  return (
    <div className="md:border md:border-line/50 md:rounded-2xl md:max-h-[70vh] md:overflow-y-auto md:relative custom-scrollbar">
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm px-4 py-3 hidden md:grid grid-cols-9 gap-x-4 text-xs font-bold uppercase tracking-wider text-muted border-b border-line/50">
        <div className="col-span-2">Fecha</div>
        <div>Ruta</div>
        <div>Pasajeros</div>
        <div className="text-center">Ganancia</div>
        <div className="text-center">Gastos</div>
        <div className="text-center">Recaudado</div>
        <div className="text-center">En empresa</div>
        <div className="text-right">Acciones</div>
      </div>

      <ul className="space-y-3 md:space-y-0">
        {history.map((entry, index) => {
          const isExpanded = expandedId === entry.id;
          const toggle = () => setExpandedId(current => (current === entry.id ? null : entry.id));
          const route = entry.formData.route || calculateRouteForDate(entry.timestamp);
          const passengers = parseFormattedNumber(entry.formData.numPassengers);

          return (
            <li key={entry.id} className="md:border-b md:border-line/40 last:md:border-b-0">
              {/* Celular: tarjeta que se despliega */}
              <div className="md:hidden bg-field/50 border border-line/50 rounded-2xl overflow-hidden">
                <div className="p-4">
                  <div className="flex justify-between items-start gap-2">
                    <button onClick={toggle} className="flex-grow text-left">
                      <p className="font-semibold text-main">{formatTimestamp(entry.timestamp)}</p>
                      <p className="text-xs text-muted">Ruta {route} · {passengers} pasajeros</p>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <IconButton title="Copiar para WhatsApp" tone="good" onClick={() => onCopy(entry)}><CopyIcon /></IconButton>
                      <IconButton title={isExpanded ? 'Ocultar detalle' : 'Ver detalle'} onClick={toggle}>
                        <ChevronDownIcon className={`!h-5 !w-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                      </IconButton>
                    </div>
                  </div>
                  <button onClick={toggle} className="w-full text-left mt-3 pt-3 border-t border-line/40 flex justify-between items-end">
                    <div>
                      <p className="text-[11px] text-muted">Ganancia</p>
                      <p className="tabular font-bold text-good text-lg leading-tight">{formatCurrency(entry.results.myEarnings)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-muted">Recaudado</p>
                      <p className="tabular font-semibold text-info leading-tight">{formatCurrency(entry.results.totalDeliveredAmount || 0)}</p>
                    </div>
                  </button>
                </div>

                <div className="collapsible" data-open={isExpanded}>
                  <div>
                    <div className="px-4 pb-4 border-t border-line/40">
                      <div className="pt-3">
                        {editingId === entry.id ? timestampEditor(entry) : (
                          <div className="flex justify-end">
                            <button onClick={() => startEdit(entry)} className="flex items-center gap-1 text-xs text-muted hover:text-main transition-colors">
                              <EditIcon /> Editar fecha
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mt-3">
                        <Detail label="Pasajeros" value={passengers} />
                        <Detail label="Gastos" value={formatCurrency(entry.results.totalExpenses)} tone="text-warn" />
                        <div className="col-span-2">
                          <p className="text-muted">Desglose de ganancia</p>
                          <div className="text-xs mt-1 text-muted grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
                            <span>Fija ({entry.formData.fixedCommission}%)</span><span className="tabular font-medium text-info text-right">{formatCurrency(entry.results.fixedCommissionValue)}</span>
                            <span>Por pasajeros</span><span className="tabular font-medium text-brand text-right">{formatCurrency(entry.results.perPassengerCommissionValue)}</span>
                          </div>
                        </div>
                        <div className="col-span-2"><Detail label="En empresa" value={formatCurrency(entry.results.amountToSettle)} tone="text-violet" /></div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-line/40">{actions(entry, index)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Escritorio: fila de tabla */}
              <div className="hidden md:grid md:grid-cols-9 md:gap-x-4 md:items-center px-4 py-3 even:bg-field/30 hover:bg-brand/5 transition-colors group">
                <div className="md:col-span-2">
                  {editingId === entry.id ? timestampEditor(entry) : (
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-main text-sm">{formatTimestamp(entry.timestamp)}</p>
                      <IconButton title="Editar fecha" onClick={() => startEdit(entry)} className="!p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"><EditIcon /></IconButton>
                    </div>
                  )}
                </div>
                <div className="font-bold text-brand">{route}</div>
                <div className="tabular font-bold text-main">{passengers}</div>
                <div className="text-center">
                  <p className="tabular font-bold text-good">{formatCurrency(entry.results.myEarnings)}</p>
                  <p className="tabular text-[11px] text-info">{formatCurrency(entry.results.fixedCommissionValue)} ({entry.formData.fixedCommission}%)</p>
                  <p className="tabular text-[11px] text-brand">{formatCurrency(entry.results.perPassengerCommissionValue)} (pasajeros)</p>
                </div>
                <div className="tabular font-bold text-warn text-center">{formatCurrency(entry.results.totalExpenses)}</div>
                <div className="tabular font-bold text-info text-center">{formatCurrency(entry.results.totalDeliveredAmount || 0)}</div>
                <div className="tabular font-bold text-violet text-center">{formatCurrency(entry.results.amountToSettle)}</div>
                <div className="flex justify-end">{actions(entry, index)}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const Detail: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone = 'text-main' }) => (
  <div>
    <p className="text-muted">{label}</p>
    <p className={`tabular font-bold text-base ${tone}`}>{value}</p>
  </div>
);
