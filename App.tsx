
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// --- TYPE DEFINITIONS ---
interface FormData {
  numPassengers: string;
  fareValue: string;
  fixedCommission: string;
  commissionPerPassenger: string;
  route: string;
  fuelExpenses: string;
  variableExpenses: string;
  administrativeExpenses: string;
}

interface CalculationResults {
  totalRevenue: number;
  myEarnings: number;
  totalExpenses: number;
  amountToSettle: number;
  totalDeliveredAmount?: number;
  fixedCommissionValue: number;
  perPassengerCommissionValue: number;
}

interface HistoryEntry {
  id: string;
  timestamp: string;
  formData: FormData;
  results: CalculationResults;
}

interface ManagedDocument {
  id: string;
  name: string;
  expiryDate: string;
  alertDateTime?: string;
  imageSrc?: string;
}

interface MaintenanceRecord {
  id: string;
  type: string;
  date: string;
  mileage?: string;
  nextChangeMileage?: string;
  filterChangeMileage?: string;
  notes?: string;
}

interface AppConfig {
  fareValue: string;
  commissionPerPassenger: string;
  variableExpenses: string;
  administrativeExpenses: string;
  passengerGoal: number;
}


const PASSENGER_GOAL_DEFAULT = 5500;


const MOTIVATIONAL_PHRASES = [
  "¡Excelente! Cada registro te acerca más a tu meta.",
  "¡Sigue así! La constancia es la clave del éxito.",
  "¡Un día más, un paso más cerca de tu objetivo!",
  "¡Buen trabajo! Tu esfuerzo de hoy es la ganancia de mañana.",
  "¡Imparable! Estás construyendo un gran resultado.",
  "La disciplina te está llevando al lugar que quieres. ¡Adelante!",
  "¡Lo estás haciendo genial! No te detengas.",
  "Cada pasajero cuenta, y tú estás contando cada uno de ellos. ¡Perfecto!",
  "¡Tu dedicación es admirable! Sigue sumando.",
  "¡Registro guardado! La meta está cada vez más cerca."
];

// --- HELPER FUNCTIONS ---
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatTimestamp = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return isoString;
    }
    return date.toLocaleString('es-CO', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return isoString;
  }
};

const formatNumberWithDots = (value: string): string => {
  if (!value) return '';
  const cleanValue = value.replace(/[^\d]/g, '');
  if (cleanValue === '') return '';
  return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const parseFormattedNumber = (value: string): string => {
  return value.replace(/[^\d]/g, '');
};

const saveHistoryToLocalStorage = (history: HistoryEntry[]) => {
  try {
    localStorage.setItem('earningsCalculatorHistory', JSON.stringify(history));
  } catch (error) {
    console.error("Error saving history to localStorage:", error);
  }
};

// Anchor Point: Sunday, May 18, 2025 = Route 60
const ANCHOR_DATE = new Date('2025-05-18');
const ROUTE_SEQUENCE = ['60', '29'];

const calculateRouteForDate = (dateString: string): string => {
  const date = new Date(dateString);
  // Normalize dates to midnight
  const anchor = new Date(ANCHOR_DATE);
  anchor.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const timeDiff = target.getTime() - anchor.getTime();
  const dayDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

  const index = (dayDiff % ROUTE_SEQUENCE.length + ROUTE_SEQUENCE.length) % ROUTE_SEQUENCE.length;
  return ROUTE_SEQUENCE[index];
};

const loadHistoryFromLocalStorage = (): HistoryEntry[] => {
  try {
    const savedHistory = localStorage.getItem('earningsCalculatorHistory');
    if (!savedHistory) return [];

    const history: HistoryEntry[] = JSON.parse(savedHistory);

    // Auto-Repair/Sync: Ensure all records follow the 60/29 pattern based on their date
    return history.map(entry => ({
      ...entry,
      formData: {
        ...entry.formData,
        route: calculateRouteForDate(entry.timestamp)
      }
    }));
  } catch (error) {
    console.error("Error loading history from localStorage:", error);
    return [];
  }
};

const CONFIG_STORAGE_KEY = 'driverAppConfig';

const saveConfigToLocalStorage = (config: AppConfig) => {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("Error saving config to localStorage:", error);
  }
};

const loadConfigFromLocalStorage = (): AppConfig => {
  const defaultConfig: AppConfig = {
    fareValue: '3.000',
    commissionPerPassenger: '100',
    variableExpenses: '20.000',
    administrativeExpenses: '109.165',
    passengerGoal: PASSENGER_GOAL_DEFAULT,
  };
  try {
    const savedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
    return savedConfig ? { ...defaultConfig, ...JSON.parse(savedConfig) } : defaultConfig;
  } catch (error) {
    console.error("Error loading config from localStorage:", error);
    return defaultConfig;
  }
};


const DOCUMENT_STORAGE_KEY = 'driverAppDocuments';

const saveDocumentsToLocalStorage = (documents: ManagedDocument[]) => {
  try {
    localStorage.setItem(DOCUMENT_STORAGE_KEY, JSON.stringify(documents));
  } catch (error) {
    console.error("Error saving documents to localStorage:", error);
  }
};

const loadDocumentsFromLocalStorage = (): ManagedDocument[] => {
  try {
    const savedDocuments = localStorage.getItem(DOCUMENT_STORAGE_KEY);
    return savedDocuments ? JSON.parse(savedDocuments) : [];
  } catch (error) {
    console.error("Error loading documents from localStorage:", error);
    return [];
  }
};

const MAINTENANCE_STORAGE_KEY = 'driverAppMaintenance';

const saveMaintenanceToLocalStorage = (records: MaintenanceRecord[]) => {
  try {
    localStorage.setItem(MAINTENANCE_STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.error("Error saving maintenance records to localStorage:", error);
  }
};

const loadMaintenanceFromLocalStorage = (): MaintenanceRecord[] => {
  try {
    const savedRecords = localStorage.getItem(MAINTENANCE_STORAGE_KEY);
    return savedRecords ? JSON.parse(savedRecords) : [];
  } catch (error) {
    console.error("Error loading maintenance records from localStorage:", error);
    return [];
  }
};


// --- SVG ICONS ---
const UsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const MoneyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 6v-1h4v1m-4 0H8m11 10h-3.857A4.002 4.002 0 0012 18c-2.209 0-4-1.791-4-4s1.791-4 4-4 4 1.791 4 4v1" />
  </svg>
);

const PercentageIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
  </svg>
);

const RouteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13v-6m0-6V4m6 16l5.447-2.724A1 1 0 0021 16.382V5.618a1 1 0 00-1.447-.894L15 7m0 13v-6m0-6V4" />
  </svg>
);

const FuelIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
  </svg>
);

const WrenchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const BriefcaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const LoadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const EditIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-4 w-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ArrowUpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
  </svg>
);

const ArrowDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className || ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const WalletIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const TrendingDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
  </svg>
);

const CashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const ClipboardCheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const IdCardIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-6 w-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 012-2h2a2 2 0 012 2v1m-4 0h4m-9 4h1.01M15 11h.01M10 15h.01M15 15h.01" />
  </svg>
);

const BellIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-6 w-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const CameraIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const PlusCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const SearchIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const RobotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2v-5a2 2 0 00-2-2H5a2 2 0 00-2 2v5a2 2 0 002 2zM10 5a2 2 0 012-2h0a2 2 0 012 2v2h-4V5z" />
  </svg>
);

// --- REUSABLE UI COMPONENTS ---
interface InputControlProps {
  label: string;
  name: keyof FormData;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  icon: React.ReactNode;
  unit?: string;
  disabled?: boolean;
}

const InputControl = React.forwardRef<HTMLInputElement, InputControlProps>(
  ({ label, name, value, onChange, onFocus, placeholder = '0', icon, unit, disabled = false }, ref) => (
    <div className={`bg-slate-800/70 p-3 rounded-xl flex items-center gap-4 border border-slate-700 transition-all duration-300 ${!disabled && 'focus-within:border-teal-400 focus-within:shadow-[0_0_20px_rgba(20,184,166,0.4)]'}`}>
      <div className="text-teal-400">{icon}</div>
      <div className="flex-grow">
        <label htmlFor={name} className="block text-xs font-medium text-slate-400 mb-1">
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            type="text"
            inputMode="numeric"
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full bg-transparent text-white placeholder-slate-500 focus:outline-none text-lg font-semibold disabled:text-slate-400"
            onFocus={(e) => {
              e.target.select();
              if (onFocus) onFocus(e);
            }}
            aria-label={label}
            disabled={disabled}
          />
          {unit && (
            <span className="absolute inset-y-0 right-0 flex items-center text-slate-400 pointer-events-none text-base">
              {unit}
            </span>
          )}
        </div>
      </div>
    </div>
  )
);

interface CheckboxControlGroupProps {
  label: string;
  name: keyof FormData;
  value: string;
  onChange: (e: { target: { name: keyof FormData; value: string } }) => void;
  icon: React.ReactNode;
  options: string[];
  disabled?: boolean;
}

