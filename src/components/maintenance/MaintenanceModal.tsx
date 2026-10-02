import React, { useEffect, useState } from 'react';
import { MaintenanceRecord } from '../../types';
import { DEFAULT_MAINTENANCE_TYPES } from '../../constants';
import { formatNumberWithDots, getLocalDateString, parseFormattedNumber } from '../../utils/format';
import { TrashIcon, WrenchIcon } from '../icons';
import { Button, ModalShell, inputClass, labelClass } from '../ui';
import { NotesEditor } from './NotesEditor';

interface MaintenanceModalProps {
  record: MaintenanceRecord | null;
  onSave: (record: MaintenanceRecord) => void;
  onClose: () => void;
  customTypes: string[];
  setCustomTypes: React.Dispatch<React.SetStateAction<string[]>>;
}

const OIL_CHANGE = 'Cambio de Aceite';
const KM_FIELDS = ['mileage', 'nextChangeMileage', 'filterChangeMileage'];

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({ record, onSave, onClose, customTypes, setCustomTypes }) => {
  const [formData, setFormData] = useState<Omit<MaintenanceRecord, 'id'>>({
    type: record?.type || 'Otro',
    date: record?.date || getLocalDateString(),
    mileage: record?.mileage || '',
    nextChangeMileage: record?.nextChangeMileage || '',
    filterChangeMileage: record?.filterChangeMileage || '',
    notes: record?.notes || '',
  });
  const [customType, setCustomType] = useState('');

  // Si el registro tiene un tipo que ya no está en la lista, se muestra como "Otro".
  useEffect(() => {
    const allValidTypes = [...DEFAULT_MAINTENANCE_TYPES, ...customTypes];
    if (record && !allValidTypes.includes(record.type)) {
      setFormData(prev => ({ ...prev, type: 'Otro' }));
      setCustomType(record.type);
    }
  }, [record, customTypes]);

  // Cambio de aceite: filtros a +4.000 km y próximo aceite a +8.000 km.
  useEffect(() => {
    if (formData.type === OIL_CHANGE && formData.mileage) {
      const currentMileage = parseInt(parseFormattedNumber(formData.mileage), 10);
      if (!isNaN(currentMileage)) {
        setFormData(prev => ({
          ...prev,
          filterChangeMileage: formatNumberWithDots((currentMileage + 4000).toString()),
          nextChangeMileage: formatNumberWithDots((currentMileage + 8000).toString()),
        }));
      }
    }
  }, [formData.mileage, formData.type]);

  useEffect(() => {
    if (formData.type !== OIL_CHANGE) {
      setFormData(prev => ({ ...prev, mileage: '', filterChangeMileage: '', nextChangeMileage: '' }));
    }
  }, [formData.type]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: KM_FIELDS.includes(name) ? formatNumberWithDots(value) : value });
  };

  const handleAddCustomType = () => {
    const newType = customType.trim();
    if (!newType) return;
    if ([...DEFAULT_MAINTENANCE_TYPES, 'Otro'].includes(newType) || customTypes.includes(newType)) {
      alert('Este tipo de mantenimiento ya existe en la lista.');
      return;
    }
    setCustomTypes(prev => [...prev, newType]);
    setFormData(prev => ({ ...prev, type: newType }));
    setCustomType('');
  };

  const handleRemoveCustomType = (typeName: string) => {
    if (window.confirm(`¿Estás seguro de que quieres quitar "${typeName}" de tu lista de mantenimientos?`)) {
      setCustomTypes(prev => prev.filter(t => t !== typeName));
      if (formData.type === typeName) setFormData(prev => ({ ...prev, type: 'Revisión General' }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalType = formData.type === 'Otro' ? customType : formData.type;

    if (finalType === OIL_CHANGE) {
      if (!formData.mileage || !formData.date) {
        alert('Para cambio de aceite, el tipo, fecha y kilometraje actual son obligatorios.');
        return;
      }
    } else if (!finalType || !formData.date) {
      alert('El tipo y la fecha del mantenimiento son obligatorios.');
      return;
    }

    onSave({ ...formData, type: finalType, id: record?.id || '' });
  };

  const isOil = formData.type === OIL_CHANGE;

  return (
    <ModalShell title={`${record ? 'Editar' : 'Añadir'} mantenimiento`} onClose={onClose} icon={<WrenchIcon className="h-5 w-5" />}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Tipo de mantenimiento</label>
          <select name="type" value={formData.type} onChange={handleChange} className={inputClass}>
            {DEFAULT_MAINTENANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            {customTypes.map(t => <option key={t} value={t}>{t}</option>)}
            <option value="Otro">Otro...</option>
          </select>
        </div>

        {formData.type === 'Otro' && (
          <div className="space-y-3 p-3 bg-field/50 border border-line/50 rounded-xl">
            <div>
              <label className={labelClass}>Nombre del nuevo mantenimiento</label>
              <div className="flex gap-2">
                <input type="text" value={customType} onChange={e => setCustomType(e.target.value)} className={`${inputClass} text-sm`} placeholder="Ej: Sincronización" />
                <Button type="button" variant="primary" small onClick={handleAddCustomType}>Agregar</Button>
              </div>
            </div>
            {customTypes.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-faint mb-1.5 uppercase tracking-wider">Mantenimientos creados</p>
                <ul className="space-y-1 max-h-[120px] overflow-y-auto custom-scrollbar">
                  {customTypes.map(t => (
                    <li key={t} className="flex justify-between items-center bg-card border border-line/50 p-2 rounded-lg text-sm text-main">
                      <span>{t}</span>
                      <button type="button" onClick={() => handleRemoveCustomType(t)} className="text-bad p-1 rounded hover:bg-bad/10 transition-colors" title="Eliminar de la lista">
                        <TrashIcon />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Fecha</label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} className={inputClass} required />
          </div>
          {isOil && (
            <div>
              <label className={labelClass}>Kilometraje</label>
              <input type="text" inputMode="numeric" name="mileage" value={formData.mileage} onChange={handleChange} placeholder="Ej: 123.456" className={inputClass} required />
            </div>
          )}
        </div>

        {isOil && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Cambio de filtros (km)</label>
              <input type="text" value={formData.filterChangeMileage} placeholder="Automático" className={`${inputClass} text-warn font-semibold opacity-80`} disabled />
            </div>
            <div>
              <label className={labelClass}>Próximo aceite (km)</label>
              <input type="text" value={formData.nextChangeMileage} placeholder="Automático" className={`${inputClass} text-brand font-semibold opacity-80`} disabled />
            </div>
          </div>
        )}

        <div>
          <label className={labelClass}>Notas</label>
          <NotesEditor initialHtml={record?.notes || ''} onChange={html => setFormData(prev => ({ ...prev, notes: html }))} />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-line/50">
          <Button type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary">Guardar</Button>
        </div>
      </form>
    </ModalShell>
  );
};
