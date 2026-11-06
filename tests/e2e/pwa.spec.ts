import { expect, test } from '@playwright/test';

const BASE_PATH = '/workout-tracker/';

test('the manifest matches the base path and its icons load', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const response = await request.get(new URL(href ?? '', page.url()).href);
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as {
    id: string;
    scope: string;
    start_url: string;
    display: string;
    icons: { src: string; sizes: string; purpose?: string }[];
  };
  expect(manifest.id).toBe(BASE_PATH);
  expect(manifest.scope).toBe(BASE_PATH);
  expect(manifest.start_url).toBe(BASE_PATH);
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512', '512x512']);
  expect(manifest.icons.at(-1)?.purpose).toBe('maskable');
  for (const icon of manifest.icons) {
    expect((await request.get(`${BASE_PATH}${icon.src}`)).ok(), icon.src).toBe(true);
  }
});

test('every icon and splash screen in the page exists', async ({ page, request }) => {
  await page.goto('./');
  const hrefs = await page
    .locator(
      'link[rel="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-startup-image"]',
    )
    .evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href));
  expect(hrefs.length).toBe(47);
  for (const href of hrefs) expect((await request.get(href)).ok(), href).toBe(true);
});
