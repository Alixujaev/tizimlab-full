import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { Button } from '../../atoms/Button';
import { PageHeader } from './PageHeader';

beforeEach(async () => {
  await i18n.changeLanguage('uz');
});

describe('PageHeader', () => {
  it('h1, tavsif va amallar', () => {
    render(
      <MemoryRouter>
        <PageHeader
          title="Namunalar"
          description="Barcha namunalar"
          actions={<Button>Yangi</Button>}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Namunalar' })).toBeInTheDocument();
    expect(screen.getByText('Barcha namunalar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yangi' })).toBeInTheDocument();
  });

  it('orqaga havola standart matn bilan', () => {
    render(
      <MemoryRouter>
        <PageHeader title="NS-001" back={{ to: '/samples' }} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Orqaga' })).toHaveAttribute('href', '/samples');
  });
});
