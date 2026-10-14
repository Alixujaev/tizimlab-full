import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { Pagination } from './Pagination';

beforeEach(async () => {
  await i18n.changeLanguage('uz');
});

describe('Pagination', () => {
  it('nav nomlangan, sahifalar soni va chegaralar', async () => {
    const onPageChange = vi.fn();
    render(<Pagination meta={{ page: 1, limit: 20, total: 45 }} onPageChange={onPageChange} />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Oldingi' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Keyingi' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("oxirgi sahifada Keyingi o'chiq; summary qatori", () => {
    render(
      <Pagination
        meta={{ page: 3, limit: 20, total: 45 }}
        onPageChange={() => undefined}
        showSummary
      />,
    );
    expect(screen.getByRole('button', { name: 'Keyingi' })).toBeDisabled();
    expect(screen.getByText(/41-45/)).toBeInTheDocument();
  });
});
