import { expect, login, test, world } from '../fixtures.js';

/**
 * TZ §3.3 — ND bo'yicha bajarish mumkinligi: har sabab aniq matn bilan.
 * Seed: "ND-E2E-MOSLIK" talablari — Gaz xromatograf (laboratoriyada yo'q), Muffel pech (texnik xizmatda),
 * Spektrofotometr (kalibrlash o'tgan), Natriy xlorid 10 g/tahlil (1 g bor), Atseton (faqat muddati o'tgan lot).
 */
test('TZ §3.3: apparat yo‘q / xizmatda / kalibrlash o‘tgan, reaktiv yetmaydi / muddati o‘tgan — aniq sabablar', async ({
  page,
}) => {
  await login(page, 'labHead');
  await page.goto(`/nd/${world().nd.feasibility}`);

  await expect(page.getByRole('heading', { name: 'Bajarish mumkinligi' })).toBeVisible();
  const panel = page.getByRole('main');
  await expect(panel.getByText('Tahlilni bajarish mumkin emas')).toBeVisible();

  await expect(
    panel.getByText('"Gaz xromatograf" turidagi apparat laboratoriyada yo‘q'),
  ).toBeVisible();
  await expect(panel.getByText('"E2E Mufel pech" (Muffel pech): Texnik xizmatda')).toBeVisible();
  await expect(
    panel.getByText(/"E2E Spektrofotometr" \(Spektrofotometr\) kalibrlash muddati o‘tgan: \S+/),
  ).toBeVisible();
  await expect(
    panel.getByText('"E2E Natriy xlorid" yetarli emas: kerak 10 g, mavjud 1 g, yetishmaydi 9 g'),
  ).toBeVisible();
  await expect(
    panel.getByText('"E2E Atseton" reaktivining barcha lotlari muddati o‘tgan'),
  ).toBeVisible();

  // Tahlillar soni o'zgarsa — hisob qayta: 3 tahlil → 30 g kerak
  await panel.getByLabel('Tahlillar soni').fill('3');
  await expect(
    panel.getByText('"E2E Natriy xlorid" yetarli emas: kerak 30 g, mavjud 1 g, yetishmaydi 29 g'),
  ).toBeVisible();
});

test('TZ §3.3: hamma talab bajarilganda — "bajarish mumkin"', async ({ page }) => {
  await login(page, 'chemist');
  await page.goto(`/nd/${world().nd.ok}`);
  await expect(page.getByText('Tahlilni bajarish mumkin', { exact: true })).toBeVisible();
});
