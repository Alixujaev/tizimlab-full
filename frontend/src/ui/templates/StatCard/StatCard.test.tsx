import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('havola sifatida: yorliq va qiymat nomda', () => {
    render(
      <MemoryRouter>
        <StatCard label="Tahlilda" value={7} to="/samples?status=in_progress" icon="flask" />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: /Tahlilda\s*7/ });
    expect(link).toHaveAttribute('href', '/samples?status=in_progress');
  });

  it('highlight — ogohlantirish rangi', () => {
    render(<StatCard label="Kutilmoqda" value={3} highlight hint="bugun" />);
    expect(screen.getByText('3')).toHaveClass('text-warning-fg');
    expect(screen.getByText('bugun')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
