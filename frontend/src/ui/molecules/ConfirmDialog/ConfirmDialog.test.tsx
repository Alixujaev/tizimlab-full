import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { ConfirmDialog } from './ConfirmDialog';

beforeEach(async () => {
  await i18n.changeLanguage('uz');
});

describe('ConfirmDialog', () => {
  it('alertdialog, fokus "Bekor qilish" da, danger tugma', () => {
    render(
      <ConfirmDialog
        open
        title="Hujjatni o'chirish"
        description="Bu amalni qaytarib bo'lmaydi"
        confirmLabel="O'chirish"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    const dlg = screen.getByRole('alertdialog', { name: "Hujjatni o'chirish" });
    expect(dlg).toHaveAccessibleDescription("Bu amalni qaytarib bo'lmaydi");
    expect(screen.getByRole('button', { name: 'Bekor qilish' })).toHaveFocus();
    expect(screen.getByRole('button', { name: "O'chirish" })).toHaveClass('bg-danger');
  });

  it('tasdiqlash, bekor qilish va Esc', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="T" onConfirm={onConfirm} onCancel={onCancel} tone="primary" />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Tasdiqlash' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Bekor qilish' }));
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("loading: tugmalar o'chiq, Esc yopmaydi", async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="T" loading onConfirm={() => undefined} onCancel={onCancel} />,
    );
    expect(screen.getByRole('button', { name: 'Tasdiqlash' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Bekor qilish' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
  });
});
