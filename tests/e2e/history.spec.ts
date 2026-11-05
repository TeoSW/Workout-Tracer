import { expect, test, type Page } from '@playwright/test';
import { card, finishWorkout, openApp, openTab, visibleText } from './helpers';

/** An empty workout with one set of squats, finished and closed. */
async function logSquats(page: Page, kg: string, reps: string): Promise<void> {
  await openTab(page, 'Today');
  await visibleText(page, 'Empty workout').click();
  await visibleText(page, 'Add exercise').click();
  await page.getByPlaceholder('Search').filter({ visible: true }).fill('Squat');
  await visibleText(page, 'Squat').click();
  await card(page, 'Squat').locator('ion-item', { hasText: 'Set 1' }).click();
  await page.getByRole('textbox', { name: 'Kg', exact: true }).fill(kg);
  await page.getByRole('textbox', { name: 'Reps', exact: true }).fill(reps);
  await page.getByTestId('sheet-done').click();
  await expect(page.getByTestId('sheet-done')).toBeHidden();
  await finishWorkout(page);
  await visibleText(page, 'Close').click();
  await expect(page).toHaveURL(/#\/tabs\/today$/);
}

test('corrects a set in History, then deletes the workout', async ({ page }) => {
  await openApp(page);
  await logSquats(page, '20', '5');

  await openTab(page, 'History');
  await expect(
    page.getByRole('button', { name: 'Monday 2 November, Empty workout' }),
  ).toBeVisible();
  await page.getByRole('heading', { name: 'Empty workout' }).filter({ visible: true }).click();
  await expect(visibleText(page, 'Set 1 · 20kg x 5')).toBeVisible();

  await visibleText(page, 'Edit').click();
  await expect(visibleText(page, 'Edit workout')).toBeVisible();
  await expect(visibleText(page, 'Monday 2 November')).toBeHidden();
  await visibleText(page, 'Set 1 · 20kg x 5').click();
  await page.getByRole('textbox', { name: 'Kg', exact: true }).fill('22.5');
  await page.getByTestId('sheet-done').click();
  await expect(page.getByTestId('sheet-done')).toBeHidden();
  await expect(visibleText(page, 'Set 1 · 22.5kg x 5')).toBeVisible();
  await expect(page.getByTestId('rest-bar')).toBeHidden();

  await page.locator('ion-back-button').filter({ visible: true }).click();
  await expect(visibleText(page, 'Set 1 · 22.5kg x 5')).toBeVisible();

  await visibleText(page, 'Delete workout').click();
  await page.locator('ion-alert button', { hasText: 'Delete' }).click();
  await expect(visibleText(page, 'Finished workouts will show here.')).toBeVisible();
});

test('a first session draws charts, on a Progress tab already open', async ({ page }) => {
  await openApp(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openTab(page, 'Progress');
  await expect(visibleText(page, 'Stats will show here once you log workouts.')).toBeVisible();
  await logSquats(page, '20', '5');

  await openTab(page, 'Progress');
  await expect(page.getByText(/^1 week streak/).filter({ visible: true })).toBeVisible();
  await visibleText(page, 'Exercises').click();
  await page.getByRole('heading', { name: 'Squat', exact: true }).filter({ visible: true }).click();
  await expect(visibleText(page, 'Latest 20kg, best 20kg')).toBeVisible();
  await expect(page.locator('.recharts-line-dot').filter({ visible: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('Progress draws charts, and a tap on one reads a value', async ({ page }) => {
  await openApp(page);
  await logSquats(page, '20', '5');
  await page.clock.fastForward('24:00:00');
  await logSquats(page, '25', '5');

  await openTab(page, 'Progress');
  await expect(visibleText(page, 'Squat: heaviest load 25kg')).toBeVisible();
  await expect(page.locator('.recharts-surface').filter({ visible: true }).first()).toBeVisible();

  await visibleText(page, 'Exercises').click();
  await page.getByRole('heading', { name: 'Squat', exact: true }).filter({ visible: true }).click();
  await expect(visibleText(page, 'Latest 25kg, best 25kg')).toBeVisible();

  const chart = page
    .locator('.chart-card', { hasText: 'Latest 25kg, best 25kg' })
    .locator('.recharts-surface')
    .first();
  await chart.scrollIntoViewIfNeeded();
  const box = await chart.boundingBox();
  if (!box) throw new Error('No chart');
  await page.touchscreen.tap(box.x + box.width - 24, box.y + box.height / 2);
  await expect(page.getByTestId('chart-tooltip').filter({ visible: true })).toContainText('25kg');
});
