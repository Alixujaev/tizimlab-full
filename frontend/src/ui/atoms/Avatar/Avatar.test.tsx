import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar, initials } from './Avatar';

describe('Avatar', () => {
  it('bosh harflar va ism aria-label sifatida', () => {
    render(<Avatar name="Aziza Karimova" />);
    const el = screen.getByRole('img', { name: 'Aziza Karimova' });
    expect(el).toHaveTextContent('AK');
  });

  it('rasm bo‘lsa — img alt bilan', () => {
    render(<Avatar name="Ali" src="/a.png" size="lg" />);
    const img = screen.getByRole('img', { name: 'Ali' });
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveClass('size-12');
  });

  it('initials chekka holatlar va barqaror rang', () => {
    expect(initials('  ')).toBe('?');
    expect(initials('bobur')).toBe('B');
    const a = render(<Avatar name="Test" />).container.firstElementChild!.className;
    const b = render(<Avatar name="Test" />).container.firstElementChild!.className;
    expect(a).toBe(b);
  });
});
