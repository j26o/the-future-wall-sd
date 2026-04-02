import { api } from './api';

export function submitVision(text) {
  return api('/api/vision', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export function getVisions(limit = 50) {
  return api(`/api/visions?limit=${limit}`);
}
