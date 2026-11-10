import { expect, test } from '@playwright/test';
import {
  MONDAY,
  card,
  expectRestBarOnTop,
  finishWorkout,
  logNextSet,
  logSets,
  openApp,
  openTab,
  startProgramC,
  visibleText,
} from './helpers';

test('flow 1: fresh start, activate Program C, Today shows the right day', async ({ page }) => {
  await openApp(page);
  await expect(visibleText(page, 'Pick a program')).toBeVisible();
  await startProgramC(page);
  await expect(visibleText(page, 'Heavy (planche first)')).toBeVisible();
  await expect(visibleText(page, 'Week 1 of 6')).toBeVisible();
});

test('flow 1: a mocked Tuesday is a rest day, and Wednesday is Light', async ({ page }) => {
  await openApp(page, new Date('2026-11-03T09:00:00'));
  await startProgramC(page);
  await expect(visibleText(page, 'Rest day')).toBeVisible();
  await expect(visibleText(page, 'Next: Light (front lever first), Wed 4 Nov')).toBeVisible();
});

test('flow 2: log a full Heavy day with rest, finish, and find it in History', async ({ page }) => {
  test.setTimeout(180_000); // 18 sets, each with a sheet opening and closing
  await openApp(page);
  await startProgramC(page);
  await visibleText(page, 'Start').click();
  await expect(visibleText(page, 'Planche Complex')).toBeVisible();

  // Warm-up is a toggle, and starts no rest.
  await card(page, 'Warm-up').locator('ion-toggle').click();
  await expect(page.getByTestId('rest-bar')).toBeHidden();

  await logNextSet(page, 'Planche Complex');
  await expect(page.getByTestId('rest-bar')).toContainText(/^Rest[23]:\d\d/);
  await expectRestBarOnTop(page);
  await visibleText(page, '+15s').click();
  await visibleText(page, 'Skip').click();
  await expect(page.getByTestId('rest-bar')).toBeHidden();

  await logSets(page, 'Planche Complex', 2);
  await logSets(page, 'Front Lever Complex', 3);

  await visibleText(page, 'Planche Lean').click();
  await expect(
    card(page, 'Planche Lean').locator('ion-item', { hasText: 'tap to log' }),
  ).toHaveCount(3);
  await logSets(page, 'Planche Lean', 3);

  await logSets(page, 'Weighted Dips', 2);
  await logSets(page, 'Weighted Pull-ups', 2);
  await logSets(page, 'Lateral Raise', 3);
  await logSets(page, 'Bicep Curl', 2);
  await expect(card(page, 'Weighted Dips')).toContainText('Set 1 · +25kg x 8');

  await page.clock.fastForward('45:00');
  await page.clock.resume();
  await finishWorkout(page);

  await expect(visibleText(page, 'Duration')).toBeVisible();
  await expect(card(page, 'Working sets')).toContainText('Working sets18');
  await visibleText(page, 'Close').click();
  await expect(visibleText(page, 'Done: Heavy (planche first)')).toBeVisible();
  await expect(visibleText(page, 'Next: Light (front lever first), Wed 4 Nov')).toBeVisible();

  await openTab(page, 'History');
  const day = page.getByRole('button', { name: 'Monday 2 November, Heavy (planche first)' });
  await expect(day.locator('[data-day-type="skill_heavy"]')).toBeVisible();
  await page
    .locator('ion-item', { hasText: 'Heavy (planche first)' })
    .filter({ visible: true })
    .click();
  await expect(visibleText(page, 'Monday 2 November')).toBeVisible();
  await expect(card(page, 'Weighted Dips')).toContainText('Set 1 · +25kg x 8');
  await expect(card(page, 'Working sets')).toContainText('Working sets18');
});

test('flow 3: reload mid-workout, Resume restores the sets and the rest', async ({ page }) => {
  await openApp(page);
  await startProgramC(page);
  await visibleText(page, 'Start').click();
  await logNextSet(page, 'Planche Complex');
  await expect(page.getByTestId('rest-bar')).toContainText(/^Rest[23]:\d\d/);

  await page.clock.fastForward('00:30');
  await page.clock.resume();
  await page.goto('./#/tabs/today');
  await page.reload();

  await expect(visibleText(page, 'Resume workout')).toBeVisible();
  await expect(page.getByTestId('rest-bar')).toContainText(/^Rest2:[0-3]\d/);
  await visibleText(page, 'Resume workout').click();
  await expect(card(page, 'Planche Complex')).toContainText('Set 1 ·');
  await expect(card(page, 'Planche Complex')).toContainText('band 25kg');
});

test('the rest bar stays on every tab and says when rest is over', async ({ page }) => {
  await openApp(page, MONDAY);
  await startProgramC(page);
  await visibleText(page, 'Start').click();
  await logNextSet(page, 'Planche Complex');
  await openTab(page, 'History');
  await expect(page.getByTestId('rest-bar')).toBeVisible();
  await page.clock.fastForward('03:01');
  await page.clock.resume();
  await expect(page.getByTestId('rest-bar')).toContainText('Rest over');
  await visibleText(page, 'Dismiss').click();
  await expect(page.getByTestId('rest-bar')).toBeHidden();
});
