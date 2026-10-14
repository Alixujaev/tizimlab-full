import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Select, type SelectOption } from './Select';

const OPTIONS: SelectOption[] = [
  { value: 'raw', label: 'Xomashyo' },
  { value: 'fin', label: 'Tayyor mahsulot' },
  { value: 'rea', label: 'Reaktiv', disabled: true },
  { value: 'std', label: 'Standart modda' },
];

function Harness({ onChange = () => undefined }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <form data-testid="form">
      <Select
        aria-label="Turi"
        name="type"
        options={OPTIONS}
        value={value}
        onChange={(v) => {
          onChange(v);
          setValue(v);
        }}
        placeholder="Tanlang"
      />
    </form>
  );
}

describe('Select', () => {
  it('combobox aria atributlari va placeholder', () => {
    render(<Harness />);
    const cb = screen.getByRole('combobox', { name: 'Turi' });
    expect(cb).toHaveAttribute('aria-haspopup', 'listbox');
    expect(cb).toHaveAttribute('aria-expanded', 'false');
    expect(cb).toHaveTextContent('Tanlang');
  });

  it('sichqoncha bilan tanlash; yashirin input formaga qiymat beradi', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: 'Tayyor mahsulot' }));
    expect(onChange).toHaveBeenCalledWith('fin');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('combobox')).toHaveTextContent('Tayyor mahsulot');
    const data = new FormData(screen.getByTestId('form') as HTMLFormElement);
    expect(data.get('type')).toBe('fin');
  });

  it("klaviatura: ↓ ochadi, o'chiq variantni o'tkazib yuboradi, Enter tanlaydi, fokus tugmada", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.tab();
    const cb = screen.getByRole('combobox');
    await userEvent.keyboard('{ArrowDown}');
    expect(cb).toHaveAttribute('aria-expanded', 'true');
    expect(cb.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Xomashyo' }).id,
    );
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    // "Reaktiv" o'chiq — Standart modda ga sakraydi
    expect(cb.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Standart modda' }).id,
    );
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('std');
    expect(cb).toHaveFocus();
  });

  it('Home/End va harf terish (type-ahead)', async () => {
    render(<Harness />);
    await userEvent.tab();
    const cb = screen.getByRole('combobox');
    await userEvent.keyboard('{ArrowDown}{End}');
    expect(cb.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Standart modda' }).id,
    );
    await userEvent.keyboard('{Home}');
    expect(cb.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Xomashyo' }).id,
    );
    await userEvent.keyboard('t');
    expect(cb.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Tayyor mahsulot' }).id,
    );
  });

  it("Esc yopadi va tashqi Esc tinglovchisiga o'tmaydi", async () => {
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    render(<Harness />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(outer).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }));
    document.removeEventListener('keydown', outer);
  });

  it('tashqarida bosilsa yopiladi; tanlangan variant aria-selected', async () => {
    render(
      <>
        <Select aria-label="S" options={OPTIONS} value="raw" onChange={() => undefined} />
        <p>tashqi</p>
      </>,
    );
    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: 'Xomashyo' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.click(screen.getByText('tashqi'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('disabled — ochilmaydi; invalid — aria-invalid', async () => {
    render(
      <Select
        aria-label="S"
        options={OPTIONS}
        value=""
        onChange={() => undefined}
        disabled
        invalid
      />,
    );
    const cb = screen.getByRole('combobox');
    expect(cb).toBeDisabled();
    expect(cb).toHaveAttribute('aria-invalid', 'true');
    await userEvent.click(cb);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
