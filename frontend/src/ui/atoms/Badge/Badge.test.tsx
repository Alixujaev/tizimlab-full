import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge, toneClasses } from './Badge';

describe('Badge', () => {
  it('matn va standart neutral ohang', () => {
    render(<Badge>Reaktiv</Badge>);
    expect(screen.getByText('Reaktiv')).toHaveClass('bg-surface-sunken');
  });

  it.each(Object.keys(toneClasses) as Array<keyof typeof toneClasses>)('%s ohangi', (tone) => {
    render(<Badge tone={tone}>t</Badge>);
    const cls = toneClasses[tone].split(' ')[1]!;
    expect(screen.getByText('t')).toHaveClass(cls);
  });

  it("o'lcham va bezak ikon", () => {
    const { container } = render(
      <Badge size="lg" icon="check">
        OK
      </Badge>,
    );
    expect(screen.getByText('OK')).toHaveClass('text-sm');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
