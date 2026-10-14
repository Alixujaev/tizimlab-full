import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DatePicker } from '../../atoms/DatePicker';
import { Input } from '../../atoms/Input';
import { Select } from '../../atoms/Select';
import { FormField } from './FormField';

describe('FormField', () => {
  it("label input'ga bog'lanadi, hint aria-describedby orqali o'qiladi", () => {
    render(
      <FormField label="Partiya raqami" hint="Masalan: PR-001" required>
        <Input />
      </FormField>,
    );
    const input = screen.getByRole('textbox', { name: /Partiya raqami/ });
    expect(input).toBeRequired();
    expect(input).toHaveAccessibleDescription('Masalan: PR-001');
  });

  it("xato: aria-invalid, role=alert, hint o'rniga xato", () => {
    render(
      <FormField label="Email" hint="hint" error="Email noto'g'ri">
        <Input />
      </FormField>,
    );
    const input = screen.getByRole('textbox', { name: 'Email' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription("Email noto'g'ri");
    expect(screen.getByRole('alert')).toHaveTextContent("Email noto'g'ri");
    expect(screen.queryByText('hint')).toBeNull();
  });

  it('Select va DatePicker ham kontekstdan id/xatoni oladi', () => {
    render(
      <>
        <FormField label="Holati" error="Majburiy">
          <Select options={[{ value: 'a', label: 'A' }]} value="" onChange={() => undefined} />
        </FormField>
        <FormField label="Sana" disabled>
          <DatePicker value="" onChange={() => undefined} />
        </FormField>
      </>,
    );
    const combo = screen.getByRole('combobox', { name: 'Holati' });
    expect(combo).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('textbox', { name: 'Sana' })).toBeDisabled();
  });
});
