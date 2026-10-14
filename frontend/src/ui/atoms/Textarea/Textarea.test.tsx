import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it("ko'p qatorli matn kiritiladi", async () => {
    render(<Textarea aria-label="Izoh" />);
    const el = screen.getByRole('textbox', { name: 'Izoh' });
    await userEvent.type(el, 'birinchi{Enter}ikkinchi');
    expect(el).toHaveValue('birinchi\nikkinchi');
    expect(el).toHaveAttribute('rows', '3');
  });

  it('invalid holati', () => {
    render(<Textarea aria-label="x" invalid />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });
});
