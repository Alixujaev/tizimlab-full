import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Input } from './Input';

describe('Input', () => {
  it('yoziladi va onChange chaqiriladi', async () => {
    const onChange = vi.fn();
    render(<Input aria-label="Nomi" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Nomi' }), 'abc');
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('textbox')).toHaveValue('abc');
  });

  it('invalid — aria-invalid va xato rangi', () => {
    render(<Input aria-label="x" invalid />);
    const el = screen.getByRole('textbox');
    expect(el).toHaveAttribute('aria-invalid', 'true');
    expect(el).toHaveClass('border-danger');
  });

  it("o'lcham va chap ikon", () => {
    const { container } = render(<Input aria-label="q" size="lg" leftIcon="search" />);
    expect(screen.getByRole('textbox')).toHaveClass('h-11', 'pl-9');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it("disabled — yozib bo'lmaydi", async () => {
    render(<Input aria-label="x" disabled />);
    await userEvent.type(screen.getByRole('textbox'), 'a');
    expect(screen.getByRole('textbox')).toHaveValue('');
  });
});
