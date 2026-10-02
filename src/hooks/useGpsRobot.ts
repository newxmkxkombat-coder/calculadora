import { useCallback, useEffect, useState } from 'react';
import { GpsStatus, GpsVehicle } from '../types';
import { fetchGpsVehicles, wakeGpsServer } from '../services/gps';

export const useGpsRobot = () => {
  const [status, setStatus] = useState<GpsStatus>('idle');
  const [vehicles, setVehicles] = useState<GpsVehicle[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  // Despertar el servidor apenas se abre la app (o vuelve a primer plano), antes de tocar el botón.
  useEffect(() => {
    wakeGpsServer();
    const onVisible = () => { if (document.visibilityState === 'visible') wakeGpsServer(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const refresh = useCallback(async () => {
    setStatus(prev => (prev === 'success' || prev === 'idle' ? 'loading' : prev));
    try {
      // 1) Lo que el robot tenga guardado, al instante.
      const quick = await fetchGpsVehicles();
      setVehicles(quick.vehicles);
      setErrorMessage('');
      if (!quick.refreshing) {
        setStatus('success');
        return;
      }
      // 2) Si ese dato tenía unos minutos, se muestra igual y se espera el nuevo sin bloquear la ventana.
      setStatus('loading');
      const latest = await fetchGpsVehicles(true);
      setVehicles(latest.vehicles);
      setStatus('success');
    } catch (error) {
      console.error('GPS Poll Error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Error desconocido');
      setStatus('error');
    }
  }, []);

  return { status, vehicles, errorMessage, refresh };
};
