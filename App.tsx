
import React, { useState, useEffect, useCallback, useMemo } from 'react';

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
  myEarnings: number;
  totalExpenses: number;
  amountToSettle: number;
  fixedCommissionValue: number;
  perPassengerCommissionValue: number;
}

interface HistoryEntry {
  id: string;
  timestamp: string;
  formData: FormData;
  results: CalculationResults;
}

const INITIAL_FORM_DATA: Omit<FormData, 'administrativeExpenses'> = {
  numPassengers: '',
  fareValue: '3.000',
  fixedCommission: '15',
  commissionPerPassenger: '100',
  route: '9',
  fuelExpenses: '',
  variableExpenses: '20.000',
};

const PASSENGER_GOAL = 5500;
const ADMIN_EXPENSE_DAYS_LIMIT = 20;
const ADMIN_EXPENSE_VALUE = '109.165';


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

const loadHistoryFromLocalStorage = (): HistoryEntry[] => {
  try {
    const savedHistory = localStorage.getItem('earningsCalculatorHistory');
    return savedHistory ? JSON.parse(savedHistory) : [];
  } catch (error) {
    console.error("Error loading history from localStorage:", error);
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

const WrenchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const BriefcaseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
);

const SaveIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
);

const RestoreIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 4l16 16" />
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

// --- REUSABLE UI COMPONENTS ---
interface InputControlProps {
  label: string;
  name: keyof FormData;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  icon: React.ReactNode;
  unit?: string;
  isNumericFormatted?: boolean;
  disabled?: boolean;
}

