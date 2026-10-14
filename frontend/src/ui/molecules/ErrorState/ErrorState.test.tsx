import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { ErrorState } from './ErrorState';

beforeEach(async () => {
  await i18n.changeLanguage('uz');
});

describe('ErrorState', () => {
  it('role=alert va standart matnlar', () => {
    render(<ErrorState />);
    expect(screen.getByRole('alert')).toHaveTextContent('Xatolik yuz berdi');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('qayta urinish tugmasi', async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} description="Tarmoq xatosi" />);
    expect(screen.getByText('Tarmoq xatosi')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
