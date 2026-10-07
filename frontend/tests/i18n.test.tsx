import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n, { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY } from '@/i18n';
import en from '@/i18n/locales/en.json';
import ru from '@/i18n/locales/ru.json';
import uz from '@/i18n/locales/uz.json';
import { loginAs, renderAt } from './helpers';

function flatKeys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('tarjima fayllari', () => {
  it('uz, ru, en kalitlari AYNAN bir xil (parity)', () => {
    const uzKeys = flatKeys(uz).sort();
    expect(flatKeys(ru).sort()).toEqual(uzKeys);
    expect(flatKeys(en).sort()).toEqual(uzKeys);
  });

  it("bo'sh tarjima yo'q", () => {
    for (const dict of [uz, ru, en]) {
      const values = flatKeys(dict).map((k) =>
        k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], dict),
      );
      expect(values.every((v) => typeof v === 'string' && v.trim().length > 0)).toBe(true);
    }
  });

  it('standart til — uz', () => {
    expect(DEFAULT_LANGUAGE).toBe('uz');
    expect(i18n.options.fallbackLng).toEqual(['uz']);
  });
});

describe('til almashtirgich', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('uz');
  });

  it("tanlangan til matnni, localStorage va <html lang> ni o'zgartiradi", async () => {
    loginAs('lab_head');
    renderAt('/samples');
    expect(screen.getByRole('heading', { name: 'Namunalar' })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Til'), 'ru');
    expect(await screen.findByRole('heading', { name: 'Образцы' })).toBeInTheDocument();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');

    await userEvent.selectOptions(screen.getByLabelText('Язык'), 'en');
    expect(await screen.findByRole('heading', { name: 'Samples' })).toBeInTheDocument();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it("top bar'da til almashtirgich va bildirishnoma qo'ng'irog'i bor", () => {
    loginAs('chemist');
    renderAt('/registry');
    const header = screen.getByRole('banner');
    expect(header).toContainElement(screen.getByLabelText('Til'));
    expect(header).toContainElement(screen.getByRole('button', { name: 'Bildirishnomalar' }));
  });
});
