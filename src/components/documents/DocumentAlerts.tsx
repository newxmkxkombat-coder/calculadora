import React, { useEffect, useMemo, useState } from 'react';
import { ManagedDocument } from '../../types';
import { getDocumentStatus, playNotificationSound } from '../../utils/documents';
import { BellIcon } from '../icons';
import { Button } from '../ui';

const DISMISS_KEY = 'docAlertsDismissed';

/** Ventana de aviso al abrir la app cuando algún documento está vencido o por vencer. */
export const DocumentAlerts: React.FC<{ documents: ManagedDocument[] }> = ({ documents }) => {
  const [isDismissed, setIsDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === 'true');

  const alerts = useMemo(() => documents
    .map(doc => ({ ...doc, statusInfo: getDocumentStatus(doc.expiryDate, doc.alertDateTime) }))
    .filter(doc => doc.statusInfo.status === 'expired' || doc.statusInfo.status === 'expiring'), [documents]);

  useEffect(() => {
    if (alerts.length > 0 && !isDismissed) {
      try {
        playNotificationSound();
      } catch (e) {
        console.warn('Could not play notification sound due to browser policy:', e);
      }
    }
  }, [alerts, isDismissed]);

  if (isDismissed || alerts.length === 0) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, 'true');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-backdrop" aria-modal="true" role="dialog">
      <div className="bg-card border border-warn/40 rounded-3xl w-full max-w-md p-6 shadow-2xl text-center animate-fade-in-scale">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-warn/15 mb-4 border border-warn/40 text-warn animate-pulse-bell">
          <BellIcon className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-extrabold text-main mb-1">Documentos que requieren atención</h3>
        <p className="text-sm text-muted mb-5">Revisa estos vencimientos cuanto antes.</p>

        <ul className="space-y-2 text-left">
          {alerts.map(doc => {
            const expired = doc.statusInfo.status === 'expired';
            return (
              <li key={doc.id} className={`p-3 rounded-xl border ${expired ? 'border-bad/30 bg-bad/10' : 'border-warn/30 bg-warn/10'}`}>
                <p className="font-bold text-main">{doc.name}</p>
                <p className={`text-sm font-semibold ${expired ? 'text-bad' : 'text-warn'}`}>
                  {expired ? `Venció hace ${Math.abs(doc.statusInfo.daysRemaining)} días` : `Vence en ${doc.statusInfo.daysRemaining} días`}
                </p>
              </li>
            );
          })}
        </ul>

        <Button variant="primary" className="mt-6 w-full" onClick={handleDismiss}>Entendido, revisar más tarde</Button>
      </div>
    </div>
  );
};
