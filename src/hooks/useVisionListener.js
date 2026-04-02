import { useEffect } from 'react';
import {
  collection, query, where, orderBy, limit, onSnapshot,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useWallStore } from '@/stores/useWallStore';

/**
 * Subscribes to Firestore visions collection via onSnapshot.
 * Pushes new completed visions into the wall store queue.
 *
 * If Firestore is not configured (no Firebase project), this is a no-op.
 */
export function useVisionListener() {
  const pushVision = useWallStore((s) => s.pushVision);

  useEffect(() => {
    if (!db) return;

    const q = query(
      collection(db, 'visions'),
      where('status', '==', 'complete'),
      orderBy('createdAt', 'desc'),
      limit(1),
    );

    // Track the latest known timestamp to avoid re-processing on initial load
    let latestSeen = null;

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const ts = data.createdAt?.toMillis?.() || 0;

            // Skip initial load results — only process new additions
            if (latestSeen === null) {
              latestSeen = ts;
              return;
            }

            if (ts > latestSeen) {
              latestSeen = ts;
              pushVision({
                id: change.doc.id,
                imageUrl: data.imageUrl,
                prompt: data.prompt,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
              });
            }
          }
        });
      },
      (err) => {
        // Firestore disconnected — wall continues with dream cycling
        console.warn('[VisionListener] Firestore error, falling back to dreams:', err.message);
      },
    );

    return () => unsubscribe();
  }, [pushVision]);
}
