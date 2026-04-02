import styles from './StatusIndicator.module.css';

const LABELS = {
  idle: 'Press and hold to speak',
  recording: 'Listening...',
  transcribing: 'Processing speech...',
  enriching: 'Crafting your vision...',
  generating: 'Generating image...',
  done: 'Your vision has been added to the wall',
  error: 'Something went wrong. Try again.',
  unsupported: 'Speech recognition is not supported in this browser.',
};

export function StatusIndicator({ status, message }) {
  const label = message || LABELS[status] || '';
  const isError = status === 'error' || status === 'unsupported';

  return (
    <p className={`${styles.status} ${isError ? styles.error : ''}`}>
      {label}
    </p>
  );
}
