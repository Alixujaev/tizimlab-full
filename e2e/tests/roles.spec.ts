import {
  apiAs,
  expect,
  login,
  pageAs,
  pdfFile,
  pick,
  prepareSample,
  test,
  who,
  world,
  type RoleKeyExport,
} from '../fixtures.js';

/**
 * Rol va izolyatsiya (UI): taqiqlangan sahifa → "Ruxsat yo'q", taqiqlangan tugma yashirin, server rad etgan amal →
 * aniq 403 toast; boshqa kompaniya ma'lumoti ko'rinmaydi (D-12).
 */

const FORBIDDEN: Array<[RoleKeyExport, string[], string[], string?]> = [
  // [rol, taqiqlangan yo'llar, menyuda bo'lmasligi kerak bo'lgan bandlar, menyuda albatta bor band]
  [
    'kontrolyor',
    ['/protocols', '/oos', '/users', '/activity', '/knowledge-base', '/companies', '/logs'],
    ['Protokollar', 'OOS jurnali', 'Foydalanuvchilar'],
  ],
  [
    'chemist',
    ['/users', '/activity', '/knowledge-base', '/companies', '/logs', '/team'],
    ['Foydalanuvchilar', 'Faoliyat'],
  ],
  ['director', ['/knowledge-base', '/companies', '/logs'], []],
  [
    'superAdmin',
    ['/samples', '/reagents', '/temperature', '/oos'],
    ['Namunalar', 'Reaktivlar'],
    'Kompaniyalar',
  ],
];

for (const [role, paths, hiddenNav, visibleNav = 'Bosh sahifa'] of FORBIDDEN) {
  test(`rol ${role}: taqiqlangan sahifalar ochilmaydi va menyuda yo‘q`, async ({ page }) => {
    await login(page, role);
    const nav = page.getByRole('navigation').first();
    // Menyu yuklanganini ijobiy tekshiruv bilan kutamiz (aks holda "yo'q" tekshiruvi bo'sh o'tadi)
    await expect(nav.getByRole('link', { name: visibleNav, exact: true })).toBeVisible();
    for (const item of hiddenNav)
      await expect(nav.getByRole('link', { name: item, exact: true })).toHaveCount(0);
    for (const path of paths) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: "Ruxsat yo'q" }), path).toBeVisible();
    }
  });
}

test('rol: taqiqlangan tugmalar yashirin (kontrolyor, director, biriktirilmagan kimyogar)', async ({
  browser,
}) => {
  const sample = await prepareSample({ prefix: 'E2E Rol', until: 'submitted' });

  const kontrolyor = await pageAs(browser, 'kontrolyor');
  await kontrolyor.goto(`/samples/${sample.sampleId}`);
  await expect(kontrolyor.getByRole('heading', { level: 1, name: sample.name })).toBeVisible();
  for (const name of [
    'Tasdiqlash',
    'Rad etish',
    'Yuborish',
    'Kimyogarga biriktirish',
    'OOS ochish',
    'Peak faylini yuklash',
  ]) {
    await expect(kontrolyor.getByRole('button', { name, exact: true })).toHaveCount(0);
  }
  await kontrolyor.goto('/reagents');
  await expect(kontrolyor.getByRole('button', { name: 'Yangi reaktiv' })).toBeVisible();

  const director = await pageAs(browser, 'director');
  await director.goto(`/samples/${sample.sampleId}`);
  await expect(director.getByText('Yuborilgan').first()).toBeVisible();
  for (const name of ['Tasdiqlash', 'Rad etish', 'Yakunlash', 'OOS ochish']) {
    await expect(director.getByRole('button', { name, exact: true })).toHaveCount(0);
  }

  const other = await pageAs(browser, 'chemist2');
  await other.goto('/samples');
  await expect(other.getByRole('table')).toBeVisible();
  await expect(other.getByRole('button', { name: 'Yangi namuna' })).toHaveCount(0);
  await other.goto('/reagents');
  await expect(other.getByRole('table')).toBeVisible();
  await expect(other.getByRole('button', { name: 'Yangi reaktiv' })).toHaveCount(0);
});

