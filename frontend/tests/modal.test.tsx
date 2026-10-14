import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from '@/ui';

function Harness({ onClose = () => undefined }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <Modal
        open={open}
        title="Sarlavha"
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        footer={<button type="button">save</button>}
      >
        <input aria-label="field" />
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it("role=dialog, aria-modal va aria-labelledby sarlavhaga bog'langan", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText('open'));
    const dialog = screen.getByRole('dialog', { name: 'Sarlavha' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it("ochilganda fokus birinchi elementga o'tadi va Tab ichkarida aylanadi", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText('open'));
    const close = screen.getByRole('button', { name: 'Yopish' });
    const field = screen.getByLabelText('field');
    const save = screen.getByText('save');
    expect(close).toHaveFocus();
    await userEvent.tab();
    expect(field).toHaveFocus();
    await userEvent.tab();
    expect(save).toHaveFocus();
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(save).toHaveFocus();
  });

  it('Esc yopadi va fokus ochgan tugmaga qaytadi', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByText('open');
    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('yopish tugmasi bilan yopiladi', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText('open'));
    await userEvent.click(screen.getByRole('button', { name: 'Yopish' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
