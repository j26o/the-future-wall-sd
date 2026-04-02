import { VoiceCapture } from '@/components/organisms/VoiceCapture';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { useWallStore } from '@/stores/useWallStore';
import styles from './InputPage.module.css';

export function InputPage() {
  useIdleTimeout();

  const phase = useWallStore((s) => s.phase);
  const imageUrl = useWallStore((s) => s.lastGeneratedUrl);

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <h1 className={styles.title}>What is your vision of Singapore&rsquo;s future?</h1>
        <VoiceCapture />

        {phase === 'done' && imageUrl && (
          <div className={styles.preview}>
            <img
              src={imageUrl}
              alt="Your vision"
              className={styles.previewImg}
            />
            <p className={styles.previewHint}>Your vision is now on the wall</p>
          </div>
        )}
      </div>
    </div>
  );
}
