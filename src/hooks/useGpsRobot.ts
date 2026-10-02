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
      setVehicles(await fetchGpsVehicles());
      setStatus('success');
      setErrorMessage('');
    } catch (error) {
      console.error('GPS Poll Error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Error desconocido');
      setStatus('error');
    }
  }, []);

  return { status, vehicles, errorMessage, refresh };
};
