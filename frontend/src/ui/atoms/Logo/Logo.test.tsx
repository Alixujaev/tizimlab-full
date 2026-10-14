import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo, LogoIcon, LogoMark } from './Logo';

describe('Logo', () => {
  it("so'z belgisi ikki qismda, brend tokenlari bilan", () => {
    render(<Logo primary="Tizim" secondary="Lab" />);
    expect(screen.getByText('Tizim')).toHaveClass('font-bold', 'text-brand-word');
    expect(screen.getByText('Lab')).toHaveClass('font-light', 'text-brand-word-accent');
  });

  it("katta o'lcham", () => {
    const { container } = render(<Logo primary="Tizim" secondary="Lab" size="lg" />);
    expect(container.querySelector('svg')).toHaveClass('h-16');
  });

  it('belgi va ikon bezak (aria-hidden), uchta olti burchak', () => {
    for (const el of [<LogoMark key="m" />, <LogoIcon key="i" />]) {
      const { container, unmount } = render(el);
      const svg = container.querySelector('svg')!;
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg.querySelectorAll('polygon')).toHaveLength(3);
      unmount();
    }
  });
});
