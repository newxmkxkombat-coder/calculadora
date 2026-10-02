import React, { useState } from 'react';
import { ManagedDocument } from '../../types';
import { getDocumentStatus } from '../../utils/documents';
import { formatDateOnly } from '../../utils/format';
import { EditIcon, IdCardIcon, PlusCircleIcon, TrashIcon } from '../icons';
import { Button, EmptyState, IconButton, SectionCard } from '../ui';
import { DocumentModal } from './DocumentModal';

interface DocumentManagerProps {
  documents: ManagedDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<ManagedDocument[]>>;
}

const STATUS_STYLES = {
  valid: { box: 'border-line/50 bg-field/50', text: 'text-good', dot: 'bg-good' },
  expiring: { box: 'border-warn/30 bg-warn/10', text: 'text-warn', dot: 'bg-warn' },
  expired: { box: 'border-bad/30 bg-bad/10', text: 'text-bad', dot: 'bg-bad' },
};

export const DocumentManager: React.FC<DocumentManagerProps> = ({ documents, setDocuments }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<ManagedDocument | null>(null);

  const openModal = (doc: ManagedDocument | null) => {
    setEditingDoc(doc);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este documento?')) {
      setDocuments(docs => docs.filter(d => d.id !== id));
    }
  };

  const handleSave = (doc: ManagedDocument) => {
    if (editingDoc) {
      setDocuments(docs => docs.map(d => (d.id === doc.id ? doc : d)));
    } else {
      setDocuments(docs => [...docs, { ...doc, id: Date.now().toString() }]);
    }
    setIsModalOpen(false);
  };

  const attention = documents.filter(d => getDocumentStatus(d.expiryDate, d.alertDateTime).status !== 'valid').length;

  return (
    <>
      <SectionCard
        title="Documentos"
        icon={<IdCardIcon className="h-5 w-5" />}
        tone="warn"
        badge={attention > 0 ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-warn/15 text-warn">{attention} por revisar</span> : undefined}
      >
        <div className="flex justify-end mb-4">
          <Button variant="primary" small onClick={() => openModal(null)}><PlusCircleIcon /> Añadir documento</Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
          {documents.length === 0 ? (
            <EmptyState icon={<IdCardIcon className="h-8 w-8" />}>Añade tu licencia, SOAT y revisión técnico-mecánica para recibir avisos de vencimiento.</EmptyState>
          ) : documents.map(doc => {
            const { status, daysRemaining } = getDocumentStatus(doc.expiryDate, doc.alertDateTime);
            const style = STATUS_STYLES[status];
            const label = status === 'valid' ? 'Vigente' : status === 'expired' ? 'Vencido' : `Vence en ${daysRemaining} días`;
            return (
              <div key={doc.id} className={`p-3 rounded-xl flex items-center justify-between gap-3 border ${style.box}`}>
                <div className="flex-grow min-w-0">
                  <p className="font-bold text-main truncate">{doc.name}</p>
                  <p className="text-sm text-muted">Vence: {formatDateOnly(doc.expiryDate, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  <p className={`text-xs font-semibold flex items-center gap-1.5 mt-0.5 ${style.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />{label}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <IconButton title="Editar" tone="brand" onClick={() => openModal(doc)}><EditIcon /></IconButton>
                  <IconButton title="Eliminar" tone="bad" onClick={() => handleDelete(doc.id)}><TrashIcon /></IconButton>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
      {isModalOpen && <DocumentModal doc={editingDoc} onSave={handleSave} onClose={() => setIsModalOpen(false)} />}
    </>
  );
};
