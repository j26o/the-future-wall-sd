import { useEffect, useRef, useState, useCallback } from 'react';
import { useWallStore } from '@/stores/useWallStore';
import { BASE_IMAGE, MORPH, IDLE_TIMEOUT_MS } from '@/config';
import { preloadImage } from '@/utils/imageLoader';

/**
 * Drives the MorphCanvas: manages which two images are active,
 * animates morph progress 0→1, pauses, then advances to next pair.
 *
 * Returns: { currentSrc, nextSrc, progress }
 */
export function useVisionCycle(morphControls = {}) {
  const isIdle = useWallStore((s) => s.isIdle);
  const dreamImages = useWallStore((s) => s.dreamImages);
  const visionQueue = useWallStore((s) => s.visionQueue);
  const resetToIdle = useWallStore((s) => s.resetToIdle);

  const idleDuration = morphControls.idleDuration ?? MORPH.IDLE_DURATION;
  const visitorDuration = morphControls.visitorDuration ?? MORPH.VISITOR_DURATION;
  const pauseBetween = morphControls.pauseBetween ?? MORPH.PAUSE_BETWEEN;

  const images = isIdle ? dreamImages : visionQueue.map((v) => v.imageUrl);

  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('morph'); // 'morph' | 'pause'

  const rafRef = useRef(null);
  const startRef = useRef(null);
  const idleTimerRef = useRef(null);

  const currentSrc = images.length > 0 ? images[index % images.length] : BASE_IMAGE;
  const nextIdx = images.length > 1 ? (index + 1) % images.length : 0;
  const nextSrc = images.length > 1 ? images[nextIdx] : currentSrc;

  // Preload upcoming image
  useEffect(() => {
    if (nextSrc && nextSrc !== currentSrc) {
      preloadImage(nextSrc).catch(() => {});
    }
  }, [nextSrc, currentSrc]);

  // Advance to next image pair
  const advance = useCallback(() => {
    setIndex((prev) => {
      const total = images.length;
      if (total < 2) return prev;
      return (prev + 1) % total;
    });
    setProgress(0);
    setPhase('morph');
    startRef.current = null;
  }, [images.length]);

  // Animation loop
  useEffect(() => {
    if (images.length < 2) {
      setProgress(0);
      return;
    }

    const duration = (isIdle ? idleDuration : visitorDuration) * 1000;
    const pauseMs = pauseBetween * 1000;

    const tick = (now) => {
      if (!startRef.current) startRef.current = now;
      const elapsed = now - startRef.current;

      if (phase === 'morph') {
        const p = Math.min(elapsed / duration, 1);
        // Smooth ease-in-out
        const eased = p < 0.5
          ? 2 * p * p
          : 1 - Math.pow(-2 * p + 2, 2) / 2;
        setProgress(eased);

        if (p >= 1) {
          setPhase('pause');
          startRef.current = now;
        }
      } else {
        // Pause phase
        if (elapsed >= pauseMs) {
          advance();
          return; // advance resets startRef
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, images.length, isIdle, idleDuration, visitorDuration, pauseBetween, advance]);

  // Auto-return to idle after visitor queue stalls
  useEffect(() => {
    clearTimeout(idleTimerRef.current);
    if (!isIdle) {
      idleTimerRef.current = setTimeout(() => {
        resetToIdle();
        setIndex(0);
        setProgress(0);
        setPhase('morph');
        startRef.current = null;
      }, IDLE_TIMEOUT_MS);
    }
    return () => clearTimeout(idleTimerRef.current);
  }, [isIdle, visionQueue.length, resetToIdle]);

  return { currentSrc, nextSrc, progress };
}
