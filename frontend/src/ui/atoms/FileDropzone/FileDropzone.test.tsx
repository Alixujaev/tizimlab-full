import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { FileDropzone, formatBytes } from './FileDropzone';

beforeEach(async () => {
  await i18n.changeLanguage('uz');
});

function Harness({ onReject }: { onReject?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <FileDropzone value={file} onChange={setFile} maxBytes={1024 * 1024} onReject={onReject} />
  );
}

const pdf = (size = 10) => new File(['x'.repeat(size)], 'pasport.pdf', { type: 'application/pdf' });

describe('FileDropzone', () => {
  it("klaviatura bilan fokuslanadi; tanlangan fayl nomi va hajmi ko'rinadi, olib tashlanadi", async () => {
    render(<Harness />);
    await userEvent.tab();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toHaveFocus();
    expect(input).toHaveAccessibleDescription(/PDF/);
    await userEvent.upload(input, pdf());
    expect(screen.getByText('pasport.pdf')).toBeInTheDocument();
    expect(screen.getByText('10 B')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Faylni olib tashlash' }));
    expect(screen.queryByText('pasport.pdf')).toBeNull();
  });

  it('ruxsat etilmagan tur va katta hajm rad etiladi (role=alert)', async () => {
    const onReject = vi.fn();
    render(<Harness onReject={onReject} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(['x'], 'virus.exe'), { applyAccept: false });
    expect(screen.getByRole('alert')).toHaveTextContent('Bu turdagi fayl ruxsat etilmagan');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await userEvent.upload(input, pdf(2 * 1024 * 1024));
    expect(screen.getByRole('alert')).toHaveTextContent('1 MB');
    expect(onReject).toHaveBeenCalledTimes(2);
  });

  it('sudrab tashlash (drop) bilan fayl qabul qilinadi', () => {
    render(<Harness />);
    const zone = screen.getByText(/Faylni shu yerga tashlang/).closest('label')!;
    fireEvent.dragOver(zone);
    expect(zone).toHaveClass('bg-primary-subtle');
    fireEvent.drop(zone, { dataTransfer: { files: [pdf()] } });
    expect(screen.getByText('pasport.pdf')).toBeInTheDocument();
  });

  it('formatBytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
