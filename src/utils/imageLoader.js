const cache = new Map();

/**
 * Preload an image and return a promise that resolves with the HTMLImageElement.
 * Caches results so the same URL is only loaded once.
 */
export function preloadImage(src) {
  if (cache.has(src)) return cache.get(src);

  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });

  cache.set(src, promise);
  return promise;
}

/**
 * Preload an array of image URLs. Returns when all are loaded.
 */
export function preloadImages(srcs) {
  return Promise.all(srcs.map(preloadImage));
}
