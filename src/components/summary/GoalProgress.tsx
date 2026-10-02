import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatNumberWithDots, parseFormattedNumber } from '../../utils/format';
import { CheckIcon, EditIcon, UsersIcon, XIcon } from '../icons';
import { IconBadge, IconButton } from '../ui';

interface GoalProgressProps {
  totalPassengers: number;
  goal: number;
  onGoalChange: (newGoal: number) => void;
}

const WORKDAY_START_HOUR = 4;
const WORKDAY_END_HOUR = 20;

export const GoalProgress: React.FC<GoalProgressProps> = ({ totalPassengers, goal, onGoalChange }) => {
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
    if (!isNaN(newGoal) && newGoal > 0) onGoalChange(newGoal);
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
    const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    let daysLeft = totalDaysInMonth - now.getDate() + 1;
    if (currentHour >= WORKDAY_END_HOUR || currentHour < WORKDAY_START_HOUR) daysLeft -= 1;

    const passengersNeeded = Math.max(0, goal - totalPassengers);
    return { dailyGoal: daysLeft > 0 ? Math.ceil(passengersNeeded / daysLeft) : 0, daysRemaining: daysLeft };
  }, [totalPassengers, goal]);

  const message =
    percentage >= 100 ? "¡Meta cumplida y superada! ¡Excelente trabajo!"
    : percentage >= 80 ? "¡Ya casi lo logras, sigue así!"
    : percentage >= 50 ? "¡Vas por la mitad del camino! ¡Buen ritmo!"
    : "¡Un gran viaje comienza con un solo paso!";

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-field/50 border border-line/50">
      <div className="flex items-center gap-3 mb-4">
        <IconBadge tone="brand"><UsersIcon /></IconBadge>
        <div className="flex-grow">
          <h3 className="font-bold text-main leading-tight">Meta mensual de pasajeros</h3>
          <p className="text-xs text-muted">{message}</p>
        </div>
        <span className="tabular text-xl font-extrabold text-brand">{percentage.toFixed(1)}%</span>
      </div>

      <div className="w-full bg-raised/60 rounded-full h-3 mb-4 overflow-hidden">
        <div
          className="bg-gradient-to-r from-brand to-info h-3 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[11px] text-muted">Actual</p>
          <p className="tabular font-bold text-main">{totalPassengers.toLocaleString('es-CO')}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted">Faltan</p>
          <p className="tabular font-bold text-warn">{remaining.toLocaleString('es-CO')}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted">Meta</p>
          {isEditing ? (
            <div className="flex items-center justify-center gap-1">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                value={formatNumberWithDots(tempGoal)}
                onChange={e => setTempGoal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') handleCancel();
                }}
                className="tabular bg-field border border-line rounded-lg px-1 py-0.5 text-main w-20 text-center font-bold focus:outline-none focus:border-brand"
              />
              <IconButton title="Guardar meta" tone="good" onClick={handleSave} className="!p-1"><CheckIcon /></IconButton>
              <IconButton title="Cancelar" tone="bad" onClick={handleCancel} className="!p-1"><XIcon /></IconButton>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1">
              <p className="tabular font-bold text-good">{goal.toLocaleString('es-CO')}</p>
              <IconButton title="Editar meta" onClick={() => { setTempGoal(goal.toString()); setIsEditing(true); }} className="!p-1 !bg-transparent"><EditIcon /></IconButton>
            </div>
          )}
        </div>
      </div>

      {dailyGoal > 0 && (
        <div className="text-center mt-4 pt-4 border-t border-line/50">
          <p className="text-xs text-muted">Para cumplir necesitas un promedio de</p>
          <p className="tabular text-2xl font-extrabold text-brand my-0.5">
            {dailyGoal.toLocaleString('es-CO')}
            <span className="text-sm font-medium text-muted ml-1">pasajeros / día</span>
          </p>
          <p className="text-xs text-faint">Quedan {daysRemaining} días para finalizar el mes</p>
        </div>
      )}
    </div>
  );
};
