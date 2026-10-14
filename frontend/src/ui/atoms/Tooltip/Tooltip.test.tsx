import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it("klaviatura fokusida darhol ko'rinadi va aria-describedby bog'lanadi", async () => {
    render(
      <Tooltip content="Faqat PDF">
        <button type="button">Yuklash</button>
      </Tooltip>,
    );
    await userEvent.tab();
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Faqat PDF');
    expect(screen.getByRole('button')).toHaveAccessibleDescription('Faqat PDF');
  });

  it('Esc va blur yashiradi', async () => {
    render(
      <Tooltip content="Izoh">
        <button type="button">B</button>
      </Tooltip>,
    );
    await userEvent.tab();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).toBeNull();
    await userEvent.tab({ shift: true });
    await userEvent.tab();
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await userEvent.tab();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it("sichqoncha — kechikish bilan ko'rinadi, chiqqanda yo'qoladi", () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Kech" delay={300}>
        <button type="button">H</button>
      </Tooltip>,
    );
    const anchor = screen.getByRole('button').parentElement!;
    act(() => {
      anchor.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    act(() => {
      anchor.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
    vi.useRealTimers();
  });
});
