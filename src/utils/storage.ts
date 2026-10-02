import { AppConfig, HistoryEntry } from '../types';
import { PASSENGER_GOAL_DEFAULT, STORAGE_KEYS } from '../constants';
import { calculateRouteForDate } from './route';

export const loadJSON = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch (error) {
    console.error(`Error loading ${key} from localStorage:`, error);
    return fallback;
  }
};

export const saveJSON = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving ${key} to localStorage:`, error);
  }
};

/** Carga el historial y repara la ruta de cada registro según su fecha (patrón 60/29). */
export const loadHistory = (): HistoryEntry[] => {
  const history = loadJSON<HistoryEntry[]>(STORAGE_KEYS.history, []);
  if (!Array.isArray(history)) return [];
  return history.map(entry => ({
    ...entry,
    formData: { ...entry.formData, route: calculateRouteForDate(entry.timestamp) },
  }));
};

export const DEFAULT_CONFIG: AppConfig = {
  fareValue: '3.000',
  commissionPerPassenger: '100',
  variableExpenses: '20.000',
  administrativeExpenses: '109.165',
  passengerGoal: PASSENGER_GOAL_DEFAULT,
};

export const loadConfig = (): AppConfig => ({
  ...DEFAULT_CONFIG,
  ...loadJSON<Partial<AppConfig>>(STORAGE_KEYS.config, {}),
});
