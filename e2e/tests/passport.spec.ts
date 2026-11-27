import { expect, pageAs, pdfFile, pick, test, uniq } from '../fixtures.js';

/**
 * R-FLOW-11 (spec §3, D-39..D-42): `reagent` / `standard_substance` namunasi kimyogar va protokolsiz,
 * pasport orqali `approved` bo'ladi.
 *  - reagent: kontrolyor pasport yuklaydi (pending) → lab_head tasdiqlaydi;
 *  - standard_substance: lab_head yuklagan pasport darhol tasdiqlanadi.
 * Ikkala holatda reyestrda pasport fayli yuklab olinadi.
 */

async function createSample(page: import('@playwright/test').Page, name: string, type: string) {
  await page.goto('/samples');
  await page.getByRole('button', { name: 'Yangi namuna' }).click();
  const dialog = page.getByRole('dialog');
  await pick(dialog, 'Namuna turi', type);
  await dialog.getByLabel('Modda nomi', { exact: true }).fill(name);
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('searchbox').fill(name);
  await page.getByRole('link', { name }).first().click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

test('R-FLOW-11: reaktiv namunasi — kontrolyor pasporti, lab_head tasdig‘i, protokolsiz approved', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const name = uniq('E2E Reaktiv-pasport');
  const kontrolyor = await pageAs(browser, 'kontrolyor');
  await createSample(kontrolyor, name, 'Reaktiv');
  const sampleUrl = new URL(kontrolyor.url()).pathname;

  await test.step('kontrolyor: pasport yuklaydi → tasdiq kutilmoqda', async () => {
    await expect(kontrolyor.getByText(/tasdiqlashning yagona yo'li/)).toBeVisible();
    await kontrolyor
      .getByLabel('Pasport fayli')
      .setInputFiles(pdfFile('pasport-reaktiv.pdf', `${name} passport`));
    await expect(kontrolyor.getByText('pasport-reaktiv.pdf')).toBeVisible();
    await expect(kontrolyor.getByText('Kutilmoqda').first()).toBeVisible();
  });

  const labHead = await pageAs(browser, 'labHead');
  await test.step('lab_head: biriktirish tugmasi yo‘q, pasportni tasdiqlaydi → namuna approved', async () => {
    await labHead.goto(sampleUrl);
    await expect(labHead.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(labHead.getByRole('button', { name: 'Kimyogarga biriktirish' })).toHaveCount(0);
    await labHead.getByRole('button', { name: 'Tasdiqlash' }).click();
    await expect(labHead.getByText('Pasport tasdiqlandi').first()).toBeVisible();
    await expect(labHead.getByText('Tasdiqlangan').first()).toBeVisible();
    // Protokol yaratilmagan
    await expect(labHead.getByText('Ushbu namunada protokollar topilmadi.')).toBeVisible();
  });

  await test.step('reyestr: pasport yuklab olinadi', async () => {
    await labHead.goto('/registry');
    await labHead.getByLabel('Modda nomi').fill(name);
    await labHead.getByRole('button', { name: 'Qidirish' }).click();
    const row = labHead.getByRole('row').filter({ hasText: name });
    const response = labHead
      .context()
      .waitForEvent('response', (r) => r.url().includes('/api/v1/__test/files'));
    await row.getByRole('button', { name: 'Pasportni yuklab olish' }).click();
    const res = await response;
    expect(res.status()).toBe(200);
    expect(res.headers()['content-disposition']).toContain('pasport-reaktiv.pdf');
  });
});

test('R-FLOW-11: standart namuna — lab_head yuklagan pasport darhol tasdiqlanadi', async ({
  browser,
}) => {
  const name = uniq('E2E Standart');
  const kontrolyor = await pageAs(browser, 'kontrolyor');
  await createSample(kontrolyor, name, 'Standart namuna');
  const sampleUrl = new URL(kontrolyor.url()).pathname;

  const labHead = await pageAs(browser, 'labHead');
  await labHead.goto(sampleUrl);
  await expect(labHead.getByText(/darhol tasdiqlanadi/)).toBeVisible();
  await labHead
    .getByLabel('Pasport fayli')
    .setInputFiles(pdfFile('pasport-standart.pdf', `${name} CoA`));
  await expect(labHead.getByText('pasport-standart.pdf')).toBeVisible();
  await expect(labHead.getByText('Tasdiqlangan').first()).toBeVisible();

  // Kontrolyor ham tasdiqlangan holatni ko'radi
  await kontrolyor.reload();
  await expect(kontrolyor.getByText('Tasdiqlangan').first()).toBeVisible();
});
