import { expect, test } from '@playwright/test';
import { openApp, openTab, visibleText } from './helpers';

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

test('the service worker precaches the main chunk', async ({ page, request }) => {
  await page.goto('./');
  const script = await page.locator('script[type="module"][src]').first().getAttribute('src');
  const main = script?.split('/').pop() ?? '';
  expect(main).toMatch(/^index-.+\.js$/);
  expect(await (await request.get(`${BASE_PATH}sw.js`)).text()).toContain(`assets/${main}`);
});

test.describe('with the worker out of the way', () => {
  test.use({ serviceWorkers: 'block' });

  test('a chunk that will not load shows the crash screen, and the data can leave', async ({
    page,
  }) => {
    await page.route('**/ProgressContent-*.js', (route) => route.abort());
    await openApp(page);
    await openTab(page, 'Progress');
    await expect(page.getByText('Something went wrong')).toBeVisible();

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export my data' }).click();
    expect((await download).suggestedFilename()).toMatch(/^workout-tracker-backup-.+\.json$/);
    await expect(page.getByText('Backup saved.')).toBeVisible();

    await page.unroute('**/ProgressContent-*.js');
    await page.getByRole('button', { name: 'Reload' }).click();
    await expect(page.locator('ion-tab-button', { hasText: 'Today' })).toBeVisible();
  });
});

test('in the installed app there is no banner, and storage is requested', async ({ page }) => {
  await page.addInitScript(() => {
    let granted = false;
    Object.defineProperty(navigator, 'standalone', { value: true });
    StorageManager.prototype.persisted = async () => granted;
    StorageManager.prototype.persist = async () => (granted = true);
  });
  await openApp(page);
  await expect(visibleText(page, 'Bodyweight')).toBeVisible();
  await expect(page.getByText('Install this app')).toHaveCount(0);
  await openTab(page, 'Settings');
  await expect(visibleText(page, 'Persistent')).toBeVisible();
});

test('in a Safari tab the banner shows on Today', async ({ page }) => {
  await openApp(page);
  await expect(visibleText(page, 'Install this app')).toBeVisible();
});

test('it works offline from the first launch, charts chunk included', async ({ page, context }) => {
  await openApp(page);
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  // No reload yet, so the Progress chunk has never been fetched.
  await context.setOffline(true);
  await openTab(page, 'Progress');
  await expect(visibleText(page, 'Stats will show here once you log workouts.')).toBeVisible();

  await page.reload();
  await expect(visibleText(page, 'Stats will show here once you log workouts.')).toBeVisible();

  await openTab(page, 'Today');
  await visibleText(page, 'Empty workout').click();
  await expect(page.getByTestId('finish-workout').filter({ visible: true })).toBeVisible();
});
