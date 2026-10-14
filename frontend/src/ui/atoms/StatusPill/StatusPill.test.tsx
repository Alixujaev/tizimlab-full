import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusPill } from './StatusPill';

describe('StatusPill', () => {
  it('ohang klasslari va bezak nuqta', () => {
    const { container } = render(<StatusPill tone="success">Tasdiqlangan</StatusPill>);
    expect(screen.getByText('Tasdiqlangan')).toHaveClass('bg-success-subtle', 'rounded-full');
    const dot = container.querySelector('[aria-hidden="true"]')!;
    expect(dot).toHaveClass('bg-success');
    expect(dot).not.toHaveClass('animate-pulse-soft');
  });

  it('pulse — jarayon belgisi', () => {
    const { container } = render(
      <StatusPill tone="info" pulse>
        Tahlilda
      </StatusPill>,
    );
    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass('animate-pulse-soft');
  });
});
