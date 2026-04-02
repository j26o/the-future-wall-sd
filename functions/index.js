import { initializeApp } from 'firebase-admin/app';
import { onRequest } from 'firebase-functions/v2/https';
import { handleVision, handleGetVisions } from './routes/vision.js';

initializeApp();

/**
 * Main API function — routes requests based on path.
 */
export const api = onRequest(
  { cors: true, region: 'asia-southeast1' },
  async (req, res) => {
    const path = req.path;

    if (path === '/vision' || path === '/api/vision') {
      return handleVision(req, res);
    }

    if (path === '/visions' || path === '/api/visions') {
      return handleGetVisions(req, res);
    }

    if (path === '/health' || path === '/api/health') {
      return res.status(200).json({
        ok: true,
        timestamp: new Date().toISOString(),
        hfToken: !!process.env.HF_TOKEN,
      });
    }

    return res.status(404).json({ error: 'Not found' });
  },
);
