import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { enrichPrompt } from '../services/promptEnricher.js';
import { generateImage } from '../services/imageGenerator.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * POST /api/vision
 * Body: { text: string }
 * Response: { id, status, prompt, imageUrl? }
 */
export async function handleVision(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body || {};
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'text is required' });
  }

  const transcript = text.trim();
  const db = getFirestore();
  const bucket = getStorage().bucket();
  const id = `vision_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    // Step 1: Enrich prompt
    const prompt = await enrichPrompt(transcript);

    // Step 2: Create Firestore doc (generating status)
    const docRef = db.collection('visions').doc(id);
    await docRef.set({
      transcript,
      prompt,
      status: 'generating',
      createdAt: FieldValue.serverTimestamp(),
    });

    // Step 3: Generate image
    let baseImageBuffer = null;
    try {
      const basePath = join(__dirname, '..', 'assets', 'base-img.png');
      baseImageBuffer = await readFile(basePath);
    } catch {
      console.warn('[vision] base-img.png not found in functions/assets — using txt2img');
    }

    const imageBuffer = await generateImage(prompt, baseImageBuffer);

    // Step 4: Upload to Firebase Storage
    const filePath = `generated/${id}.png`;
    const file = bucket.file(filePath);
    await file.save(imageBuffer, {
      metadata: { contentType: 'image/png' },
    });
    await file.makePublic();
    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    // Step 5: Update Firestore doc
    await docRef.update({
      status: 'complete',
      imageUrl,
    });

    return res.status(200).json({ id, status: 'complete', prompt, imageUrl });
  } catch (err) {
    console.error('[vision] Error:', err);

    // Update Firestore doc to error status
    try {
      const docRef = db.collection('visions').doc(id);
      await docRef.update({ status: 'error', error: err.message });
    } catch { /* ignore */ }

    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/visions
 * Query: ?limit=N (default 50)
 * Response: [{ id, imageUrl, prompt, createdAt }]
 */
export async function handleGetVisions(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const db = getFirestore();

  try {
    const snap = await db
      .collection('visions')
      .where('status', '==', 'complete')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const visions = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
    }));

    return res.status(200).json(visions);
  } catch (err) {
    console.error('[visions] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
