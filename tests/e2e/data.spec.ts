import { readFile } from 'node:fs/promises';
import { devices, expect, test, type Page } from '@playwright/test';
import {
  card,
  finishWorkout,
  logNextSet,
  openApp,
  openTab,
  startProgramC,
  visibleText,
} from './helpers';

/** Exports through Settings. There is no share sheet here, so the backup arrives as a download. */
async function exportBackup(page: Page, path: string): Promise<{ data: unknown }> {
  await openTab(page, 'Settings');
  const download = page.waitForEvent('download');
  await visibleText(page, 'Export backup').click();
  await (await download).saveAs(path);
  await expect(visibleText(page, 'Backup saved.')).toBeVisible();
  return JSON.parse(await readFile(path, 'utf8')) as { data: unknown };
}

async function clearStorage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const databases = await indexedDB.databases();
    await Promise.all(
      databases.map(
        ({ name }) =>
          new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(name ?? '');
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
          }),
      ),
    );
  });
  await page.reload();
}

test('flow 4: export a backup, clear storage, restore, same data', async ({ page }, testInfo) => {
  await openApp(page);
  await startProgramC(page);
  await visibleText(page, 'Start').click();
  await logNextSet(page, 'Planche Complex');
  await page.clock.fastForward('10:00');
  await page.clock.resume();
  await finishWorkout(page);
  await visibleText(page, 'Close').click();

  const before = await exportBackup(page, testInfo.outputPath('before.json'));

  await clearStorage(page);
  await openTab(page, 'Today');
  await expect(visibleText(page, 'Pick a program')).toBeVisible();

  await openTab(page, 'Settings');
  await page.getByLabel('Backup file').setInputFiles(testInfo.outputPath('before.json'));
  await visibleText(page, 'Replace all data').click();
  await expect(visibleText(page, 'Backup restored.')).toBeVisible();

  const after = await exportBackup(page, testInfo.outputPath('after.json'));
  expect(after.data).toEqual(before.data);

  await openTab(page, 'History');
  await expect(
    page.locator('ion-item', { hasText: 'Heavy (planche first)' }).filter({ visible: true }),
  ).toBeVisible();
  await openTab(page, 'Today');
  await expect(visibleText(page, 'Done: Heavy (planche first)')).toBeVisible();
});

test('flow 5: share Program A as a code, import it in a fresh browser', async ({
  browser,
  page,
}, testInfo) => {
  await openApp(page);
  await openTab(page, 'Programs');
  await visibleText(page, 'New program').click();
  await page.locator('ion-item', { hasText: 'ULU/LUL' }).filter({ visible: true }).first().click();
  await visibleText(page, 'Edit before using').click();
  await visibleText(page, 'Share program').click();
  const code = await page.locator('.share-code').filter({ visible: true }).innerText();
  expect(code).toMatch(/^WT1\./);

  const { baseURL } = testInfo.project.use;
  const friend = await browser.newContext({ ...devices['iPhone 13'], baseURL });
  const friendPage = await friend.newPage();
  await openApp(friendPage);
  await openTab(friendPage, 'Programs');
  await visibleText(friendPage, 'Import program').click();
  await friendPage.getByRole('textbox', { name: 'Share code' }).fill(code);
  await visibleText(friendPage, 'Preview').click();
  await expect(visibleText(friendPage, '4 days')).toBeVisible();
  await expect(card(friendPage, 'New exercises')).toContainText('New exercises0');
  await visibleText(friendPage, 'Add program').click();

  for (const day of ['Upper A', 'Lower A', 'Upper B', 'Lower B']) {
    await expect(visibleText(friendPage, day)).toBeVisible();
  }
  await friend.close();
});
