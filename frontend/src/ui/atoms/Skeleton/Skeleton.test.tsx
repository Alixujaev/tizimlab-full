import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('bezak (aria-hidden) va animatsiya', () => {
    const { container } = render(<Skeleton className="w-40" />);
    const el = container.firstElementChild!;
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el).toHaveClass('animate-pulse-soft', 'bg-skeleton', 'w-40');
  });

  it('matn qatorlari — oxirgisi qisqaroq', () => {
    const { container } = render(<Skeleton lines={3} />);
    const lines = container.querySelectorAll('span > span');
    expect(lines).toHaveLength(3);
    expect(lines[2]).toHaveClass('w-2/3');
  });

  it('doira varianti', () => {
    const { container } = render(<Skeleton variant="circle" className="size-10" />);
    expect(container.firstElementChild).toHaveClass('rounded-full');
  });
});
