import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import './styles/global.css';

const params = new URLSearchParams(window.location.search);
const isKiosk = params.has('kiosk');

if (isKiosk) {
  document.documentElement.classList.add('kiosk-mode');

  // Request fullscreen on first user interaction
  const requestFS = () => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    document.removeEventListener('pointerdown', requestFS);
  };
  document.addEventListener('pointerdown', requestFS);

  // Block context menu
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // Block pinch-zoom / scroll
  document.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
}

// F11 fullscreen toggle (works outside kiosk mode too)
document.addEventListener('keydown', (e) => {
  if (e.key === 'F11') {
    e.preventDefault();
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
