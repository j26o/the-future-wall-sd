import { useCallback, useEffect, useRef, useState } from 'react';

const SpeechRecognition =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

/**
 * Web Speech API hook.
 *
 * Returns:
 *  - supported: boolean — is the API available in this browser?
 *  - listening: boolean — is recognition currently active?
 *  - interim: string — live interim transcript (updates while speaking)
 *  - transcript: string — final committed transcript
 *  - start(): begin recognition
 *  - stop(): end recognition (triggers final result)
 *  - reset(): clear transcript state
 *  - error: string | null
 */
export function useSpeechRecognition({ lang = 'en-US', onResult } = {}) {
  const [supported] = useState(() => !!SpeechRecognition);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);

  const recRef = useRef(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  // Create recognition instance once
  useEffect(() => {
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let interimText = '';
      let finalText = '';

      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      setInterim(interimText);

      if (finalText) {
        setTranscript((prev) => {
          const combined = prev ? `${prev} ${finalText}` : finalText;
          return combined.trim();
        });
      }
    };

    rec.onerror = (e) => {
      // 'no-speech' and 'aborted' are expected when user stops quickly
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      setError(e.error);
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      setInterim('');
    };

    recRef.current = rec;

    return () => {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try { rec.abort(); } catch { /* ignore */ }
    };
  }, [lang]);

  const start = useCallback(() => {
    const rec = recRef.current;
    if (!rec || listening) return;
    setError(null);
    setTranscript('');
    setInterim('');
    try {
      rec.start();
      setListening(true);
    } catch (e) {
      setError(e.message);
    }
  }, [listening]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec || !listening) return;
    try {
      rec.stop();
    } catch { /* ignore */ }
  }, [listening]);

  const reset = useCallback(() => {
    setTranscript('');
    setInterim('');
    setError(null);
  }, []);

  return { supported, listening, interim, transcript, start, stop, reset, error };
}
