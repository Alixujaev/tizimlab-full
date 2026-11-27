import {
  apiAs,
  chooseFile,
  expect,
  expectNotification,
  pageAs,
  pdfFile,
  pick,
  realtimeToast,
  test,
  uniq,
  who,
} from '../fixtures.js';

/**
 * TZ §3.1 — asosiy namuna oqimi, to'liq UI orqali (R-FLOW-01..06, R-FLOW-10).
 * kontrolyor (AI-to'ldirish + qo'lda) → lab_head xabar oladi, biriktiradi → kimyogar protokol + peak,
 * apparat, ND, tahlillar soni → lab_head sabab bilan rad etadi → kimyogar sababni ko'radi, qayta yuboradi →
 * lab_head tasdiqlaydi → director yakunlaydi → reyestrda qidirish va faylni yuklab olish.
 */
test('R-FLOW-01..06, R-FLOW-10: namuna kiritishdan reyestrgacha (rad etish bilan)', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const name = uniq('E2E Ibuprofen');
  const lot = uniq('LOT');
  const reason = `Peak ajralishi yetarli emas — qayta o‘lchang (${lot})`;

  // ---------------------------------------------------------------- R-FLOW-01
  const kontrolyor = await pageAs(browser, 'kontrolyor');
  await test.step('kontrolyor: AI bilan to‘ldiradi, qo‘lda tuzatadi va saqlaydi', async () => {
    await kontrolyor.goto('/samples');
    await kontrolyor.getByRole('button', { name: 'Yangi namuna' }).click();
    const dialog = kontrolyor.getByRole('dialog');
    await chooseFile(
      dialog.getByRole('button', { name: 'Hujjatdan to‘ldirish' }),
      pdfFile('sertifikat.pdf', 'Certificate of analysis Ibuprofen E2E'),
    );
    await expect(dialog.getByText(/AI \d+ ta maydonni to‘ldirdi/)).toBeVisible();
    // Mock AI javobi: seriya va ishlab chiqaruvchi taklif qilinadi
    await expect(dialog.getByLabel('Seriya raqami')).toHaveValue('E2E-SER-01');
    await expect(dialog.getByLabel('Ishlab chiqaruvchi')).toHaveValue('E2E Pharma LLC');
    // Qo'lda: noyob nom (parallel testlar uchun) va lot
    await dialog.getByLabel('Modda nomi', { exact: true }).fill(name);
    await dialog.getByLabel('Partiya (Lot) raqami').fill(lot);
    await pick(dialog, 'Namuna turi', 'Tayyor mahsulot');
    await dialog.getByRole('button', { name: 'Saqlash' }).click();
    await expect(dialog).toHaveCount(0);

    await kontrolyor.getByRole('searchbox').fill(name);
    await kontrolyor.getByRole('link', { name }).first().click();
    await expect(kontrolyor.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(kontrolyor.getByText('Kutilmoqda').first()).toBeVisible();
    await expect(kontrolyor.getByText(lot)).toBeVisible();
    await expect(kontrolyor.getByText('E2E-SER-01')).toBeVisible();
  });
  const sampleUrl = kontrolyor.url();
  const sampleId = sampleUrl.split('/samples/')[1]!;

  // ---------------------------------------------------------------- R-FLOW-02
  // Kimyogar oldindan tizimda (socket ulangan) — biriktirish xabari real vaqtda kelishi tekshiriladi
  const chemist = await pageAs(browser, 'chemist', { realtime: true });
  const labHead = await pageAs(browser, 'labHead');
  await test.step('lab_head: yangi namuna xabarini oladi va kimyogarga biriktiradi', async () => {
    await expectNotification(labHead, 'Yangi namuna biriktirishni kutmoqda', name, { click: true });
    await expect(labHead).toHaveURL(new RegExp(`/samples/${sampleId}$`));
    await expect(labHead.getByText('Namuna kimyogarga biriktirilgach')).toBeVisible();
    await labHead.getByRole('button', { name: 'Kimyogarga biriktirish' }).click();
    const dialog = labHead.getByRole('dialog');
    const chem = who('chemist');
    await pick(dialog, 'Kimyogarni tanlang', `${chem.fullName} (${chem.email})`);
    await dialog.getByRole('button', { name: 'Biriktirish' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(labHead.getByText('Jarayonda').first()).toBeVisible();
    // Protokol avtomatik yaratildi
    await expect(labHead.getByText('Qoralama')).toBeVisible();
    // Kimyogarga real vaqtda (sahifa yangilanmasdan) toast
    await expect(realtimeToast(chemist, 'Sizga yangi namuna biriktirildi', name)).toBeVisible();
  });

  // ---------------------------------------------------------------- R-FLOW-03
  await test.step('kimyogar: xabar → protokol fayli, peak fayli, apparat, ND, tahlillar soni → yuborish', async () => {
    await expectNotification(chemist, 'Sizga yangi namuna biriktirildi', name, { click: true });
    await expect(chemist).toHaveURL(new RegExp(`/samples/${sampleId}$`));
    const submit = chemist.getByRole('button', { name: 'Yuborish', exact: true });
    await expect(submit).toBeDisabled();

    await chooseFile(
      chemist.getByRole('button', { name: 'Tahlil hisobot faylini yuklash' }),
      pdfFile('hisobot-v1.pdf', `${name} assay 99.1%`),
    );
    await expect(chemist.getByText('hisobot-v1.pdf')).toBeVisible();
    await chooseFile(
      chemist.getByRole('button', { name: 'Peak faylini yuklash' }),
      pdfFile('peak-1.pdf', `${name} chromatogram main peak`),
    );
    await expect(chemist.getByText('peak-1.pdf')).toBeVisible();

    await pick(chemist, 'Apparat', 'E2E HPLC-1 (HPLC)');
    await pick(chemist, /Tahlil o.tkazilgan xona/, 'E2E Xona-1 (E2E-S1)');
    await pick(chemist, 'Normativ hujjat (ND)', /ND-E2E-OK/);
    await chemist.getByLabel('Tahlillar soni').fill('2');
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(chemist.getByText('Yuborilgan').first()).toBeVisible();
    // Yuborishda ND bo'yicha avto-sarf (2 × 2 ml) va harorat snapshot
    await expect(chemist.getByRole('heading', { name: 'ND bo‘yicha reaktiv sarfi' })).toBeVisible();
    await expect(chemist.getByText('4 / 4 ml', { exact: true })).toBeVisible();
    await expect(chemist.getByText(/E2E Xona-1/).first()).toBeVisible();
  });

  // ---------------------------------------------------------------- R-FLOW-10 (rad etish)
  await test.step('lab_head: sabab yozib rad etadi', async () => {
    await expectNotification(labHead, 'Protokol tasdiqlashga yuborildi', name);
    await labHead.reload();
    await labHead.getByRole('button', { name: 'Rad etish' }).click();
    const dialog = labHead.getByRole('dialog');
    const confirm = dialog.getByRole('button', { name: 'Rad etish' });
    await dialog.getByLabel(/Rad etish sababi/).fill('qisqa');
    await dialog.getByLabel(/Rad etish sababi/).fill(reason);
    await confirm.click();
    await expect(dialog).toHaveCount(0);
    await expect(labHead.getByText('Rad etilgan').first()).toBeVisible();
  });

  await test.step('kimyogar: rad sababini ko‘radi, faylni yangilab qayta yuboradi', async () => {
    await expectNotification(chemist, 'Protokol rad etildi', reason);
    await chemist.reload();
    await expect(chemist.getByText('Laboratoriya mudiri tomonidan rad etilgan')).toBeVisible();
    await expect(chemist.getByText(reason).first()).toBeVisible();
    await chooseFile(
      chemist.getByRole('button', { name: 'Almashtirish' }).first(),
      pdfFile('hisobot-v2.pdf', `${name} assay 99.4% (qayta)`),
    );
    await expect(chemist.getByText('hisobot-v2.pdf')).toBeVisible();
    await chemist.getByRole('button', { name: 'Qayta yuborish' }).click();
    await expect(chemist.getByText('Yuborilgan').first()).toBeVisible();
  });

  // ---------------------------------------------------------------- R-FLOW-04
  await test.step('lab_head: tasdiqlaydi; rad sababi tarixda saqlangan', async () => {
    await labHead.reload();
    // Sarf jadvalida ham "Tasdiqlash" (sarfni tasdiqlash) bor — protokol tugmasi jadvaldan tashqarida
    await labHead
      .getByRole('button', { name: 'Tasdiqlash', exact: true })
      .and(labHead.locator(':not(table *)'))
      .click();
    await expect(labHead.getByText('Tasdiqlangan').first()).toBeVisible();
    await expect(labHead.getByText('Rad etish tarixi (1)')).toBeVisible();
    await expect(labHead.getByText(reason).first()).toBeVisible();
    // Kontrolyor (yaratgan) ham tasdiq xabarini oladi
    await expectNotification(kontrolyor, 'Namuna tasdiqlandi', name);
  });

  // ---------------------------------------------------------------- R-FLOW-05
  const director = await pageAs(browser, 'director');
  await test.step('director: protokolni yakunlaydi', async () => {
    await director.goto(`/samples/${sampleId}`);
    await director.getByRole('button', { name: 'Yakunlash' }).click();
    await expect(director.getByText('Yakunlangan').first()).toBeVisible();
    await expect(director.getByRole('button', { name: 'Yakunlash' })).toHaveCount(0);
  });

  // ---------------------------------------------------------------- R-FLOW-06
  await test.step('reyestr: qidiriladi va protokol fayli yuklab olinadi', async () => {
    await kontrolyor.goto('/registry');
    await kontrolyor.getByLabel('Modda nomi').fill(name);
    await kontrolyor.getByRole('button', { name: 'Qidirish' }).click();
    const row = kontrolyor.getByRole('row').filter({ hasText: name });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(lot);

    const fileResponse = kontrolyor
      .context()
      .waitForEvent('response', (r) => r.url().includes('/api/v1/__test/files'));
    await row.getByRole('button', { name: 'Protokolni yuklab olish' }).click();
    const res = await fileResponse;
    expect(res.status()).toBe(200);
    expect(res.headers()['content-disposition']).toContain('hisobot-v2.pdf');
    // Yuklangan fayl mazmuni — oxirgi (qayta yuborilgan) versiya
    const body = await (await kontrolyor.request.get(res.url())).body();
    expect(body.toString('latin1')).toContain('99.4%');
  });

  // Yakuniy holat API orqali ham tasdiqlanadi
  const api = await apiAs('labHead');
  const sample = await api.get<{ status: string }>(`/samples/${sampleId}`);
  expect(sample.status).toBe('approved');
});
