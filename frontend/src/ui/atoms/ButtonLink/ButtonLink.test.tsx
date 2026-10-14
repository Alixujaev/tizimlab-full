import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ButtonLink } from './ButtonLink';

describe('ButtonLink', () => {
  it('havola semantikasi, Button variant klasslari', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/samples" variant="primary" leftIcon="arrow-left">
          Namunalar
        </ButtonLink>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Namunalar' });
    expect(link).toHaveAttribute('href', '/samples');
    expect(link).toHaveClass('bg-primary', 'h-9');
  });
});
