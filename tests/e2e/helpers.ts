import { expect, type Locator, type Page } from '@playwright/test';

/** Monday of the first week in these tests. */
export const MONDAY = new Date('2026-11-02T09:00:00');

/** The shown element with this text. Ionic keeps left pages in the DOM, hidden. */
export function visibleText(page: Page, text: string): Locator {
  return page.getByText(text, { exact: true }).filter({ visible: true }).first();
}

export async function openTab(page: Page, name: string): Promise<void> {
  await page.locator('ion-tab-button', { hasText: name }).click();
}

/** Opens the app on a mocked date. Time keeps moving unless a test moves it. */
export async function openApp(page: Page, date = MONDAY): Promise<void> {
  await page.clock.install({ time: date });
  await page.goto('./');
  await expect(page).toHaveURL(/#\/tabs\/today$/);
}

/** Creates Program C from its template and starts it this week, through the screens. */
export async function startProgramC(page: Page): Promise<void> {
  await openTab(page, 'Programs');
  await visibleText(page, 'New program').click();
  await page.locator('ion-select').filter({ visible: true }).first().click();
  await page.locator('ion-action-sheet button', { hasText: 'Calisthenics cycle' }).click();
  await visibleText(page, 'Calisthenics 6-week cycle').click();
  await visibleText(page, 'Create').click();
  await visibleText(page, 'Start this week').click();
  await expect(visibleText(page, 'Stop using this program')).toBeVisible();
  await openTab(page, 'Today');
}

export function card(page: Page, name: string): Locator {
  return page.locator('ion-list').filter({ visible: true }).filter({ hasText: name }).first();
}

/** Taps the next pending set of a card and accepts the prefilled values. */
export async function logNextSet(page: Page, name: string): Promise<void> {
  const pending = card(page, name).locator('ion-item', { hasText: 'tap to log' });
  await expect(pending.first()).toBeVisible();
  const before = await pending.count();
  await pending.first().click();
  const done = page.getByTestId('sheet-done');
  await expect(done).toBeVisible();
  await done.click();
  await expect(done).toBeHidden();
  await expect(pending).toHaveCount(before - 1);
}

export async function logSets(page: Page, name: string, count: number): Promise<void> {
  for (let i = 0; i < count; i++) await logNextSet(page, name);
}

export async function finishWorkout(page: Page): Promise<void> {
  await page.getByTestId('finish-workout').filter({ visible: true }).click();
  await page.locator('ion-alert button', { hasText: 'Finish' }).click();
}
