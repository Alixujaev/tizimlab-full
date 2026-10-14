import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FileButton } from './FileButton';

describe('FileButton', () => {
  it('tugma fayl tanlashni ochadi; tanlangan fayl onSelect ga, input qayta tanlash uchun tozalanadi', async () => {
    const onSelect = vi.fn();
    const { container } = render(
      <FileButton onSelect={onSelect} accept={['pdf', 'docx']}>
        Yuklash
      </FileButton>,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toHaveAttribute('accept', '.pdf,.docx');
    expect(input).toHaveAttribute('aria-hidden', 'true');
    const clickSpy = vi.spyOn(input, 'click');
    await userEvent.click(screen.getByRole('button', { name: 'Yuklash' }));
    expect(clickSpy).toHaveBeenCalled();
    const file = new File(['x'], 'hisobot.pdf', { type: 'application/pdf' });
    await userEvent.upload(input, file);
    expect(onSelect).toHaveBeenCalledWith(file);
    expect(input.value).toBe('');
  });

  it("loading — tugma o'chiq", () => {
    render(
      <FileButton onSelect={() => undefined} loading>
        Yuklash
      </FileButton>,
    );
    expect(screen.getByRole('button', { name: 'Yuklash' })).toBeDisabled();
  });
});
