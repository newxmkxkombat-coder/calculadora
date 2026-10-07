import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalculationResults, FormData, HistoryEntry, ManagedDocument, MaintenanceRecord, PocketMove } from './types';
import { MOTIVATIONAL_PHRASES, STORAGE_KEYS } from './constants';
import { calculateResults, getRawData } from './utils/calc';
import { formatCurrency, formatNumberWithDots, getLocalDateString, parseFormattedNumber } from './utils/format';
import { calculateRouteForDate } from './utils/route';
import { DEFAULT_CONFIG, loadConfig, loadHistory, loadJSON, saveJSON } from './utils/storage';
import { usePersistentState } from './hooks/usePersistentState';
import { useGpsRobot } from './hooks/useGpsRobot';
import { useKeyboardOpen } from './hooks/useKeyboardOpen';
import { useTheme } from './hooks/useTheme';
import { sendPreoperacional } from './services/preoperacional';
import { BackupManager } from './components/backup/BackupManager';
import { CalendarModal } from './components/calendar/CalendarModal';
import { DocumentAlerts } from './components/documents/DocumentAlerts';
import { DocumentManager } from './components/documents/DocumentManager';
import { DayForm } from './components/form/DayForm';
import { HistorySection } from './components/history/HistorySection';
import { ActionBar } from './components/layout/ActionBar';
import { Header } from './components/layout/Header';
import { Toast } from './components/layout/Toast';
import { VehicleMaintenanceManager } from './components/maintenance/VehicleMaintenanceManager';
import { PocketModal } from './components/pocket/PocketModal';
import { RobotModal } from './components/robot/RobotModal';
import { PeriodSummary } from './components/summary/PeriodSummary';

const FUEL_MAX_DIGITS = 6;
const PASSENGERS_MAX_DIGITS = 3;

/** Texto del movimiento que entra a Mi Bolsillo al guardar un día. */
const dayPocketConcept = (isoTimestamp: string) =>
  `Sueldo del día ${new Date(isoTimestamp).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' })}`;

const getInitialFormData = (): FormData => {
  const config = loadConfig();
  return {
    numPassengers: '',
    fareValue: config.fareValue,
    fixedCommission: '15',
    fuelExpenses: '',
    route: calculateRouteForDate(new Date().toISOString()),
    commissionPerPassenger: config.commissionPerPassenger,
    variableExpenses: config.variableExpenses,
    administrativeExpenses: config.administrativeExpenses,
  };
};

/** Si dejaste un día a medias (y cerraste la app), se recupera el borrador de hoy. */
const getStartingFormData = (): FormData => {
  const base = getInitialFormData();
  const draft = loadJSON<{ date: string; formData: FormData } | null>(STORAGE_KEYS.draft, null);
  if (draft && draft.date === getLocalDateString() && draft.formData) return { ...base, ...draft.formData };
  return base;
};

