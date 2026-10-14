import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pressable } from './Pressable';

describe('Pressable', () => {
  it('haqiqiy tugma: boy mazmun nomga kiradi, klaviatura bilan bosiladi', async () => {
    const onClick = vi.fn();
    render(
      <Pressable onClick={onClick}>
        <span>Namuna biriktirildi</span>
        <span>Paratsetamol</span>
      </Pressable>,
    );
    const btn = screen.getByRole('button', { name: /Namuna biriktirildi\s*Paratsetamol/ });
    expect(btn).toHaveAttribute('type', 'button');
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('variant va highlighted holati', () => {
    render(
      <>
        <Pressable highlighted>qator</Pressable>
        <Pressable variant="card">karta</Pressable>
      </>,
    );
    expect(screen.getByRole('button', { name: 'qator' })).toHaveClass(
      'focus-ring-inset',
      'bg-primary-subtle/60',
    );
    expect(screen.getByRole('button', { name: 'karta' })).toHaveClass('rounded-xl', 'focus-ring');
  });
});
