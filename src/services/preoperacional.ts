import { API_URL, GPS_TIMEOUT_MS } from '../constants';

/**
 * Link del formulario Preoperacional ya rellenado con las respuestas de siempre.
 * Si la empresa cambia el formulario, basta con pegar aquí el nuevo link rellenado.
 */
const PREFILLED_LINK =
  'https://docs.google.com/forms/d/e/1FAIpQLScOLIelV9FBvOWZL8aseQWFYxc1dL7fYNfnpRbRK3N3hSBKQA/viewform?usp=pp_url&entry.74085162=Si+Cumple&entry.159675045=Si+Cumple&entry.220097002=Si+Cumple&entry.272472659=Si+Cumple&entry.329913345=Si+Cumple&entry.467793536=Si+Cumple&entry.505663884=Si+Cumple&entry.602204696=Si+Cumple&entry.715794137=Si+Cumple&entry.771272373=Si+Cumple&entry.837176613=Si+Cumple&entry.862707359=Si+Cumple&entry.998217467=JORDY+ALEXANDER+RENGIFO+Q.&entry.1004432695=Si+Cumple&entry.1039803474=Si+Cumple&entry.1201363317=Si+Cumple&entry.1217477198=C2-+Vehiculo+pesado+no+articulado+Servicio+Publico&entry.1274679485=Sin+novedades&entry.1461129920=S%C3%AD&entry.1653454195=THQ009+-+15&entry.1667517091=S%C3%AD&entry.1731295706=Si+Cumple&entry.1860277907=Si+Cumple&entry.1890342019=Si+Cumple&entry.2060316116=Si+Cumple';

/** Correo que se registra con cada respuesta (el mismo del cuadrito "Registrar ... como el correo"). */
const PREOP_EMAIL = 'newxmkxkombat@gmail.com';

const getEntries = (): Record<string, string> => {
  const entries: Record<string, string> = {};
  new URL(PREFILLED_LINK).searchParams.forEach((value, key) => {
    if (key.startsWith('entry.')) entries[key] = value;
  });
  return entries;
};

/** Envía el formulario Preoperacional a través del robot (Google no deja enviarlo directo desde la app). */
export const sendPreoperacional = async (): Promise<void> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GPS_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/preoperacional`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: PREOP_EMAIL, entries: getEntries() }),
      signal: controller.signal,
    });
  } catch {
    throw new Error(controller.signal.aborted
      ? 'El servidor no respondió a tiempo. Si estaba dormido, ya debería estar despertando: intenta de nuevo en un minuto.'
      : 'No se pudo llegar al servidor. Revisa tu internet e intenta de nuevo.');
  } finally {
    clearTimeout(timeoutId);
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    throw new Error(`El servidor respondió con un error (código ${response.status}).`);
  }
  if (!response.ok || !data?.success) {
    throw new Error(typeof data?.message === 'string' ? data.message : `Error (código ${response.status}).`);
  }
};
