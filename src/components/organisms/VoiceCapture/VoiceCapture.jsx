import { useCallback, useEffect, useRef } from 'react';
import { MicButton } from '@/components/atoms/MicButton';
import { StatusIndicator } from '@/components/atoms/StatusIndicator';
import { TranscriptDisplay } from '@/components/molecules/TranscriptDisplay';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useWallStore } from '@/stores/useWallStore';
import { submitVision } from '@/services/visionService';
import { RETRY } from '@/config';
import styles from './VoiceCapture.module.css';

/** Silence timeout: auto-stop recording after this many ms of no new results */
const SILENCE_MS = 3000;

export function VoiceCapture() {
  const phase = useWallStore((s) => s.phase);
  const setPhase = useWallStore((s) => s.setPhase);
  const setTranscript = useWallStore((s) => s.setTranscript);
  const setEnrichedPrompt = useWallStore((s) => s.setEnrichedPrompt);
  const setError = useWallStore((s) => s.setError);
  const resetInput = useWallStore((s) => s.resetInput);

  const {
    supported,
    listening,
    interim,
    transcript: speechText,
    start: startSpeech,
    stop: stopSpeech,
    reset: resetSpeech,
    error: speechError,
  } = useSpeechRecognition({ lang: 'en-US' });

  const silenceTimer = useRef(null);

  // Clear silence timer on unmount
  useEffect(() => () => clearTimeout(silenceTimer.current), []);

  // Restart silence timer whenever we get new interim/final text
  useEffect(() => {
    if (!listening) return;
    clearTimeout(silenceTimer.current);
    silenceTimer.current = setTimeout(() => {
      stopSpeech();
    }, SILENCE_MS);
  }, [interim, speechText, listening, stopSpeech]);

  // Sync speech text into store
  useEffect(() => {
    if (speechText) {
      setTranscript(speechText);
    }
  }, [speechText, setTranscript]);

  // When listening ends and we have text, auto-submit
  useEffect(() => {
    if (!listening && phase === 'recording' && speechText) {
      handleSubmit(speechText);
    }
    // If listening ended with no text, go back to idle
    if (!listening && phase === 'recording' && !speechText) {
      setPhase('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);

  // Handle speech errors
  useEffect(() => {
    if (speechError) {
      setError(`Speech error: ${speechError}`);
    }
  }, [speechError, setError]);

  const handlePressStart = useCallback(() => {
    if (!supported) return;
    const busy = ['transcribing', 'enriching', 'generating'].includes(
      useWallStore.getState().phase,
    );
    if (busy) return;

    resetInput();
    resetSpeech();
    setPhase('recording');
    startSpeech();
  }, [supported, resetInput, resetSpeech, setPhase, startSpeech]);

  const handlePressEnd = useCallback(() => {
    if (!listening) return;
    clearTimeout(silenceTimer.current);
    stopSpeech();
  }, [listening, stopSpeech]);

  const setLastGeneratedUrl = useWallStore((s) => s.setLastGeneratedUrl);
  const pushVision = useWallStore((s) => s.pushVision);

  const handleSubmit = useCallback(
    async (text) => {
      setPhase('generating');

      for (let attempt = 1; attempt <= RETRY.MAX_ATTEMPTS; attempt++) {
        try {
          const result = await submitVision(text);
          setEnrichedPrompt(result.prompt || '');
          setLastGeneratedUrl(result.imageUrl || null);

          if (result.imageUrl) {
            pushVision({
              id: result.id,
              imageUrl: result.imageUrl,
              prompt: result.prompt,
              createdAt: new Date().toISOString(),
            });
          }

          setPhase('done');
          return;
        } catch (err) {
          if (attempt >= RETRY.MAX_ATTEMPTS) {
            setError(err.message);
            return;
          }
          // Exponential backoff with jitter
          const delay = Math.min(
            RETRY.BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 500,
            RETRY.MAX_DELAY_MS,
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    },
    [setPhase, setEnrichedPrompt, setLastGeneratedUrl, pushVision, setError],
  );

  const displayStatus = !supported ? 'unsupported' : phase;

  return (
    <div className={styles.wrap}>
      <MicButton
        onPressStart={handlePressStart}
        onPressEnd={handlePressEnd}
      />

      <TranscriptDisplay
        text={speechText}
        interim={interim}
        isLive={listening}
      />

      <StatusIndicator status={displayStatus} />
    </div>
  );
}
