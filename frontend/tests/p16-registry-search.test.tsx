import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import type { RegistryItemDto } from '@/types';
import { loginAs, renderAt, resetAuth, selectOption } from './helpers';

/** P16 / TZ §3.5 — reyestrda kimyogar bo'yicha qidiruv (D-172). */

let api: MockAdapter;

const row = {
  id: 'r1',
  companyId: 'c1',
  type: 'raw_material',
  status: 'approved',
  substanceId: null,
  substanceName: 'Ibuprofen',
  serialNumber: 'S-1',
  lotNumber: 'LOT-1',
  quantity: null,
  manufacturer: null,
  manufacturedAt: null,
  analysisStart: null,
  analysisEnd: null,
  notes: null,
  createdBy: 'u2',
  assignedTo: 'chem-1',
  assignedToName: 'Aziz Karimov',
  assignedBy: null,
  assignedAt: null,
  stopReason: null,
  stoppedAt: null,
  deletedAt: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  approvedAt: '2026-03-02T00:00:00.000Z',
  downloadKind: null,
} as unknown as RegistryItemDto;

describe('P16: reyestr — kimyogar filtri', () => {
  beforeEach(() => {
    api = new MockAdapter(apiClient);
    api.onGet('/registry/chemists').reply(200, {
      data: [
        { id: 'chem-1', fullName: 'Aziz Karimov', isActive: true },
        { id: 'chem-9', fullName: 'Old Chemist', isActive: false },
      ],
    });
  });
  afterEach(() => {
    api.restore();
    resetAuth();
  });

  it('"Kimyogar" ustuni ko‘rinadi va filtr chemistId yuboradi', async () => {
    const user = userEvent.setup();
    loginAs('kontrolyor');
    const seen: Record<string, unknown>[] = [];
    api.onGet('/registry').reply((config) => {
      seen.push((config.params ?? {}) as Record<string, unknown>);
      return [200, { data: [row], meta: { page: 1, limit: 20, total: 1 } }];
    });
    renderAt('/registry');
    await waitFor(() => expect(screen.getByText('Ibuprofen')).toBeInTheDocument());
    expect(screen.getAllByText('Aziz Karimov').length).toBeGreaterThan(0);

    const select = screen.getByLabelText('Kimyogar');
    await selectOption(user, select, 'chem-1');
    await user.click(screen.getByRole('button', { name: /Qo‘llash|Qidirish|Qo'llash/i }));
    await waitFor(() => expect(seen.some((p) => p.chemistId === 'chem-1')).toBe(true));
  });

  it('nofaol kimyogar belgilanadi', async () => {
    const user = userEvent.setup();
    loginAs('director');
    api.onGet('/registry').reply(200, { data: [], meta: { page: 1, limit: 20, total: 0 } });
    renderAt('/registry');
    const select = await screen.findByLabelText('Kimyogar');
    await waitFor(() => expect(select).not.toBeDisabled());
    await user.click(select);
    expect(await screen.findByText('Old Chemist (nofaol)')).toBeInTheDocument();
  });
});