const InputControl: React.FC<InputControlProps> = ({ label, name, value, onChange, placeholder = '0', icon, unit, isNumericFormatted = false, disabled = false }) => (
  <div className="mb-4">
    <label htmlFor={name} className="block text-base font-semibold text-gray-300 mb-2 tracking-wide">
      {label}
    </label>
    <div className={`flex items-center border border-gray-700 rounded-lg transition-all duration-200 ${disabled ? 'bg-gray-700/50' : 'bg-gray-800 focus-within:ring-2 focus-within:ring-cyan-500'}`}>
      <div className="pl-3 text-gray-500 pointer-events-none">{icon}</div>
      <div className="relative flex-grow">
        <input
          type={isNumericFormatted ? 'text' : 'number'}
          inputMode={isNumericFormatted ? 'numeric' : 'decimal'}
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full bg-transparent py-3 pl-3 ${unit ? 'pr-8' : 'pr-3'} placeholder-gray-500 focus:outline-none ${disabled ? 'cursor-not-allowed text-gray-400' : 'text-white'}`}
          onFocus={(e) => e.target.select()}
          min="0"
          aria-label={label}
          disabled={disabled}
        />
        {unit && (
          <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  </div>
);


interface CheckboxControlGroupProps {
  label: string;
  name: keyof FormData;
  value: string;
  onChange: (e: { target: { name: keyof FormData; value: string } }) => void;
  icon: React.ReactNode;
  options: string[];
}

const CheckboxControlGroup: React.FC<CheckboxControlGroupProps> = ({ label, name, value, onChange, icon, options }) => {
  const handleCheckboxChange = (optionValue: string) => {
    onChange({ target: { name, value: optionValue } });
  };

  return (
    <div className="mb-4 sm:col-span-2">
      <label className="block text-base font-semibold text-gray-300 mb-3 tracking-wide">
        {label}
      </label>
      <div className="relative flex items-center">
        <div className="absolute left-0 pl-3 text-gray-500 pointer-events-none">{icon}</div>
        <div className="pl-10 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
          {options.map(option => (
            <div key={option}>
              <input
                type="checkbox"
                id={`${name}-${option}`}
                name={name}
                value={option}
                checked={value === option}
                onChange={() => handleCheckboxChange(option)}
                className="hidden peer"
                aria-labelledby={`label-${name}-${option}`}
              />
              <label
                id={`label-${name}-${option}`}
                htmlFor={`${name}-${option}`}
                className="w-full block text-center py-2 px-4 border border-gray-700 rounded-lg cursor-pointer transition-all duration-200 font-semibold bg-gray-800 text-gray-400 peer-checked:bg-cyan-600 peer-checked:text-white peer-checked:border-cyan-500 hover:border-gray-500 peer-checked:hover:bg-cyan-700"
              >
                {option}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface ResultDisplayProps {
  label: string;
  value: number;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ label, value }) => {
  const formattedValue = formatCurrency(value);

  const valueColor = label.includes('Sueldo') ? 'from-green-400 to-cyan-400' : 
                     label.includes('Gastos') ? 'from-amber-400 to-red-500' :
                     'from-blue-400 to-purple-400';

  return (
    <div className="bg-gray-800/50 p-5 rounded-lg flex justify-between items-center mb-4 border border-gray-700 shadow-inner">
      <span className="text-gray-300 text-lg font-medium">{label}</span>
      <span className={`text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${valueColor}`}>
        {formattedValue}
      </span>
    </div>
  );
};

interface PassengerGoalProgressProps {
  totalPassengers: number;
  goal: number;
}

const PassengerGoalProgress: React.FC<PassengerGoalProgressProps> = ({ totalPassengers, goal }) => {
  const remaining = Math.max(0, goal - totalPassengers);
  const percentage = Math.min(100, (totalPassengers / goal) * 100);

  const getMotivationalMessage = () => {
    if (percentage >= 100) return "¡Meta cumplida y superada! ¡Excelente trabajo!";
    if (percentage >= 80) return "¡Ya casi lo logras, sigue así!";
    if (percentage >= 50) return "¡Vas por la mitad del camino! ¡Buen ritmo!";
    return "¡Un gran viaje comienza con un solo paso!";
  };

  return (
    <div className="mb-6 p-5 bg-gray-900/50 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between mb-3">
         <h3 className="text-lg font-bold text-gray-300 flex items-center">
            <UsersIcon />
            <span className="ml-2">Meta Mensual de Pasajeros</span>
         </h3>
         <span className="font-bold text-lg text-cyan-400">{percentage.toFixed(1)}%</span>
      </div>

      <div className="w-full bg-gray-700 rounded-full h-4 mb-3 overflow-hidden">
        <div
          className="bg-gradient-to-r from-cyan-400 to-blue-600 h-4 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        ></div>
      </div>

      <div className="flex justify-between text-sm text-gray-400 font-medium">
        <span>Actual: <span className="text-white font-bold">{totalPassengers.toLocaleString('es-CO')}</span></span>
        <span>Faltan: <span className="text-amber-400 font-bold">{remaining.toLocaleString('es-CO')}</span></span>
        <span>Meta: <span className="text-green-400 font-bold">{goal.toLocaleString('es-CO')}</span></span>
      </div>
       <p className="text-center text-sm text-gray-400 mt-4 italic">{getMotivationalMessage()}</p>
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
      }, 5000); // Auto-dismiss after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className={`fixed top-5 right-5 z-50 transition-all duration-300 ease-in-out ${
        show ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      }`}
    >
      {show && (
        <div role="alert" className="flex items-center p-4 max-w-sm bg-gray-800 text-white rounded-lg shadow-lg border border-cyan-500/50">
          <CheckCircleIcon />
          <div className="ml-3 text-sm font-normal">{message}</div>
        </div>
      )}
    </div>
  );
};


// --- MAIN APP COMPONENT ---
const App: React.FC = () => {
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistoryFromLocalStorage());
  
  const getInitialFormData = useCallback((): FormData => {
    const isPastAdminLimit = history.length >= ADMIN_EXPENSE_DAYS_LIMIT;
    return {
      ...INITIAL_FORM_DATA,
      administrativeExpenses: isPastAdminLimit ? '0' : ADMIN_EXPENSE_VALUE,
    };
  }, [history.length]);

  const [formData, setFormData] = useState<FormData>(getInitialFormData);
  const [results, setResults] = useState<CalculationResults>({ myEarnings: 0, totalExpenses: 0, amountToSettle: 0, fixedCommissionValue: 0, perPassengerCommissionValue: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [usedPhrases, setUsedPhrases] = useState<string[]>([]);

  useEffect(() => {
    saveHistoryToLocalStorage(history);
  }, [history]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string } }) => {
    const { name, value } = e.target;
    const fieldsToFormat: (keyof FormData)[] = ['fareValue', 'commissionPerPassenger', 'fuelExpenses', 'variableExpenses', 'administrativeExpenses'];
    
    const isFormatted = fieldsToFormat.includes(name as keyof FormData);
    setFormData(prev => ({ ...prev, [name]: isFormatted ? formatNumberWithDots(value) : value }));
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
    const calculatedTotalExpenses = fuelExpenses + variableExpenses + administrativeExpenses;
    const amountToSettle = totalRevenue - driverEarnings - calculatedTotalExpenses;

    setResults({
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

  const handleClearForm = () => {
      setFormData(getInitialFormData());
      setEditingId(null);
  }

  const handleSaveCalculation = () => {
    const rawData = getRawData(formData);
    if (rawData.numPassengers === 0) {
      alert("No se puede guardar un cálculo sin pasajeros.");
      return;
    }

    if (editingId) {
      setHistory(prevHistory => 
        prevHistory.map(entry => 
          entry.id === editingId
            ? {
                ...entry,
                formData,
                results,
              }
            : entry
        )
      );
      setEditingId(null);
    } else {
      const newEntry: HistoryEntry = {
        id: new Date().toISOString(),
        timestamp: new Date().toLocaleString('es-CO', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        }),
        formData,
        results,
      };
      setHistory(prevHistory => [newEntry, ...prevHistory]);
    }
    showMotivationalToast();
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
    if (editingId) {
        // If deleting the entry being edited, clear the form as well
        const entryToDelete = history.find(entry => entry.id === id);
        if (entryToDelete && entryToDelete.id === editingId) {
            handleClearForm();
        }
    }
    setHistory(prevHistory => prevHistory.filter(entry => entry.id !== id));
  };
  
  const handleClearAllHistory = () => {
    const isConfirmed = window.confirm(
      "¿Estás seguro de que quieres borrar todo el historial? Esta acción no se puede deshacer."
    );
    if (isConfirmed) {
      setHistory([]);
      handleClearForm(); // Also reset the form
    }
  };

  const historyTotals = useMemo(() => {
    return history.reduce((acc, entry) => {
      acc.totalEarnings += entry.results.myEarnings;
      acc.totalExpenses += entry.results.totalExpenses;
      acc.totalAmountSettled += entry.results.amountToSettle;
      acc.totalPassengers += parseFloat(parseFormattedNumber(entry.formData.numPassengers)) || 0;
      acc.totalFixedCommission += entry.results.fixedCommissionValue || 0;
      acc.totalPerPassengerCommission += entry.results.perPassengerCommissionValue || 0;
      return acc;
    }, { 
        totalEarnings: 0, 
        totalExpenses: 0, 
        totalAmountSettled: 0, 
        totalPassengers: 0,
        totalFixedCommission: 0,
        totalPerPassengerCommission: 0,
    });
  }, [history]);

  const isAdministrativeExpenseLocked = history.length < ADMIN_EXPENSE_DAYS_LIMIT;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
      <Toast 
        message={toastMessage} 
        show={!!toastMessage} 
        onClose={() => setToastMessage('')} 
      />
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
            Calculadora de Ganancias
          </h1>
          <p className="text-gray-400 mt-2 text-lg">Para conductores de bus</p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Columna de Entradas */}
          <div className="lg:col-span-3 bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700">
            <h2 className="text-2xl font-bold mb-6 text-cyan-400">Datos del Día</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <InputControl label="Número de Pasajeros" name="numPassengers" value={formData.numPassengers} onChange={handleChange} icon={<UsersIcon />} />
                <InputControl label="Valor del Pasaje" name="fareValue" value={formData.fareValue} onChange={handleChange} icon={<MoneyIcon />} unit="$" isNumericFormatted />
                <InputControl label="Comisión Fija" name="fixedCommission" value={formData.fixedCommission} onChange={handleChange} icon={<PercentageIcon />} unit="%" />
                <InputControl label="Comisión por Pasajero" name="commissionPerPassenger" value={formData.commissionPerPassenger} onChange={handleChange} icon={<MoneyIcon />} unit="$" isNumericFormatted />
                <CheckboxControlGroup label="Ruta" name="route" value={formData.route} onChange={handleChange} icon={<RouteIcon />} options={['9', '11', '29', '60']} />
            </div>
            
            <h2 className="text-2xl font-bold mb-6 mt-8 text-amber-400">Gastos del Día</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <InputControl label="Combustible" name="fuelExpenses" value={formData.fuelExpenses} onChange={handleChange} icon={<FuelIcon />} unit="$" isNumericFormatted />
                <InputControl label="Taller (Lavada,Tencioanda,Engrase,etc.)" name="variableExpenses" value={formData.variableExpenses} onChange={handleChange} icon={<WrenchIcon />} unit="$" isNumericFormatted placeholder="Valor Total" />
                <InputControl 
                  label="Gastos Administrativos" 
                  name="administrativeExpenses" 
                  value={formData.administrativeExpenses} 
                  onChange={handleChange} 
                  icon={<BriefcaseIcon />} 
                  unit="$" 
                  isNumericFormatted 
                  disabled={isAdministrativeExpenseLocked}
                />
            </div>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <button onClick={handleSaveCalculation} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 flex items-center justify-center">
                    <SaveIcon />
                    {editingId ? 'Actualizar Datos' : 'Guardar Datos'}
                </button>
                 <button onClick={handleClearForm} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300">
                    {editingId ? 'Cancelar Edición' : 'Limpiar Formulario'}
                </button>
            </div>
          </div>

          {/* Columna de Resultados */}
          <div className="lg:col-span-2 bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 flex flex-col justify-center">
            <h2 className="text-2xl font-bold mb-6 text-green-400">Resumen</h2>
            <ResultDisplay label="Mi Sueldo" value={results.myEarnings} />
            <ResultDisplay label="Gastos Operativos" value={results.totalExpenses} />
            <ResultDisplay label="Total A Entregar" value={results.amountToSettle} />
          </div>
        </main>
        
        {/* History Section */}
        <section className="mt-10">
            <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6">
                    <h2 className="text-2xl font-bold text-cyan-400 mb-4 sm:mb-0">Historial</h2>
                     {history.length > 0 && (
                        <button onClick={handleClearAllHistory} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center text-sm">
                            <TrashIcon />
                            <span className="ml-2">Borrar Historial</span>
                        </button>
                    )}
                </div>

                {history.length > 0 && (
                  <>
                    <PassengerGoalProgress 
                      totalPassengers={historyTotals.totalPassengers} 
                      goal={PASSENGER_GOAL} 
                    />
                    <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                        <h3 className="text-lg font-bold text-gray-300 mb-3 text-center">Resumen Total del Historial</h3>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                            <div>
                                <p className="text-sm text-gray-400">Ganancia Total</p>
                                <p className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">
                                    {formatCurrency(historyTotals.totalEarnings)}
                                </p>
                                 <div className="flex justify-center space-x-6 mt-2">
                                    <div className="text-center">
                                        <span className="text-lg font-bold text-sky-400">{formatCurrency(historyTotals.totalFixedCommission)}</span>
                                        <p className="text-xs text-gray-400">15%</p>
                                    </div>
                                    <div className="text-center">
                                        <span className="text-lg font-bold text-teal-400">{formatCurrency(historyTotals.totalPerPassengerCommission)}</span>
                                        <p className="text-xs text-gray-400">Comisión</p>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">Gastos Totales</p>
                                <p className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-red-500">
                                    {formatCurrency(historyTotals.totalExpenses)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">Total Entregado</p>
                                <p className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                                    {formatCurrency(historyTotals.totalAmountSettled)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">Pasajeros Totales</p>
                                <p className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-teal-400">
                                    {historyTotals.totalPassengers.toLocaleString('es-CO')}
                                </p>
                            </div>
                        </div>
                    </div>
                  </>
                )}

                {history.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No hay cálculos guardados.</p>
                ) : (
                    <ul className="space-y-4 mt-6">
                        {history.map((entry) => (
                           <li key={entry.id} className="bg-gray-900/60 p-4 rounded-lg border border-gray-700 hover:border-cyan-500 transition-all duration-200 group">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-start w-full">
                                    <div className="flex-grow">
                                        <p className="font-semibold text-gray-300 group-hover:text-white mb-3">{entry.timestamp}</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-2 text-sm">
                                            <div>
                                                <p className="text-gray-400">Ruta</p>
                                                <p className="font-bold text-cyan-400 text-base">{entry.formData.route}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-400">Pasajeros</p>
                                                <p className="font-bold text-white text-base">{parseFormattedNumber(entry.formData.numPassengers)}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-400">Ganancia</p>
                                                <p className="font-bold text-green-400 text-base">{formatCurrency(entry.results.myEarnings)}</p>
                                                <div className="flex space-x-4 mt-1">
                                                    <p className="text-base"><span className="text-gray-400">15%:</span> <span className="font-semibold text-sky-300">{formatCurrency(entry.results.fixedCommissionValue)}</span></p>
                                                    <p className="text-base"><span className="text-gray-400">Comisión:</span> <span className="font-semibold text-teal-300">{formatCurrency(entry.results.perPassengerCommissionValue)}</span></p>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-gray-400">Gastos</p>
                                                <p className="font-bold text-amber-400 text-base">{formatCurrency(entry.results.totalExpenses)}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-400">A Entregar</p>
                                                <p className="font-bold text-blue-400 text-base">{formatCurrency(entry.results.amountToSettle)}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-3 mt-4 sm:mt-0 sm:ml-4 flex-shrink-0 self-end sm:self-center">
                                        <button onClick={() => handleLoadEntry(entry.id)} title="Cargar este cálculo" aria-label="Cargar este cálculo" className="p-2 rounded-full bg-gray-700 hover:bg-cyan-600 text-gray-300 hover:text-white transition-colors duration-200">
                                            <RestoreIcon />
                                        </button>
                                        <button onClick={() => handleDeleteEntry(entry.id)} title="Borrar este cálculo" aria-label="Borrar este cálculo" className="p-2 rounded-full bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white transition-colors duration-200">
                                            <TrashIcon />
                                        </button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>

      </div>
    </div>
  );
};

export default App;
