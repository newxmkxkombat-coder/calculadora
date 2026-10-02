export interface FormData {
  numPassengers: string;
  fareValue: string;
  fixedCommission: string;
  commissionPerPassenger: string;
  route: string;
  fuelExpenses: string;
  variableExpenses: string;
  administrativeExpenses: string;
}

export interface CalculationResults {
  totalRevenue: number;
  myEarnings: number;
  totalExpenses: number;
  amountToSettle: number;
  totalDeliveredAmount?: number;
  fixedCommissionValue: number;
  perPassengerCommissionValue: number;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  formData: FormData;
  results: CalculationResults;
}

export interface ManagedDocument {
  id: string;
  name: string;
  expiryDate: string;
  alertDateTime?: string;
  imageSrc?: string;
}

export interface MaintenanceRecord {
  id: string;
  type: string;
  date: string;
  mileage?: string;
  nextChangeMileage?: string;
  filterChangeMileage?: string;
  notes?: string;
}

export interface AppConfig {
  fareValue: string;
  commissionPerPassenger: string;
  variableExpenses: string;
  administrativeExpenses: string;
  passengerGoal: number;
}

export type GpsStatus = 'idle' | 'loading' | 'success' | 'error';

export interface GpsVehicle {
  identifier: string;
  pasajeros: string;
  /** Dirección donde el GPS ubicó el vehículo por última vez. */
  localizacion?: string;
  /** Fecha y hora del último reporte GPS del vehículo. */
  fechaGps?: string;
  /** Enlace al mapa de esa ubicación, si la página del GPS lo trae. */
  mapaUrl?: string;
  /** Coordenadas del último reporte, si la página del GPS las trae. */
  lat?: number | null;
  lng?: number | null;
  /** true si las coordenadas se calcularon a partir de la dirección (no vienen del GPS). */
  aproximada?: boolean;
}
