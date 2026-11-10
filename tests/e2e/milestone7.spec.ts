import { expect, test } from '@playwright/test';
import { card, openApp, openTab, startProgramC, visibleText } from './helpers';

test('Not today skips the day with a reason, shows the next one, and History keeps it', async ({
  page,
}) => {
  await openApp(page);
  await startProgramC(page);
  await expect(visibleText(page, 'Training today?')).toBeVisible();
  await visibleText(page, 'Not today').click();
  await visibleText(page, 'Busy').click();
  await visibleText(page, 'Skip day').click();

  await expect(visibleText(page, 'Missed: Heavy (planche first)')).toBeVisible();
  await expect(visibleText(page, 'Busy')).toBeVisible();
  await expect(visibleText(page, 'Next: Light (front lever first), Wed 4 Nov')).toBeVisible();

  await openTab(page, 'History');
  await expect(
    page.getByRole('button', { name: 'Monday 2 November, missed Heavy (planche first)' }),
  ).toBeVisible();
  await expect(visibleText(page, '2 Nov · Busy')).toBeVisible();
});

test('the Excel preset starts in the chosen week, and week 5 halves the sets', async ({ page }) => {
  await openApp(page);
  await openTab(page, 'Programs');
  await visibleText(page, 'New program').click();
  await visibleText(page, 'Calisthenics 5-week cycle').click();
  await expect(visibleText(page, 'Weeks 3-4')).toBeVisible();
  const more = page.locator('ion-button[aria-label="More weeks"]').filter({ visible: true });
  for (let i = 0; i < 4; i++) await more.click();
  await visibleText(page, 'Use this program').click();

  // Monday is a rest day in the sheet, and Tuesday of week 5 is the deloaded Heavy 1.
  await expect(visibleText(page, 'Week 5 of 5')).toBeVisible();
  await expect(visibleText(page, 'Rest day')).toBeVisible();
  await expect(visibleText(page, 'Next: Heavy 1, planche (volume), Tue 3 Nov')).toBeVisible();
  await page.clock.fastForward('24:00:00');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(visibleText(page, 'Heavy 1, planche (volume)')).toBeVisible();
  await expect(visibleText(page, 'Deload')).toBeVisible();
  await visibleText(page, 'Start').click();

  // The sheet's deload: Planche Complex 3 sets become 2.
  const complex = card(page, 'Planche Complex');
  await expect(complex.locator('ion-item', { hasText: /^Set \d/ })).toHaveCount(2);
});

test('the check button logs a set in one tap and starts the rest', async ({ page }) => {
  await openApp(page);
  await startProgramC(page);
  await visibleText(page, 'Start').click();
  await expect(visibleText(page, 'Weighted Dips')).toBeVisible();
  const dips = card(page, 'Weighted Dips');
  await dips.locator('ion-button[aria-label="Log set 1 of Weighted Dips"]').click();
  await expect(dips.getByText(/^Set 1 · /)).toBeVisible();
  await expect(page.getByTestId('rest-bar')).toContainText(/^Rest2:\d\d/);
});
