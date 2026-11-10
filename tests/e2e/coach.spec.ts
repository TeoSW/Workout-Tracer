import { devices, expect, test } from '@playwright/test';
import { openApp, openTab, startProgramC, visibleText } from './helpers';

test('a coach builds a client program, sends it, the client imports it, and My training is untouched', async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  // The share sheet can't open here, so record what would have been sent.
  await page.addInitScript(() => {
    const sent: string[] = [];
    Object.assign(window, { sentTexts: sent });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: { text?: string }) => {
        sent.push(data.text ?? '');
      },
    });
  });

  // My training first, so there is something to keep.
  await openApp(page);
  await startProgramC(page);
  await expect(visibleText(page, 'Heavy (planche first)')).toBeVisible();

  // Switch to Coach.
  await openTab(page, 'Settings');
  await page.locator('ion-segment-button', { hasText: 'Coach' }).filter({ visible: true }).click();
  await page.locator('ion-alert button', { hasText: 'Switch' }).click();
  await expect(page.locator('ion-tab-button', { hasText: 'Clients' })).toBeVisible();
  await expect(page.locator('ion-tab-button', { hasText: 'Today' })).toHaveCount(0);

  // Add a client and build their program from the 5-week preset.
  await openTab(page, 'Clients');
  await visibleText(page, 'Add client').click();
  await page.getByRole('textbox', { name: 'Client name' }).fill('Ana');
  await page.locator('ion-modal ion-button', { hasText: 'Add' }).click();
  await visibleText(page, 'Ana').click();
  await visibleText(page, 'New program for Ana').click();
  await visibleText(page, 'Calisthenics 5-week cycle').click();
  await visibleText(page, 'Create for Ana').click();

  // Send it.
  await visibleText(page, 'Send to Ana').click();
  await visibleText(page, 'Send message').click();
  await expect(visibleText(page, 'Sent to Ana.')).toBeVisible();
  const texts = await page.evaluate(() => (window as unknown as { sentTexts: string[] }).sentTexts);
  const code = /WT1\.\S+/.exec(texts[0] ?? '')?.[0] ?? '';
  expect(code).not.toBe('');

  // The client's phone imports it.
  const { baseURL } = testInfo.project.use;
  const phone = await browser.newContext({ ...devices['iPhone 13'], baseURL });
  const client = await phone.newPage();
  await openApp(client);
  await openTab(client, 'Programs');
  await visibleText(client, 'Import program').click();
  await client.getByRole('textbox', { name: 'Share code' }).fill(code);
  await visibleText(client, 'Preview').click();
  await visibleText(client, 'Add program').click();
  await expect(visibleText(client, 'Heavy 1, planche (intensity)')).toBeVisible();
  await phone.close();

  // Back to My training: the active program and Today are as they were.
  await openTab(page, 'Settings');
  await page
    .locator('ion-segment-button', { hasText: 'My training' })
    .filter({ visible: true })
    .click();
  await page.locator('ion-alert button', { hasText: 'Switch' }).click();
  await expect(page.locator('ion-tab-button', { hasText: 'Today' })).toBeVisible();
  await openTab(page, 'Today');
  await expect(visibleText(page, 'Heavy (planche first)')).toBeVisible();
  await expect(visibleText(page, 'Week 1 of 6')).toBeVisible();
});
