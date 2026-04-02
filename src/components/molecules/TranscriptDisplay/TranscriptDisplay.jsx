import styles from './TranscriptDisplay.module.css';

export function TranscriptDisplay({ text, interim, isLive }) {
  if (!text && !interim) return null;

  return (
    <div className={`${styles.wrap} ${isLive ? styles.live : ''}`}>
      {text && <span className={styles.final}>{text}</span>}
      {interim && <span className={styles.interim}> {interim}</span>}
    </div>
  );
}
