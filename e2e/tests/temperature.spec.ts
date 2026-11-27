import { apiAs, expect, pageAs, pick, prepareSample, test, uniq } from '../fixtures.js';

/**
 * Harorat: me'yordan chiqqan qiymat ajratib ko'rsatiladi; protokol yuborishda tanlangan xona va tahlil
 * sanasi bo'yicha taklif ko'rinadi va yuborishda snapshot olinadi (keyingi o'qishlar uni o'zgartirmaydi).
 * Har test o'z xonasi bilan — boshqa oqimlarning harorat taklifiga ta'sir qilmaydi.
 */
test('harorat: me’yordan chiqqan qiymat ajratiladi; protokol taklifi va snapshot', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const room = uniq('E2E Xona');
  const labHeadApi = await apiAs('labHead');
  const sensor = await labHeadApi.post<{ id: string }>('/temperature/sensors', {
    sensorId: uniq('S'),
    locationName: room,
    tempMin: 15,
    tempMax: 25,
  });
  // Me'yordagi eski o'qish (taklif oynasidan tashqarida: 3 kun oldin)
  await labHeadApi.post('/temperature/readings', {
    sensorConfigId: sensor.id,
    temperature: 20.4,
    humidity: 40,
    recordedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  });

  const labHead = await pageAs(browser, 'labHead');
  await test.step('lab_head: qo‘lda me’yordan yuqori qiymat kiritadi → ajratib ko‘rsatiladi', async () => {
    await labHead.goto('/temperature');
    await labHead.getByRole('button', { name: "Qo'lda kiritish" }).click();
    const dialog = labHead.getByRole('dialog');
    await pick(dialog, 'Sensorni tanlang', new RegExp(`^${room} `));
    await dialog.getByLabel('Harorat').fill('31.2');
    await dialog.getByLabel('Namlik').fill('50');
    await dialog.getByRole('button', { name: 'Saqlash' }).click();
    await expect(dialog).toHaveCount(0);

    await pick(labHead, 'Sensorlar', new RegExp(room));
    const high = labHead.getByRole('row').filter({ hasText: '31.2' });
    const normal = labHead.getByRole('row').filter({ hasText: '20.4' });
    await expect(high).toContainText('Chegaradan chiqqan');
    await expect(normal).toContainText("Me'yorda");
    await expect(normal).not.toContainText('Chegaradan chiqqan');
  });

  const sample = await prepareSample({ prefix: 'E2E Harorat', until: 'uploaded' });
  const chemist = await pageAs(browser, 'chemist');
  await test.step('kimyogar: xona tanlanganda taklif me’yordan tashqari ekanini ko‘rsatadi', async () => {
    await chemist.goto(`/samples/${sample.sampleId}`);
    await pick(chemist, /Tahlil o.tkazilgan xona/, new RegExp(`^${room} `));
    const suggestion = chemist.getByRole('alert').filter({ hasText: 'Harorat taklifi' });
    await expect(suggestion).toContainText('31.2 °C');
    await expect(suggestion).toContainText('Me’yor: 15…25 °C');
    await expect(suggestion).toContainText('Harorat me’yordan tashqarida');
  });

  await test.step('yuborishda snapshot olinadi va keyingi o‘qish uni o‘zgartirmaydi', async () => {
    await chemist.getByRole('button', { name: 'Yuborish', exact: true }).click();
    const snapshot = chemist
      .getByRole('alert')
      .filter({ hasText: 'Xona harorati (tahlil vaqtida)' });
    await expect(snapshot).toContainText('31.2 °C');
    await expect(snapshot).toContainText(room);
    await expect(snapshot).toContainText('Bu o‘qish xona chegarasidan tashqarida bo‘lgan.');

    await labHeadApi.post('/temperature/readings', {
      sensorConfigId: sensor.id,
      temperature: 21,
      humidity: 45,
    });
    await chemist.reload();
    await expect(snapshot).toContainText('31.2 °C');
    await expect(snapshot).not.toContainText('21 °C');
  });
});
