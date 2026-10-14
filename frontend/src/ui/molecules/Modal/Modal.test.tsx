import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { Button } from '../../atoms/Button';
import { Input } from '../../atoms/Input';
import { Select } from '../../atoms/Select';
import { Modal } from './Modal';

beforeEach(async () => {
  await i18n.changeLanguage('uz');
});

function Harness({ onClose = () => undefined, withSelect = false }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState('');
  return (
    <>
      <Button onClick={() => setOpen(true)}>open</Button>
      <Modal
        open={open}
        title="Sarlavha"
        description="Tavsif matni"
        size="lg"
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        footer={<Button>save</Button>}
      >
        <Input aria-label="field" />
        {withSelect && (
          <Select
            aria-label="tur"
            options={[{ value: 'a', label: 'A' }]}
            value={v}
            onChange={setV}
          />
        )}
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('role=dialog, aria-modal, sarlavha va tavsif bog‘langan, o‘lcham', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText('open'));
    const dialog = screen.getByRole('dialog', { name: 'Sarlavha' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Tavsif matni');
    expect(dialog).toHaveClass('max-w-modal-lg');
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('fokus birinchi elementda, Tab ichkarida aylanadi', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText('open'));
    const close = screen.getByRole('button', { name: 'Yopish' });
    expect(close).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByLabelText('field')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByText('save')).toHaveFocus();
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByText('save')).toHaveFocus();
  });

  it('Esc yopadi, fokus ochgan tugmaga qaytadi, scroll tiklanadi', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByText('open');
    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it("ichidagi Select ochiq bo'lsa Esc faqat ro'yxatni yopadi", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} withSelect />);
    await userEvent.click(screen.getByText('open'));
    await userEvent.click(screen.getByRole('combobox', { name: 'tur' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
