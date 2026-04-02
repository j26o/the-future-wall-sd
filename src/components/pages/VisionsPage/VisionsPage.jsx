import { useEffect, useState } from 'react';
import { getVisions } from '@/services/visionService';
import styles from './VisionsPage.module.css';

export function VisionsPage() {
  const [visions, setVisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getVisions(100)
      .then((data) => {
        if (!cancelled) setVisions(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Submitted Visions</h1>
        <p className={styles.subtitle}>
          {loading ? 'Loading...' : `${visions.length} vision${visions.length !== 1 ? 's' : ''}`}
        </p>
      </header>

      {error && <p className={styles.error}>Failed to load visions: {error}</p>}

      {!loading && !error && visions.length === 0 && (
        <p className={styles.empty}>No visions yet. Be the first to share yours.</p>
      )}

      <ul className={styles.list}>
        {visions.map((v) => (
          <li key={v.id} className={styles.card}>
            <div className={styles.imageWrap}>
              {v.imageUrl ? (
                <img
                  src={v.imageUrl}
                  alt={v.transcript || 'Generated vision'}
                  className={styles.image}
                  loading="lazy"
                />
              ) : (
                <div className={styles.placeholder}>No image</div>
              )}
            </div>

            <div className={styles.details}>
              <div className={styles.field}>
                <span className={styles.label}>Raw transcript</span>
                <p className={styles.value}>{v.transcript || '—'}</p>
              </div>

              <div className={styles.field}>
                <span className={styles.label}>Enriched prompt</span>
                <p className={styles.value}>{v.prompt || '—'}</p>
              </div>

              <time className={styles.time} dateTime={v.createdAt || undefined}>
                {v.createdAt
                  ? new Date(v.createdAt).toLocaleString()
                  : '—'}
              </time>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
