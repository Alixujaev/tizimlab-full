import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from './Icon';
import { ICONS } from './icons';

describe('Icon', () => {
  it("label'siz — bezak: aria-hidden, rol yo'q", () => {
    const { container } = render(<Icon name="check" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role');
  });

  it('label bilan — role=img va aria-label', () => {
    render(<Icon name="bell" label="Bildirishnomalar" />);
    expect(screen.getByRole('img', { name: 'Bildirishnomalar' })).toBeInTheDocument();
  });

  it("o'lcham varianti klass beradi va har ikon kamida bitta path", () => {
    const { container } = render(<Icon name="search" size="lg" />);
    expect(container.querySelector('svg')).toHaveClass('size-6');
    for (const paths of Object.values(ICONS)) expect(paths.length).toBeGreaterThan(0);
  });
});
