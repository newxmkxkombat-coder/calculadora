export type DocumentStatus = 'valid' | 'expiring' | 'expired';

export const getDocumentStatus = (expiryDate: string, alertDateTime: string | undefined): { status: DocumentStatus; daysRemaining: number } => {
  if (!expiryDate) return { status: 'valid', daysRemaining: Infinity };

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDate);
  const expiryLocal = new Date(expiry.getTime() + expiry.getTimezoneOffset() * 60000);
  expiryLocal.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((expiryLocal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { status: 'expired', daysRemaining: diffDays };

  if (alertDateTime) {
    const alertD = new Date(alertDateTime);
    if (now.getTime() >= alertD.getTime()) return { status: 'expiring', daysRemaining: diffDays };
  }

  return { status: 'valid', daysRemaining: diffDays };
};

export const playNotificationSound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.5);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
};
