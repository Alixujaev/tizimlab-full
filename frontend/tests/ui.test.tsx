import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataTable as Table, Pagination } from '@/ui';
import i18n from '@/i18n';

beforeEach(async () => {
  await i18n.changeLanguage('uz');
});

describe('Table', () => {
  const columns = [
    { key: 'name', header: 'Nomi', render: (r: { id: string; name: string }) => r.name },
  ];

  it('qatorlarni chiqaradi', () => {
    render(
      <Table columns={columns} rows={[{ id: '1', name: 'Paracetamol' }]} rowKey={(r) => r.id} />,
    );
    expect(screen.getByRole('cell', { name: 'Paracetamol' })).toBeInTheDocument();
  });

  it("bo'sh ro'yxat va yuklanish holatlari", () => {
    const { rerender } = render(<Table columns={columns} rows={[]} rowKey={(r) => r.id} />);
    expect(screen.getByText("Ma'lumot yo'q")).toBeInTheDocument();
    rerender(<Table columns={columns} rows={[]} rowKey={(r) => r.id} loading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('Pagination', () => {
  it("D-22 meta bo'yicha sahifalar va chegaralar", async () => {
    const onPageChange = vi.fn();
    render(<Pagination meta={{ page: 1, limit: 20, total: 45 }} onPageChange={onPageChange} />);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Oldingi' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Keyingi' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("oxirgi sahifada Keyingi o'chiq", () => {
    render(<Pagination meta={{ page: 3, limit: 20, total: 45 }} onPageChange={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Keyingi' })).toBeDisabled();
  });
});
