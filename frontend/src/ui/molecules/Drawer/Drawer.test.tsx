import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { Button } from '../../atoms/Button';
import { Drawer } from './Drawer';

beforeEach(async () => {
  await i18n.changeLanguage('uz');
});

function Harness({
  side = 'right',
  hideTitle = false,
}: {
  side?: 'left' | 'right';
  hideTitle?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>menyu</Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Navigatsiya"
        side={side}
        hideTitle={hideTitle}
      >
        <a href="/samples">Namunalar</a>
      </Drawer>
    </>
  );
}

describe('Drawer', () => {
  it('dialog nomlangan, tomon animatsiyasi', async () => {
    render(<Harness side="left" />);
    await userEvent.click(screen.getByText('menyu'));
    const dlg = screen.getByRole('dialog', { name: 'Navigatsiya' });
    expect(dlg).toHaveClass('left-0', 'animate-slide-in-left');
  });

  it('focus trap, Esc yopadi va fokus qaytadi', async () => {
    render(<Harness />);
    const opener = screen.getByText('menyu');
    await userEvent.click(opener);
    expect(screen.getByRole('button', { name: 'Yopish' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Namunalar' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Yopish' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("hideTitle — sarlavha faqat ekran o'quvchi uchun", async () => {
    render(<Harness hideTitle />);
    await userEvent.click(screen.getByText('menyu'));
    expect(screen.getByText('Navigatsiya')).toHaveClass('sr-only');
  });
});
