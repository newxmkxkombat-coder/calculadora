import { useCallback, useState } from 'react';
import { GpsStatus, GpsVehicle } from '../types';
import { fetchGpsVehicles } from '../services/gps';

export const useGpsRobot = () => {
  const [status, setStatus] = useState<GpsStatus>('idle');
  const [vehicles, setVehicles] = useState<GpsVehicle[]>([]);

  const refresh = useCallback(async () => {
    setStatus(prev => (prev === 'success' || prev === 'idle' ? 'loading' : prev));
    try {
      setVehicles(await fetchGpsVehicles());
      setStatus('success');
    } catch (error) {
      console.error('GPS Poll Error:', error);
      setStatus('error');
    }
  }, []);

  return { status, vehicles, refresh };
};
