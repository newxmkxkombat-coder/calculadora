import React, { useEffect, useState } from 'react';
import { ManagedDocument } from '../../types';
import { DOCUMENT_COMMON_NAMES } from '../../constants';
import { CameraIcon, IdCardIcon } from '../icons';
import { Button, ModalShell, inputClass, labelClass } from '../ui';

interface DocumentModalProps {
  doc: ManagedDocument | null;
  onSave: (doc: ManagedDocument) => void;
  onClose: () => void;
}

export const DocumentModal: React.FC<DocumentModalProps> = ({ doc, onSave, onClose }) => {
  const [formData, setFormData] = useState<Omit<ManagedDocument, 'id'>>({
    name: doc?.name || '',
    expiryDate: doc?.expiryDate || '',
    alertDateTime: doc?.alertDateTime || '',
    imageSrc: doc?.imageSrc || '',
  });
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    if (doc && !DOCUMENT_COMMON_NAMES.includes(doc.name)) {
      setFormData(prev => ({ ...prev, name: 'Otro' }));
      setCustomName(doc.name);
    }
  }, [doc]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setFormData(prev => ({ ...prev, imageSrc: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = formData.name === 'Otro' ? customName : formData.name;
    if (!finalName || !formData.expiryDate) {
      alert('El nombre y la fecha de vencimiento son obligatorios.');
      return;
    }
    onSave({ ...formData, name: finalName, id: doc?.id || '' });
  };

  return (
    <ModalShell title={`${doc ? 'Editar' : 'Añadir'} documento`} onClose={onClose} icon={<IdCardIcon className="h-5 w-5" />}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Nombre del documento</label>
          <select name="name" value={formData.name} onChange={handleChange} className={inputClass}>
            <option value="" disabled>Selecciona uno...</option>
            {DOCUMENT_COMMON_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
            <option value="Otro">Otro</option>
          </select>
        </div>
        {formData.name === 'Otro' && (
          <div>
            <label className={labelClass}>Especifica el nombre</label>
            <input type="text" value={customName} onChange={e => setCustomName(e.target.value)} className={inputClass} required />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Fecha de vencimiento</label>
            <input type="date" name="expiryDate" value={formData.expiryDate} onChange={handleChange} className={inputClass} required />
          </div>
          <div>
            <label className={labelClass}>Fecha y hora de alerta</label>
            <input type="datetime-local" name="alertDateTime" value={formData.alertDateTime} onChange={handleChange} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Foto del documento (opcional)</label>
          <div className="flex items-center gap-4">
            <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-raised/60 border border-line/60 hover:bg-raised transition-colors">
              <CameraIcon /> Subir foto
            </label>
            <input id="file-upload" name="file-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            {formData.imageSrc && <img src={formData.imageSrc} alt="Vista previa" className="h-11 w-11 object-cover rounded-lg border border-line/60" />}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-line/50">
          <Button type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary">Guardar</Button>
        </div>
      </form>
    </ModalShell>
  );
};
