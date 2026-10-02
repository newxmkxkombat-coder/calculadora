import React, { useEffect, useState } from 'react';
import { GpsStatus, GpsVehicle } from '../../types';
import { RobotIcon, TrashIcon } from '../icons';
import { Button, ModalShell } from '../ui';

interface RobotModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: GpsVehicle[];
  status: GpsStatus;
  errorMessage?: string;
  deduction: string;
  onDeductionChange: (val: string) => void;
  onSelectPassengers: (total: string) => void;
  onUpdate: () => void;
}

const toNumber = (passengers: string) => parseInt(passengers.replace(/\./g, ''), 10);

export const RobotModal: React.FC<RobotModalProps> = ({ isOpen, onClose, vehicles, status, errorMessage, deduction, onDeductionChange, onSelectPassengers, onUpdate }) => {
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (!isOpen || status !== 'loading') return;
    setTimer(0);
    const interval = setInterval(() => setTimer(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [isOpen, status]);

  if (!isOpen) return null;

  const deductionValue = parseInt(deduction, 10) || 0;

  const handleVehicleClick = (vehiclePassengers: string) => {
    const raw = toNumber(vehiclePassengers);
    if (!isNaN(raw)) onSelectPassengers(Math.max(0, raw + deductionValue).toString());
  };

  const changeDeduction = (amount: number) => onDeductionChange((deductionValue + amount).toString());

  const subtitle = status === 'loading' ? 'Actualizando...' : status === 'error' ? 'Error de conexión' : 'Conexión segura';

  return (
    <ModalShell
      title="Datos GPS"
      subtitle={subtitle}
      tone="violet"
      icon={<RobotIcon />}
      onClose={onClose}
      headerExtra={<Button variant="secondary" small onClick={onUpdate} disabled={status === 'loading'}>Actualizar</Button>}
    >
      <div className="mb-4 p-3 rounded-xl bg-field/50 border border-line/50 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
          <TrashIcon /> A descontar
        </span>
        <div className="flex items-center gap-2">
          <button onClick={() => changeDeduction(-1)} className="w-9 h-9 rounded-lg bg-raised/60 text-bad hover:bg-bad/15 active:scale-95 transition-all font-bold text-lg" aria-label="Restar uno">−</button>
          <input
            type="text"
            inputMode="numeric"
            value={deduction}
            onChange={e => onDeductionChange(e.target.value)}
            className="tabular bg-transparent text-main text-lg font-bold text-center w-14 focus:outline-none placeholder:text-faint"
            placeholder="0"
            aria-label="Pasajeros a descontar"
          />
          <button onClick={() => changeDeduction(1)} className="w-9 h-9 rounded-lg bg-raised/60 text-good hover:bg-good/15 active:scale-95 transition-all font-bold text-lg" aria-label="Sumar uno">+</button>
        </div>
      </div>

      {status === 'loading' && vehicles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-4">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 border-4 border-violet/25 rounded-full" />
            <div className="absolute inset-0 border-4 border-violet rounded-full border-t-transparent animate-spin" />
          </div>
          <div className="text-center">
            <h4 className="font-bold text-main">Cargando datos...</h4>
            <p className="tabular text-sm font-mono text-violet">{timer} s</p>
            <p className="text-xs text-faint mt-1">La primera consulta puede tardar un poco.</p>
          </div>
        </div>
      ) : vehicles.length > 0 ? (
        <>
          <p className="text-xs text-center text-violet mb-3 font-medium">Toca un vehículo para cargar sus pasajeros</p>
          <div className="space-y-3">
            {vehicles.map((v, i) => (
              <div key={i} className="bg-field/50 border border-line/60 rounded-2xl overflow-hidden">
              <button
                onClick={() => handleVehicleClick(v.pasajeros)}
                className="w-full hover:bg-violet/10 p-4 flex items-center justify-between transition-all active:scale-[0.99]"
              >
                <div className="text-left">
                  <p className="text-[11px] text-muted font-bold uppercase tracking-wider">Vehículo</p>
                  <p className="text-2xl font-black text-main">{v.identifier}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted font-bold uppercase tracking-wider">Pasajeros</p>
                  <p className="tabular text-3xl font-black text-brand">{v.pasajeros}</p>
                  {deductionValue !== 0 && (
                    <span className="tabular text-xs text-faint font-mono">
                      {deductionValue > 0 ? '+' : ''}{deductionValue} = <span className="text-violet font-bold">{Math.max(0, (toNumber(v.pasajeros) || 0) + deductionValue)}</span>
                    </span>
                  )}
                </div>
              </button>
              {(v.localizacion || v.fechaGps) && (
                <div className="px-4 py-2.5 border-t border-line/40 space-y-1 text-xs">
                  {v.fechaGps && (
                    <p className="text-muted">
                      <span className="font-bold text-faint uppercase tracking-wider text-[10px] mr-1.5">Último reporte</span>
                      <span className="tabular text-main">{v.fechaGps}</span>
                    </p>
                  )}
                  {v.localizacion && (
                    <p className="text-muted">
                      <span className="font-bold text-faint uppercase tracking-wider text-[10px] mr-1.5">Ubicación</span>
                      {v.mapaUrl ? (
                        <a href={v.mapaUrl} target="_blank" rel="noopener noreferrer" className="text-violet underline">{v.localizacion}</a>
                      ) : (
                        <span className="text-main">{v.localizacion}</span>
                      )}
                    </p>
                  )}
                </div>
              )}
              </div>
            ))}
          </div>
          <p className="mt-3 pt-3 border-t border-line/40 text-center text-[11px] text-faint font-mono">
            Tiempo transcurrido: <span className="text-violet font-bold">{timer} s</span>
          </p>
        </>
      ) : (
        <div className="text-center py-10 text-muted italic bg-field/30 rounded-xl border border-line/40">
          {status === 'error' ? (
            <>
              <p>No se pudo conectar. Toca “Actualizar” para reintentar.</p>
              {errorMessage && <p className="mt-2 px-4 text-xs not-italic text-faint">{errorMessage}</p>}
            </>
          ) : 'No se encontraron vehículos operando hoy.'}
        </div>
      )}
    </ModalShell>
  );
};
