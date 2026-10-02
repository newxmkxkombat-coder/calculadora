import React, { useEffect, useState } from 'react';
import { ClockIcon } from '../icons';

export const DigitalClock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  const formatted = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <div className="flex items-center gap-1.5 text-muted">
      <ClockIcon />
      <p className="tabular font-mono text-xs tracking-wide">{formatted}</p>
    </div>
  );
};
