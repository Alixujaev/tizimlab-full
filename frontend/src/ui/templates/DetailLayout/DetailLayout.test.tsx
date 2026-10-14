import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DetailLayout } from './DetailLayout';

describe('DetailLayout', () => {
  it('asosiy mazmun va yon panel (complementary landmark)', () => {
    render(<DetailLayout aside={<p>xulosa</p>}>asosiy</DetailLayout>);
    expect(screen.getByRole('complementary')).toHaveTextContent('xulosa');
    expect(screen.getByText('asosiy')).toHaveClass('lg:col-span-2');
  });

  it('yon panelsiz — bitta ustun', () => {
    render(<DetailLayout>faqat</DetailLayout>);
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.getByText('faqat')).toHaveClass('flex-col');
  });
});
