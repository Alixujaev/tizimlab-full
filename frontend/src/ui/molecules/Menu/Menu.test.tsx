import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../../atoms/Button';
import { Menu, type MenuItem } from './Menu';

function setup(extra: Partial<Record<string, () => void>> = {}) {
  const items: MenuItem[] = [
    { id: 'edit', label: 'Tahrirlash', icon: 'edit', onSelect: extra.edit ?? (() => undefined) },
    { id: 'arch', label: 'Arxivlash', disabled: true, onSelect: () => undefined },
    { id: 'del', label: "O'chirish", tone: 'danger', onSelect: extra.del ?? (() => undefined) },
  ];
  render(<Menu items={items} trigger={(p) => <Button {...p}>Amallar</Button>} />);
  return screen.getByRole('button', { name: 'Amallar' });
}

describe('Menu', () => {
  it('menu button aria: haspopup, expanded; menyu trigger bilan nomlangan', async () => {
    const trigger = setup();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await userEvent.click(trigger);
    expect(screen.getByRole('menu', { name: 'Amallar' })).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Tahrirlash' })).toHaveFocus();
  });

  it("klaviatura: ↓ ochadi, o'chiq bandni o'tkazadi, aylanadi, Enter tanlaydi va fokus qaytadi", async () => {
    const del = vi.fn();
    const trigger = setup({ del });
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Tahrirlash' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: "O'chirish" })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Tahrirlash' })).toHaveFocus();
    await userEvent.keyboard('{End}{Enter}');
    expect(del).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('↑ oxirgi bandga, harf terish, Esc yopadi', async () => {
    const trigger = setup();
    trigger.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: "O'chirish" })).toHaveFocus();
    await userEvent.keyboard('t');
    expect(screen.getByRole('menuitem', { name: 'Tahrirlash' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('tanlov bandlari menuitemradio + aria-checked', async () => {
    render(
      <Menu
        items={[
          { id: 'uz', label: "O'zbekcha", checked: true, onSelect: () => undefined },
          { id: 'ru', label: 'Русский', checked: false, onSelect: () => undefined },
        ]}
        trigger={(p) => <Button {...p}>Til</Button>}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Til' }));
    expect(screen.getByRole('menuitemradio', { name: "O'zbekcha" })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
