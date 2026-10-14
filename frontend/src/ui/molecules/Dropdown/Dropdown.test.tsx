import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Button } from '../../atoms/Button';
import { Dropdown } from './Dropdown';

function Harness() {
  return (
    <>
      <Dropdown label="Bildirishnomalar" trigger={(p) => <Button {...p}>ochish</Button>}>
        {(close) => (
          <div className="p-2">
            <a href="/n/1">Birinchi</a>
            <Button onClick={close}>yopish</Button>
          </div>
        )}
      </Dropdown>
      <p>tashqi</p>
    </>
  );
}

describe('Dropdown', () => {
  it('trigger aria-expanded/controls, panel nomlangan, fokus ichkarida', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'ochish' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    const panel = screen.getByRole('dialog', { name: 'Bildirishnomalar' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', panel.id);
    expect(screen.getByRole('link', { name: 'Birinchi' })).toHaveFocus();
  });

  it('Esc yopadi va fokus trigger ga qaytadi', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'ochish' });
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('tashqarida bosish va close() yopadi', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'ochish' }));
    await userEvent.click(screen.getByText('tashqi'));
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'ochish' }));
    await userEvent.click(screen.getByRole('button', { name: 'yopish' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
