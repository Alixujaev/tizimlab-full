import { apiAs, expect, pageAs, prepareSample, test, uniq, waitForIndexed } from '../fixtures.js';

/**
 * OOS (P19): protokolda OOS ochiladi → AI kopilot (mock LLM) ichki bazadagi manba bilan javob beradi →
 * kimyogar yopa olmaydi (tugma yo'q, API 403) → lab_head ildiz sabab bilan yopadi.
 * Ichki manba: shu moddaning avval tasdiqlangan protokoli (RAG indeksi — haqiqiy worker, mock embedding).
 */
test('OOS: ochish → manbali AI javobi → chemist yopolmaydi, lab_head yopadi', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const substance = uniq('E2E Metformin');

  // Ichki baza: shu modda bo'yicha tasdiqlangan protokol (matnli PDF) → indekslanguncha kutiladi
  const archived = await prepareSample({
    prefix: 'unused',
    name: substance,
    until: 'approved',
    fileText: `${substance} assay standart eritma parchalanishi sababli natija past chiqdi; yangi standart bilan qayta o‘lchandi`,
  });
  await waitForIndexed(archived.protocolId);

  const current = await prepareSample({ prefix: 'unused', name: substance, until: 'uploaded' });
  const chemist = await pageAs(browser, 'chemist');

  let oosUrl = '';
  await test.step('kimyogar: protokoldan OOS ochadi', async () => {
    await chemist.goto(`/samples/${current.sampleId}`);
    await chemist.getByRole('button', { name: 'OOS ochish' }).click();
    const dialog = chemist.getByRole('dialog');
    await dialog.getByLabel('Ko‘rsatkich').fill('Assay');
    await dialog.getByLabel('Natija').fill('91.2');
    await dialog.getByLabel('Me’yor (spetsifikatsiya)').fill('98.0–102.0');
    await dialog.getByLabel('Birlik').fill('%');
    await dialog.getByRole('button', { name: 'OOS ochish' }).click();
    await expect(chemist).toHaveURL(/\/oos\/[0-9a-f-]{36}$/);
    oosUrl = new URL(chemist.url()).pathname;
    await expect(chemist.getByText('Ochiq').first()).toBeVisible();
    await expect(chemist.getByText(substance).first()).toBeVisible();
  });

  await test.step('AI kopilot: savolga ichki manba [S1] bilan javob', async () => {
    await chemist.getByRole('button', { name: 'Yangi suhbat' }).click();
    await chemist
      .getByLabel('Savol')
      .fill('Assay natijasi past chiqdi — avval shunday holat bo‘lganmi, nimani tekshiray?');
    await chemist.getByRole('button', { name: 'Yuborish' }).click();
    const internal = chemist
      .locator('section')
      .filter({ has: chemist.getByText('Ichki bazadan topilganlar') })
      .last();
    await expect(internal).toContainText('E2E: ichki bazada o‘xshash holat topildi');
    await expect(internal.getByText('[S1]')).toBeVisible();
    await expect(chemist.getByText('Ichki bazada topilmadi')).toHaveCount(0);
    await expect(chemist.getByText('E2E: standart eritma')).toBeVisible();
  });

  await test.step('kimyogar yopa olmaydi: tugma yo‘q va server 403', async () => {
    await expect(chemist.getByRole('button', { name: 'OOS ni yopish' })).toHaveCount(0);
    const api = await apiAs('chemist');
    const oosId = oosUrl.split('/').pop()!;
    const res = await api.raw('post', `/oos/${oosId}/status`, {
      status: 'closed',
      rootCause: 'Kimyogar yopishga urinmoqda',
      closureNote: 'Ruxsat bo‘lmasligi kerak',
    });
    expect(res.status).toBe(403);
  });

  await test.step('lab_head: ildiz sabab va izoh bilan yopadi', async () => {
    const labHead = await pageAs(browser, 'labHead');
    await labHead.goto(oosUrl);
    await labHead.getByRole('button', { name: 'OOS ni yopish' }).click();
    const dialog = labHead.getByRole('alertdialog');
    await dialog
      .getByLabel('Ildiz sabab')
      .fill('Standart eritma muddati o‘tgan — laboratoriya xatosi tasdiqlandi');
    await dialog.getByLabel('Yopish izohi').fill('Yangi standart bilan qayta tahlil me’yorda');
    await dialog.getByRole('button', { name: 'OOS ni yopish' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(labHead.getByText('Yopilgan').first()).toBeVisible();
    await expect(
      labHead.getByText('Standart eritma muddati o‘tgan — laboratoriya xatosi tasdiqlandi'),
    ).toBeVisible();
    await expect(labHead.getByRole('button', { name: 'OOS ni yopish' })).toHaveCount(0);
  });
});
