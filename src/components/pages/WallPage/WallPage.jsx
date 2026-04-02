import { useEffect } from 'react';
import { Leva } from 'leva';
import { MorphCanvas, useLevaControls } from '@/components/organisms/MorphCanvas';
import { useVisionCycle } from '@/hooks/useVisionCycle';
import { useVisionListener } from '@/hooks/useVisionListener';
import { SHOW_CONTROLS } from '@/config';
import styles from './WallPage.module.css';

export function WallPage() {
  // Subscribe to Firestore for new visions
  useVisionListener();

  // Leva controls for shader tuning
  const controls = useLevaControls();

  // Vision cycling drives morph progress
  const { currentSrc, nextSrc, progress } = useVisionCycle(controls.morph);

  // Ctrl+Shift+L toggle for leva panel
  useEffect(() => {
    let visible = SHOW_CONTROLS;
    const onKey = (e) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyL') {
        visible = !visible;
        // Leva doesn't expose a toggle API, so we toggle the root container
        const root = document.querySelector('[class*="leva-"]');
        if (root) {
          root.style.display = visible ? '' : 'none';
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={styles.page}>
      <Leva hidden={!SHOW_CONTROLS} collapsed />

      <MorphCanvas
        currentSrc={currentSrc}
        nextSrc={nextSrc}
        progress={progress}
        controls={controls}
      />
    </div>
  );
}
