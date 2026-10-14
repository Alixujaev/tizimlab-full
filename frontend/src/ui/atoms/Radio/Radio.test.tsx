import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { RadioGroup } from './Radio';

function Harness() {
  const [value, setValue] = useState<'in' | 'out' | ''>('');
  return (
    <RadioGroup
      label="Tranzaksiya turi"
      name="kind"
      value={value}
      onChange={setValue}
      options={[
        { value: 'in', label: 'Kirim' },
        { value: 'out', label: 'Chiqim' },
      ]}
    />
  );
}

describe('RadioGroup', () => {
  it('radiogroup nomlangan, sichqoncha bilan tanlanadi', async () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Tranzaksiya turi' })).toBeInTheDocument();
    await userEvent.click(screen.getByText('Chiqim'));
    expect(screen.getByRole('radio', { name: 'Chiqim' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Kirim' })).not.toBeChecked();
  });

  it('klaviatura: strelkalar bilan guruh ichida almashadi', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('radio', { name: 'Kirim' }));
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Chiqim' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Chiqim' })).toHaveFocus();
  });
});
