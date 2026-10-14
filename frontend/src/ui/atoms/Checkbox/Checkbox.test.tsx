import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('label bilan bog‘langan, bosilganda belgilanadi', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Faol" onChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: 'Faol' });
    await userEvent.click(screen.getByText('Faol'));
    expect(box).toBeChecked();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('klaviatura: Tab bilan fokus, Space bilan almashadi', async () => {
    render(<Checkbox label="A" />);
    await userEvent.tab();
    const box = screen.getByRole('checkbox');
    expect(box).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(box).toBeChecked();
  });

  it('indeterminate va invalid holatlari', () => {
    render(<Checkbox label="Hammasi" indeterminate invalid />);
    const box = screen.getByRole('checkbox') as HTMLInputElement;
    expect(box.indeterminate).toBe(true);
    expect(box).toHaveAttribute('aria-invalid', 'true');
  });

  it("disabled — o'zgarmaydi", async () => {
    render(<Checkbox label="X" disabled />);
    await userEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
});
