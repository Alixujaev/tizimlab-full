import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client';
import { SubstanceSelect } from '@/components/substances/SubstanceSelect';
import i18n from '@/i18n';
import { createQueryClient } from '@/lib/queryClient';
import type { SubstanceDetailDto, SubstanceDto } from '@/types';
import { loginAs, renderAt } from './helpers';

let api: MockAdapter;

const mockSubstances: SubstanceDto[] = [
  {
    id: 'sub-1',
    nameUz: 'Paratsetamol',
    nameRu: 'Парацетамол',
    nameEn: 'Paracetamol',
    pharmacopoeia: 'USP',
    casNumber: '103-90-2',
    description: 'Ogriq qoldiruvchi vosita',
    isActive: true,
    createdBy: 'u1',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    companyId: 'c1',
    parametersCount: 2,
  },
  {
    id: 'sub-2',
    nameUz: 'Aspirin',
    nameRu: null,
    nameEn: null,
    pharmacopoeia: 'EP',
    casNumber: '50-78-2',
    description: null,
    isActive: true,
    createdBy: 'u1',
    createdAt: '2026-03-02T00:00:00.000Z',
    updatedAt: '2026-03-02T00:00:00.000Z',
    companyId: 'c1',
    parametersCount: 1,
  },
];

const mockDetailSub1: SubstanceDetailDto = {
  ...mockSubstances[0]!,
  parameters: [
    {
      id: 'p-1',
      substanceId: 'sub-1',
      parameterName: 'Erish harorati',
      unit: '°C',
      specMin: 168,
      specMax: 172,
      method: 'Kapillyar usul',
      sortOrder: 0,
      createdAt: '2026-03-01T00:00:00.000Z',
    },
    {
      id: 'p-2',
      substanceId: 'sub-1',
      parameterName: 'Tashqi ko‘rinishi',
      unit: null,
      specMin: null,
      specMax: null,
      method: 'Vizual',
      sortOrder: 1,
      createdAt: '2026-03-01T00:00:00.000Z',
    },
  ],
};

beforeEach(async () => {
  await i18n.changeLanguage('uz');
  api = new MockAdapter(apiClient);
});

afterEach(() => {
  api.restore();
});

