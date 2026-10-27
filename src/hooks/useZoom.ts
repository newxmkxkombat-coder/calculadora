import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../constants';

/** Tamaños posibles de toda la app (1 = normal). */
export const ZOOM_LEVELS = [0.8, 0.9, 1, 1.1, 1.2, 1.3] as const;

const readZoom = (): number => {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEYS.zoom));
    return (ZOOM_LEVELS as readonly number[]).includes(saved) ? saved : 1;
  } catch {
    return 1;
  }
};

/** Acerca o aleja toda la app. Las alturas con `vh` se dividen por --app-zoom para que las ventanas sigan cabiendo. */
export const useZoom = () => {
  const [zoom, setZoom] = useState<number>(readZoom);

  useEffect(() => {
    const root = document.documentElement;
    // En 100% quitamos el zoom del todo: así el celular dibuja la app de la forma normal.
    if (zoom === 1) {
      root.style.removeProperty('zoom');
      root.style.removeProperty('--app-zoom');
    } else {
      root.style.setProperty('zoom', String(zoom));
      root.style.setProperty('--app-zoom', String(zoom));
    }
    try {
      localStorage.setItem(STORAGE_KEYS.zoom, String(zoom));
    } catch {
      /* sin almacenamiento: el tamaño solo dura la sesión */
    }
  }, [zoom]);

  const step = useCallback((dir: 1 | -1) => {
    setZoom(z => {
      const i = ZOOM_LEVELS.indexOf(z as (typeof ZOOM_LEVELS)[number]);
      return ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, i + dir))];
    });
  }, []);

  const zoomIn = useCallback(() => step(1), [step]);
  const zoomOut = useCallback(() => step(-1), [step]);
  const resetZoom = useCallback(() => setZoom(1), []);

  return {
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    canZoomIn: zoom < ZOOM_LEVELS[ZOOM_LEVELS.length - 1],
    canZoomOut: zoom > ZOOM_LEVELS[0],
  };
};
