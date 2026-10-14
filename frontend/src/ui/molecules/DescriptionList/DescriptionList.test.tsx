import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DescriptionList } from './DescriptionList';

describe('DescriptionList', () => {
  it("yorliq/qiymat juftliklari, bo'sh qiymat — tire, false bandlar tashlanadi", () => {
    render(
      <DescriptionList
        items={[
          { label: 'Lot', value: 'LOT-100', mono: true },
          { label: 'Miqdori', value: null },
          false,
          { label: 'Izoh', value: 'uzun', wide: true },
        ]}
      />,
    );
    expect(screen.getAllByRole('term')).toHaveLength(3);
    expect(screen.getByText('LOT-100')).toHaveClass('font-mono');
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('uzun').parentElement).toHaveClass('sm:col-span-full');
  });
});
