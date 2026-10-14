import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { Spinner } from './Spinner';

beforeEach(async () => {
  await i18n.changeLanguage('uz');
});

describe('Spinner', () => {
  it('role=status va tarjima qilingan yashirin matn', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveTextContent('Yuklanmoqda…');
  });

  it('inline — status rolisiz (tugma ichida ishlatiladi)', () => {
    render(<Spinner inline />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it("o'lcham varianti", () => {
    const { container } = render(<Spinner size="lg" />);
    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass('size-8');
  });
});
