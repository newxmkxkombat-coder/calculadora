import React, { useRef, useState } from 'react';
import { STORAGE_KEYS } from '../../constants';
import { getLocalDateString } from '../../utils/format';
import { DownloadIcon, LoadIcon, ShieldIcon } from '../icons';
import { Button, SectionCard } from '../ui';

/** Datos que se guardan en el respaldo (las mismas claves que usa la app en el teléfono). */
const BACKUP_KEYS = [
  STORAGE_KEYS.history,
  STORAGE_KEYS.config,
  STORAGE_KEYS.documents,
  STORAGE_KEYS.maintenance,
  STORAGE_KEYS.customTypes,
  STORAGE_KEYS.passengerDeduction,
  STORAGE_KEYS.pocket,
];

/** Claves que deben contener una lista; el resto es un objeto o un texto. */
const ARRAY_KEYS: string[] = [STORAGE_KEYS.history, STORAGE_KEYS.documents, STORAGE_KEYS.maintenance, STORAGE_KEYS.customTypes, STORAGE_KEYS.pocket];

const BACKUP_APP_ID = 'mi-ganancia';

/**
 * Tipos que acepta Restaurar. Sin esto, Android muestra el selector de fotos/cámara y el .json
 * no aparece; con los tipos indicados abre directo el explorador de archivos.
 * application/octet-stream cubre celulares que no reconocen la extensión .json.
 */
const BACKUP_FILE_ACCEPT = '.json,application/json,.txt,text/plain,application/octet-stream';

const readLastBackup = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.lastBackup);
  } catch {
    return null;
  }
};

const buildBackup = () => {
  const data: Record<string, string> = {};
  for (const key of BACKUP_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  }
  return { app: BACKUP_APP_ID, version: 1, exportedAt: new Date().toISOString(), data };
};

/** Devuelve un texto de error si el archivo no es un respaldo válido, o null si todo está bien. */
const validateBackup = (parsed: any): string | null => {
  if (!parsed || parsed.app !== BACKUP_APP_ID || typeof parsed.data !== 'object' || parsed.data === null) {
    return 'Este archivo no parece un respaldo de Mi Ganancia.';
  }
  for (const [key, value] of Object.entries(parsed.data)) {
    if (!BACKUP_KEYS.includes(key as any) || typeof value !== 'string') return 'El respaldo tiene datos desconocidos.';
    if (key === STORAGE_KEYS.passengerDeduction) continue;
    try {
      const content = JSON.parse(value);
      if (ARRAY_KEYS.includes(key) && !Array.isArray(content)) return 'El respaldo está dañado (formato de lista incorrecto).';
    } catch {
      return 'El respaldo está dañado (no se pudo leer).';
    }
  }
  return null;
};

export const BackupManager: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(readLastBackup);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const markBackupDone = () => {
    const now = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEYS.lastBackup, now);
    } catch { /* sin almacenamiento */ }
    setLastBackup(now);
  };

  /**
   * Para descargar se usa .json. Para compartir se usa .txt: es el tipo que todos los celulares y apps
   * (WhatsApp, correo...) aceptan sin problema. El contenido es idéntico y Restaurar lee ambos.
   */
  const makeFile = (forSharing = false) => {
    const fileName = `mi-ganancia-respaldo-${getLocalDateString()}.${forSharing ? 'txt' : 'json'}`;
    const file = new File([JSON.stringify(buildBackup(), null, 2)], fileName, { type: forSharing ? 'text/plain' : 'application/json' });
    return { file, fileName };
  };

  const handleExport = () => {
    const { file, fileName } = makeFile();
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    markBackupDone();
    setMessage({ text: `Respaldo descargado: ${fileName}`, ok: true });
  };

  const canShareFiles = typeof navigator.canShare === 'function' && typeof navigator.share === 'function';

  const handleShare = async () => {
    const { file } = makeFile(true);
    if (!navigator.canShare?.({ files: [file] })) {
      handleExport();
      return;
    }
    try {
      await navigator.share({ files: [file], title: 'Respaldo Mi Ganancia' });
      markBackupDone();
      setMessage({ text: 'Respaldo compartido.', ok: true });
    } catch (error) {
      const { name, message: detail } = error as Error;
      if (name === 'AbortError') return; // el usuario cerró el menú de compartir
      console.error('Error al compartir el respaldo:', error);
      // Si el celular no deja compartir el archivo, se descarga para no quedarse sin copia.
      handleExport();
      setMessage({
        text: `No se pudo abrir "Compartir" en este celular (${name}${detail ? `: ${detail}` : ''}). El respaldo se descargó como archivo; búscalo en Descargas.`,
        ok: false,
      });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    let parsed: any;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setMessage({ text: 'No se pudo leer el archivo.', ok: false });
      return;
    }

    const problem = validateBackup(parsed);
    if (problem) {
      setMessage({ text: problem, ok: false });
      return;
    }

    const savedOn = parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString('es-CO') : 'fecha desconocida';
    const confirmed = window.confirm(
      `Se van a REEMPLAZAR los datos actuales (historial, mantenimiento, documentos y ajustes) por los del respaldo del ${savedOn}.\n\n¿Quieres continuar?`
    );
    if (!confirmed) return;

    for (const key of BACKUP_KEYS) {
      if (key in parsed.data) localStorage.setItem(key, parsed.data[key]);
      else localStorage.removeItem(key);
    }
    window.location.reload();
  };

  const daysSinceBackup = lastBackup ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24)) : null;
  const needsBackup = daysSinceBackup === null || daysSinceBackup >= 7;

  return (
    <SectionCard
      title="Respaldo de datos"
      icon={<ShieldIcon />}
      tone="good"
      badge={needsBackup ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-warn/15 text-warn">Pendiente</span> : undefined}
    >
      <p className="text-sm text-muted mb-4">
        Tus datos viven solo en este teléfono. Si borras los datos del navegador o cambias de celular, se pierden.
        Guarda un respaldo de vez en cuando (por ejemplo, envíalo a tu WhatsApp o a tu correo).
      </p>

      <p className={`text-xs font-semibold mb-4 ${needsBackup ? 'text-warn' : 'text-good'}`}>
        {lastBackup
          ? `Último respaldo: ${new Date(lastBackup).toLocaleString('es-CO')} (hace ${daysSinceBackup} ${daysSinceBackup === 1 ? 'día' : 'días'})`
          : 'Todavía no has hecho ningún respaldo.'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Button variant="primary" onClick={handleExport}><DownloadIcon /> Descargar</Button>
        {canShareFiles && <Button onClick={handleShare}>Compartir</Button>}
        <Button onClick={() => fileInputRef.current?.click()}><LoadIcon /> Restaurar</Button>
        <input ref={fileInputRef} type="file" accept={BACKUP_FILE_ACCEPT} className="hidden" onChange={handleImport} />
      </div>

      <p className="mt-3 text-xs text-muted">
        Para restaurar, elige el archivo <span className="font-semibold">mi-ganancia-respaldo-....json</span> (o .txt) que
        guardaste; normalmente está en la carpeta Descargas.
      </p>

      {message && (
        <p role="status" className={`mt-4 text-sm font-medium ${message.ok ? 'text-good' : 'text-bad'}`}>{message.text}</p>
      )}
    </SectionCard>
  );
};