test('403 toast: qayta biriktirilgan namunada eski kimyogar yubora olmaydi', async ({
  browser,
}) => {
  const sample = await prepareSample({ prefix: 'E2E Qayta-biriktirish', until: 'uploaded' });
  const chemist = await pageAs(browser, 'chemist');
  await chemist.goto(`/samples/${sample.sampleId}`);
  const submit = chemist.getByRole('button', { name: 'Yuborish', exact: true });
  await expect(submit).toBeEnabled();

  // Shu payt lab_head (boshqa oynada) namunani ikkinchi kimyogarga o'tkazadi — kimyogar UI'si eskirgan
  const labHead = await pageAs(browser, 'labHead');
  await labHead.goto(`/samples/${sample.sampleId}`);
  await labHead.getByRole('button', { name: 'Qayta biriktirish' }).click();
  const dialog = labHead.getByRole('dialog');
  const second = who('chemist2');
  await pick(dialog, 'Kimyogarni tanlang', `${second.fullName} (${second.email})`);
  await dialog.getByRole('button', { name: 'Biriktirish' }).click();
  await expect(dialog).toHaveCount(0);

  await submit.click();
  await expect(chemist.getByText("Protokolni yuborish uchun ruxsat yo'q")).toBeVisible();
  // Server holatni o'zgartirmagan
  const api = await apiAs('labHead');
  const [protocol] = await api.get<Array<{ status: string }>>(
    `/protocols/sample/${sample.sampleId}`,
  );
  expect(protocol!.status).toBe('draft');
});

test('izolyatsiya: B kompaniyasi A ning namunasi, xonasi va apparatini ko‘rmaydi (va aksincha)', async ({
  browser,
}) => {
  const sample = await prepareSample({ prefix: 'E2E Maxfiy-A', until: 'uploaded' });

  const labHeadB = await pageAs(browser, 'labHeadB');
  await labHeadB.goto('/samples');
  await labHeadB.getByRole('searchbox').fill(sample.name);
  await expect(labHeadB.getByText('Namunalar topilmadi')).toBeVisible();
  await expect(labHeadB.getByRole('link', { name: sample.name })).toHaveCount(0);
  await labHeadB.goto(`/samples/${sample.sampleId}`);
  await expect(labHeadB.getByRole('heading', { name: 'Namuna topilmadi' })).toBeVisible();
  await labHeadB.goto(`/nd/${world().nd.ok}`);
  await expect(labHeadB.getByText('ND topilmadi yoki yuklashda xatolik')).toBeVisible();
  await expect(labHeadB.getByText('ND-E2E-OK')).toHaveCount(0);
  await labHeadB.goto('/equipment');
  await expect(labHeadB.getByText('B Maxfiy HPLC')).toBeVisible();
  await expect(labHeadB.getByText('E2E HPLC-1')).toHaveCount(0);

  const labHeadA = await pageAs(browser, 'labHead');
  await labHeadA.goto('/temperature');
  await expect(labHeadA.getByText('E2E Xona-1').first()).toBeVisible();
  await expect(labHeadA.getByText('B Maxfiy xona')).toHaveCount(0);
  await labHeadA.goto('/equipment');
  await expect(labHeadA.getByText('E2E HPLC-1')).toBeVisible();
  await expect(labHeadA.getByText('B Maxfiy HPLC')).toHaveCount(0);

  // Server darajasida ham: B tokeni bilan A resurslari — 404 (mavjudligi ham oshkor qilinmaydi)
  const apiB = await apiAs('labHeadB');
  expect((await apiB.raw('get', `/samples/${sample.sampleId}`)).status).toBe(404);
  expect((await apiB.raw('get', `/protocols/${sample.protocolId}`)).status).toBe(404);
  const upload = await apiB.ctx.post(`/api/v1/protocols/${sample.protocolId}/file`, {
    multipart: { file: pdfFile('hujum.pdf', 'x') },
  });
  expect(upload.status()).toBe(404);
});
