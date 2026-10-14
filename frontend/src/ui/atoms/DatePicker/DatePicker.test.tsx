import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { addMonths, monthGrid } from './calendar';
import { DatePicker } from './DatePicker';

beforeEach(async () => {
  await i18n.changeLanguage('uz');
});

function Harness({
  initial = '',
  onChange = () => undefined,
  min,
  max,
}: {
  initial?: string;
  onChange?: (v: string) => void;
  min?: string;
  max?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DatePicker
        aria-label="Sana"
        value={value}
        min={min}
        max={max}
        onChange={(v) => {
          onChange(v);
          setValue(v);
        }}
      />
      <span data-testid="value">{value}</span>
    </>
  );
}

describe('calendar utils', () => {
  it('oy setkasi dushanbadan boshlanadi, 6 hafta', () => {
    const weeks = monthGrid(2026, 9); // 2026-yil oktyabr, 1-oktyabr — payshanba
    expect(weeks).toHaveLength(6);
    expect(weeks[0]![0]).toEqual({ y: 2026, m: 8, d: 28 });
    expect(weeks[0]![3]).toEqual({ y: 2026, m: 9, d: 1 });
  });

  it("oy qo'shishda kun oxirgi kunga qisqaradi", () => {
    expect(addMonths({ y: 2026, m: 0, d: 31 }, 1)).toEqual({ y: 2026, m: 1, d: 28 });
  });
});

describe('DatePicker', () => {
  it('qiymat DD.MM.YYYY ko‘rinishida (D-110), API uchun ISO', () => {
    render(<Harness initial="2026-10-14" />);
    expect(screen.getByRole('textbox', { name: 'Sana' })).toHaveValue('14.10.2026');
  });

  it("yozib kiritish: ISO ga o'giriladi; noto'g'ri sana — matn qoladi, aria-invalid, qiymat bo'sh", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '05.03.2026');
    expect(onChange).toHaveBeenLastCalledWith('2026-03-05');
    await userEvent.clear(input);
    await userEvent.type(input, '31.02.2026{Enter}');
    expect(screen.getByTestId('value')).toBeEmptyDOMElement();
    expect(input).toHaveValue('31.02.2026');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    // ISO ko'rinishi yozib kiritilmaydi (D-110)
    await userEvent.clear(input);
    await userEvent.type(input, '2026-03-05');
    fireEvent.blur(input);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    // Tuzatilsa — xato yo'qoladi
    await userEvent.clear(input);
    await userEvent.type(input, '05032026');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(screen.getByTestId('value')).toHaveTextContent('2026-03-05');
  });

  it("onInputChange xom matnni beradi; tashqi qiymat o'zgarsa matn yangilanadi", async () => {
    const onInputChange = vi.fn();
    const { rerender } = render(
      <DatePicker
        aria-label="d"
        value=""
        onChange={() => undefined}
        onInputChange={onInputChange}
      />,
    );
    await userEvent.type(screen.getByRole('textbox'), '1');
    expect(onInputChange).toHaveBeenLastCalledWith('1');
    rerender(<DatePicker aria-label="d" value="2026-01-02" onChange={() => undefined} />);
    expect(screen.getByRole('textbox')).toHaveValue('02.01.2026');
  });

  it("bo'shatilsa — bo'sh qator", async () => {
    const onChange = vi.fn();
    render(<Harness initial="2026-01-01" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('kalendar dialogi: fokus tanlangan kunda, strelkalar bilan harakat, Enter tanlaydi', async () => {
    const onChange = vi.fn();
    render(<Harness initial="2026-10-14" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Kalendarni ochish' }));
    const dialog = screen.getByRole('dialog', { name: 'Sanani tanlang' });
    expect(dialog).toBeInTheDocument();
    const focused = document.activeElement as HTMLElement;
    expect(focused).toHaveTextContent('14');
    expect(focused.closest('[role="gridcell"]')).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowRight}{ArrowDown}');
    expect(document.activeElement).toHaveTextContent('22');
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('2026-10-22');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('PageDown keyingi oy, Esc yopadi va fokus kalendar tugmasiga qaytadi', async () => {
    render(<Harness initial="2026-01-31" />);
    const toggle = screen.getByRole('button', { name: 'Kalendarni ochish' });
    await userEvent.click(toggle);
    await userEvent.keyboard('{PageDown}');
    expect(document.activeElement).toHaveTextContent('28');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toggle).toHaveFocus();
  });

  it('min/max dan tashqari kun tanlanmaydi (aria-disabled)', async () => {
    const onChange = vi.fn();
    render(<Harness initial="2026-10-14" min="2026-10-10" max="2026-10-20" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Kalendarni ochish' }));
    const late = screen
      .getAllByRole('button')
      .find((b) => b.textContent === '25' && b.getAttribute('aria-disabled') === 'true');
    expect(late).toBeDefined();
    await userEvent.click(late!);
    expect(onChange).not.toHaveBeenCalled();
  });
});
