import React from 'react';
import { GpsStatus, GpsVehicle } from '../../types';

interface LiveStatusBarProps {
  status: GpsStatus;
  vehicles: GpsVehicle[];
  onClick: () => void;
}

/** Cápsula flotante arriba con los pasajeros de cada bus (solo aparece si ya se consultó el GPS). */
export const LiveStatusBar: React.FC<LiveStatusBarProps> = ({ status, vehicles, onClick }) => {
  if (status === 'idle') return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50 flex justify-center pt-2 pointer-events-none" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
      <button
        onClick={onClick}
        className="bg-card/90 backdrop-blur-md border border-violet/40 rounded-full pl-5 pr-3 py-2 shadow-lg shadow-violet/20 flex items-center gap-4 pointer-events-auto hover:scale-105 transition-transform animate-fade-in-down"
      >
        <div className="flex items-center gap-3">
          {vehicles.length === 0 ? (
            <span className="text-sm font-bold text-main whitespace-nowrap">
              {status === 'loading' ? 'Sincronizando...' : status === 'error' ? 'Reconectando...' : 'Esperando datos...'}
            </span>
          ) : (
            vehicles.map((v, i) => (
              <div key={i} className="flex flex-col items-center leading-none px-2 border-r border-violet/30 last:border-0">
                <span className="text-[10px] text-violet font-bold uppercase tracking-wider mb-0.5">Bus {v.identifier}</span>
                <span className="tabular text-lg font-black text-main">{v.pasajeros}</span>
              </div>
            ))
          )}
        </div>
        {status === 'loading' && <span className="h-2.5 w-2.5 rounded-full bg-violet animate-ping" />}
        {status === 'error' && <span className="h-2.5 w-2.5 rounded-full bg-bad" />}
        {status === 'success' && <span className="h-2.5 w-2.5 rounded-full bg-good shadow-[0_0_8px_rgb(var(--c-good))]" />}
      </button>
    </div>
  );
};
