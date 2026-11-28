import { expect, login, test } from '../fixtures.js';

/**
 * D-200: refresh so'rovi yo'lda turganda sahifa qayta yuklansa foydalanuvchi logout bo'lmaydi.
 * Birinchi refresh serverga yetadi (token aylantiriladi), lekin javobi brauzerga qaytmaydi —
 * eski cookie tiklanadi (javob yo'qolgan holat), so'ng sahifa reload qilinadi.
 */
test('refresh yo‘lda turganda reload — sessiya saqlanadi (grace)', async ({ page, context }) => {
  await login(page, 'chemist');
  const nav = page.getByRole('navigation').first();
  await expect(nav.getByRole('link', { name: 'Bosh sahifa', exact: true })).toBeVisible();

  const oldCookie = (await context.cookies()).find((c) => c.name === 'refresh_token');
  expect(oldCookie, 'refresh cookie').toBeTruthy();

  let held = 0;
  let serverRotated!: () => void;
  const rotated = new Promise<void>((resolve) => (serverRotated = resolve));
  await page.route('**/api/v1/auth/refresh', async (route) => {
    if (held++ > 0) return route.continue();
    // Server tokenni aylantiradi, lekin javob sahifaga hech qachon yetmaydi (sekin tarmoq + reload)
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    await context.addCookies([oldCookie!]);
    serverRotated();
  });

  // Bootstrap refresh boshlanadi va "osilib" qoladi
  await page.reload();
  await rotated;

  // Javob kelmasdan reload — brauzer eski cookie'ni yuboradi
  const second = page.waitForResponse(
    (r) => r.url().includes('/api/v1/auth/refresh') && r.request().method() === 'POST',
  );
  await page.reload();
  expect((await second).status()).toBe(200);

  await expect(page).not.toHaveURL(/\/login/);
  await expect(nav.getByRole('link', { name: 'Bosh sahifa', exact: true })).toBeVisible();

  // Keyingi oddiy reload ham ishlaydi (yangi token bilan rotatsiya davom etadi)
  await page.unroute('**/api/v1/auth/refresh');
  await page.reload();
  await expect(page).not.toHaveURL(/\/login/);
  await expect(nav.getByRole('link', { name: 'Bosh sahifa', exact: true })).toBeVisible();
});
