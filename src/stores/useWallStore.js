import { create } from 'zustand';
import { DREAM_IMAGES } from '@/config';

export const useWallStore = create((set, get) => ({
  /* --- Input page FSM --- */
  phase: 'idle', // idle | recording | transcribing | enriching | generating | done | error
  transcript: '',
  enrichedPrompt: '',
  generationProgress: 0,
  lastGeneratedUrl: null,
  errorMessage: null,

  setPhase: (phase) => set({ phase }),
  setTranscript: (transcript) => set({ transcript }),
  setEnrichedPrompt: (enrichedPrompt) => set({ enrichedPrompt }),
  setGenerationProgress: (generationProgress) => set({ generationProgress }),
  setLastGeneratedUrl: (lastGeneratedUrl) => set({ lastGeneratedUrl }),
  setError: (errorMessage) => set({ phase: 'error', errorMessage }),
  resetInput: () =>
    set({
      phase: 'idle',
      transcript: '',
      enrichedPrompt: '',
      generationProgress: 0,
      lastGeneratedUrl: null,
      errorMessage: null,
    }),

  /* --- Wall page --- */
  visionQueue: [],
  dreamImages: DREAM_IMAGES,
  currentIndex: 0,
  nextIndex: 1,
  morphProgress: 0,
  isIdle: true,

  pushVision: (vision) =>
    set((state) => ({
      visionQueue: [...state.visionQueue, vision],
      isIdle: false,
    })),

  advanceVision: () =>
    set((state) => {
      const images = state.isIdle ? state.dreamImages : state.visionQueue.map((v) => v.imageUrl);
      const total = images.length;
      if (total < 2) return {};
      const next = (state.nextIndex + 1) % total;
      return {
        currentIndex: state.nextIndex,
        nextIndex: next,
        morphProgress: 0,
      };
    }),

  setMorphProgress: (morphProgress) => set({ morphProgress }),

  resetToIdle: () =>
    set({
      isIdle: true,
      currentIndex: 0,
      nextIndex: 1,
      morphProgress: 0,
    }),
}));
