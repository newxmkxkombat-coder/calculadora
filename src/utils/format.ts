export const stripHtml = (htmlString: string): string => {
  if (!htmlString) return '';
  return htmlString.replace(/<[^>]*>/g, '');
};

export const getLocalDateString = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatTimestamp = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleString('es-CO', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return isoString;
  }
};

export const formatNumberWithDots = (value: string): string => {
  if (!value) return '';
  const cleanValue = value.replace(/[^\d]/g, '');
  if (cleanValue === '') return '';
  return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const parseFormattedNumber = (value: string): string => value.replace(/[^\d]/g, '');

/** Fecha guardada como YYYY-MM-DD, mostrada en la zona horaria local. */
export const formatDateOnly = (dateString: string, options: Intl.DateTimeFormatOptions): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const localDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
  return localDate.toLocaleDateString('es-CO', options);
};