const CheckboxControlGroup: React.FC<CheckboxControlGroupProps> = ({ label, name, value, onChange, icon, options, disabled = false }) => {
  const handleCheckboxChange = (optionValue: string) => {
    onChange({ target: { name, value: optionValue } });
  };

  return (
    <div className={`p-3 rounded-xl border border-slate-700 bg-slate-800/70 ${disabled ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="text-teal-400">{icon}</div>
        <label className="block text-xs font-medium text-slate-400">{label}</label>
      </div>
      <fieldset disabled={disabled} className={`grid ${options.length <= 2 ? 'grid-cols-2' : 'grid-cols-4'} gap-2`}>
        {options.map(option => (
          <div key={option}>
            <input
              type="checkbox"
              id={`${name}-${option}`}
              name={name}
              value={option}
              checked={value === option}
              onChange={() => handleCheckboxChange(option)}
              className="hidden peer route-checkbox"
              aria-labelledby={`label-${name}-${option}`}
            />
            <label
              id={`label-${name}-${option}`}
              htmlFor={`${name}-${option}`}
              className={`w-full block text-center py-2 px-2 border-2 border-slate-700 rounded-lg transition-all duration-300 font-semibold bg-slate-800 text-slate-300 ${!disabled ? 'cursor-pointer peer-checked:bg-gradient-to-br peer-checked:from-cyan-500 peer-checked:to-teal-600 peer-checked:text-white peer-checked:border-teal-400 hover:border-slate-500 peer-checked:hover:from-cyan-600 peer-checked:hover:to-teal-700' : 'cursor-not-allowed'} text-sm`}
            >
              Ruta {option}
            </label>
          </div>
        ))}
      </fieldset>
    </div>
  );
};

interface PassengerGoalProgressProps {
  totalPassengers: number;
  goal: number;
  onGoalChange: (newGoal: number) => void;
}

const PassengerGoalProgress: React.FC<PassengerGoalProgressProps> = ({ totalPassengers, goal, onGoalChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempGoal, setTempGoal] = useState(goal.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const newGoal = parseInt(parseFormattedNumber(tempGoal), 10);
    if (!isNaN(newGoal) && newGoal > 0) {
      onGoalChange(newGoal);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempGoal(goal.toString());
    setIsEditing(false);
  };

  const remaining = Math.max(0, goal - totalPassengers);
  const percentage = goal > 0 ? Math.min(100, (totalPassengers / goal) * 100) : 0;

  const { dailyGoal, daysRemaining } = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDayOfMonth = now.getDate();
    const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    let daysLeft = totalDaysInMonth - currentDayOfMonth + 1;
    const WORKDAY_START_HOUR = 4;
    const WORKDAY_END_HOUR = 20;

    const isBeforeWorkday = currentHour < WORKDAY_START_HOUR;
    const isAfterWorkday = currentHour >= WORKDAY_END_HOUR;

    if (isAfterWorkday || isBeforeWorkday) {
      daysLeft -= 1;
    }

    const passengersNeeded = Math.max(0, goal - totalPassengers);
    const dailyTarget = daysLeft > 0 ? Math.ceil(passengersNeeded / daysLeft) : 0;

    return { dailyGoal: dailyTarget, daysRemaining: daysLeft };
  }, [totalPassengers, goal]);

  const getMotivationalMessage = () => {
    if (percentage >= 100) return "¡Meta cumplida y superada! ¡Excelente trabajo!";
    if (percentage >= 80) return "¡Ya casi lo logras, sigue así!";
    if (percentage >= 50) return "¡Vas por la mitad del camino! ¡Buen ritmo!";
    return "¡Un gran viaje comienza con un solo paso!";
  };

  return (
    <div className="mb-6 p-5 bg-slate-900/50 rounded-lg border border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-slate-300 flex items-center">
          <UsersIcon />
          <span className="ml-2">Meta Mensual de Pasajeros</span>
        </h3>
        <span className="font-bold text-lg text-teal-300">{percentage.toFixed(1)}%</span>
      </div>

      <div className="w-full bg-slate-700 rounded-full h-4 mb-3 overflow-hidden">
        <div
          className="bg-gradient-to-r from-teal-400 to-cyan-500 h-4 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        ></div>
      </div>

      <div className="grid grid-cols-3 text-sm text-slate-400 font-medium">
        <span>Actual: <span className="text-white font-bold">{totalPassengers.toLocaleString('es-CO')}</span></span>
        <span className="text-center">Faltan: <span className="text-amber-400 font-bold">{remaining.toLocaleString('es-CO')}</span></span>
        <div className="flex items-center justify-end gap-2">
          <span>Meta:</span>
          {isEditing ? (
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                value={formatNumberWithDots(tempGoal)}
                onChange={(e) => setTempGoal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') handleCancel();
                }}
                className="bg-slate-700/80 border border-slate-600 rounded-md px-2 py-0.5 text-white w-24 text-center font-bold focus:ring-teal-500 focus:border-teal-500"
              />
              <button onClick={handleSave} title="Guardar meta" className="p-1 rounded-full bg-slate-700 hover:bg-green-600 text-slate-300 hover:text-white transition-colors duration-200"><CheckIcon /></button>
              <button onClick={handleCancel} title="Cancelar" className="p-1 rounded-full bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white transition-colors duration-200"><XIcon /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-green-400 font-bold">{goal.toLocaleString('es-CO')}</span>
              <button onClick={() => setIsEditing(true)} title="Editar meta" className="p-1 rounded-full text-slate-500 hover:bg-slate-700 hover:text-white transition-colors duration-200 opacity-50 hover:opacity-100"><EditIcon className="h-4 w-4" /></button>
            </div>
          )}
        </div>
      </div>

      {dailyGoal > 0 && (
        <div className="text-center mt-5 pt-4 border-t border-slate-700/60">
          <p className="text-sm text-slate-400">Para cumplir, necesitas un promedio de:</p>
          <p className="text-2xl font-extrabold text-teal-300 my-1">
            {dailyGoal.toLocaleString('es-CO')}
            <span className="text-base font-medium text-slate-400 ml-1">pasajeros / día</span>
          </p>
          <p className="text-xs text-slate-500">(Quedan {daysRemaining} días para finalizar el mes)</p>
        </div>
      )}

      <p className="text-center text-sm text-slate-400 mt-4 italic">{getMotivationalMessage()}</p>
    </div>
  );
};

interface ToastProps {
  message: string;
  show: boolean;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, show, onClose }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className={`fixed top-5 right-5 z-50 transition-all duration-300 ease-in-out ${show ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
        }`}
    >
      {show && (
        <div role="alert" className="flex items-center p-4 max-w-sm bg-slate-800 text-white rounded-lg shadow-lg border border-teal-500/50">
          <CheckCircleIcon />
          <div className="ml-3 text-sm font-normal">{message}</div>
        </div>
      )}
    </div>
  );
};

// --- DIGITAL CLOCK COMPONENT ---
const DigitalClock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timerId);
    };
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      <ClockIcon />
      <p className="font-mono tracking-wider">{formatTime(time)}</p>
    </div>
  );
};


// --- DOCUMENT MANAGER COMPONENTS ---
const playNotificationSound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);

  gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.5);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
};

const getDocumentStatus = (expiryDate: string, alertDateTime: string | undefined) => {
  if (!expiryDate) return { status: 'valid' as const, daysRemaining: Infinity };

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDate);
  const expiryLocal = new Date(expiry.getTime() + expiry.getTimezoneOffset() * 60000);
  expiryLocal.setHours(0, 0, 0, 0);

  const diffTime = expiryLocal.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { status: 'expired' as const, daysRemaining: diffDays };

  if (alertDateTime) {
    const alertD = new Date(alertDateTime);
    if (now.getTime() >= alertD.getTime()) {
      return { status: 'expiring' as const, daysRemaining: diffDays };
    }
  }

  return { status: 'valid' as const, daysRemaining: diffDays };
};

const DocumentAlerts: React.FC<{ documents: ManagedDocument[] }> = ({ documents }) => {
  const [isDismissed, setIsDismissed] = useState(() => sessionStorage.getItem('docAlertsDismissed') === 'true');

  const alerts = useMemo(() => {
    return documents
      .map(doc => ({ ...doc, statusInfo: getDocumentStatus(doc.expiryDate, doc.alertDateTime) }))
      .filter(doc => doc.statusInfo.status === 'expired' || doc.statusInfo.status === 'expiring');
  }, [documents]);

  useEffect(() => {
    if (alerts.length > 0 && !isDismissed) {
      try {
        playNotificationSound();
      } catch (e) {
        console.warn("Could not play notification sound due to browser policy:", e);
      }
    }
  }, [alerts, isDismissed]);

  if (isDismissed || alerts.length === 0) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('docAlertsDismissed', 'true');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-backdrop"
      aria-modal="true"
      role="dialog"
    >
      <div className="bg-slate-800 border-2 border-amber-500/60 rounded-2xl w-full max-w-lg p-6 shadow-2xl text-center animate-fade-in-scale">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-amber-500/20 mb-4 border-2 border-amber-500/50 animate-pulse-bell">
          <BellIcon className="h-8 w-8 text-amber-400" />
        </div>
        <h3 className="text-2xl font-bold text-amber-300 mb-2">¡Atención! Documentos Importantes</h3>
        <p className="text-slate-400 mb-6 leading-relaxed">Los siguientes documentos requieren tu atención inmediata:</p>

        <ul className="space-y-3 text-left">
          {alerts.map(doc => (
            <li key={doc.id} className="p-3 rounded-lg flex items-center justify-between gap-4 border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-transparent">
              <div className="leading-relaxed">
                <p className="font-bold text-white">{doc.name}</p>
                <p className={`text-sm font-semibold ${doc.statusInfo.status === 'expired' ? 'text-red-400' : 'text-amber-400'}`}>
                  {doc.statusInfo.status === 'expired'
                    ? `Venció hace ${Math.abs(doc.statusInfo.daysRemaining)} días.`
                    : `Vence en ${doc.statusInfo.daysRemaining} días.`}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <button
          onClick={handleDismiss}
          className="mt-8 w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 text-base"
        >
          Entendido, revisar más tarde
        </button>
      </div>
    </div>
  );
};

const DocumentManager: React.FC<{ documents: ManagedDocument[]; setDocuments: React.Dispatch<React.SetStateAction<ManagedDocument[]>> }> = ({ documents, setDocuments }) => {
  const [isSectionOpen, setIsSectionOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<ManagedDocument | null>(null);

  const handleAddNew = () => {
    setEditingDoc(null);
    setIsModalOpen(true);
  };

  const handleEdit = (doc: ManagedDocument) => {
    setEditingDoc(doc);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar este documento?")) {
      setDocuments(docs => docs.filter(d => d.id !== id));
    }
  };

  const handleSave = (doc: ManagedDocument) => {
    if (editingDoc) {
      setDocuments(docs => docs.map(d => (d.id === doc.id ? doc : d)));
    } else {
      setDocuments(docs => [...docs, { ...doc, id: Date.now().toString() }]);
    }
    setIsModalOpen(false);
  };

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const localDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    return localDate.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <>
      <section className="mt-12">
        <div className="bg-slate-800/60 p-4 sm:p-6 rounded-2xl shadow-2xl border border-slate-700">
          <button onClick={() => setIsSectionOpen(!isSectionOpen)} className="w-full flex justify-between items-center text-left">
            <div className="flex items-center gap-3">
              <IdCardIcon className="h-6 w-6 text-teal-300" />
              <h2 className="text-xl font-bold text-teal-300">Documentos</h2>
            </div>
            <ChevronDownIcon className={`transform transition-transform duration-300 ${isSectionOpen ? 'rotate-180' : ''}`} />
          </button>

          <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isSectionOpen ? 'max-h-[1000px] mt-6' : 'max-h-0'}`}>
            <div className="border-t border-slate-700 pt-6">
              <div className="flex justify-end mb-4">
                <button onClick={handleAddNew} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center text-sm gap-2 hover:scale-105">
                  <PlusCircleIcon /> Añadir Nuevo Documento
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto pr-2 -mr-2 space-y-3">
                {documents.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No has añadido ningún documento.</p>
                ) : (
                  documents.map(doc => {
                    const { status, daysRemaining } = getDocumentStatus(doc.expiryDate, doc.alertDateTime);
                    const statusStyles = {
                      valid: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Vigente' },
                      expiring: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: `Vence en ${daysRemaining} días` },
                      expired: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Vencido' },
                    };
                    const currentStatus = statusStyles[status];

                    return (
                      <div key={doc.id} className={`p-3 rounded-lg flex items-center justify-between gap-4 border border-slate-700 ${currentStatus.bg}`}>
                        <div className="flex-grow">
                          <p className="font-bold text-white">{doc.name}</p>
                          <p className="text-sm text-slate-400">Vence: {formatDateForDisplay(doc.expiryDate)}</p>
                          <p className={`text-xs font-semibold ${currentStatus.text}`}>{currentStatus.label}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => handleEdit(doc)} className="p-2 rounded-full bg-slate-700 hover:bg-cyan-600 text-slate-300 hover:text-white transition-colors duration-200" title="Editar"><EditIcon /></button>
                          <button onClick={() => handleDelete(doc.id)} className="p-2 rounded-full bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white transition-colors duration-200" title="Eliminar"><TrashIcon /></button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      {isModalOpen && <DocumentModal doc={editingDoc} onSave={handleSave} onClose={() => setIsModalOpen(false)} />}
    </>
  );
};

const DocumentModal: React.FC<{ doc: ManagedDocument | null; onSave: (doc: ManagedDocument) => void; onClose: () => void; }> = ({ doc, onSave, onClose }) => {
  const [formData, setFormData] = useState<Omit<ManagedDocument, 'id'>>({
    name: doc?.name || '',
    expiryDate: doc?.expiryDate || '',
    alertDateTime: doc?.alertDateTime || '',
    imageSrc: doc?.imageSrc || '',
  });
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    const commonNames = ["Licencia de Conducir", "SOAT", "Revisión Técnico-Mecánica"];
    if (doc && !commonNames.includes(doc.name)) {
      setFormData(prev => ({ ...prev, name: 'Otro' }));
      setCustomName(doc.name);
    }
  }, [doc]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imageSrc: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = formData.name === 'Otro' ? customName : formData.name;
    if (!finalName || !formData.expiryDate) {
      alert("El nombre y la fecha de vencimiento son obligatorios.");
      return;
    }
    onSave({ ...formData, name: finalName, id: doc?.id || '' });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} aria-modal="true" role="dialog">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-teal-300 mb-4">{doc ? 'Editar' : 'Añadir'} Documento</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-400 block mb-1">Nombre del Documento</label>
            <select name="name" value={formData.name} onChange={handleChange} className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2 text-white">
              <option value="" disabled>Selecciona uno...</option>
              <option value="Licencia de Conducir">Licencia de Conducir</option>
              <option value="SOAT">SOAT</option>
              <option value="Revisión Técnico-Mecánica">Revisión Técnico-Mecánica</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
          {formData.name === 'Otro' && (
            <div>
              <label className="text-sm font-medium text-slate-400 block mb-1">Especifica el nombre</label>
              <input type="text" value={customName} onChange={e => setCustomName(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2 text-white" required />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-400 block mb-1">Fecha de Vencimiento</label>
              <input type="date" name="expiryDate" value={formData.expiryDate} onChange={handleChange} className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2 text-white" required />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-400 block mb-1">Fecha y Hora de Alerta</label>
              <input type="datetime-local" name="alertDateTime" value={formData.alertDateTime} onChange={handleChange} className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2 text-white" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-400 block mb-1">Foto del Documento (Opcional)</label>
            <div className="flex items-center gap-4">
              <label htmlFor="file-upload" className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2">
                <CameraIcon /> Subir Foto
              </label>
              <input id="file-upload" name="file-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              {formData.imageSrc && <img src={formData.imageSrc} alt="Vista previa" className="h-10 w-10 object-cover rounded-md" />}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <button type="button" onClick={onClose} className="py-2 px-4 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-semibold">Cancelar</button>
            <button type="submit" className="py-2 px-4 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-semibold">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- MAINTENANCE MANAGER COMPONENTS ---
const MaintenanceModal: React.FC<{ record: MaintenanceRecord | null; onSave: (record: MaintenanceRecord) => void; onClose: () => void; }> = ({ record, onSave, onClose }) => {
  const [formData, setFormData] = useState<Omit<MaintenanceRecord, 'id'>>({
    type: record?.type || 'Otro',
    date: record?.date || new Date().toISOString().split('T')[0],
    mileage: record?.mileage || '',
    nextChangeMileage: record?.nextChangeMileage || '',
    filterChangeMileage: record?.filterChangeMileage || '',
    notes: record?.notes || '',
  });
  const [customType, setCustomType] = useState('');

  useEffect(() => {
    const commonTypes = ["Cambio de Aceite", "Frenos", "Llantas", "Revisión General"];
    if (record && !commonTypes.includes(record.type)) {
      setFormData(prev => ({ ...prev, type: 'Otro' }));
      setCustomType(record.type);
    }
  }, [record]);

  useEffect(() => {
    if (formData.type === 'Cambio de Aceite' && formData.mileage) {
      const currentMileage = parseInt(parseFormattedNumber(formData.mileage), 10);
      if (!isNaN(currentMileage)) {
        const filterChange = currentMileage + 4000;
        const nextOilChange = currentMileage + 8000;
        setFormData(prev => ({
          ...prev,
          filterChangeMileage: formatNumberWithDots(filterChange.toString()),
          nextChangeMileage: formatNumberWithDots(nextOilChange.toString()),
        }));
      }
    }
  }, [formData.mileage, formData.type]);

  useEffect(() => {
    if (formData.type !== 'Cambio de Aceite') {
      setFormData(prev => ({
        ...prev,
        mileage: '',
        filterChangeMileage: '',
        nextChangeMileage: '',
      }));
    }
  }, [formData.type]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'mileage' || name === 'nextChangeMileage' || name === 'filterChangeMileage') {
      setFormData({ ...formData, [name]: formatNumberWithDots(value) });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalType = formData.type === 'Otro' ? customType : formData.type;

    if (finalType === 'Cambio de Aceite') {
      if (!finalType || !formData.mileage || !formData.date) {
        alert("Para cambio de aceite, el tipo, fecha y kilometraje actual son obligatorios.");
        return;
      }
    } else {
      if (!finalType || !formData.date) {
        alert("El tipo y la fecha del mantenimiento son obligatorios.");
        return;
      }
    }

    onSave({ ...formData, type: finalType, id: record?.id || '' });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} aria-modal="true" role="dialog">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-teal-300 mb-4">{record ? 'Editar' : 'Añadir'} Mantenimiento</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-400 block mb-1">Tipo de Mantenimiento</label>
            <select name="type" value={formData.type} onChange={handleChange} className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2 text-white">
              <option value="Cambio de Aceite">Cambio de Aceite</option>
              <option value="Frenos">Frenos</option>
              <option value="Llantas">Llantas</option>
              <option value="Revisión General">Revisión General</option>
              <option value="Otro">Otro...</option>
            </select>
          </div>
          {formData.type === 'Otro' && (
            <div>
              <label className="text-sm font-medium text-slate-400 block mb-1">Especifica el tipo</label>
              <input type="text" value={customType} onChange={e => setCustomType(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2 text-white" required />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-400 block mb-1">Fecha</label>
              <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2 text-white" required />
            </div>
            {formData.type === 'Cambio de Aceite' && (
              <div>
                <label className="text-sm font-medium text-slate-400 block mb-1">
                  Kilometraje
                </label>
                <input type="text" inputMode="numeric" name="mileage" value={formData.mileage} onChange={handleChange} placeholder="Ej: 123.456" className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2 text-white" required />
              </div>
            )}
          </div>
          {formData.type === 'Cambio de Aceite' && (
            <>
              <div>
                <label className="text-sm font-medium text-slate-400 block mb-1">Cambio de Filtros (Km)</label>
                <input type="text" name="filterChangeMileage" value={formData.filterChangeMileage} placeholder="Automático" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-amber-300 font-semibold" disabled />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-400 block mb-1">Próximo Cambio de Aceite (Km)</label>
                <input type="text" name="nextChangeMileage" value={formData.nextChangeMileage} placeholder="Automático" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-teal-300 font-semibold" disabled />
              </div>
            </>
          )}
          <div>
            <label className="text-sm font-medium text-slate-400 block mb-1">Notas</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2 text-white" placeholder="Añade una nota..."></textarea>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <button type="button" onClick={onClose} className="py-2 px-4 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-semibold">Cancelar</button>
            <button type="submit" className="py-2 px-4 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-semibold">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const VehicleMaintenanceManager: React.FC<{ records: MaintenanceRecord[]; setRecords: React.Dispatch<React.SetStateAction<MaintenanceRecord[]>> }> = ({ records, setRecords }) => {
  const [isSectionOpen, setIsSectionOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const formatDateForDisplay = useCallback((dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const localDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    return localDate.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }, []);

  const filteredRecords = useMemo(() => {
    const lowercasedFilter = searchTerm.toLowerCase();

    const filtered = records.filter(record => {
      if (!searchTerm.trim()) return true;

      const formattedDate = formatDateForDisplay(record.date).toLowerCase();

      return (
        record.type.toLowerCase().includes(lowercasedFilter) ||
        (record.notes && record.notes.toLowerCase().includes(lowercasedFilter)) ||
        (record.mileage && record.mileage.includes(searchTerm)) ||
        (record.filterChangeMileage && record.filterChangeMileage.includes(searchTerm)) ||
        (record.nextChangeMileage && record.nextChangeMileage.includes(searchTerm)) ||
        formattedDate.includes(lowercasedFilter)
      );
    });

    return [...filtered].sort((a, b) => {
      const isA_OilChange = a.type === 'Cambio de Aceite';
      const isB_OilChange = b.type === 'Cambio de Aceite';

      if (isA_OilChange && !isB_OilChange) return -1;
      if (!isA_OilChange && isB_OilChange) return 1;

      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [records, searchTerm, formatDateForDisplay]);


  const handleAddNew = () => {
    setEditingRecord(null);
    setIsModalOpen(true);
  };

  const handleEdit = (record: MaintenanceRecord) => {
    setEditingRecord(record);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar este registro de mantenimiento?")) {
      setRecords(prev => prev.filter(r => r.id !== id));
    }
  };

  const handleSave = (record: MaintenanceRecord) => {
    if (editingRecord) {
      setRecords(prev => prev.map(r => (r.id === record.id ? record : r)));
    } else {
      setRecords(prev => [...prev, { ...record, id: Date.now().toString() }]);
    }
    setIsModalOpen(false);
  };

  return (
    <>
      <section className="mt-12">
        <div className="bg-slate-800/60 p-4 sm:p-6 rounded-2xl shadow-2xl border border-slate-700">
          <button onClick={() => setIsSectionOpen(!isSectionOpen)} className="w-full flex justify-between items-center text-left">
            <div className="flex items-center gap-3">
              <WrenchIcon className="h-6 w-6 text-teal-300" />
              <h2 className="text-xl font-bold text-teal-300">Mantenimiento del Vehículo</h2>
            </div>
            <ChevronDownIcon className={`transform transition-transform duration-300 ${isSectionOpen ? 'rotate-180' : ''}`} />
          </button>

          <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isSectionOpen ? 'max-h-[2000px] mt-6' : 'max-h-0'}`}>
            <div className="border-t border-slate-700 pt-6">
              <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
                <div className="relative w-full sm:flex-grow">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <SearchIcon />
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar por tipo, nota, fecha, km..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-700/80 border border-slate-600 rounded-lg py-2 pl-10 pr-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    aria-label="Buscar en mantenimiento"
                  />
                </div>
                <button onClick={handleAddNew} className="w-full sm:w-auto flex-shrink-0 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center text-sm gap-2 hover:scale-105">
                  <PlusCircleIcon /> Añadir Mantenimiento
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto pr-2 -mr-2 space-y-3">
                {filteredRecords.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">
                    {searchTerm
                      ? `No se encontraron resultados para "${searchTerm}".`
                      : "No has añadido ningún registro de mantenimiento."
                    }
                  </p>
                ) : (
                  filteredRecords.map(record => (
                    <div key={record.id} className="p-3 rounded-lg flex items-start justify-between gap-4 border border-slate-700 bg-slate-800/50">
                      <div className="flex-grow">
                        <p className="font-bold text-white">{record.type}</p>
                        <p className="text-sm text-slate-400">{formatDateForDisplay(record.date)}</p>

                        {(record.mileage || (record.type === 'Cambio de Aceite' && record.nextChangeMileage)) && (
                          <div className="mt-2 text-sm space-y-1">
                            {record.mileage && <p className="text-slate-300">Kilometraje: <span className="font-semibold text-white">{record.mileage} km</span></p>}
                            {record.type === 'Cambio de Aceite' && record.filterChangeMileage && <p className="text-amber-300">Cambio Filtros: <span className="font-semibold text-white">{record.filterChangeMileage} km</span></p>}
                            {record.type === 'Cambio de Aceite' && record.nextChangeMileage && <p className="text-teal-300">Próximo Cambio: <span className="font-semibold text-white">{record.nextChangeMileage} km</span></p>}
                          </div>
                        )}

                        {record.notes && <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-700 italic">Nota: {record.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => handleEdit(record)} className="p-2 rounded-full bg-slate-700 hover:bg-cyan-600 text-slate-300 hover:text-white transition-colors duration-200" title="Editar"><EditIcon /></button>
                        <button onClick={() => handleDelete(record.id)} className="p-2 rounded-full bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white transition-colors duration-200" title="Eliminar"><TrashIcon /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      {isModalOpen && <MaintenanceModal record={editingRecord} onSave={handleSave} onClose={() => setIsModalOpen(false)} />}
    </>
  );
};

const LiveStatusBar: React.FC<{ status: 'idle' | 'loading' | 'success' | 'error', vehicles: Array<{ identifier: string, pasajeros: string }>, onClick: () => void }> = ({ status, vehicles, onClick }) => {
  if (status === 'idle') return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-2 pointer-events-none">
      <button onClick={onClick} className="bg-slate-900/90 backdrop-blur-md border border-indigo-500/50 rounded-full pl-5 pr-2 py-2 shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center justify-center gap-4 pointer-events-auto cursor-pointer hover:scale-105 transition-transform animate-fade-in-down group">

        <div className="flex items-center gap-3">
          {(!vehicles || vehicles.length === 0) ? (
            <span className="text-sm font-bold text-white whitespace-nowrap">
              {status === 'loading' ? 'Sincronizando...' : status === 'error' ? 'Reconectando...' : 'Esperando datos...'}
            </span>
          ) : (
            vehicles.map((v, i) => (
              <div key={i} className="flex flex-col items-center leading-none px-2 border-r border-indigo-500/30 last:border-0">
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-0.5">Bus {v.identifier}</span>
                <span className="text-lg font-black text-white">{v.pasajeros}</span>
              </div>
            ))
          )}
        </div>

        <div className="pl-2">
          {status === 'loading' && <div className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-ping"></div>}
          {status === 'error' && <div className="h-2.5 w-2.5 rounded-full bg-red-500"></div>}
          {status === 'success' && <div className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]"></div>}
        </div>
      </button>
    </div>
  );
};

const RobotModal: React.FC<{ isOpen: boolean; onClose: () => void; vehicles: Array<{ identifier: string, pasajeros: string }>; status: string; deduction: string; onDeductionChange: (val: string) => void; onSelectPassengers: (total: string) => void; onUpdate: () => void }> = ({ isOpen, onClose, vehicles, status, deduction, onDeductionChange, onSelectPassengers, onUpdate }) => {
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isOpen && status === 'loading') {
      setTimer(0);
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isOpen, status]);

  if (!isOpen) return null;

  const handleVehicleClick = (vehiclePassengers: string) => {
    const rawPassengers = parseInt(vehiclePassengers.replace(/\./g, ''), 10);
    const deductionVal = parseInt(deduction, 10) || 0;

    if (!isNaN(rawPassengers)) {
      const finalCount = Math.max(0, rawPassengers + deductionVal);
      onSelectPassengers(finalCount.toString());
    }
  };

  const incrementDeduction = (amount: number) => {
    const current = parseInt(deduction || '0', 10);
    onDeductionChange((current + amount).toString());
  };

  const decrementDeduction = (amount: number) => {
    const current = parseInt(deduction || '0', 10);
    onDeductionChange((current - amount).toString());
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-backdrop" onClick={onClose}>
      <div className="bg-slate-800 border-2 border-indigo-500/50 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in-scale flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 border-b border-indigo-500/20 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/20 rounded-full text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
              <RobotIcon />
            </div>
            <div>
              <h3 className="text-xl font-bold text-indigo-300">Datos GPS</h3>
              <p className="text-xs text-indigo-400/70">
                {status === 'loading' ? 'Actualizando...' : status === 'error' ? 'Error de Conexión' : 'Conexión Segura'}
              </p>
            </div>
          </div>
          <button onClick={onUpdate} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow transition-transform active:scale-95 mx-3">Actualizar</button>
          <button onClick={onClose} className="p-2.5 rounded-full bg-slate-700/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all active:scale-95 border border-transparent hover:border-red-500/30 shadow-lg" title="Cerrar"><XIcon /></button>
        </div>

        <div className="mb-2 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50 flex items-center justify-between gap-2">
          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
            <TrashIcon /> A Descontar
          </label>
          <div className="flex items-center gap-2 bg-slate-800/80 rounded-md p-1 border border-slate-700">
            <button onClick={() => decrementDeduction(1)} className="w-8 h-8 flex items-center justify-center rounded bg-slate-700 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all font-bold text-lg leading-none pb-0.5">−</button>
            <input type="text" inputMode="numeric" value={deduction} onChange={(e) => onDeductionChange(e.target.value)} className="bg-transparent border-none text-white text-lg font-bold text-center w-14 focus:ring-0 active:ring-0 p-0 placeholder-slate-600" placeholder="0" />
            <button onClick={() => incrementDeduction(1)} className="w-8 h-8 flex items-center justify-center rounded bg-slate-700 text-green-400 hover:bg-green-500/20 active:scale-95 transition-all font-bold text-lg leading-none pb-0.5">+</button>
          </div>
        </div>

        {status === 'loading' && vehicles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <div className="relative w-16 h-16">
              <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-500/30 rounded-full"></div>
              <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <div className="text-center">
              <h4 className="text-lg font-bold text-white mb-1">Cargando Datos...</h4>
              <p className="text-sm font-mono text-indigo-300">{timer} s</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            {vehicles.length > 0 ? (
              <>
                <p className="text-xs text-center text-indigo-300 mb-2 font-medium animate-pulse">👇 Toca un vehículo para cargar los pasajeros</p>

                <div className="overflow-y-auto flex-grow pr-1 space-y-3 custom-scrollbar">
                  {vehicles.map((v, i) => (
                    <button key={i} onClick={() => handleVehicleClick(v.pasajeros)} className="w-full bg-slate-900/50 border border-slate-700 hover:border-indigo-500 hover:bg-indigo-500/10 p-4 rounded-xl flex items-center justify-between group transition-all duration-200">
                      <div className="text-left">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 group-hover:text-indigo-300">Vehículo</p>
                        <p className="text-2xl font-black text-white">{v.identifier}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 group-hover:text-indigo-300">Pasajeros</p>
                        <div className="flex flex-col items-end">
                          <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400 group-hover:from-indigo-400 group-hover:to-cyan-300">{v.pasajeros}</p>
                          {parseInt(deduction) !== 0 && !isNaN(parseInt(deduction)) && (
                            <span className="text-xs text-slate-500 font-mono">
                              {parseInt(deduction) > 0 ? '+' : ''} {deduction} = <span className="text-indigo-300 font-bold">{Math.max(0, (parseInt(v.pasajeros.replace(/\./g, '')) || 0) + parseInt(deduction || '0'))}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-700/50 text-center">
                  <p className="text-[10px] text-slate-500 font-mono">Tiempo transcurrido: <span className="text-indigo-400 font-bold">{timer} seg</span></p>
                </div>
              </>
            ) : (
              <div className="text-center py-10 text-slate-400 italic bg-slate-900/30 rounded-xl border border-slate-800">
                {status === 'error' ? 'No se pudo conectar. Reintentando...' : 'No se encontraron vehículos operando hoy.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


// --- MAIN APP COMPONENT ---
const App: React.FC = () => {
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistoryFromLocalStorage());
  const [documents, setDocuments] = useState<ManagedDocument[]>(() => loadDocumentsFromLocalStorage());
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>(() => loadMaintenanceFromLocalStorage());
  const [passengerGoal, setPassengerGoal] = useState<number>(() => loadConfigFromLocalStorage().passengerGoal);

  const getInitialFormData = useCallback((): FormData => {
    const config = loadConfigFromLocalStorage();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyDefaultRoute = calculateRouteForDate(today.toISOString());

    return {
      numPassengers: '',
      fareValue: config.fareValue,
      fixedCommission: '15',
      fuelExpenses: '',
      route: dailyDefaultRoute,
      commissionPerPassenger: config.commissionPerPassenger,
      variableExpenses: config.variableExpenses,
      administrativeExpenses: config.administrativeExpenses,
    };
  }, []);

  const [formData, setFormData] = useState<FormData>(getInitialFormData);
  const [results, setResults] = useState<CalculationResults>({ totalRevenue: 0, myEarnings: 0, totalExpenses: 0, amountToSettle: 0, fixedCommissionValue: 0, perPassengerCommissionValue: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [usedPhrases, setUsedPhrases] = useState<string[]>([]);
  const [editingTimestampId, setEditingTimestampId] = useState<string | null>(null);
  const [tempTimestamp, setTempTimestamp] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fabBottom, setFabBottom] = useState('1.5rem');
  const [showSaveSuccessAnim, setShowSaveSuccessAnim] = useState(false);
  const [isRecordListOpen, setIsRecordListOpen] = useState(false);
  const [isRobotModalOpen, setIsRobotModalOpen] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [gpsVehicles, setGpsVehicles] = useState<Array<{ identifier: string, pasajeros: string }>>([]);
  const [gpsPassengersTotal, setGpsPassengersTotal] = useState<number | null>(null);
  const [passengerDeduction, setPassengerDeduction] = useState<string>(() => localStorage.getItem('passengerDeduction') || '');

  const fuelInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });
  const focusedElementRef = useRef<HTMLInputElement | null>(null);

  const API_URL = import.meta.env.DEV ? '' : 'https://calculadora-production-fa9d.up.railway.app';

  useEffect(() => {
    localStorage.setItem('passengerDeduction', passengerDeduction);
  }, [passengerDeduction]);

  const fetchGpsData = useCallback(async () => {
    setGpsStatus(prev => prev === 'success' || prev === 'idle' ? 'loading' : prev);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const response = await fetch(`${API_URL}/api/scrape-passengers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'luniosilva', password: '12256643' }), // Credenciales seguras
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (response.ok && data.success) {
        setGpsVehicles(data.vehicles);
        setGpsStatus('success');
        // Calcular total aproximado o usar el primero? Usualmente se busca un vehiculo especifico.
        // Sumamos todos los pasajeros detectados para la "Live Island"
        const total = data.vehicles.reduce((acc: number, v: any) => acc + (parseInt(v.pasajeros.replace(/\./g, '')) || 0), 0);
        setGpsPassengersTotal(total);
      } else {
        setGpsStatus('error');
      }
    } catch (e) {
      console.error("GPS Poll Error:", e);
      setGpsStatus('error');
    }
  }, []);



  useEffect(() => {
    saveHistoryToLocalStorage(history);
  }, [history]);

  useEffect(() => {
    saveDocumentsToLocalStorage(documents);
  }, [documents]);

  useEffect(() => {
    saveMaintenanceToLocalStorage(maintenanceRecords);
  }, [maintenanceRecords]);

  useEffect(() => {
    const config: AppConfig = {
      fareValue: formData.fareValue,
      commissionPerPassenger: formData.commissionPerPassenger,
      variableExpenses: formData.variableExpenses,
      administrativeExpenses: formData.administrativeExpenses,
      passengerGoal: passengerGoal,
    };
    saveConfigToLocalStorage(config);
  }, [formData.fareValue, formData.commissionPerPassenger, formData.variableExpenses, formData.administrativeExpenses, passengerGoal]);


  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const handleResize = () => {
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const isSmallScreen = window.innerWidth < 640;
      const defaultBottomRem = isSmallScreen ? 3 : 3.5;
      const defaultBottomPx = defaultBottomRem * rootFontSize;

      const keyboardHeight = window.innerHeight - visualViewport.height;

      if (keyboardHeight > 50) {
        setFabBottom(`${keyboardHeight + defaultBottomPx}px`);

        if (focusedElementRef.current) {
          setTimeout(() => {
            if (!focusedElementRef.current) return;
            const inputRect = focusedElementRef.current.getBoundingClientRect();

            if (inputRect.bottom > visualViewport.height) {
              focusedElementRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              });
            }
          }, 150);
        }
      } else {
        setFabBottom(`${defaultBottomRem}rem`);
      }
    };

    visualViewport.addEventListener('resize', handleResize);
    window.addEventListener('resize', handleResize);

    handleResize();

    return () => {
      visualViewport.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string } }) => {
    const { name, value } = e.target;
    const fieldsToFormat: (keyof FormData)[] = ['fareValue', 'commissionPerPassenger', 'fuelExpenses', 'variableExpenses', 'administrativeExpenses'];
    const numericOnlyFields: (keyof FormData)[] = ['numPassengers', 'fixedCommission'];

    let processedValue = value;
    if (fieldsToFormat.includes(name as keyof FormData)) {
      let cleanValue = parseFormattedNumber(value);

      if (name === 'fuelExpenses') {
        if (cleanValue.length > 6) {
          cleanValue = cleanValue.slice(0, 6);
        }
        if (cleanValue.length === 6) {
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }

      processedValue = formatNumberWithDots(cleanValue);

    } else if (numericOnlyFields.includes(name as keyof FormData)) {
      processedValue = value.replace(/[^\d]/g, '');
      if (name === 'numPassengers') {
        if (processedValue.length > 3) {
          processedValue = processedValue.slice(0, 3);
        }
        if (processedValue.length === 3) {
          fuelInputRef.current?.focus();
          fuelInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }

    setFormData(prev => ({ ...prev, [name]: processedValue }));
  }, []);

  const getRawData = (data: FormData): Record<string, number> => {
    return {
      numPassengers: parseFloat(parseFormattedNumber(data.numPassengers)) || 0,
      fareValue: parseFloat(parseFormattedNumber(data.fareValue)) || 0,
      fixedCommission: parseFloat(parseFormattedNumber(data.fixedCommission)) || 0,
      commissionPerPassenger: parseFloat(parseFormattedNumber(data.commissionPerPassenger)) || 0,
      fuelExpenses: parseFloat(parseFormattedNumber(data.fuelExpenses)) || 0,
      variableExpenses: parseFloat(parseFormattedNumber(data.variableExpenses)) || 0,
      administrativeExpenses: parseFloat(parseFormattedNumber(data.administrativeExpenses)) || 0,
    };
  }

  useEffect(() => {
    const { numPassengers, fareValue, fixedCommission, commissionPerPassenger, fuelExpenses, variableExpenses, administrativeExpenses } = getRawData(formData);

    const totalRevenue = numPassengers * fareValue;
    const fixedCommissionValue = totalRevenue * (fixedCommission / 100);
    const perPassengerCommissionValue = numPassengers * commissionPerPassenger;

    const driverEarnings = fixedCommissionValue + perPassengerCommissionValue;

    const ownerExpenses = fuelExpenses + variableExpenses;
    const adminExpenses = administrativeExpenses;

    const calculatedTotalExpenses = ownerExpenses + adminExpenses;

    const amountToSettle = totalRevenue - driverEarnings - ownerExpenses;

    setResults({
      totalRevenue: isNaN(totalRevenue) ? 0 : totalRevenue,
      myEarnings: isNaN(driverEarnings) ? 0 : driverEarnings,
      totalExpenses: isNaN(calculatedTotalExpenses) ? 0 : calculatedTotalExpenses,
      amountToSettle: isNaN(amountToSettle) ? 0 : amountToSettle,
      fixedCommissionValue: isNaN(fixedCommissionValue) ? 0 : fixedCommissionValue,
      perPassengerCommissionValue: isNaN(perPassengerCommissionValue) ? 0 : perPassengerCommissionValue,
    });
  }, [formData]);

  const showMotivationalToast = useCallback(() => {
    let availablePhrases = MOTIVATIONAL_PHRASES.filter(p => !usedPhrases.includes(p));

    if (availablePhrases.length === 0) {
      setUsedPhrases([]);
      availablePhrases = MOTIVATIONAL_PHRASES;
    }

    const randomIndex = Math.floor(Math.random() * availablePhrases.length);
    const phrase = availablePhrases[randomIndex];

    setUsedPhrases(prev => [...prev, phrase]);
    setToastMessage(phrase);
  }, [usedPhrases]);

  const handleClearForm = useCallback(() => {
    setFormData(getInitialFormData());
    setEditingId(null);
  }, [getInitialFormData]);

  const handleSaveCalculation = () => {
    if (isDragging || showSaveSuccessAnim) return;

    const rawData = getRawData(formData);
    if (rawData.numPassengers === 0) {
      alert("No se puede guardar un cálculo sin pasajeros.");
      return;
    }

    const grossAmountToSettle = results.amountToSettle;
    const netAmountToSettle = grossAmountToSettle - rawData.administrativeExpenses;

    const resultsForHistory: CalculationResults = {
      ...results,
      amountToSettle: netAmountToSettle,
      totalDeliveredAmount: grossAmountToSettle,
    };

    if (editingId) {
      setHistory(prevHistory =>
        prevHistory.map(entry =>
          entry.id === editingId
            ? {
              ...entry,
              formData,
              results: resultsForHistory,
            }
            : entry
        )
      );
    } else {
      const newEntry: HistoryEntry = {
        id: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        formData,
        results: resultsForHistory,
      };
      setHistory(prevHistory => [newEntry, ...prevHistory]);
    }

    setShowSaveSuccessAnim(true);
    setTimeout(() => {
      setShowSaveSuccessAnim(false);
      showMotivationalToast();
      handleClearForm();
    }, 1200);
  };

  const handleEditTimestampStart = (id: string, timestamp: string) => {
    setEditingTimestampId(id);
    try {
      const date = new Date(timestamp);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const localDateTime = `${date.getFullYear()}-${month}-${day}T${hours}:${minutes}`;
      setTempTimestamp(localDateTime);
    } catch (e) {
      setTempTimestamp('');
    }
  };

  const handleEditTimestampSave = (id: string) => {
    if (!tempTimestamp) return;

    const newTimestamp = new Date(tempTimestamp).toISOString();

    setHistory(prev => prev.map(entry =>
      entry.id === id ? { ...entry, timestamp: newTimestamp, formData: { ...entry.formData, route: calculateRouteForDate(newTimestamp) } } : entry
    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));

    setEditingTimestampId(null);
    setTempTimestamp('');
  };

  const handleEditTimestampCancel = () => {
    setEditingTimestampId(null);
    setTempTimestamp('');
  };

  const handleLoadEntry = (id: string) => {
    const entryToLoad = history.find(entry => entry.id === id);
    if (entryToLoad) {
      setFormData(entryToLoad.formData);
      setEditingId(id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDeleteEntry = (id: string) => {
    if (window.confirm("¿Estás seguro de que quieres borrar este registro?")) {
      if (editingId) {
        const entryToDelete = history.find(entry => entry.id === id);
        if (entryToDelete && entryToDelete.id === editingId) {
          handleClearForm();
        }
      }
      setHistory(prevHistory => prevHistory.filter(entry => entry.id !== id));
    }
  };

  const handleClearAllHistory = () => {
    const isConfirmed = window.confirm(
      "¿Estás seguro de que quieres borrar todo el historial? Esta acción no se puede deshacer."
    );
    if (isConfirmed) {
      setHistory([]);
      handleClearForm();
    }
  };

  const handleMoveEntryUp = (id: string) => {
    setHistory(prevHistory => {
      const index = prevHistory.findIndex(entry => entry.id === id);
      if (index > 0) {
        const newHistory = [...prevHistory];
        [newHistory[index - 1], newHistory[index]] = [newHistory[index], newHistory[index - 1]];
        return newHistory;
      }
      return prevHistory;
    });
  };

  const handleMoveEntryDown = (id: string) => {
    setHistory(prevHistory => {
      const index = prevHistory.findIndex(entry => entry.id === id);
      if (index < prevHistory.length - 1 && index !== -1) {
        const newHistory = [...prevHistory];
        [newHistory[index + 1], newHistory[index]] = [newHistory[index], newHistory[index + 1]];
        return newHistory;
      }
      return prevHistory;
    });
  };

  const handleToggleExpand = (id: string) => {
    setExpandedId(currentId => (currentId === id ? null : id));
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    focusedElementRef.current = e.target;
  };

  const getClientCoords = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if ('touches' in e) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const { x, y } = getClientCoords(e);
    dragStartRef.current = { x, y, initialX: position.x, initialY: position.y };
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const { x: currentX, y: currentY } = getClientCoords(e);
    const { x: startX, y: startY, initialX, initialY } = dragStartRef.current;

    const dx = currentX - startX;
    const dy = currentY - startY;

    setPosition({ x: initialX + dx, y: initialY + dy });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchend', handleDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('touchmove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);


  const historyTotals = useMemo(() => {
    return history.reduce((acc, entry) => {
      acc.totalEarnings += entry.results.myEarnings;
      acc.totalExpenses += entry.results.totalExpenses;
      acc.totalAmountSettled += entry.results.amountToSettle;
      acc.totalDeliveredAmount += entry.results.totalDeliveredAmount || 0;
      acc.totalPassengers += parseFloat(parseFormattedNumber(entry.formData.numPassengers)) || 0;
      acc.totalFixedCommission += entry.results.fixedCommissionValue || 0;
      acc.totalPerPassengerCommission += entry.results.perPassengerCommissionValue || 0;
      return acc;
    }, {
      totalEarnings: 0,
      totalExpenses: 0,
      totalAmountSettled: 0,
      totalDeliveredAmount: 0,
      totalPassengers: 0,
      totalFixedCommission: 0,
      totalPerPassengerCommission: 0,
    });
  }, [history]);

  const HistoryTableHeader = () => (
    <div className="sticky top-0 z-10 bg-slate-800/95 backdrop-blur-sm p-4 hidden md:grid grid-cols-9 gap-x-4 text-sm font-bold text-slate-400 border-b border-slate-700">
      <div className="col-span-2">Fecha</div>
      <div>Ruta</div>
      <div>Pasajeros</div>
      <div className="text-center">Ganancia</div>
      <div className="text-center">Gastos</div>
      <div className="text-center">Recaudado</div>
      <div className="text-center">En Empresa</div>
      <div className="text-right">Acciones</div>
    </div>
  );

  const handleBackgroundClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('input, button, a, label, select')) {
      return;
    }

    if (document.activeElement instanceof HTMLInputElement) {
      document.activeElement.blur();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-6 lg:p-8 pt-16 sm:pt-20" onClick={handleBackgroundClick}>
      <LiveStatusBar status={gpsStatus} vehicles={gpsVehicles} onClick={() => { setIsRobotModalOpen(true); fetchGpsData(); }} />
      <Toast
        message={toastMessage}
        show={!!toastMessage}
        onClose={() => setToastMessage('')}
      />
      <div className="max-w-6xl mx-auto">
        <DocumentAlerts documents={documents} />
        <header className="mb-6">
          <div className="bg-gradient-to-b from-slate-800/60 to-slate-900/40 backdrop-blur-sm p-4 rounded-xl border border-cyan-500/20 shadow-lg">
            <div className="flex justify-between items-center text-xs text-slate-400 mb-3">
              <div className="flex items-center gap-3">
                <a
                  href="https://newxmkxkombat-coder.github.io/calendario/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 px-2 py-1 rounded-lg text-teal-300 font-bold transition-all hover:scale-105 active:scale-95"
                >
                  <CalendarIcon />
                  <span>Calendario</span>
                </a>
                <button
                  onClick={() => { setIsRobotModalOpen(true); fetchGpsData(); }}
                  className="flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 px-3 py-1 rounded-lg text-indigo-300 font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_10px_rgba(99,102,241,0.2)] ml-1"
                >
                  <RobotIcon />
                  <span>{gpsStatus === 'loading' ? 'Sync...' : 'Pasajeros'}</span>
                </button>
                <div className="hidden sm:flex items-center gap-1.5 opacity-80">
                  <span>{new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                </div>
              </div>
              <DigitalClock />
            </div>
            <div className="border-t border-slate-700/60 pt-3">
              <div className="text-center mb-4 pb-4 border-b border-slate-700/60">
                <div className="flex items-center justify-center gap-2 text-sm text-slate-300 mb-1">
                  <ClipboardCheckIcon />
                  <span className="font-medium">Entrega</span>
                </div>
                <p className="font-bold text-4xl text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300 tracking-tight">{formatCurrency(results.amountToSettle)}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-xs text-slate-400">Mi Sueldo</p>
                  <p className="font-semibold text-lg text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-400">{formatCurrency(results.myEarnings)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400">Gastos</p>
                  <p className="font-semibold text-lg text-orange-400">{formatCurrency(results.totalExpenses)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400">Recaudado</p>
                  <p className="font-semibold text-lg text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">{formatCurrency(results.totalRevenue)}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main>
          <fieldset
            className="bg-slate-800/60 rounded-2xl shadow-2xl border border-slate-700 p-4 sm:p-6 space-y-6 transition-opacity"
          >
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-semibold text-teal-300 ml-1">DATOS DEL DÍA</h3>
              </div>
              <div className="space-y-3">
                <InputControl label="Número de Pasajeros" name="numPassengers" value={formData.numPassengers} onChange={handleChange} onFocus={handleInputFocus} icon={<UsersIcon />} />
                <div className="grid grid-cols-2 gap-3">
                  <InputControl label="Valor Pasaje" name="fareValue" value={formData.fareValue} onChange={handleChange} onFocus={handleInputFocus} icon={<MoneyIcon />} unit="$" />
                  <InputControl label="Comisión Fija" name="fixedCommission" value={formData.fixedCommission} onChange={handleChange} onFocus={handleInputFocus} icon={<PercentageIcon />} unit="%" />
                </div>
                <InputControl label="Comisión por Pasajero" name="commissionPerPassenger" value={formData.commissionPerPassenger} onChange={handleChange} onFocus={handleInputFocus} icon={<MoneyIcon />} unit="$" />
                <CheckboxControlGroup label="Ruta Actual" name="route" value={formData.route} onChange={handleChange} icon={<RouteIcon />} options={['60', '29']} />
              </div>
            </div>
            <div>
              <h3 className="text-base font-semibold text-amber-400 mb-3 ml-1">GASTOS DEL DÍA</h3>
              <div className="space-y-3">
                <InputControl ref={fuelInputRef} label="Combustible" name="fuelExpenses" value={formData.fuelExpenses} onChange={handleChange} onFocus={handleInputFocus} icon={<FuelIcon />} unit="$" />
                <InputControl label="Taller (Lavada, Engrase, etc.)" name="variableExpenses" value={formData.variableExpenses} onChange={handleChange} onFocus={handleInputFocus} icon={<WrenchIcon />} unit="$" placeholder="Valor Total" />
                <InputControl label="Gastos Administrativos" name="administrativeExpenses" value={formData.administrativeExpenses} onChange={handleChange} onFocus={handleInputFocus} icon={<BriefcaseIcon />} unit="$" />
              </div>
            </div>
          </fieldset>
        </main>

        <section className="mt-12">
          <div className="bg-slate-800/60 p-4 sm:p-6 rounded-2xl shadow-2xl border border-slate-700">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-teal-300 whitespace-nowrap">Historial</h2>
            </div>

            <div className="border-t border-slate-700 mt-6 pt-6">
              <div className="flex justify-end mb-4">
                <button onClick={handleClearAllHistory} disabled={history.length === 0} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center text-sm hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-red-600">
                  <TrashIcon />
                  <span className="ml-2">Borrar Historial</span>
                </button>
              </div>

              {history.length > 0 && (
                <>
                  <PassengerGoalProgress
                    totalPassengers={historyTotals.totalPassengers}
                    goal={passengerGoal}
                    onGoalChange={setPassengerGoal}
                  />
                  <div className="p-4 mt-6 bg-slate-900/50 rounded-lg border border-slate-700">
                    <h3 className="text-lg font-bold text-slate-300 mb-3 text-center">Resumen Total del Historial</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                      <div>
                        <p className="text-sm text-slate-400">Pasajeros Totales</p>
                        <p className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-teal-400">
                          {historyTotals.totalPassengers.toLocaleString('es-CO')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Ganancia Total</p>
                        <p className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">
                          {formatCurrency(historyTotals.totalEarnings)}
                        </p>
                        <div className="mt-2 text-center">
                          <span className="text-sm font-bold text-sky-400">{formatCurrency(historyTotals.totalFixedCommission)}</span>
                          <p className="text-xs text-slate-400">15%</p>
                          <span className="text-sm font-bold text-teal-400 mt-1 block">{formatCurrency(historyTotals.totalPerPassengerCommission)}</span>
                          <p className="text-xs text-slate-400">Comisión</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Gastos Totales</p>
                        <p className="text-xl font-bold text-orange-400">
                          {formatCurrency(historyTotals.totalExpenses)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Recaudado</p>
                        <p className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">
                          {formatCurrency(historyTotals.totalDeliveredAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">En Empresa</p>
                        <p className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                          {formatCurrency(historyTotals.totalAmountSettled)}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {history.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No hay cálculos guardados.</p>
              ) : (
                <div className="mt-6">
                  <button onClick={() => setIsRecordListOpen(!isRecordListOpen)} className="w-full flex justify-between items-center text-left p-3 bg-slate-900/50 rounded-lg hover:bg-slate-700/50 transition-colors duration-200">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-slate-300">Registros Diarios</h3>
                      <span className="text-sm bg-slate-700 text-slate-300 font-semibold px-2 py-0.5 rounded-full">{history.length} registros</span>
                    </div>
                    <ChevronDownIcon className={`transform transition-transform duration-300 ${isRecordListOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isRecordListOpen ? 'max-h-[5000px] mt-4' : 'max-h-0'}`}>
                    <div className="md:border md:border-slate-700 md:rounded-lg md:max-h-[70vh] md:overflow-y-auto md:relative">
                      <HistoryTableHeader />
                      <ul className="space-y-4 md:space-y-0">
                        {history.map((entry, index) => {
                          const isExpanded = expandedId === entry.id;
                          return (
                            <li key={entry.id} className="md:border-b md:border-slate-700 last:md:border-b-0">
                              <div className="md:hidden bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                                <button onClick={() => handleToggleExpand(entry.id)} className="w-full p-4 text-left bg-slate-800 hover:bg-teal-500/10 transition-colors duration-200">
                                  <div className="flex justify-between items-start gap-4">
                                    <div>
                                      <p className="font-semibold text-slate-300">{formatTimestamp(entry.timestamp)}</p>
                                      <p className="text-sm text-slate-400">Ruta {entry.formData.route}</p>
                                    </div>
                                    <ChevronDownIcon className={`transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''} flex-shrink-0 mt-1`} />
                                  </div>
                                  <div className="mt-3 pt-3 border-t border-slate-700/50 flex justify-between items-end">
                                    <div>
                                      <p className="text-xs text-slate-400">Ganancia</p>
                                      <p className="font-bold text-green-400 text-lg leading-tight">{formatCurrency(entry.results.myEarnings)}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xs text-slate-400">Recaudado</p>
                                      <p className="font-semibold text-indigo-400 text-base leading-tight">{formatCurrency(entry.results.totalDeliveredAmount || 0)}</p>
                                    </div>
                                  </div>
                                </button>

                                <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[500px]' : 'max-h-0'}`}>
                                  <div className="px-4 pb-4 border-t border-teal-500/20">
                                    {editingTimestampId === entry.id ? (
                                      <div className="flex items-center gap-2 my-3">
                                        <input type="datetime-local" value={tempTimestamp} onChange={(e) => setTempTimestamp(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-md p-1 text-white focus:ring-teal-500 focus:border-teal-500 w-full" aria-label="Editar fecha y hora" />
                                        <button onClick={() => handleEditTimestampSave(entry.id)} title="Guardar" aria-label="Guardar fecha y hora" className="p-2 rounded-full bg-slate-700 hover:bg-green-600 text-slate-300 hover:text-white transition-colors duration-200"><CheckIcon /></button>
                                        <button onClick={handleEditTimestampCancel} title="Cancelar" aria-label="Cancelar edición" className="p-2 rounded-full bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white transition-colors duration-200"><XIcon /></button>
                                      </div>
                                    ) : (
                                      <div className="flex justify-end pt-2">
                                        <button onClick={() => handleEditTimestampStart(entry.id, entry.timestamp)} title="Editar fecha" aria-label="Editar fecha" className="p-1 rounded-full text-slate-500 hover:bg-slate-700 hover:text-white transition-colors duration-200 flex items-center text-xs">
                                          <EditIcon /> <span className="ml-1">Editar Fecha</span>
                                        </button>
                                      </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mt-3">
                                      <div><p className="text-slate-400">Pasajeros</p><p className="font-bold text-white text-base">{parseFormattedNumber(entry.formData.numPassengers)}</p></div>
                                      <div><p className="text-slate-400">Gastos</p><p className="font-bold text-amber-400 text-base">{formatCurrency(entry.results.totalExpenses)}</p></div>
                                      <div className="col-span-2">
                                        <p className="text-slate-400">Desglose Ganancia</p>
                                        <div className="text-xs mt-1 text-slate-400 grid grid-cols-[auto_1fr] gap-x-4">
                                          <span>↳ Fija ({entry.formData.fixedCommission}%):</span><span className="font-medium text-sky-300 text-right">{formatCurrency(entry.results.fixedCommissionValue)}</span>
                                          <span>↳ Pasajeros:</span><span className="font-medium text-teal-300 text-right">{formatCurrency(entry.results.perPassengerCommissionValue)}</span>
                                        </div>
                                      </div>
                                      <div className="col-span-2"><p className="text-slate-400">En Empresa</p><p className="font-bold text-blue-400 text-base">{formatCurrency(entry.results.amountToSettle)}</p></div>
                                    </div>
                                    <div className="flex items-center space-x-2 mt-4 justify-start border-t border-slate-700 pt-3">
                                      <button onClick={() => handleMoveEntryUp(entry.id)} title="Mover hacia arriba" aria-label="Mover hacia arriba" disabled={index === 0} className="p-2 rounded-full bg-slate-700 hover:bg-sky-600 text-slate-300 hover:text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"><ArrowUpIcon /></button>
                                      <button onClick={() => handleMoveEntryDown(entry.id)} title="Mover hacia abajo" aria-label="Mover hacia abajo" disabled={index === history.length - 1} className="p-2 rounded-full bg-slate-700 hover:bg-sky-600 text-slate-300 hover:text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"><ArrowDownIcon /></button>
                                      <button onClick={() => handleLoadEntry(entry.id)} title="Cargar este cálculo" aria-label="Cargar este cálculo" className="p-2 rounded-full bg-slate-700 hover:bg-cyan-600 text-slate-300 hover:text-white transition-colors duration-200"><LoadIcon /></button>
                                      <button onClick={() => handleDeleteEntry(entry.id)} title="Borrar este cálculo" aria-label="Borrar este cálculo" className="p-2 rounded-full bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white transition-colors duration-200"><TrashIcon /></button>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="hidden md:p-4 md:grid md:grid-cols-9 md:gap-x-4 md:items-center bg-transparent even:bg-slate-900/60 odd:bg-transparent hover:bg-teal-500/10 transition-colors duration-200 group">
                                <div className="md:col-span-2">
                                  {editingTimestampId === entry.id ? (
                                    <div className="flex items-center gap-2">
                                      <input type="datetime-local" value={tempTimestamp} onChange={(e) => setTempTimestamp(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-md p-1 text-white focus:ring-teal-500 focus:border-teal-500 w-full" aria-label="Editar fecha y hora" />
                                      <button onClick={() => handleEditTimestampSave(entry.id)} title="Guardar" aria-label="Guardar fecha y hora" className="p-2 rounded-full bg-slate-700 hover:bg-green-600 text-slate-300 hover:text-white transition-colors duration-200"><CheckIcon /></button>
                                      <button onClick={handleEditTimestampCancel} title="Cancelar" aria-label="Cancelar edición" className="p-2 rounded-full bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white transition-colors duration-200"><XIcon /></button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold text-slate-300 group-hover:text-white">{formatTimestamp(entry.timestamp)}</p>
                                      <button onClick={() => handleEditTimestampStart(entry.id, entry.timestamp)} title="Editar fecha" aria-label="Editar fecha" className="p-1 rounded-full text-slate-500 hover:bg-slate-700 hover:text-white transition-colors duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"><EditIcon /></button>
                                    </div>
                                  )}
                                </div>
                                <div className="font-bold text-teal-400 text-base">{entry.formData.route}</div>
                                <div className="font-bold text-white text-base">{parseFormattedNumber(entry.formData.numPassengers)}</div>
                                <div className="text-center text-sm">
                                  <p className="font-bold text-green-400 text-base">{formatCurrency(entry.results.myEarnings)}</p>
                                  <p className="text-xs text-sky-300">{formatCurrency(entry.results.fixedCommissionValue)} ({entry.formData.fixedCommission}%)</p>
                                  <p className="text-xs text-teal-300">{formatCurrency(entry.results.perPassengerCommissionValue)} (Pasajeros)</p>
                                </div>
                                <div className="font-bold text-amber-400 text-base text-center">{formatCurrency(entry.results.totalExpenses)}</div>
                                <div className="font-bold text-indigo-400 text-base text-center">{formatCurrency(entry.results.totalDeliveredAmount || 0)}</div>
                                <div className="font-bold text-blue-400 text-base text-center">{formatCurrency(entry.results.amountToSettle)}</div>
                                <div className="flex items-center space-x-2 justify-end">
                                  <button onClick={() => handleMoveEntryUp(entry.id)} title="Mover hacia arriba" aria-label="Mover hacia arriba" disabled={index === 0} className="p-2 rounded-full bg-slate-700 hover:bg-sky-600 text-slate-300 hover:text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"><ArrowUpIcon /></button>
                                  <button onClick={() => handleMoveEntryDown(entry.id)} title="Mover hacia abajo" aria-label="Mover hacia abajo" disabled={index === history.length - 1} className="p-2 rounded-full bg-slate-700 hover:bg-sky-600 text-slate-300 hover:text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"><ArrowDownIcon /></button>
                                  <button onClick={() => handleLoadEntry(entry.id)} title="Cargar este cálculo" aria-label="Cargar este cálculo" className="p-2 rounded-full bg-slate-700 hover:bg-cyan-600 text-slate-300 hover:text-white transition-colors duration-200"><LoadIcon /></button>
                                  <button onClick={() => handleDeleteEntry(entry.id)} title="Borrar este cálculo" aria-label="Borrar este cálculo" className="p-2 rounded-full bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white transition-colors duration-200"><TrashIcon /></button>
                                </div>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <VehicleMaintenanceManager records={maintenanceRecords} setRecords={setMaintenanceRecords} />

        <DocumentManager documents={documents} setDocuments={setDocuments} />

        <RobotModal
          isOpen={isRobotModalOpen}
          onClose={() => setIsRobotModalOpen(false)}
          vehicles={gpsVehicles}
          status={gpsStatus}
          deduction={passengerDeduction}
          onDeductionChange={setPassengerDeduction}
          onUpdate={fetchGpsData}
          onSelectPassengers={(passengers) => {
            setFormData(prev => ({ ...prev, numPassengers: formatNumberWithDots(passengers) }));
            setIsRobotModalOpen(false);
            setToastMessage('Pasajeros actualizados desde Robot GPS');
          }}
        />

        <div
          className="fixed right-6 sm:right-8 z-40 flex flex-col items-end gap-3 transition-[bottom] duration-300 ease-in-out"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          style={{
            bottom: fabBottom,
            transform: `translate(${position.x}px, ${position.y}px)`,
            cursor: isDragging ? 'grabbing' : 'grab',
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          <button
            onClick={handleSaveCalculation}
            disabled={showSaveSuccessAnim}
            className={`py-2 px-4 text-white rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 text-sm font-semibold ${showSaveSuccessAnim
              ? 'bg-green-500 scale-110'
              : 'bg-gradient-to-br from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 hover:scale-105 focus:ring-purple-500/50'
              }`}
            title={editingId ? 'Actualizar Datos' : 'Guardar Datos'}
            aria-label={editingId ? 'Actualizar Datos' : 'Guardar Datos'}
          >
            {showSaveSuccessAnim ? <CheckIcon /> : (editingId ? 'Actualizar' : 'Guardar')}
          </button>
          <button
            onClick={handleClearForm}
            disabled={showSaveSuccessAnim}
            className="py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-4 focus:ring-slate-600/50 text-sm font-semibold disabled:opacity-50"
            title={editingId ? 'Cancelar Edición' : 'Limpiar Formulario'}
            aria-label={editingId ? 'Cancelar Edición' : 'Limpiar Formulario'}
          >
            {editingId ? 'Cancelar' : 'Limpiar'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default App;
