import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from './Switch';

function Harness({ onChange = () => undefined }: { onChange?: (v: boolean) => void }) {
  const [on, setOn] = useState(false);
  return (
    <Switch
      label="Telegram xabarlari"
      description="Yangi bildirishnomalar botga yuboriladi"
      checked={on}
      onChange={(v) => {
        onChange(v);
        setOn(v);
      }}
    />
  );
}

describe('Switch', () => {
  it('role=switch, label va tavsif bog‘langan', () => {
    render(<Harness />);
    const sw = screen.getByRole('switch', { name: 'Telegram xabarlari' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveAccessibleDescription('Yangi bildirishnomalar botga yuboriladi');
  });

  it('bosish va klaviatura (Space/Enter) bilan almashadi', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const sw = screen.getByRole('switch');
    await userEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard(' ');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it("aria-label bilan (ko'rinadigan yorliqsiz) va disabled", async () => {
    const onChange = vi.fn();
    render(<Switch aria-label="Faol" checked={false} onChange={onChange} disabled size="sm" />);
    const sw = screen.getByRole('switch', { name: 'Faol' });
    expect(sw).toHaveClass('w-9');
    await userEvent.click(sw);
    expect(onChange).not.toHaveBeenCalled();
  });
});
