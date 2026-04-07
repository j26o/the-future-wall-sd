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
  isIdle: true,

  // Diffusion transition state
  transitionFrames: [],     // Array of frame URLs from interpolation
  transitionIndex: -1,      // Current frame being played (-1 = not transitioning)
  isTransitioning: false,   // Whether a transition is in progress
  inferenceReady: false,    // Whether local inference server is available

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
      };
    }),

  setInferenceReady: (inferenceReady) => set({ inferenceReady }),

  setTransitionFrames: (frames) =>
    set({
      transitionFrames: frames,
      transitionIndex: 0,
      isTransitioning: true,
    }),

  advanceTransitionFrame: () =>
    set((state) => {
      const nextIdx = state.transitionIndex + 1;
      if (nextIdx >= state.transitionFrames.length) {
        return {
          transitionFrames: [],
          transitionIndex: -1,
          isTransitioning: false,
        };
      }
      return { transitionIndex: nextIdx };
    }),

  completeTransition: () =>
    set({
      transitionFrames: [],
      transitionIndex: -1,
      isTransitioning: false,
    }),

  resetToIdle: () =>
    set({
      isIdle: true,
      currentIndex: 0,
      nextIndex: 1,
      transitionFrames: [],
      transitionIndex: -1,
      isTransitioning: false,
    }),
}));
