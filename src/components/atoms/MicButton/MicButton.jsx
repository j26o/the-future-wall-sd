import { useWallStore } from '@/stores/useWallStore';
import styles from './MicButton.module.css';

const PHASE_CLASS = {
  idle: '',
  recording: styles.recording,
  transcribing: styles.processing,
  enriching: styles.processing,
  generating: styles.processing,
  done: styles.done,
  error: styles.error,
};

export function MicButton({ onPressStart, onPressEnd }) {
  const phase = useWallStore((s) => s.phase);

  const isActive = phase === 'recording';
  const isBusy = ['transcribing', 'enriching', 'generating'].includes(phase);

  const handlePointerDown = () => {
    if (isBusy) return;
    onPressStart?.();
  };

  const handlePointerUp = () => {
    if (phase !== 'recording') return;
    onPressEnd?.();
  };

  return (
    <button
      className={`${styles.mic} ${PHASE_CLASS[phase] || ''}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      disabled={isBusy}
      aria-label={isActive ? 'Release to stop recording' : 'Press and hold to record'}
    >
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>

      {isBusy && <div className={styles.spinner} />}
    </button>
  );
}
