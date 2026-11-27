import {
  expect,
  expectNotification,
  login,
  pageAs,
  pick,
  prepareSample,
  tashkentDay,
  test,
  typeDate,
  who,
  world,
} from '../fixtures.js';

/**
 * Stabilizatsiya (spec §8, §17):
 * R-FLOW-07 — lab_head tekshiruv boshlaydi va checkpointlarni qo'lda belgilaydi (mas'ul kimyogar bilan, D-53);
 * R-FLOW-09 — kimyogar har checkpoint uchun natija kiritadi → hammasi `completed` → study avtomatik `completed` (D-56);
 * R-FLOW-08 — fon job'i (server startida ishlaydi) muddat o'tgan / yaqinlashgan checkpoint uchun xabar yuboradi.
 */
test('R-FLOW-07, R-FLOW-09: tekshiruv boshlash, checkpoint belgilash, natijalar → study yakunlanadi', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const sample = await prepareSample({
    prefix: 'E2E Stabil',
    type: 'finished_product',
    until: 'approved',
  });
  const chem = who('chemist');
  const extraTag = 'T6-E2E';

  const labHead = await pageAs(browser, 'labHead');
  await test.step('lab_head: tekshiruv boshlaydi (T3 → kimyogar), qolgan standart checkpointlarni olib tashlaydi', async () => {
    await labHead.goto('/stability');
    await labHead.getByRole('button', { name: 'Yangi tekshiruv boshlash' }).click();
    const dialog = labHead.getByRole('dialog');
    await pick(dialog, /^Namuna/, new RegExp(`^${sample.name} `));
    await dialog.getByRole('textbox', { name: 'T0 qiymat' }).nth(1).fill('99.6%');
    const cpRows = dialog.locator('ul').last().getByRole('listitem');
    await expect(cpRows).toHaveCount(3);
    await cpRows
      .nth(2)
      .getByRole('button', { name: /^O.chirish$/ })
      .click();
    await cpRows
      .nth(1)
      .getByRole('button', { name: /^O.chirish$/ })
      .click();
    await expect(cpRows).toHaveCount(1);
    await pick(dialog, "T3 — Mas'ul kimyogar", chem.fullName);
    await dialog.getByRole('button', { name: 'Saqlash' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(labHead).toHaveURL(/\/stability\/[0-9a-f-]{36}$/);
    await expect(labHead.getByText(sample.name).first()).toBeVisible();
  });
  const studyUrl = new URL(labHead.url()).pathname;

  await test.step('lab_head: checkpointni qo‘lda qo‘shadi va kimyogarga biriktiradi', async () => {
    await labHead.getByRole('button', { name: "Checkpoint qo'shish" }).click();
    const dialog = labHead.getByRole('dialog');
    await dialog.getByLabel(/^Checkpoint nomi/).fill(extraTag);
    await typeDate(dialog.getByLabel(/^Muddat/), tashkentDay(180));
    await pick(dialog, "Mas'ul kimyogar", chem.fullName);
    await dialog.getByRole('button', { name: 'Saqlash' }).click();
    await expect(dialog).toHaveCount(0);
    const card = labHead.getByRole('region', { name: new RegExp(`^${extraTag} `) });
    await expect(card).toContainText(chem.fullName);
    await expect(card).toContainText('Kutilmoqda');
  });

  const chemist = await pageAs(browser, 'chemist');
  await chemist.goto(studyUrl);
  for (const tag of ['T3', extraTag]) {
    await test.step(`kimyogar: ${tag} natijalarini kiritadi va yakunlaydi`, async () => {
      const card = chemist.getByRole('region', { name: new RegExp(`^${tag} `) });
      await card.getByRole('button', { name: 'Natija kiritish' }).click();
      const dialog = chemist.getByRole('dialog');
      const inputs = dialog.getByRole('textbox', { name: /— Joriy qiymat$/ });
      const n = await inputs.count();
      expect(n).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) await inputs.nth(i).fill(`${tag}: ${99 - i}%`);
      await dialog.getByRole('button', { name: 'Saqlash' }).click();
      await expect(dialog).toHaveCount(0);
      await card.getByRole('button', { name: 'Yakunlash' }).click();
      const confirm = chemist.getByRole('alertdialog');
      await confirm.getByRole('button', { name: 'Yakunlash' }).click();
      await expect(confirm).toHaveCount(0);
      await expect(card).toContainText('Yakunlangan');
    });
  }

  await test.step('barcha checkpointlar yakunlangach study avtomatik `completed`', async () => {
    await labHead.reload();
    await expect(labHead.getByRole('region', { name: new RegExp(`^${extraTag} `) })).toContainText(
      'Yakunlangan',
    );
    // Yakunlangan tekshiruvga checkpoint qo'shib bo'lmaydi
    await expect(labHead.getByRole('button', { name: "Checkpoint qo'shish" })).toHaveCount(0);
    await labHead.goto('/stability');
    const row = labHead.getByRole('row').filter({ hasText: sample.name });
    await expect(row).toContainText('Yakunlangan');
  });
});

test('R-FLOW-08: fon job muddat o‘tgan va yaqinlashgan checkpointlar uchun xabar yuboradi', async ({
  page,
}) => {
  const { substanceName, studyId, overdueTag, soonTag } = world().stability;

  await login(page, 'stabChemist');
  await expectNotification(
    page,
    /Stabilizatsiya muddati o.tdi/,
    `${substanceName} (${overdueTag})`,
  );
  await expectNotification(
    page,
    'Stabilizatsiya muddati yaqinlashmoqda',
    `${substanceName} (${soonTag})`,
  );

  // Job checkpoint holatini ham `overdue` ga o'tkazgan
  await page.goto(`/stability/${studyId}`);
  const overdue = page.getByRole('region', { name: new RegExp(`^${overdueTag} `) });
  await expect(overdue).toContainText("Muddati o'tgan");
  const soon = page.getByRole('region', { name: new RegExp(`^${soonTag} `) });
  await expect(soon).toContainText('Muddati yaqin');
});
