import { API_URL, GPS_TIMEOUT_MS } from '../constants';
import { GpsVehicle } from '../types';

// TODO (pendiente, junto con el cambio de robot): mover estas credenciales al servidor.
const GPS_CREDENTIALS = { username: 'luniosilva', password: '12256643' };

/** Pide al robot los pasajeros de cada vehículo. Lanza un error con un mensaje claro si falla o tarda demasiado. */
export const fetchGpsVehicles = async (): Promise<GpsVehicle[]> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GPS_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/scrape-passengers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(GPS_CREDENTIALS),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (controller.signal.aborted) {
      throw new Error(`El servidor del robot no respondió en ${Math.round(GPS_TIMEOUT_MS / 1000)} s. Si estaba dormido, ya debería estar despertando: intenta de nuevo en un minuto.`);
    }
    throw new Error('No se pudo llegar al servidor del robot. Revisa tu internet, o el servidor está apagado o reiniciándose.');
  }

  try {
    let data: any = null;
    try {
      data = await response.json();
    } catch {
      throw new Error(`El servidor del robot respondió con un error (código ${response.status}). Puede estar caído o reiniciándose.`);
    }
    if (!response.ok || !data?.success) {
      const detail = typeof data?.message === 'string' ? data.message.slice(0, 160) : `código ${response.status}`;
      throw new Error(`El robot no pudo leer la página del GPS: ${detail}`);
    }
    return data.vehicles as GpsVehicle[];
  } finally {
    clearTimeout(timeoutId);
  }
};
