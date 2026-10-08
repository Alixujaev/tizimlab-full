import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import i18n from '@/i18n';
import type { CompanyDto } from '@/types';
import { loginAs, renderAt } from './helpers';

let api: MockAdapter;

const mockCompanies: CompanyDto[] = [
  {
    id: 'c1',
    name: 'Asror Farm Lab',
    slug: 'asror-farm',
    isActive: true,
    usersCount: 5,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c2',
    name: 'Dori Standart',
    slug: 'dori-standart',
    isActive: false,
    usersCount: 2,
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  },
];

beforeEach(async () => {
  await i18n.changeLanguage('uz');
  api = new MockAdapter(apiClient);
  loginAs('super_admin');
});

afterEach(() => {
  api.restore();
});

describe('CompaniesPage', () => {
  it("kompaniyalar ro'yxati, statistikasi va ma'lumotlarini ko'rsatadi", async () => {
    api.onGet('/companies').reply(200, {
      data: mockCompanies,
      meta: { page: 1, limit: 10, total: 2 },
    });

    renderAt('/companies');

    expect(await screen.findByRole('heading', { name: 'Kompaniyalar' })).toBeInTheDocument();
    expect(await screen.findByText('Asror Farm Lab')).toBeInTheDocument();
    expect(screen.getByText('Dori Standart')).toBeInTheDocument();

    // Stats
    expect(screen.getByText('Jami kompaniyalar')).toBeInTheDocument();
    expect(screen.getByText('Faol kompaniyalar')).toBeInTheDocument();
    expect(screen.getByText('Nofaol kompaniyalar')).toBeInTheDocument();
  });

  it("yangi kompaniya yaratish modali ochiladi, validatsiya va submit ishlaydi", async () => {
    const user = userEvent.setup();
    api.onGet('/companies').reply(200, {
      data: mockCompanies,
      meta: { page: 1, limit: 10, total: 2 },
    });
    api.onPost('/companies').reply(201, {
      data: {
        id: 'c3',
        name: 'Yangi Lab',
        slug: 'yangi-lab',
        isActive: true,
        usersCount: 1,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
    });

    renderAt('/companies');
    await screen.findByText('Asror Farm Lab');

    await user.click(screen.getByRole('button', { name: 'Kompaniya yaratish' }));
    expect(await screen.findByRole('heading', { name: 'Kompaniya yaratish' })).toBeInTheDocument();

    // Bo'sh holda submit qilish - xatolarni tekshirish
    await user.click(screen.getByRole('button', { name: 'Saqlash' }));
    expect(await screen.findByText('Kompaniya nomini kiriting.')).toBeInTheDocument();
    expect(screen.getByText('Slug kiriting.')).toBeInTheDocument();

    // To'g'ri to'ldirish
    await user.type(screen.getByLabelText('Kompaniya nomi'), 'Yangi Lab');
    await user.type(screen.getByLabelText('Slug (unikal identifikator)'), 'yangi-lab');
    await user.type(screen.getByLabelText('Administrator ism-sharifi'), 'Admin Aka');
    await user.type(screen.getByLabelText('Administrator emaili'), 'admin@yangi.uz');
    await user.type(screen.getByLabelText('Administrator paroli'), 'Parol1234');

    await user.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() => {
      expect(api.history.post.some((p) => p.url === '/companies')).toBe(true);
    });
  });

  it("kompaniyani tahrirlash modali ma'lumotlarni yuklaydi va saqlaydi", async () => {
    const user = userEvent.setup();
    api.onGet('/companies').reply(200, {
      data: mockCompanies,
      meta: { page: 1, limit: 10, total: 2 },
    });
    api.onPatch('/companies/c1').reply(200, {
      data: { ...mockCompanies[0], name: 'Asror Yangilangan' },
    });

    renderAt('/companies');
    await screen.findByText('Asror Farm Lab');

    const editBtns = screen.getAllByRole('button', { name: 'Tahrirlash' });
    await user.click(editBtns[0]!);

    expect(await screen.findByRole('heading', { name: 'Kompaniyani tahrirlash' })).toBeInTheDocument();
    const nameInput = screen.getByLabelText('Kompaniya nomi');
    expect(nameInput).toHaveValue('Asror Farm Lab');

    await user.clear(nameInput);
    await user.type(nameInput, 'Asror Yangilangan');

    await user.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() => {
      expect(api.history.patch.some((p) => p.url === '/companies/c1')).toBe(true);
    });
  });

  it("kompaniyani nofaollashtirish va faollashtirish tasdiqlash modali orqali ishlaydi", async () => {
    const user = userEvent.setup();
    api.onGet('/companies').reply(200, {
      data: mockCompanies,
      meta: { page: 1, limit: 10, total: 2 },
    });
    api.onPost('/companies/c1/deactivate').reply(200, { data: { success: true } });
    api.onPost('/companies/c2/activate').reply(200, { data: { success: true } });

    renderAt('/companies');
    await screen.findByText('Asror Farm Lab');

    // Nofaollashtirish
    await user.click(screen.getByRole('button', { name: 'Nofaollashtirish' }));
    expect(
      await screen.findByRole('heading', { name: 'Kompaniyani nofaollashtirishni tasdiqlaysizmi?' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Kompaniya nofaol qilinsa, uning barcha foydalanuvchilari tizimdan chiqariladi/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tasdiqlash' }));
    await waitFor(() => {
      expect(api.history.post.some((p) => p.url === '/companies/c1/deactivate')).toBe(true);
    });

    // Faollashtirish
    await user.click(screen.getByRole('button', { name: 'Faollashtirish' }));
    expect(
      await screen.findByRole('heading', { name: 'Kompaniyani faollashtirishni tasdiqlaysizmi?' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tasdiqlash' }));
    await waitFor(() => {
      expect(api.history.post.some((p) => p.url === '/companies/c2/activate')).toBe(true);
    });
  });
});
