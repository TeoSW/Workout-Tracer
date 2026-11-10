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

/** Starts Program C from its preset this week, through the screens. */
export async function startProgramC(page: Page): Promise<void> {
  await openTab(page, 'Programs');
  await visibleText(page, 'New program').click();
  await visibleText(page, 'Calisthenics 6-week cycle').click();
  await visibleText(page, 'Use this program').click();
  await expect(visibleText(page, 'Week 1 of 6')).toBeVisible();
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

/** Page content runs behind the bottom bars, so check what is really on top at the bar. */
export async function expectRestBarOnTop(page: Page): Promise<void> {
  const onTop = await page.getByTestId('rest-bar').evaluate((bar) => {
    const time = bar.querySelector('.rest-bar-time') as HTMLElement;
    const box = time.getBoundingClientRect();
    return bar.contains(document.elementFromPoint(box.left + 4, box.top + 4));
  });
  expect(onTop).toBe(true);
}
