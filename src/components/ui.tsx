import React, { useEffect, useState } from 'react';
import { ChevronDownIcon, XIcon } from './icons';

export type Tone = 'neutral' | 'brand' | 'good' | 'bad' | 'warn' | 'info' | 'violet';

/** Clases por tono: texto + fondo suave + borde suave. */
export const toneSoft: Record<Tone, string> = {
  neutral: 'text-muted bg-raised/50 border-line/60',
  brand: 'text-brand bg-brand/10 border-brand/25',
  good: 'text-good bg-good/10 border-good/25',
  bad: 'text-bad bg-bad/10 border-bad/25',
  warn: 'text-warn bg-warn/10 border-warn/25',
  info: 'text-info bg-info/10 border-info/25',
  violet: 'text-violet bg-violet/10 border-violet/25',
};

export const inputClass =
  'w-full bg-field border border-line/70 rounded-xl px-3 py-2.5 text-main placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/25 transition-colors';

export const labelClass = 'block text-xs font-semibold text-muted mb-1.5';

export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`bg-card/80 backdrop-blur-sm border border-line/50 rounded-2xl shadow-lg shadow-black/10 ${className}`}>
    {children}
  </div>
);

/** Icono dentro de un cuadrito de color, para encabezados y campos. */
export const IconBadge: React.FC<{ tone?: Tone; children: React.ReactNode; className?: string }> = ({ tone = 'brand', children, className = '' }) => (
  <span className={`inline-flex items-center justify-center h-9 w-9 rounded-xl border shrink-0 ${toneSoft[tone]} ${className}`}>
    {children}
  </span>
);

export const SectionTitle: React.FC<{ tone?: Tone; children: React.ReactNode }> = ({ tone = 'brand', children }) => {
  const dot: Record<Tone, string> = {
    neutral: 'bg-muted', brand: 'bg-brand', good: 'bg-good', bad: 'bg-bad', warn: 'bg-warn', info: 'bg-info', violet: 'bg-violet',
  };
  return (
    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${dot[tone]}`} />
      {children}
    </h3>
  );
};

interface SectionCardProps {
  title: string;
  icon: React.ReactNode;
  tone?: Tone;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/** Tarjeta plegable (Mantenimiento, Documentos, Respaldo...). */
export const SectionCard: React.FC<SectionCardProps> = ({ title, icon, tone = 'brand', badge, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="mt-6">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 text-left p-4 sm:p-5"
      >
        <IconBadge tone={tone}>{icon}</IconBadge>
        <h2 className="text-base sm:text-lg font-bold text-main flex-grow">{title}</h2>
        {badge}
        <ChevronDownIcon className={`text-muted transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className="collapsible" data-open={open}>
        <div>
          <div className="border-t border-line/50 p-4 sm:p-5">{children}</div>
        </div>
      </div>
    </Card>
  );
};

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-on-brand hover:brightness-110 shadow-md shadow-brand/20',
  secondary: 'bg-raised/60 text-main hover:bg-raised border border-line/60',
  danger: 'bg-bad/10 text-bad border border-bad/30 hover:bg-bad/20',
  ghost: 'text-muted hover:text-main hover:bg-raised/50',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  small?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ variant = 'secondary', small = false, className = '', children, ...rest }) => (
  <button
    {...rest}
    className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${small ? 'px-3 py-2 text-sm' : 'px-4 py-2.5 text-sm'} ${buttonVariants[variant]} ${className}`}
  >
    {children}
  </button>
);

const iconButtonTones: Record<Tone, string> = {
  neutral: 'hover:bg-raised hover:text-main',
  brand: 'hover:bg-brand/15 hover:text-brand',
  good: 'hover:bg-good/15 hover:text-good',
  bad: 'hover:bg-bad/15 hover:text-bad',
  warn: 'hover:bg-warn/15 hover:text-warn',
  info: 'hover:bg-info/15 hover:text-info',
  violet: 'hover:bg-violet/15 hover:text-violet',
};

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  title: string;
  tone?: Tone;
}

export const IconButton: React.FC<IconButtonProps> = ({ title, tone = 'neutral', className = '', children, ...rest }) => (
  <button
    {...rest}
    title={title}
    aria-label={title}
    className={`p-2 rounded-lg text-muted bg-raised/40 transition-colors duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${iconButtonTones[tone]} ${className}`}
  >
    {children}
  </button>
);

interface ModalShellProps {
  title: string;
  onClose: () => void;
  tone?: Tone;
  icon?: React.ReactNode;
  subtitle?: string;
  headerExtra?: React.ReactNode;
  maxWidth?: string;
  children: React.ReactNode;
}

/** Ventana emergente común: fondo difuminado, cierre con Escape o tocando afuera. */
export const ModalShell: React.FC<ModalShellProps> = ({ title, onClose, tone = 'brand', icon, subtitle, headerExtra, maxWidth = 'max-w-md', children }) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Mientras la ventana está abierta, el fondo no se mueve: solo se desliza la ventana.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in-backdrop"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`bg-card border border-line/60 rounded-t-3xl sm:rounded-2xl w-full ${maxWidth} max-h-[92vh] flex flex-col shadow-2xl animate-fade-in-scale`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 sm:p-5 border-b border-line/50 shrink-0">
          {icon && <IconBadge tone={tone}>{icon}</IconBadge>}
          <div className="flex-grow min-w-0">
            <h3 className="text-lg font-bold text-main truncate">{title}</h3>
            {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          </div>
          {headerExtra}
          <IconButton title="Cerrar" onClick={onClose}><XIcon /></IconButton>
        </div>
        <div className="overflow-y-auto overscroll-contain p-4 sm:p-5 custom-scrollbar">{children}</div>
      </div>
    </div>
  );
};

export const EmptyState: React.FC<{ icon?: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="flex flex-col items-center gap-2 py-8 text-center text-faint text-sm">
    {icon && <span className="text-faint/70">{icon}</span>}
    <p>{children}</p>
  </div>
);
