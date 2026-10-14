import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { DataTable, type DataTableColumn } from './DataTable';

interface Row {
  id: string;
  name: string;
  qty: number;
}

const ROWS: Row[] = [
  { id: '1', name: 'Paracetamol', qty: 30 },
  { id: '2', name: 'Aspirin', qty: 5 },
  { id: '3', name: 'Ibuprofen', qty: 12 },
];

const COLUMNS: DataTableColumn<Row>[] = [
  { key: 'name', header: 'Nomi', render: (r) => r.name, sortValue: (r) => r.name, primary: true },
  { key: 'qty', header: 'Miqdor', render: (r) => r.qty, sortValue: (r) => r.qty, align: 'right' },
];

beforeEach(async () => {
  await i18n.changeLanguage('uz');
});

const names = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[0]!.textContent);

describe('DataTable (desktop)', () => {
  it('qatorlar, caption va sticky sarlavha', () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} caption="Moddalar" />);
    expect(screen.getByRole('table', { name: 'Moddalar' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Paracetamol' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Nomi/ })).toHaveClass('sticky');
  });

  it('saralash: asc → desc → yo‘q, aria-sort', async () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />);
    const header = screen.getByRole('columnheader', { name: /Miqdor/ });
    await userEvent.click(within(header).getByRole('button'));
    expect(header).toHaveAttribute('aria-sort', 'ascending');
    expect(names()).toEqual(['Aspirin', 'Ibuprofen', 'Paracetamol']);
    await userEvent.click(within(header).getByRole('button'));
    expect(header).toHaveAttribute('aria-sort', 'descending');
    expect(names()).toEqual(['Paracetamol', 'Ibuprofen', 'Aspirin']);
    await userEvent.click(within(header).getByRole('button'));
    expect(header).not.toHaveAttribute('aria-sort');
    expect(names()).toEqual(['Paracetamol', 'Aspirin', 'Ibuprofen']);
  });

  it('boshqariladigan (server) saralash — onSortChange chaqiriladi, qatorlar o‘zgarmaydi', async () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        sort={null}
        onSortChange={onSortChange}
      />,
    );
    await userEvent.click(
      within(screen.getByRole('columnheader', { name: /Nomi/ })).getByRole('button'),
    );
    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'asc' });
    expect(names()[0]).toBe('Paracetamol');
  });

  it("yuklanish: skelet qatorlar + role=status; bo'sh va xato holatlari", async () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <DataTable columns={COLUMNS} rows={[]} rowKey={(r) => r.id} loading skeletonRows={3} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Yuklanmoqda…');
    expect(screen.getAllByRole('row')).toHaveLength(4);
    rerender(<DataTable columns={COLUMNS} rows={[]} rowKey={(r) => r.id} />);
    expect(screen.getByText("Ma'lumot yo'q")).toBeInTheDocument();
    rerender(
      <DataTable columns={COLUMNS} rows={[]} rowKey={(r) => r.id} error onRetry={onRetry} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('qator bosilishi (sichqoncha va Enter) va onRowIntent', async () => {
    const onRowClick = vi.fn();
    const onRowIntent = vi.fn();
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
        onRowIntent={onRowIntent}
      />,
    );
    const row = screen.getByRole('cell', { name: 'Aspirin' }).closest('tr')!;
    await userEvent.hover(row);
    expect(onRowIntent).toHaveBeenCalledWith(ROWS[1]);
    await userEvent.click(row);
    row.focus();
    await userEvent.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });
});

describe('DataTable (mobil)', () => {
  const original = window.matchMedia;
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it("tor ekranda karta ko'rinishi: sarlavha + yorliqli qiymatlar", () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} caption="Moddalar" />);
    expect(screen.queryByRole('table')).toBeNull();
    const list = screen.getByRole('list', { name: 'Moddalar' });
    const cards = within(list).getAllByRole('listitem');
    expect(cards).toHaveLength(3);
    expect(within(cards[0]!).getByText('Paracetamol')).toBeInTheDocument();
    expect(within(cards[0]!).getByRole('term')).toHaveTextContent('Miqdor');
    expect(within(cards[0]!).getByRole('definition')).toHaveTextContent('30');
  });
});
