import { expect, test } from '@playwright/test';

test('opens on Today with five tabs', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveURL(/#\/tabs\/today$/);
  for (const name of ['Today', 'History', 'Progress', 'Programs', 'Settings']) {
    await expect(page.locator('ion-tab-button', { hasText: name })).toBeVisible();
  }
});
