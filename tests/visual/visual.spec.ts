import { test, expect } from '@playwright/test';

test('visual regression test', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/SpriteAnvil/);
  
  // Wait for the canvas to be visible
  const canvas = page.locator('.stage__canvas');
  await expect(canvas).toBeVisible();

  // Wait for tool rail
  const toolRail = page.locator('.toolrail');
  await expect(toolRail).toBeVisible();

  // Take a screenshot of the entire page
  await expect(page).toHaveScreenshot('landing-page.png');
});
