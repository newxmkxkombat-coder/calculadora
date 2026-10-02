export const PASSENGER_GOAL_DEFAULT = 5500;

// Claves de localStorage (no cambiar: ahí viven los datos ya guardados en el teléfono)
export const STORAGE_KEYS = {
  history: 'earningsCalculatorHistory',
  config: 'driverAppConfig',
  documents: 'driverAppDocuments',
  maintenance: 'driverAppMaintenance',
  customTypes: 'driverAppCustomMaintenanceTypes',
  passengerDeduction: 'passengerDeduction',
  draft: 'driverAppDraft',
  theme: 'driverAppTheme',
  lastBackup: 'driverAppLastBackup',
  preopLastSent: 'driverAppPreopLastSent',
} as const;

export const MOTIVATIONAL_PHRASES = [
  "¡Excelente! Cada registro te acerca más a tu meta.",
  "¡Sigue así! La constancia es la clave del éxito.",
  "¡Un día más, un paso más cerca de tu objetivo!",
  "¡Buen trabajo! Tu esfuerzo de hoy es la ganancia de mañana.",
  "¡Imparable! Estás construyendo un gran resultado.",
  "La disciplina te está llevando al lugar que quieres. ¡Adelante!",
  "¡Lo estás haciendo genial! No te detengas.",
  "Cada pasajero cuenta, y tú estás contando cada uno de ellos. ¡Perfecto!",
  "¡Tu dedicación es admirable! Sigue sumando.",
  "¡Registro guardado! La meta está cada vez más cerca.",
];

// Punto de anclaje: domingo 18 de mayo de 2025 = Ruta 60
export const ANCHOR_DATE = new Date('2025-05-18');
export const ROUTE_SEQUENCE = ['60', '29'];

export const DEFAULT_MAINTENANCE_TYPES = ["Cambio de Aceite", "Frenos", "Llantas", "Revisión General", "Rodamiento"];

export const DOCUMENT_COMMON_NAMES = ["Licencia de Conducir", "SOAT", "Revisión Técnico-Mecánica"];

// Robot GPS desplegado en Render
export const API_URL = 'https://calculadora-y7oh.onrender.com';
export const GPS_TIMEOUT_MS = 90000;

// Muestra u oculta el selector "Ruta actual" en el formulario. La ruta se sigue calculando sola por fecha.
export const SHOW_ROUTE_SELECTOR = false;
