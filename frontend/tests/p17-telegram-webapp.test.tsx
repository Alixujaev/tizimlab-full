import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import { loginAs, renderAt, resetAuth } from './helpers';
import { telegramStub } from './telegramStub';

/** P17 — apparatlar va ND sahifalari Telegram WebApp mobil shell'ida (D-166). */

let api: MockAdapter;

describe('P17: Telegram WebApp', () => {
  beforeEach(() => {
    window.Telegram = { WebApp: telegramStub() };
    api = new MockAdapter(apiClient);
    api.onGet(/\/notifications/).reply(200, { data: [], meta: { page: 1, limit: 20, total: 0 } });
    api.onGet('/equipment/categories').reply(200, { data: [] });
  });
  afterEach(() => {
    delete window.Telegram;
    api.restore();
    resetAuth();
  });

  it('lab_head "Yana" menyusida Apparatlar va Normativ hujjatlar bor', async () => {
    const user = userEvent.setup();
    loginAs('lab_head');
    api.onGet('/equipment').reply(200, { data: [], meta: { page: 1, limit: 20, total: 0 } });
    renderAt('/equipment');
    await user.click(await screen.findByRole('button', { name: /Yana/i }, { timeout: 4000 }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByRole('link', { name: /Apparatlar/ })).toHaveAttribute(
      'href',
      '/equipment',
    );
    expect(within(sheet).getByRole('link', { name: /Normativ hujjatlar/ })).toHaveAttribute(
      'href',
      '/nd',
    );
  });

  it('ND sahifasi moslik paneli bilan mobil shell ichida ochiladi', async () => {
    loginAs('chemist');
    api.onGet('/nd/nd1').reply(200, {
      data: {
        id: 'nd1',
        code: 'ND-42',
        name: 'Paratsetamol',
        version: null,
        status: 'approved',
        approvedBy: null,
        approvedAt: null,
        fileName: null,
        fileSize: null,
        hasFile: false,
        requirementCount: 0,
        createdAt: '',
        updatedAt: '',
        requirements: [],
      },
    });
    api.onGet('/nd/nd1/feasibility').reply(200, {
      data: {
        ndId: 'nd1',
        ndStatus: 'approved',
        nAnalyses: 1,
        canRun: true,
        reasons: [],
        equipment: [],
        reagents: [],
      },
    });
    renderAt('/nd/nd1');
    expect(
      await screen.findByText('Tahlilni bajarish mumkin', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Yana/i })).toBeInTheDocument();
  });
});
