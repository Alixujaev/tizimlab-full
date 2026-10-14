import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { PageSkeleton } from './PageSkeleton';

beforeEach(async () => {
  await i18n.changeLanguage('uz');
});

describe('PageSkeleton', () => {
  it.each(['list', 'detail', 'cards'] as const)(
    '%s: role=status, aria-busy, skelet bloklari',
    (variant) => {
      const { container } = render(<PageSkeleton variant={variant} />);
      expect(screen.getByRole('status')).toHaveTextContent('Yuklanmoqda…');
      expect(container.firstElementChild).toHaveAttribute('aria-busy', 'true');
      expect(container.querySelectorAll('.animate-pulse-soft').length).toBeGreaterThan(2);
    },
  );
});
