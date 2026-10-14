import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { FilterBar } from './FilterBar';

beforeEach(async () => {
  await i18n.changeLanguage('uz');
});

describe('FilterBar', () => {
  it('guruh nomlangan, tozalash tugmasi', async () => {
    const onReset = vi.fn();
    render(
      <FilterBar onReset={onReset}>
        <span>filtr</span>
      </FilterBar>,
    );
    expect(screen.getByRole('group', { name: 'Filtrlar' })).toHaveTextContent('filtr');
    await userEvent.click(screen.getByRole('button', { name: 'Filtrlarni tozalash' }));
    expect(onReset).toHaveBeenCalled();
  });

  it("faol filtr yo'q — tozalash ko'rinmaydi", () => {
    render(
      <FilterBar onReset={() => undefined} canReset={false}>
        <span>f</span>
      </FilterBar>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('FilterBar (forma rejimi)', () => {
  it("role=search forma: Enter/qo'llash onSubmit, tozalash tugmasi va qo'shimcha qator", async () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    const onReset = vi.fn();
    render(
      <FilterBar
        onSubmit={onSubmit}
        onReset={onReset}
        submitLabel="Qo'llash"
        resetLabel="Tozalash"
        extra={<span>qo'shimcha</span>}
      >
        <input aria-label="lot" />
      </FilterBar>,
    );
    expect(screen.getByRole('search', { name: 'Filtrlar' })).toBeInTheDocument();
    expect(screen.getByText("qo'shimcha")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('lot'), 'L1{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: "Qo'llash" }));
    await userEvent.click(screen.getByRole('button', { name: 'Tozalash' }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
