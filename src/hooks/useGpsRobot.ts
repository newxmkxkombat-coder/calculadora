import { useCallback, useState } from 'react';
import { GpsStatus, GpsVehicle } from '../types';
import { fetchGpsVehicles } from '../services/gps';

export const useGpsRobot = () => {
  const [status, setStatus] = useState<GpsStatus>('idle');
  const [vehicles, setVehicles] = useState<GpsVehicle[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

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
