import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('sarlavha section nomi, amallar va footer', () => {
    render(
      <Card
        title="Pasport"
        description="Yuklangan hujjat"
        actions={<span>amal</span>}
        footer="pastki"
      >
        mazmun
      </Card>,
    );
    expect(screen.getByRole('region', { name: 'Pasport' })).toHaveTextContent('mazmun');
    expect(screen.getByText('amal')).toBeInTheDocument();
    expect(screen.getByText('pastki')).toBeInTheDocument();
  });

  it('flush — ichki chetsiz; sarlavhasiz — nomsiz section', () => {
    const { container } = render(<Card flush>jadval</Card>);
    expect(screen.queryByRole('region')).toBeNull();
    expect(container.querySelector('section > div')).not.toHaveClass('px-5');
  });
});
