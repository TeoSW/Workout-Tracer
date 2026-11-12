import { expect, test } from '@playwright/test';
import { card, finishWorkout, openApp, openTab, visibleText } from './helpers';

test('a custom workout: log, repeat a set, note it, save it as a program, and see the stats', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openApp(page);
  await visibleText(page, 'Empty workout').click();
  await expect(page).toHaveURL(/#\/tabs\/today\/workout$/);

  // Add an exercise.
  await visibleText(page, 'Add exercise').click();
  await page.locator('ion-searchbar input').filter({ visible: true }).fill('Squat');
  await page
    .locator('ion-item', { hasText: /^Squat$/ })
    .filter({ visible: true })
    .first()
    .click();
  const squat = card(page, 'Squat');
  await expect(squat).toBeVisible();

  // Log set 1 with a note.
  await squat.locator('ion-item', { hasText: 'Set 1' }).first().click();
  await page.getByRole('textbox', { name: 'Set note' }).fill('Felt easy');
  const done = page.getByTestId('sheet-done');
  // Squat has no plan here, so give it reps first.
  await page
    .locator('ion-button[aria-label="More reps"]')
    .filter({ visible: true })
    .first()
    .click();
  await done.click();
  await expect(squat.getByText('Felt easy')).toBeVisible();

  // Repeat it in one tap.
  await squat.locator('ion-button[aria-label^="Repeat set 1"]').click();
  await expect(squat.getByText(/^Set 2 · /)).toBeVisible();

  await finishWorkout(page);
  await expect(visibleText(page, 'Working time')).toBeVisible();

  // Keep it as a program.
  await visibleText(page, 'Save as a new program').click();
  await page.locator('ion-alert input').fill('Leg day');
  await page.locator('ion-alert button', { hasText: 'Save' }).click();
  await expect(visibleText(page, 'Saved as Leg day, under Programs.')).toBeVisible();

  await openTab(page, 'Programs');
  await expect(visibleText(page, 'Leg day')).toBeVisible();

  // The weekly stats count it.
  await openTab(page, 'Progress');
  await expect(visibleText(page, 'Sets and reps per week')).toBeVisible();
  await expect(page.getByText(/^This week 2 sets and/).filter({ visible: true })).toBeVisible();
});
