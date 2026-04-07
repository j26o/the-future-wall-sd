import { useEffect, useRef, useState, useCallback } from 'react';
import { useWallStore } from '@/stores/useWallStore';
import { BASE_IMAGE, MORPH, IDLE_TIMEOUT_MS, DIFFUSION_TRANSITION } from '@/config';
import { preloadImage } from '@/utils/imageLoader';
import { interpolate, checkHealth } from '@/services/inferenceService';

/**
 * Vision cycling with diffusion-based transitions.
 *
 * When the target advances (timer or new vision), requests interpolation
 * frames from the local inference server and plays them sequentially.
 * Falls back to direct image swap if the server is unavailable.
 *
 * Returns: { frameSrc, isTransitioning }
 */
export function useVisionCycle(morphControls = {}, transitionControls = {}) {
  const isIdle = useWallStore((s) => s.isIdle);
  const dreamImages = useWallStore((s) => s.dreamImages);
  const visionQueue = useWallStore((s) => s.visionQueue);
  const resetToIdle = useWallStore((s) => s.resetToIdle);
  const inferenceReady = useWallStore((s) => s.inferenceReady);
  const setInferenceReady = useWallStore((s) => s.setInferenceReady);
  const transitionFrames = useWallStore((s) => s.transitionFrames);
  const transitionIndex = useWallStore((s) => s.transitionIndex);
  const isTransitioning = useWallStore((s) => s.isTransitioning);
  const setTransitionFrames = useWallStore((s) => s.setTransitionFrames);
  const advanceTransitionFrame = useWallStore((s) => s.advanceTransitionFrame);
  const completeTransition = useWallStore((s) => s.completeTransition);

  const idleHold = morphControls.idleHold ?? MORPH.IDLE_HOLD;
  const visitorHold = morphControls.visitorHold ?? MORPH.VISITOR_HOLD;
  const numFrames = transitionControls.numFrames ?? DIFFUSION_TRANSITION.NUM_FRAMES;
  const strengthStart = transitionControls.strengthStart ?? DIFFUSION_TRANSITION.STRENGTH_START;
  const strengthEnd = transitionControls.strengthEnd ?? DIFFUSION_TRANSITION.STRENGTH_END;
  const frameInterval = transitionControls.frameInterval ?? DIFFUSION_TRANSITION.FRAME_INTERVAL_MS;

  const images = isIdle ? dreamImages : visionQueue.map((v) => v.imageUrl);

  const [index, setIndex] = useState(0);
  const [frameSrc, setFrameSrc] = useState(BASE_IMAGE);
  const timerRef = useRef(null);
  const idleTimerRef = useRef(null);
  const frameTimerRef = useRef(null);
  const interpolatingRef = useRef(false);

  const currentTarget = images.length > 0 ? images[index % images.length] : BASE_IMAGE;

  // Check inference server on mount
  useEffect(() => {
    checkHealth().then((res) => setInferenceReady(res.ok));
    const interval = setInterval(() => {
      checkHealth().then((res) => setInferenceReady(res.ok));
    }, 30000);
    return () => clearInterval(interval);
  }, [setInferenceReady]);

  // Set initial frame
  useEffect(() => {
    if (!isTransitioning) {
      setFrameSrc(currentTarget);
    }
  }, [currentTarget, isTransitioning]);

  // Preload next image
  useEffect(() => {
    if (images.length < 2) return;
    const nextIdx = (index + 1) % images.length;
    preloadImage(images[nextIdx]).catch(() => {});
  }, [index, images]);

  // Request interpolation and start frame playback
  const startTransition = useCallback(async (fromSrc, toSrc, toPrompt) => {
    if (interpolatingRef.current) return;
    interpolatingRef.current = true;

    if (inferenceReady) {
      try {
        const result = await interpolate(fromSrc, toPrompt || 'future vision of Singapore', {
          numFrames,
          strengthStart,
          strengthEnd,
        });

        if (result.frames && result.frames.length > 0) {
          // Preload first frame, then start playback
          await preloadImage(result.frames[0]).catch(() => {});
          setTransitionFrames(result.frames);
          interpolatingRef.current = false;
          return;
        }
      } catch (err) {
        console.warn('Interpolation failed, falling back to direct swap:', err);
      }
    }

    // Fallback: direct swap
    setFrameSrc(toSrc);
    interpolatingRef.current = false;
  }, [inferenceReady, numFrames, strengthStart, strengthEnd, setTransitionFrames]);

  // Advance to next target on hold timer
  const advance = useCallback(() => {
    if (isTransitioning || interpolatingRef.current) return;

    const total = images.length;
    if (total < 2) return;

    const nextIdx = (index + 1) % total;
    const fromSrc = frameSrc;
    const toSrc = images[nextIdx];

    setIndex(nextIdx);
    startTransition(fromSrc, toSrc);
  }, [images, index, frameSrc, isTransitioning, startTransition]);

  // Hold timer
  useEffect(() => {
    if (images.length < 2) return;

    const holdMs = (isIdle ? idleHold : visitorHold) * 1000;
    timerRef.current = setInterval(advance, holdMs);
    return () => clearInterval(timerRef.current);
  }, [images.length, isIdle, idleHold, visitorHold, advance]);

  // Play transition frames
  useEffect(() => {
    if (!isTransitioning || transitionFrames.length === 0) return;

    const frame = transitionFrames[transitionIndex];
    if (frame) {
      // Prefix with inference server URL if it's a relative /outputs/ path
      const src = frame.startsWith('/outputs/')
        ? `/inference${frame}`
        : frame;
      setFrameSrc(src);
    }

    if (transitionIndex < transitionFrames.length - 1) {
      frameTimerRef.current = setTimeout(advanceTransitionFrame, frameInterval);
    } else {
      // Transition complete
      frameTimerRef.current = setTimeout(completeTransition, frameInterval);
    }

    return () => clearTimeout(frameTimerRef.current);
  }, [isTransitioning, transitionFrames, transitionIndex, frameInterval, advanceTransitionFrame, completeTransition]);

  // Reset index when switching between idle / visitor mode
  useEffect(() => {
    setIndex(0);
    completeTransition();
  }, [isIdle, completeTransition]);

  // Auto-return to idle after visitor queue stalls
  useEffect(() => {
    clearTimeout(idleTimerRef.current);
    if (!isIdle) {
      idleTimerRef.current = setTimeout(() => {
        resetToIdle();
        setIndex(0);
      }, IDLE_TIMEOUT_MS);
    }
    return () => clearTimeout(idleTimerRef.current);
  }, [isIdle, visionQueue.length, resetToIdle]);

  return { frameSrc, isTransitioning };
}
