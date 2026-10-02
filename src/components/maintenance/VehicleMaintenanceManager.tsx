import React, { useMemo, useState } from 'react';
import { MaintenanceRecord } from '../../types';
import { stripHtml } from '../../utils/format';
import { OIL_CHANGE_TYPE, OIL_CHANGE_WARNING_DAYS, getOilChangeStatus, longDate, maintenanceToWhatsappText } from '../../utils/maintenance';
import { CopyIcon, EditIcon, PlusCircleIcon, SearchIcon, TrashIcon, WrenchIcon } from '../icons';
import { Button, EmptyState, IconButton, SectionCard, inputClass } from '../ui';
import { MaintenanceModal } from './MaintenanceModal';

interface VehicleMaintenanceManagerProps {
  records: MaintenanceRecord[];
  setRecords: React.Dispatch<React.SetStateAction<MaintenanceRecord[]>>;
  customTypes: string[];
  setCustomTypes: React.Dispatch<React.SetStateAction<string[]>>;
}

export const VehicleMaintenanceManager: React.FC<VehicleMaintenanceManagerProps> = ({ records, setRecords, customTypes, setCustomTypes }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const oilStatus = useMemo(() => getOilChangeStatus(records), [records]);

  const filteredRecords = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filtered = records.filter(record => {
      if (!searchTerm.trim()) return true;
      return (
        record.type.toLowerCase().includes(term) ||
        (record.notes && stripHtml(record.notes).toLowerCase().includes(term)) ||
        (record.mileage && record.mileage.includes(searchTerm)) ||
        (record.filterChangeMileage && record.filterChangeMileage.includes(searchTerm)) ||
        (record.nextChangeMileage && record.nextChangeMileage.includes(searchTerm)) ||
        longDate(record.date).toLowerCase().includes(term)
      );
    });

    // Los cambios de aceite van primero; el resto, del más reciente al más antiguo.
    return [...filtered].sort((a, b) => {
      const aOil = a.type === OIL_CHANGE_TYPE;
      const bOil = b.type === OIL_CHANGE_TYPE;
      if (aOil && !bOil) return -1;
      if (!aOil && bOil) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [records, searchTerm]);

  const openModal = (record: MaintenanceRecord | null) => {
    setEditingRecord(record);
    setIsModalOpen(true);
  };

  const handleCopy = (record: MaintenanceRecord) => {
    navigator.clipboard.writeText(maintenanceToWhatsappText(record))
      .then(() => alert('¡Mantenimiento copiado al portapapeles! Ya puedes pegarlo en WhatsApp.'))
      .catch(err => {
        console.error('Error al copiar: ', err);
        alert('No se pudo copiar automáticamente. Por favor, inténtalo de nuevo.');
      });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este registro de mantenimiento?')) {
      setRecords(prev => prev.filter(r => r.id !== id));
    }
  };

  const handleSave = (record: MaintenanceRecord) => {
    if (editingRecord) {
      setRecords(prev => prev.map(r => (r.id === record.id ? record : r)));
    } else {
      setRecords(prev => [...prev, { ...record, id: Date.now().toString() }]);
    }
    setIsModalOpen(false);
  };

  return (
    <>
      <SectionCard
        title="Mantenimiento del vehículo"
        icon={<WrenchIcon className="h-5 w-5" />}
        tone="info"
        badge={oilStatus?.overdue ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-warn/15 text-warn">Aceite</span> : undefined}
      >
        {oilStatus && (
          <div className={`mb-4 p-3 rounded-xl border text-sm ${oilStatus.overdue ? 'border-warn/40 bg-warn/10' : 'border-good/30 bg-good/10'}`}>
            <p className={`font-bold ${oilStatus.overdue ? 'text-warn' : 'text-good'}`}>
              {oilStatus.overdue ? 'Revisa el cambio de aceite' : 'Aceite al día'}
            </p>
            <p className="text-muted">
              Último cambio hace {oilStatus.daysSince} {oilStatus.daysSince === 1 ? 'día' : 'días'}
              {oilStatus.record.mileage && <> a los {oilStatus.record.mileage} km</>}.
              {oilStatus.record.nextChangeMileage && <> Próximo a los <span className="font-semibold text-main">{oilStatus.record.nextChangeMileage} km</span>.</>}
              {oilStatus.overdue && <> Han pasado más de {OIL_CHANGE_WARNING_DAYS} días.</>}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch gap-3 mb-4">
          <div className="relative flex-grow">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3"><SearchIcon /></span>
            <input
              type="text"
              placeholder="Buscar por tipo, nota, fecha, km..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`${inputClass} !pl-10`}
              aria-label="Buscar en mantenimiento"
            />
          </div>
          <Button variant="primary" onClick={() => openModal(null)} className="shrink-0"><PlusCircleIcon /> Añadir</Button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
          {filteredRecords.length === 0 ? (
            <EmptyState icon={<WrenchIcon className="h-8 w-8" />}>
              {searchTerm ? `No se encontraron resultados para "${searchTerm}".` : 'Aún no has registrado mantenimientos.'}
            </EmptyState>
          ) : filteredRecords.map(record => {
            const isOil = record.type === OIL_CHANGE_TYPE;
            return (
              <div key={record.id} className="p-3 rounded-xl flex items-start justify-between gap-3 border border-line/50 bg-field/50">
                <div className="flex-grow min-w-0">
                  <p className="font-bold text-main">{record.type}</p>
                  <p className="text-sm text-muted first-letter:uppercase">{longDate(record.date)}</p>

                  {(record.mileage || (isOil && record.nextChangeMileage)) && (
                    <div className="mt-2 text-sm space-y-0.5">
                      {record.mileage && <p className="text-muted">Kilometraje: <span className="tabular font-semibold text-main">{record.mileage} km</span></p>}
                      {isOil && record.filterChangeMileage && <p className="text-warn">Cambio de filtros: <span className="tabular font-semibold text-main">{record.filterChangeMileage} km</span></p>}
                      {isOil && record.nextChangeMileage && <p className="text-brand">Próximo cambio: <span className="tabular font-semibold text-main">{record.nextChangeMileage} km</span></p>}
                    </div>
                  )}

                  {record.notes && (
                    <div className="text-sm text-muted mt-2 pt-2 border-t border-line/40 leading-relaxed break-words">
                      <span className="font-semibold text-faint">Nota: </span>
                      <span dangerouslySetInnerHTML={{ __html: record.notes }} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <IconButton title="Copiar para WhatsApp" tone="good" onClick={() => handleCopy(record)}><CopyIcon /></IconButton>
                  <IconButton title="Editar" tone="brand" onClick={() => openModal(record)}><EditIcon /></IconButton>
                  <IconButton title="Eliminar" tone="bad" onClick={() => handleDelete(record.id)}><TrashIcon /></IconButton>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
      {isModalOpen && (
        <MaintenanceModal
          record={editingRecord}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
          customTypes={customTypes}
          setCustomTypes={setCustomTypes}
        />
      )}
    </>
  );
};
