import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { Button } from '../../atoms/Button';
import { EmptyState } from './EmptyState';

beforeEach(async () => {
  await i18n.changeLanguage('uz');
});

describe('EmptyState', () => {
  it('standart tarjima qilingan sarlavha', () => {
    render(<EmptyState />);
    expect(screen.getByText("Hozircha ma'lumot yo'q")).toBeInTheDocument();
  });

  it('sarlavha, tavsif va amal', () => {
    render(
      <EmptyState
        title="Namunalar yo'q"
        description="Birinchi namunani qo'shing"
        action={<Button>Qo'shish</Button>}
        size="sm"
      />,
    );
    expect(screen.getByText("Namunalar yo'q")).toHaveClass('text-sm');
    expect(screen.getByText("Birinchi namunani qo'shing")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Qo'shish" })).toBeInTheDocument();
  });

  it('titleAs=h1 — sahifa sarlavhasi', () => {
    render(<EmptyState title="Sahifa topilmadi" titleAs="h1" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Sahifa topilmadi' })).toBeInTheDocument();
  });
});
