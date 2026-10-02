import { API_URL, GPS_TIMEOUT_MS } from '../constants';
import { GpsVehicle } from '../types';

// TODO (pendiente, junto con el cambio de robot): mover estas credenciales al servidor.
const GPS_CREDENTIALS = { username: 'luniosilva', password: '12256643' };

/** Pide al robot los pasajeros de cada vehículo. Lanza un error si falla o tarda demasiado. */
export const fetchGpsVehicles = async (): Promise<GpsVehicle[]> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GPS_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_URL}/api/scrape-passengers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(GPS_CREDENTIALS),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data?.message || 'Respuesta inválida del robot');
    return data.vehicles as GpsVehicle[];
  } finally {
    clearTimeout(timeoutId);
  }
};
