import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('aria-label orqali nomlanadi, ikon bezak', () => {
    const { container } = render(<IconButton icon="trash" label="O'chirish" />);
    expect(screen.getByRole('button', { name: "O'chirish" })).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('variant va o‘lcham', () => {
    render(<IconButton icon="plus" label="Qo'shish" variant="primary" size="lg" />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('bg-primary', 'size-11');
  });

  it('klaviatura bilan bosiladi; loading — o‘chiq', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<IconButton icon="x" label="Yopish" onClick={onClick} />);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<IconButton icon="x" label="Yopish" onClick={onClick} loading />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
