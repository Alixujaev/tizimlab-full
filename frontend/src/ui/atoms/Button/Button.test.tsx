import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('standart type=button va primary variant', () => {
    render(<Button>Saqlash</Button>);
    const btn = screen.getByRole('button', { name: 'Saqlash' });
    expect(btn).toHaveAttribute('type', 'button');
    expect(btn).toHaveClass('bg-primary');
  });

  it.each([
    ['secondary', 'bg-surface'],
    ['ghost', 'text-fg-muted'],
    ['danger', 'bg-danger'],
    ['danger-ghost', 'text-danger-fg'],
  ] as const)('%s varianti', (variant, cls) => {
    render(<Button variant={variant}>x</Button>);
    expect(screen.getByRole('button')).toHaveClass(cls);
  });

  it("o'lchamlar", () => {
    render(<Button size="lg">x</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-11');
  });

  it('klaviatura: Enter va Space bosadi', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Bos</Button>);
    await userEvent.tab();
    expect(screen.getByRole('button')).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("loading: o'chiq, aria-busy, bosilmaydi", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Yuborish
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Yuborish' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('submit turi formani yuboradi', async () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit">OK</Button>
      </form>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onSubmit).toHaveBeenCalled();
  });
});
