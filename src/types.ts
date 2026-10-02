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
}
