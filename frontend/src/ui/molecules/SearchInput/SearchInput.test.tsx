import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { SearchInput } from './SearchInput';

beforeEach(async () => {
  await i18n.changeLanguage('uz');
});
afterEach(() => {
  vi.useRealTimers();
});

function Harness({ onChange }: { onChange: (v: string) => void }) {
  const [v, setV] = useState('');
  return (
    <SearchInput
      value={v}
      debounceMs={300}
      onChange={(next) => {
        onChange(next);
        setV(next);
      }}
    />
  );
}

describe('SearchInput', () => {
  it('searchbox nomlangan; debounce bilan bitta chaqiruv', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const box = screen.getByRole('searchbox', { name: 'Qidiruv' });
    fireEvent.change(box, { target: { value: 'p' } });
    fireEvent.change(box, { target: { value: 'pa' } });
    fireEvent.change(box, { target: { value: 'par' } });
    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('par');
  });

  it('tozalash tugmasi va Esc darhol tozalaydi', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const box = screen.getByRole('searchbox');
    await userEvent.type(box, 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Tozalash' }));
    expect(box).toHaveValue('');
    expect(onChange).toHaveBeenLastCalledWith('');
    await userEvent.type(box, 'x');
    await userEvent.keyboard('{Escape}');
    expect(box).toHaveValue('');
  });
});