describe('SubstancesPage & Components', () => {
  it('moddalar ro‘yxati, jadvali va tilga mos nom ko‘rsatilishi (R-I18N-09)', async () => {
    loginAs('admin');
    api.onGet('/substances').reply(200, {
      data: mockSubstances,
      meta: { page: 1, limit: 20, total: 2 },
    });

    renderAt('/substances');

    expect(await screen.findByRole('heading', { name: 'Moddalar' })).toBeInTheDocument();
    expect(await screen.findByText('Paratsetamol')).toBeInTheDocument();
    expect(screen.getByText('Aspirin')).toBeInTheDocument();
    expect(screen.getByText('103-90-2')).toBeInTheDocument();
    expect(screen.getAllByText('USP').length).toBeGreaterThanOrEqual(1);

    // Tilni ruscha qilish: s1 'Парацетамол' bo'ladi, s2 esa nameRu yo'qligi sababli 'Aspirin' ga fallback bo'ladi
    await i18n.changeLanguage('ru');
    expect(await screen.findByText('Парацетамол')).toBeInTheDocument();
    expect(screen.getByText('Aspirin')).toBeInTheDocument();

    await i18n.changeLanguage('uz');
  });

  it('RBAC: director faqat ko‘radi, lab_head yaratadi/tahrirlaydi, admin to‘liq boshqaradi', async () => {
    api.onGet('/substances').reply(200, {
      data: mockSubstances,
      meta: { page: 1, limit: 20, total: 2 },
    });

    // 1. Director: Yangi modda, Tahrirlash, O'chirish tugmalari yo'q
    loginAs('director');
    const { unmount: unmountDirector } = renderAt('/substances');
    expect(await screen.findByText('Paratsetamol')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+ Yangi modda/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tahrirlash' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /o'?chirish/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /ko'?rish/i }).length).toBeGreaterThanOrEqual(1);
    unmountDirector();

    // 2. Lab Head: Yangi modda va Tahrirlash bor, O'chirish yo'q
    loginAs('lab_head');
    const { unmount: unmountLabHead } = renderAt('/substances');
    expect(await screen.findByRole('button', { name: /\+ Yangi modda/i })).toBeInTheDocument();
    expect(await screen.findByText('Paratsetamol')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Tahrirlash' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: /o'?chirish/i })).not.toBeInTheDocument();
    unmountLabHead();

    // 3. Admin: Yangi modda, Tahrirlash va O'chirish hammasi mavjud
    loginAs('admin');
    const { unmount: unmountAdmin } = renderAt('/substances');
    expect(await screen.findByRole('button', { name: /\+ Yangi modda/i })).toBeInTheDocument();
    expect(await screen.findByText('Paratsetamol')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Tahrirlash' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: /o'?chirish/i }).length).toBeGreaterThanOrEqual(1);
    unmountAdmin();
  });

  it('yangi modda yaratish: forma validatsiyasi (nameUz, specMin>specMax, takror parametr)', async () => {
    loginAs('admin');
    const user = userEvent.setup();
    api.onGet('/substances').reply(200, {
      data: mockSubstances,
      meta: { page: 1, limit: 20, total: 2 },
    });

    renderAt('/substances');

    const newBtn = await screen.findByRole('button', { name: /\+ Yangi modda/i });
    await user.click(newBtn);

    expect(await screen.findByRole('heading', { name: 'Yangi modda' })).toBeInTheDocument();

    // 1. Bo'sh nom bilan submit qilish
    const saveBtn = screen.getByRole('button', { name: 'Saqlash' });
    await user.click(saveBtn);
    expect(await screen.findByText(/Modda nomi \(o'?zbekcha\) kiritilishi shart/i)).toBeInTheDocument();

    // 2. Nom kiritish
    await user.type(screen.getByLabelText(/Nomi \(O'?zbekcha\)/i), 'Ibuprofen');

    // 3. Parametr qo'shish
    const addParamBtn = screen.getByRole('button', { name: /Parametr qo'?shish/i });
    await user.click(addParamBtn);

    const paramInput = screen.getByPlaceholderText(/Masalan: Erish harorati/i);
    await user.type(paramInput, 'Zichlik');

    // specMin > specMax kiritish
    const minInput = screen.getByPlaceholderText('Min');
    const maxInput = screen.getByPlaceholderText('Max');
    await user.type(minInput, '20');
    await user.type(maxInput, '10');

    await user.click(saveBtn);
    expect(
      await screen.findByText(/Minimal qiymat maksimal qiymatdan katta bo'?lishi mumkin emas/i),
    ).toBeInTheDocument();

    // 4. Maxni to'g'rilash va ikkinchi parametr qo'shib takror nom kiritish
    await user.clear(maxInput);
    await user.type(maxInput, '30');

    await user.click(addParamBtn);
    const paramInputs = screen.getAllByPlaceholderText(/Masalan: Erish harorati/i);
    await user.type(paramInputs[1]!, 'zichlik'); // bir xil nom kichik harfda

    await user.click(saveBtn);
    expect((await screen.findAllByText(/Takror parametr nomi kiritilgan/i)).length).toBeGreaterThanOrEqual(1);

    // 5. Takror nomni olib tashlash va muvaffaqiyatli submit qilish
    const removeBtns = screen.getAllByRole('button', { name: 'Olib tashlash' });
    await user.click(removeBtns[1]!);

    api.onPost('/substances').reply(201, {
      data: {
        id: 'sub-new',
        nameUz: 'Ibuprofen',
        pharmacopoeia: 'EP',
        isActive: true,
        parameters: [],
      },
    });

    await user.click(saveBtn);
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Yangi modda' })).not.toBeInTheDocument();
    });
  });

  it('modda tafsiloti modali barcha parametrlarni ko‘rsatadi', async () => {
    loginAs('chemist');
    const user = userEvent.setup();
    api.onGet('/substances').reply(200, {
      data: mockSubstances,
      meta: { page: 1, limit: 20, total: 2 },
    });
    api.onGet('/substances/sub-1').reply(200, {
      data: mockDetailSub1,
    });

    renderAt('/substances');

    const viewBtn = (await screen.findAllByRole('button', { name: /ko'?rish/i }))[0]!;
    await user.click(viewBtn);

    expect(await screen.findByText('Erish harorati')).toBeInTheDocument();
    expect(screen.getByText('168')).toBeInTheDocument();
    expect(screen.getByText('172')).toBeInTheDocument();
    expect(screen.getByText('Kapillyar usul')).toBeInTheDocument();
    expect(screen.getByText('Tashqi ko‘rinishi')).toBeInTheDocument();
  });

  it('moddani o‘chirish: admin tasdiqlash modali orqali o‘chiradi', async () => {
    loginAs('admin');
    const user = userEvent.setup();
    api.onGet('/substances').reply(200, {
      data: mockSubstances,
      meta: { page: 1, limit: 20, total: 2 },
    });
    api.onDelete('/substances/sub-1').reply(204);

    renderAt('/substances');

    const deleteBtns = await screen.findAllByRole('button', { name: /o'?chirish/i });
    await user.click(deleteBtns[0]!);

    expect(await screen.findByRole('heading', { name: /Moddani o'?chirish/i })).toBeInTheDocument();
    expect(screen.getByText(/Haqiqatan ham «Paratsetamol»/i)).toBeInTheDocument();

    const confirmBtn = within(screen.getByRole('dialog')).getByRole('button', {
      name: /o'?chirish/i,
    });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Moddani o'?chirish/i })).not.toBeInTheDocument();
    });
  });

  it('SubstanceSelect komponenti faol moddalarni yuklaydi va tanlash imkonini beradi', async () => {
    const user = userEvent.setup();
    api.onGet('/substances').reply(200, {
      data: mockSubstances,
      meta: { page: 1, limit: 100, total: 2 },
    });

    const handleChange = vi.fn();
    const queryClient = createQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <SubstanceSelect
          id="test-sub-select"
          label="Modda tanlang"
          value=""
          onChange={handleChange}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Modda tanlang')).toBeInTheDocument();
    const select = await screen.findByRole('combobox');

    await waitFor(() => {
      expect(screen.getByText(/Paratsetamol/i)).toBeInTheDocument();
    });

    await user.selectOptions(select, 'sub-1');
    expect(handleChange).toHaveBeenCalledWith('sub-1', expect.objectContaining({ id: 'sub-1' }));
  });
});
