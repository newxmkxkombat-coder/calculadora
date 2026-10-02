import { MaintenanceRecord } from '../types';
import { formatDateOnly } from './format';

export const OIL_CHANGE_TYPE = 'Cambio de Aceite';

/** Días sin cambiar el aceite a partir de los cuales se muestra una advertencia. */
export const OIL_CHANGE_WARNING_DAYS = 90;

export const longDate = (dateString: string) =>
  formatDateOnly(dateString, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

/** Convierte las notas (HTML del editor) a texto plano con saltos de línea. */
const notesToPlainText = (html: string): string => {
  let temp = html;
  temp = temp.replace(/<br\s*\/?>/gi, '\n');
  temp = temp.replace(/<\/div>/gi, '\n');
  temp = temp.replace(/<div[^>]*>/gi, '');
  temp = temp.replace(/<\/p>/gi, '\n\n');
  temp = temp.replace(/<p[^>]*>/gi, '');
  temp = temp.replace(/<li[^>]*>/gi, '• ');
  temp = temp.replace(/<\/li>/gi, '\n');
  temp = temp.replace(/<[^>]*>/g, '');
  const doc = new DOMParser().parseFromString(temp, 'text/html');
  return doc.documentElement.textContent || temp;
};

/** Texto del mantenimiento listo para pegar en WhatsApp. */
export const maintenanceToWhatsappText = (record: MaintenanceRecord): string => {
  let details = '';
  if (record.mileage) details += `\n*Kilometraje:* ${record.mileage} km`;
  if (record.type === OIL_CHANGE_TYPE) {
    if (record.filterChangeMileage) details += `\n*Cambio Filtros:* ${record.filterChangeMileage} km`;
    if (record.nextChangeMileage) details += `\n*Próximo Cambio:* ${record.nextChangeMileage} km`;
  }

  const notesText = record.notes ? notesToPlainText(record.notes).trim() : '';
  return `${longDate(record.date)}\n*Mantenimiento:* ${record.type}${details}${notesText ? `\n\n*Nota:*\n${notesText}` : ''}`;
};

export interface OilChangeStatus {
  record: MaintenanceRecord;
  daysSince: number;
  overdue: boolean;
}

/** Último cambio de aceite registrado y cuánto tiempo lleva. */
export const getOilChangeStatus = (records: MaintenanceRecord[], now = new Date()): OilChangeStatus | null => {
  const oilChanges = records.filter(r => r.type === OIL_CHANGE_TYPE && r.date);
  if (oilChanges.length === 0) return null;

  const latest = oilChanges.reduce((a, b) => (new Date(b.date).getTime() > new Date(a.date).getTime() ? b : a));
  // La fecha viene como YYYY-MM-DD: se compara contra la medianoche local para no perder un día por la zona horaria.
  const latestDay = new Date(`${latest.date}T00:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const daysSince = Math.max(0, Math.round((today.getTime() - latestDay.getTime()) / (1000 * 60 * 60 * 24)));
  return { record: latest, daysSince, overdue: daysSince >= OIL_CHANGE_WARNING_DAYS };
};
