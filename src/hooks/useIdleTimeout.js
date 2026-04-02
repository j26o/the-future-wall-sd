import { useEffect, useRef } from 'react';
import { IDLE_TIMEOUT_MS } from '@/config';
import { useWallStore } from '@/stores/useWallStore';

/**
 * Resets the input page back to idle after a configurable timeout.
 * Triggers when phase reaches 'done' or 'error'.
 */
export function useIdleTimeout(timeoutMs = IDLE_TIMEOUT_MS) {
  const phase = useWallStore((s) => s.phase);
  const resetInput = useWallStore((s) => s.resetInput);
  const timer = useRef(null);

  useEffect(() => {
    if (phase === 'done' || phase === 'error') {
      timer.current = setTimeout(() => {
        resetInput();
      }, timeoutMs);
    } else {
      clearTimeout(timer.current);
    }

    return () => clearTimeout(timer.current);
  }, [phase, resetInput, timeoutMs]);
}
