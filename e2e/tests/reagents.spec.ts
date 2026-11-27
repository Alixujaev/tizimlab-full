import {
  apiAs,
  expect,
  expectNotification,
  pageAs,
  pick,
  prepareSample,
  tashkentDay,
  test,
  typeDate,
  uniq,
  type Api,
} from '../fixtures.js';

/**
 * TZ §3.2 — reaktiv: kontrolyor kiritadi → o'zi tasdiqlay olmaydi → kimyogar tasdiqlaydi →
 * protokol yuborilganda ND normasi bo'yicha FEFO sarf avtomatik ayiriladi → kimyogar tuzatadi →
 * qoldiq to'g'ri; yetishmovchilikda lab_head xabar oladi. Har test o'z reaktivi va ND si bilan (parallel xavfsiz).
 */

interface ReagentDto {
  id: string;
  quantity: number;
  reagentItemId: string | null;
  approvalStatus: string;
}

async function reagentByName(api: Api, name: string): Promise<ReagentDto[]> {
  return api.get<ReagentDto[]>(`/reagents?search=${encodeURIComponent(name)}&limit=50`);
}

test('TZ §3.2: reaktiv tasdiqlash, FEFO avto-sarf, tuzatish va yetishmovchilik xabari', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const name = uniq('E2E Etanol');
  const ndCode = uniq('ND-E2E-RE');

  // --- kontrolyor kiritadi (UI) ---
  const kontrolyor = await pageAs(browser, 'kontrolyor');
  await test.step('kontrolyor: yangi reaktiv lotini kiritadi', async () => {
    await kontrolyor.goto('/reagents');
    await kontrolyor.getByRole('button', { name: 'Yangi reaktiv' }).click();
    const dialog = kontrolyor.getByRole('dialog');
    await dialog.getByLabel('Nomi', { exact: true }).fill(name);
    await dialog.getByLabel("O'lchov birligi").fill('ml');
    await dialog.getByLabel('Joriy zaxira').fill('100');
    await typeDate(dialog.getByLabel('Yaroqlilik muddati'), tashkentDay(200));
    await dialog.getByRole('button', { name: 'Saqlash' }).click();
    await expect(dialog).toHaveCount(0);
    await kontrolyor.getByRole('searchbox').fill(name);
    await kontrolyor.getByRole('link', { name }).first().click();
    await expect(kontrolyor.getByText('Reaktiv tasdiqlashni kutmoqda')).toBeVisible();
  });
  const reagentId = kontrolyor.url().split('/reagents/')[1]!;

  await test.step('kontrolyor o‘zi tasdiqlay olmaydi: tugma yo‘q, API 403', async () => {
    await expect(kontrolyor.getByRole('button', { name: 'Tasdiqlash' })).toHaveCount(0);
    await expect(
      kontrolyor.getByText(/tasdiqlamaguncha reaktivdan sarf qayd etilmaydi/),
    ).toBeVisible();
    const api = await apiAs('kontrolyor');
    const res = await api.raw('post', `/reagents/${reagentId}/approve`);
    expect(res.status).toBe(403);
  });

  // --- kimyogar tasdiqlaydi (UI, xabarnoma orqali) ---
  const chemist = await pageAs(browser, 'chemist');
  await test.step('kimyogar: xabarni oladi va tasdiqlaydi', async () => {
    await expectNotification(chemist, 'Yangi reaktiv tasdiqlashni kutmoqda', name, { click: true });
    await expect(chemist).toHaveURL(new RegExp(`/reagents/${reagentId}$`));
    await chemist.getByRole('button', { name: 'Tasdiqlash' }).click();
    await expect(chemist.getByText('Reaktiv tasdiqlandi').first()).toBeVisible();
    await expect(chemist.getByText('Reaktiv tasdiqlashni kutmoqda')).toHaveCount(0);
    await expectNotification(kontrolyor, 'Reaktiv tasdiqlandi', name);
  });

  // --- tayyorgarlik (API): muddati yaqinroq ikkinchi lot (FEFO) va ND (2 lot: 30 ml/tahlil) ---
  const labHeadApi = await apiAs('labHead');
  const [lot1] = await reagentByName(labHeadApi, name);
  expect(lot1?.reagentItemId).toBeTruthy();
  const kontrolyorApi = await apiAs('kontrolyor');
  const lot2 = await kontrolyorApi.post<ReagentDto>('/reagents', {
    name,
    unit: 'ml',
    quantity: 20,
    expiresAt: tashkentDay(30),
    reagentItemId: lot1!.reagentItemId,
  });
  await labHeadApi.post(`/reagents/${lot2.id}/approve`);
  const nd = await labHeadApi.post<{ id: string }>('/nd', {
    code: ndCode,
    name: `${name} metodikasi`,
  });
  await labHeadApi.post(`/nd/${nd.id}/requirements`, {
    kind: 'reagent',
    methodName: 'Assay',
    reagentItemId: lot1!.reagentItemId,
    quantityPerAnalysis: 30,
    unit: 'ml',
  });
  await labHeadApi.post(`/nd/${nd.id}/approve`);

  // --- protokol yuborish → FEFO avto-sarf (UI) ---
  const first = await prepareSample({ prefix: 'E2E Reaktiv-namuna', until: 'uploaded' });
  await test.step('kimyogar: ND va 2 tahlil bilan yuboradi → 60 ml FEFO bo‘yicha ayiriladi', async () => {
    await chemist.goto(`/samples/${first.sampleId}`);
    await pick(chemist, 'Normativ hujjat (ND)', new RegExp(ndCode));
    await chemist.getByLabel('Tahlillar soni').fill('2');
    await chemist.getByRole('button', { name: 'Yuborish', exact: true }).click();
    const row = chemist.getByRole('row').filter({ hasText: name });
    await expect(row).toContainText('60 / 60 ml');
    await expect(row).toContainText('Avtomatik');
    // FEFO: avval muddati yaqin lot (20 ml) to'liq, qolgani keyingi lotdan (40 ml)
    await expect(row).toContainText(`${name}: 20 ml`);
    await expect(row).toContainText(`${name}: 40 ml`);
  });
  const afterAuto = await reagentByName(labHeadApi, name);
  expect(afterAuto.find((r) => r.id === lot2.id)?.quantity).toBe(0);
  expect(afterAuto.find((r) => r.id === lot1!.id)?.quantity).toBe(60);

  await test.step('kimyogar: haqiqiy sarfni 50 ml ga tuzatadi → farq omborga qaytadi', async () => {
    const row = chemist.getByRole('row').filter({ hasText: name });
    await row.getByRole('button', { name: 'Tuzatish' }).click();
    const dialog = chemist.getByRole('dialog');
    await dialog.getByLabel(/Haqiqiy sarf/).fill('50');
    await dialog
      .getByLabel('Tuzatish sababi')
      .fill('Ikkinchi tahlilda kamroq erituvchi ishlatildi');
    await dialog.getByRole('button', { name: 'Saqlash' }).click();
    await expect(dialog).toHaveCount(0);
    // D-177: tuzatilgan miqdor yangi talab bo'ladi; 10 ml oxirgi olingan lotga qaytadi (40 → 30)
    await expect(row).toContainText('50 / 50 ml');
    await expect(row).toContainText(`${name}: 30 ml`);
    await expect(row).toContainText('Tuzatilgan');
    // Qoldiq: 120 - 50 = 70 ml (lot sahifasida ko'rinadi)
    await chemist.goto(`/reagents/${lot1!.id}`);
    await expect(chemist.getByText('Zaxira holati').locator('..')).toContainText('70');
  });
  const afterFix = await reagentByName(labHeadApi, name);
  const total = afterFix.reduce((sum, r) => sum + Number(r.quantity), 0);
  expect(total).toBe(70);

  // --- yetishmovchilik: 3 × 30 = 90 ml kerak, 70 ml bor ---
  const second = await prepareSample({ prefix: 'E2E Reaktiv-kam', until: 'uploaded' });
  await test.step('zaxira yetmaganda ogohlantirish va lab_head xabari', async () => {
    await chemist.goto(`/samples/${second.sampleId}`);
    await pick(chemist, 'Normativ hujjat (ND)', new RegExp(ndCode));
    await chemist.getByLabel('Tahlillar soni').fill('3');
    await chemist.getByRole('button', { name: 'Yuborish', exact: true }).click();
    await expect(
      chemist.getByText('Ombordagi zaxira yetmadi — laboratoriya mudiriga xabar yuborildi.'),
    ).toBeVisible();
    await expect(chemist.getByRole('row').filter({ hasText: name })).toContainText(
      'Yetmadi: 20 ml',
    );

    const labHead = await pageAs(browser, 'labHead');
    await expectNotification(
      labHead,
      'ND bo‘yicha reaktiv sarfi uchun zaxira yetmadi',
      second.name,
    );
  });
  const afterShort = await reagentByName(labHeadApi, name);
  expect(afterShort.reduce((sum, r) => sum + Number(r.quantity), 0)).toBe(0);
});
