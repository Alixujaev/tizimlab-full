import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { notify, Toaster } from './Toast';

beforeEach(async () => {
  await i18n.changeLanguage('uz');
});

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
});

describe('Toast', () => {
  it("notify xabarni token uslubida ko'rsatadi, hudud va yopish tugmasi tarjima qilingan", async () => {
    render(<Toaster />);
    act(() => {
      notify.success('Saqlandi');
    });
    const item = (await screen.findByText('Saqlandi')).closest('li')!;
    expect(item).toHaveClass('bg-surface', 'border-success-line');
    expect(screen.getByRole('region', { name: /Xabarlar/ })).toBeInTheDocument();
    const close = within(item).getByRole('button', { name: 'Xabarni yopish' });
    await userEvent.click(close);
    await vi.waitFor(() => expect(screen.queryByText('Saqlandi')).toBeNull());
  });

  it('error/warning/info sonner orqali (global xato oqimi bilan mos)', () => {
    const spy = vi.spyOn(toast, 'error');
    notify.error('Xato');
    expect(spy).toHaveBeenCalledWith('Xato', undefined);
    spy.mockRestore();
  });
});