const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { isKeyboardOpen, onFocus } = useKeyboardOpen();
  const gps = useGpsRobot();

  const [history, setHistory] = usePersistentState<HistoryEntry[]>(STORAGE_KEYS.history, loadHistory);
  const [documents, setDocuments] = usePersistentState<ManagedDocument[]>(STORAGE_KEYS.documents, () => loadJSON(STORAGE_KEYS.documents, []));
  const [maintenanceRecords, setMaintenanceRecords] = usePersistentState<MaintenanceRecord[]>(STORAGE_KEYS.maintenance, () => loadJSON(STORAGE_KEYS.maintenance, []));
  const [pocketMoves, setPocketMoves] = usePersistentState<PocketMove[]>(STORAGE_KEYS.pocket, () => loadJSON(STORAGE_KEYS.pocket, []));
  const [customMaintenanceTypes, setCustomMaintenanceTypes] = usePersistentState<string[]>(STORAGE_KEYS.customTypes, () => loadJSON(STORAGE_KEYS.customTypes, []));
  const [passengerGoal, setPassengerGoal] = useState<number>(() => loadConfig().passengerGoal);
  const [passengerDeduction, setPassengerDeduction] = useState<string>(() => localStorage.getItem(STORAGE_KEYS.passengerDeduction) || '');

  const [formData, setFormData] = useState<FormData>(getStartingFormData);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [usedPhrases, setUsedPhrases] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isRobotModalOpen, setIsRobotModalOpen] = useState(false);
  const [isRecordsOpen, setIsRecordsOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isPocketOpen, setIsPocketOpen] = useState(false);

  const fuelInputRef = useRef<HTMLInputElement>(null);

  const results: CalculationResults = useMemo(() => calculateResults(formData), [formData]);

  // --- Persistencia de ajustes y borrador ---
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.passengerDeduction, passengerDeduction);
  }, [passengerDeduction]);

  useEffect(() => {
    saveJSON(STORAGE_KEYS.config, {
      ...DEFAULT_CONFIG,
      fareValue: formData.fareValue,
      commissionPerPassenger: formData.commissionPerPassenger,
      variableExpenses: formData.variableExpenses,
      administrativeExpenses: formData.administrativeExpenses,
      passengerGoal,
    });
  }, [formData.fareValue, formData.commissionPerPassenger, formData.variableExpenses, formData.administrativeExpenses, passengerGoal]);

  useEffect(() => {
    if (editingId) return;
    if (formData.numPassengers || formData.fuelExpenses) {
      saveJSON(STORAGE_KEYS.draft, { date: getLocalDateString(), formData });
    } else {
      localStorage.removeItem(STORAGE_KEYS.draft);
    }
  }, [formData, editingId]);

  // --- Formulario ---
  const handleChange = useCallback((e: { target: { name: string; value: string } }) => {
    const { name, value } = e.target;
    const moneyFields = ['fareValue', 'commissionPerPassenger', 'fuelExpenses', 'variableExpenses', 'administrativeExpenses'];
    const numericOnlyFields = ['numPassengers', 'fixedCommission'];

    let processedValue = value;
    if (moneyFields.includes(name)) {
      let cleanValue = parseFormattedNumber(value);
      if (name === 'fuelExpenses') {
        cleanValue = cleanValue.slice(0, FUEL_MAX_DIGITS);
        if (cleanValue.length === FUEL_MAX_DIGITS) {
          // Combustible completo: se cierra el teclado y se sube para ver la entrega.
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
      processedValue = formatNumberWithDots(cleanValue);
    } else if (numericOnlyFields.includes(name)) {
      processedValue = value.replace(/[^\d]/g, '');
      if (name === 'numPassengers') {
        processedValue = processedValue.slice(0, PASSENGERS_MAX_DIGITS);
        if (processedValue.length === PASSENGERS_MAX_DIGITS) {
          // Pasajeros completos: salta al campo de combustible.
          fuelInputRef.current?.focus();
          fuelInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }

    setFormData(prev => ({ ...prev, [name]: processedValue }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData(getInitialFormData());
    setEditingId(null);
  }, []);

  const handleClearForm = () => {
    const hasData = !editingId && (formData.numPassengers || formData.fuelExpenses);
    if (hasData && !window.confirm('¿Limpiar los datos que llevas escritos hoy?')) return;
    resetForm();
  };

  const showMotivationalToast = useCallback(() => {
    let available = MOTIVATIONAL_PHRASES.filter(p => !usedPhrases.includes(p));
    if (available.length === 0) {
      setUsedPhrases([]);
      available = MOTIVATIONAL_PHRASES;
    }
    const phrase = available[Math.floor(Math.random() * available.length)];
    setUsedPhrases(prev => [...prev, phrase]);
    setToastMessage(phrase);
  }, [usedPhrases]);

  const handleSaveCalculation = () => {
    if (isSaving) return;

    const rawData = getRawData(formData);
    if (rawData.numPassengers === 0) {
      alert('No se puede guardar un cálculo sin pasajeros.');
      return;
    }

    const grossAmountToSettle = results.amountToSettle;
    const resultsForHistory: CalculationResults = {
      ...results,
      amountToSettle: grossAmountToSettle - rawData.administrativeExpenses,
      totalDeliveredAmount: grossAmountToSettle,
    };

    // Tu sueldo del día (15% + $100 por pasajero) también va a Mi Bolsillo.
    if (editingId) {
      setHistory(prev => prev.map(entry => (entry.id === editingId ? { ...entry, formData, results: resultsForHistory } : entry)));
      setPocketMoves(prev => prev.map(move => (move.historyId === editingId ? { ...move, amount: results.myEarnings } : move)));
    } else {
      const now = new Date().toISOString();
      setHistory(prev => [{ id: now, timestamp: now, formData, results: resultsForHistory }, ...prev]);
      setPocketMoves(prev => [{ id: now, timestamp: now, concept: dayPocketConcept(now), amount: results.myEarnings, historyId: now }, ...prev]);
    }

    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      showMotivationalToast();
      resetForm();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 1200);
  };

  // --- Historial ---
  const handleChangeTimestamp = (id: string, isoTimestamp: string) => {
    setHistory(prev => prev
      .map(entry => (entry.id === id
        ? { ...entry, timestamp: isoTimestamp, formData: { ...entry.formData, route: calculateRouteForDate(isoTimestamp) } }
        : entry))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    setPocketMoves(prev => prev.map(move => (move.historyId === id ? { ...move, concept: dayPocketConcept(isoTimestamp) } : move)));
  };

  const handleLoadEntry = (id: string) => {
    const entry = history.find(e => e.id === id);
    if (!entry) return;
    setFormData(entry.formData);
    setEditingId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteEntry = (id: string) => {
    if (!window.confirm('¿Estás seguro de que quieres borrar este registro?')) return;
    if (editingId === id) resetForm();
    setHistory(prev => prev.filter(entry => entry.id !== id));
    // Si borras un día, su sueldo también sale de Mi Bolsillo.
    setPocketMoves(prev => prev.filter(move => move.historyId !== id));
  };

  const handleCopyEntry = (entry: HistoryEntry) => {
    const pasajeros = parseFormattedNumber(entry.formData.numPassengers);
    const ganancias = formatCurrency(entry.results.myEarnings);
    const combustible = formatCurrency(Number(parseFormattedNumber(entry.formData.fuelExpenses)));
    const recaudado = formatCurrency(entry.results.totalDeliveredAmount || 0);
    const soloFecha = new Date(entry.timestamp).toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });

    const texto = `*Liquidación - ${soloFecha}*\n*Pasajeros:* ${pasajeros}\n*Combustible:* ${combustible}\n*Ganancias:* ${ganancias}\n*Recaudado:* ${recaudado}`;

    navigator.clipboard.writeText(texto)
      .then(() => alert('¡Registro copiado! Ya puedes pegarlo en WhatsApp.'))
      .catch(() => alert('No se pudo copiar. Intenta de nuevo.'));
  };

  const handleClearAllHistory = () => {
    if (window.confirm('¿Estás seguro de que quieres borrar todo el historial? Esta acción no se puede deshacer.')) {
      setHistory([]);
      resetForm();
    }
  };

  const moveEntry = (id: string, direction: -1 | 1) => {
    setHistory(prev => {
      const index = prev.findIndex(entry => entry.id === id);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  // --- Mi Bolsillo ---
  const handleAddPocketMove = (concept: string, amount: number) => {
    const now = new Date().toISOString();
    setPocketMoves(prev => [{ id: now, timestamp: now, concept, amount }, ...prev]);
  };

  const handleDeletePocketMove = (id: string) => {
    if (!window.confirm('¿Borrar este movimiento de Mi Bolsillo?')) return;
    setPocketMoves(prev => prev.filter(move => move.id !== id));
  };

  // --- Robot GPS ---
  const openRobot = () => {
    setIsRobotModalOpen(true);
    gps.refresh();
  };

  const handleSelectPassengers = (passengers: string) => {
    setFormData(prev => ({ ...prev, numPassengers: formatNumberWithDots(passengers) }));
    setIsRobotModalOpen(false);
    setToastMessage('Pasajeros actualizados desde el GPS');
  };

  // --- Formulario Preoperacional: un toque y se envía solo ---
  const handleSendPreoperacional = () => {
    const today = getLocalDateString();
    if (localStorage.getItem(STORAGE_KEYS.preopLastSent) === today
      && !window.confirm('Hoy ya enviaste el preoperacional. ¿Enviarlo otra vez?')) return;
    sendPreoperacional();
    localStorage.setItem(STORAGE_KEYS.preopLastSent, today);
  };

  // El botón "Registros" del encabezado abre la lista y baja hasta ella.
  const goToRecords = () => {
    setIsRecordsOpen(true);
    setTimeout(() => document.getElementById('registros')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  // Al tocar un espacio vacío se cierra el teclado.
  const handleBackgroundClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('input, button, a, label, select')) return;
    if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
  };

  return (
    <div className="min-h-screen px-4 sm:px-6 pt-6 pb-32" onClick={handleBackgroundClick}>
      <DocumentAlerts documents={documents} />

      <div className="max-w-4xl mx-auto">
        <Header results={results} gpsStatus={gps.status} theme={theme} onToggleTheme={toggleTheme} onOpenRobot={openRobot} onGoToRecords={goToRecords} onSendPreop={handleSendPreoperacional} onOpenCalendar={() => setIsCalendarOpen(true)} onOpenPocket={() => setIsPocketOpen(true)} />

        <DayForm formData={formData} fuelInputRef={fuelInputRef} isEditing={!!editingId} onChange={handleChange} onFocus={onFocus} />

        <HistorySection
          history={history}
          passengerGoal={passengerGoal}
          isOpen={isRecordsOpen}
          onToggle={() => setIsRecordsOpen(open => !open)}
          onGoalChange={setPassengerGoal}
          onClearAll={handleClearAllHistory}
          onLoad={handleLoadEntry}
          onDelete={handleDeleteEntry}
          onCopy={handleCopyEntry}
          onMoveUp={id => moveEntry(id, -1)}
          onMoveDown={id => moveEntry(id, 1)}
          onChangeTimestamp={handleChangeTimestamp}
        />

        <PeriodSummary history={history} />

        <VehicleMaintenanceManager
          records={maintenanceRecords}
          setRecords={setMaintenanceRecords}
          customTypes={customMaintenanceTypes}
          setCustomTypes={setCustomMaintenanceTypes}
        />

        <DocumentManager documents={documents} setDocuments={setDocuments} />

        <BackupManager />
      </div>

      <RobotModal
        isOpen={isRobotModalOpen}
        onClose={() => setIsRobotModalOpen(false)}
        vehicles={gps.vehicles}
        status={gps.status}
        errorMessage={gps.errorMessage}
        deduction={passengerDeduction}
        onDeductionChange={setPassengerDeduction}
        onUpdate={gps.refresh}
        onSelectPassengers={handleSelectPassengers}
      />

      {isCalendarOpen && <CalendarModal onClose={() => setIsCalendarOpen(false)} />}

      {isPocketOpen && (
        <PocketModal moves={pocketMoves} onAdd={handleAddPocketMove} onDelete={handleDeletePocketMove} onClose={() => setIsPocketOpen(false)} />
      )}

      <Toast message={toastMessage} show={!!toastMessage} onClose={() => setToastMessage('')} />

      <ActionBar
        isEditing={!!editingId}
        isSaving={isSaving}
        hidden={isKeyboardOpen}
        onSave={handleSaveCalculation}
        onClear={handleClearForm}
      />
    </div>
  );
};

export default App;
