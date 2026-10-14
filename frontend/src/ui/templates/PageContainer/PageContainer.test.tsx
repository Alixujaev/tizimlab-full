import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageContainer } from './PageContainer';

describe('PageContainer', () => {
  it("token kengligi va qo'shimcha klass", () => {
    render(
      <PageContainer className="extra">
        <p>mazmun</p>
      </PageContainer>,
    );
    const el = screen.getByText('mazmun').parentElement!;
    expect(el).toHaveClass('max-w-page', 'extra');
  });
});
