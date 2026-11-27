import type { Page } from '@playwright/test';
import { chooseFile, expect, pageAs, pdfFile, pick, test, uniq, who } from '../fixtures.js';

/**
 * Mobil (Telegram WebApp o'lchami 390×844, `telegram-mobile` loyihasi) — asosiy oqim smoke:
 * kontrolyor kiritadi → lab_head biriktiradi → kimyogar fayl yuklab yuboradi → lab_head tasdiqlaydi.
 * Har ekranda gorizontal toshib ketish yo'qligi tekshiriladi.
 */

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `gorizontal toshish: ${page.url()}`).toBeLessThanOrEqual(1);
}

test('mobil: asosiy namuna oqimi (kiritish → biriktirish → yuborish → tasdiqlash)', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const name = uniq('E2E Mobil');

  const kontrolyor = await pageAs(browser, 'kontrolyor');
  await kontrolyor.setViewportSize({ width: 390, height: 844 });
  await kontrolyor.goto('/samples');
  const newSample = kontrolyor.getByRole('button', { name: 'Yangi namuna' });
  await expect(newSample).toBeVisible();
  await expectNoHorizontalOverflow(kontrolyor);
  await newSample.click();
  const create = kontrolyor.getByRole('dialog');
  await create.getByLabel('Modda nomi', { exact: true }).fill(name);
  await create.getByLabel('Partiya (Lot) raqami').fill(`LOT-${name}`);
  await create.getByRole('button', { name: 'Saqlash' }).click();
  await expect(create).toHaveCount(0);
  await kontrolyor.getByRole('searchbox').fill(name);
  await kontrolyor.getByRole('link', { name }).first().click();
  await expect(kontrolyor.getByRole('heading', { level: 1, name })).toBeVisible();
  await expectNoHorizontalOverflow(kontrolyor);
  const samplePath = new URL(kontrolyor.url()).pathname;

  const labHead = await pageAs(browser, 'labHead');
  await labHead.setViewportSize({ width: 390, height: 844 });
  await labHead.goto(samplePath);
  await labHead.getByRole('button', { name: 'Kimyogarga biriktirish' }).click();
  const assign = labHead.getByRole('dialog');
  const chem = who('chemist');
  await pick(assign, 'Kimyogarni tanlang', `${chem.fullName} (${chem.email})`);
  await assign.getByRole('button', { name: 'Biriktirish' }).click();
  await expect(assign).toHaveCount(0);
  await expect(labHead.getByText('Jarayonda').first()).toBeVisible();

  const chemist = await pageAs(browser, 'chemist');
  await chemist.setViewportSize({ width: 390, height: 844 });
  await chemist.goto(samplePath);
  await chooseFile(
    chemist.getByRole('button', { name: 'Tahlil hisobot faylini yuklash' }),
    pdfFile('mobil-hisobot.pdf', `${name} mobil tahlil`),
  );
  await expect(chemist.getByText('mobil-hisobot.pdf')).toBeVisible();
  const submit = chemist.getByRole('button', { name: 'Yuborish', exact: true });
  await submit.scrollIntoViewIfNeeded();
  await submit.click();
  await expect(chemist.getByText('Yuborilgan').first()).toBeVisible();
  await expectNoHorizontalOverflow(chemist);

  await labHead.reload();
  await labHead.getByRole('button', { name: 'Tasdiqlash', exact: true }).click();
  await expect(labHead.getByText('Tasdiqlangan').first()).toBeVisible();
  await expectNoHorizontalOverflow(labHead);
});
