/**
 * Link del formulario Preoperacional ya rellenado con las respuestas de siempre.
 * Si la empresa cambia el formulario, basta con pegar aquí el nuevo link rellenado.
 */
const PREFILLED_LINK =
  'https://docs.google.com/forms/d/e/1FAIpQLScOLIelV9FBvOWZL8aseQWFYxc1dL7fYNfnpRbRK3N3hSBKQA/viewform?usp=pp_url&entry.74085162=Si+Cumple&entry.159675045=Si+Cumple&entry.220097002=Si+Cumple&entry.272472659=Si+Cumple&entry.329913345=Si+Cumple&entry.467793536=Si+Cumple&entry.505663884=Si+Cumple&entry.602204696=Si+Cumple&entry.715794137=Si+Cumple&entry.771272373=Si+Cumple&entry.837176613=Si+Cumple&entry.862707359=Si+Cumple&entry.998217467=JORDY+ALEXANDER+RENGIFO+Q.&entry.1004432695=Si+Cumple&entry.1039803474=Si+Cumple&entry.1201363317=Si+Cumple&entry.1217477198=C2-+Vehiculo+pesado+no+articulado+Servicio+Publico&entry.1274679485=Sin+novedades&entry.1461129920=S%C3%AD&entry.1653454195=THQ009+-+15&entry.1667517091=S%C3%AD&entry.1731295706=Si+Cumple&entry.1860277907=Si+Cumple&entry.1890342019=Si+Cumple&entry.2060316116=Si+Cumple';

/** Correo que se registra con cada respuesta (el mismo del cuadrito "Registrar ... como el correo"). */
const PREOP_EMAIL = 'newxmkxkombat@gmail.com';

const PREOP_SUBMIT_URL = PREFILLED_LINK.split('/viewform')[0] + '/formResponse';

const getEntries = (): Record<string, string> => {
  const entries: Record<string, string> = {};
  new URL(PREFILLED_LINK).searchParams.forEach((value, key) => {
    if (key.startsWith('entry.')) entries[key] = value;
  });
  return entries;
};

/**
 * Envía el formulario Preoperacional desde el celular. Google exige la cuenta del conductor (por eso el robot
 * no puede enviarlo), así que se abre directo en Google en una pestaña nueva, con la sesión de Google del celular.
 * Se abre como enlace normal (no como envío de formulario) para que el "#:~:text=Enviar" haga que Chrome abra la
 * página ya bajada hasta ese botón. Si Google acepta el envío directo, muestra "Se registró tu respuesta".
 * Debe llamarse directo desde el toque del botón para que el navegador no bloquee la pestaña.
 */
export const sendPreoperacional = () => {
  const params = new URLSearchParams({
    ...getEntries(),
    emailAddress: PREOP_EMAIL,
    fvv: '1',
    pageHistory: '0,1',
    submit: 'Submit',
  });
  window.open(`${PREOP_SUBMIT_URL}?${params.toString()}#:~:text=Enviar`, '_blank', 'noopener');
};
