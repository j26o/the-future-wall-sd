import { test, expect } from '@playwright/test';

const MOCK_VISIONS = [
  {
    id: 'vision_001',
    transcript: 'I see flying cars and green rooftops',
    prompt: 'Panoramic Singapore waterfront at night, flying vehicles above Marina Bay, lush green rooftop gardens, watercolour style, navy and teal palette',
    imageUrl: '/assets/dreams/dream_sky_gardens.jpg',
    createdAt: '2026-04-01T12:00:00.000Z',
    status: 'complete',
  },
  {
    id: 'vision_002',
    transcript: 'Coral reefs surrounding the city',
    prompt: 'Panoramic Singapore waterfront at night, vibrant coral reefs surrounding coastal structures, bioluminescent marine life, watercolour style',
    imageUrl: '/assets/dreams/dream_coral_reef.jpg',
    createdAt: '2026-04-01T11:30:00.000Z',
    status: 'complete',
  },
];

test.describe('Visions Page', () => {
  test('page loads with title', async ({ page }) => {
    await page.route('**/api/visions*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await page.goto('/visions');
    await expect(page.locator('h1')).toContainText('Submitted Visions');
  });

  test('shows empty state when no visions', async ({ page }) => {
    await page.route('**/api/visions*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await page.goto('/visions');
    await expect(page.getByText('No visions yet')).toBeVisible();
    await expect(page.getByText('0 visions')).toBeVisible();
  });

  test('renders vision cards with transcript, prompt, and image', async ({ page }) => {
    await page.route('**/api/visions*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_VISIONS),
      }),
    );
    await page.goto('/visions');

    // Count header
    await expect(page.getByText('2 visions')).toBeVisible();

    // Cards rendered
    const cards = page.locator('li');
    await expect(cards).toHaveCount(2);

    // First card content
    const firstCard = cards.first();
    await expect(firstCard.getByText('I see flying cars and green rooftops')).toBeVisible();
    await expect(firstCard.getByText(/Panoramic Singapore waterfront.*flying vehicles/)).toBeVisible();
    await expect(firstCard.locator('img')).toBeVisible();
  });

  test('displays labels for transcript and prompt fields', async ({ page }) => {
    await page.route('**/api/visions*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_VISIONS[0]]),
      }),
    );
    await page.goto('/visions');

    await expect(page.getByText('Raw transcript')).toBeVisible();
    await expect(page.getByText('Enriched prompt')).toBeVisible();
  });

  test('displays timestamp for each vision', async ({ page }) => {
    await page.route('**/api/visions*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_VISIONS[0]]),
      }),
    );
    await page.goto('/visions');

    const time = page.locator('time');
    await expect(time).toHaveCount(1);
    await expect(time).not.toBeEmpty();
  });

  test('shows error when API fails', async ({ page }) => {
    await page.route('**/api/visions*', (route) =>
      route.fulfill({ status: 500, contentType: 'text/plain', body: 'Internal Server Error' }),
    );
    await page.goto('/visions');

    await expect(page.getByText('Failed to load visions')).toBeVisible();
  });

  test('images use lazy loading', async ({ page }) => {
    await page.route('**/api/visions*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_VISIONS),
      }),
    );
    await page.goto('/visions');

    const images = page.locator('li img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      await expect(images.nth(i)).toHaveAttribute('loading', 'lazy');
    }
  });

  test('page is scrollable', async ({ page }) => {
    await page.route('**/api/visions*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await page.goto('/visions');

    const overflow = await page.evaluate(() => {
      const pageEl = document.querySelector('[class*="page"]');
      return getComputedStyle(pageEl).overflowY;
    });
    expect(overflow).toBe('auto');
  });
});
