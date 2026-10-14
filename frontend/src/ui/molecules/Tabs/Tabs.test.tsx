import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Tabs } from './Tabs';

function Harness({ panels = true }) {
  const [tab, setTab] = useState<'a' | 'b' | 'c'>('a');
  return (
    <Tabs
      label="Bo'limlar"
      value={tab}
      onChange={setTab}
      items={[
        { id: 'a', label: 'Umumiy', content: panels ? 'Umumiy mazmun' : undefined },
        { id: 'b', label: 'Protokol', badge: 2, content: panels ? 'Protokol mazmun' : undefined },
        { id: 'c', label: 'Tarix', content: panels ? 'Tarix mazmun' : undefined },
      ]}
    />
  );
}

describe('Tabs', () => {
  it('tablist nomlangan, faol tab aria-selected va panel bog‘langan', () => {
    render(<Harness />);
    expect(screen.getByRole('tablist', { name: "Bo'limlar" })).toBeInTheDocument();
    const tab = screen.getByRole('tab', { name: 'Umumiy' });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Umumiy' })).toHaveTextContent('Umumiy mazmun');
    expect(screen.getByRole('tab', { name: /Protokol/ })).toHaveAttribute('tabindex', '-1');
  });

  it('klaviatura: → ← Home End almashadi va fokuslanadi', async () => {
    render(<Harness />);
    await userEvent.tab();
    expect(screen.getByRole('tab', { name: 'Umumiy' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Protokol/ })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Protokol mazmun');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Tarix' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Umumiy' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Tarix' })).toHaveFocus();
  });

  it("panelsiz rejim (filtr sifatida) — tabpanel yo'q", async () => {
    render(<Harness panels={false} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Tarix' }));
    expect(screen.getByRole('tab', { name: 'Tarix' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tabpanel')).toBeNull();
  });
});
