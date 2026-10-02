import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { saveJSON } from '../utils/storage';

/** Como useState, pero guarda cada cambio en localStorage bajo la clave dada. */
export function usePersistentState<T>(key: string, load: () => T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(load);

  useEffect(() => {
    saveJSON(key, value);
  }, [key, value]);

  return [value, setValue];
}
