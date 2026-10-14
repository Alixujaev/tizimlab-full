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
