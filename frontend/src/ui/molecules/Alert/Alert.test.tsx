import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Alert } from './Alert';

describe('Alert', () => {
  it('danger — role=alert, sarlavha va matn', () => {
    render(
      <Alert tone="danger" title="Saqlanmadi">
        Server javob bermadi
      </Alert>,
    );
    const el = screen.getByRole('alert');
    expect(el).toHaveTextContent('Saqlanmadi');
    expect(el).toHaveTextContent('Server javob bermadi');
    expect(el).toHaveClass('bg-danger-subtle');
  });

  it('info — role=status; amal joyi', () => {
    render(<Alert action={<span>amal</span>}>Ma'lumot</Alert>);
    expect(screen.getByRole('status')).toHaveTextContent("Ma'lumot");
    expect(screen.getByText('amal')).toBeInTheDocument();
  });
});
