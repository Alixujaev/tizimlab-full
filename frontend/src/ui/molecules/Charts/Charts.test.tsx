import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import {
  BarChart,
  ChartFrame,
  DonutChart,
  Heatmap,
  LineChart,
  Sparkline,
  StackedBar,
} from './index';
import { niceScale, thinIndexes } from './chartUtils';

beforeEach(async () => {
  await i18n.changeLanguage('uz');
});

describe('chartUtils', () => {
  it('niceScale: 1-2-5 qadam, 0 da xavfsiz', () => {
    expect(niceScale(7)).toEqual({ max: 8, step: 2 });
    expect(niceScale(0)).toEqual({ max: 4, step: 1 });
    expect(niceScale(100)).toEqual({ max: 100, step: 50 });
  });
  it('thinIndexes: chetlar doim bor', () => {
    const s = thinIndexes(31, 6);
    expect(s.has(0) && s.has(30)).toBe(true);
    expect(s.size).toBe(6);
  });
});

describe('LineChart', () => {
  const props = {
    labels: ['2025-03-01', '2025-03-02', '2025-03-03'],
    series: [
      { key: 'a', label: 'Kiritilgan', values: [1, 4, 2] },
      { key: 'b', label: 'Tasdiqlangan', values: [0, 2, null] },
    ],
    ariaLabel: 'Trend grafigi',
  };
  it('role=img + aria-label, ≥2 seriyada legenda', () => {
    render(<LineChart {...props} />);
    expect(screen.getByRole('img', { name: 'Trend grafigi' })).toBeInTheDocument();
    expect(screen.getByText('Kiritilgan')).toBeInTheDocument();
    expect(screen.getByText('Tasdiqlangan')).toBeInTheDocument();
  });
  it('klaviatura: → bilan nuqta tanlanadi va tooltip qiymatlarni ko‘rsatadi, Esc yopadi', () => {
    render(<LineChart {...props} />);
    const group = screen.getByRole('group', { name: 'Trend grafigi' });
    group.focus();
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    const tip = screen.getByRole('status');
    expect(tip).toHaveTextContent('2025-03-02');
    expect(tip).toHaveTextContent('4');
    fireEvent.keyDown(group, { key: 'End' });
    expect(screen.getByRole('status')).toHaveTextContent('—');
    fireEvent.keyDown(group, { key: 'Escape' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('Boshqa grafiklar', () => {
  it('BarChart: har qator matnli yorliq + qiymat, bosish ishlaydi', async () => {
    const clicked: string[] = [];
    render(
      <BarChart
        ariaLabel="Yuklama"
        data={[
          { key: 'a', label: 'Ali', value: 3, note: '60%' },
          { key: 'b', label: 'Vali', value: 0 },
        ]}
        onBarClick={(d) => clicked.push(d.key)}
      />,
    );
    const list = screen.getByRole('list', { name: 'Yuklama' });
    expect(within(list).getByRole('listitem', { name: 'Ali: 3 (60%)' })).toBeInTheDocument();
    await userEvent.setup().click(within(list).getAllByRole('button')[0]!);
    expect(clicked).toEqual(['a']);
  });

  it('DonutChart: 6 dan ortiq toifa "Boshqa" ga yig‘iladi, foizlar', () => {
    const data = Array.from({ length: 8 }, (_, i) => ({ key: `k${i}`, label: `S${i}`, value: 1 }));
    render(<DonutChart data={data} ariaLabel="Sabablar" centerLabel="Jami" otherLabel="Boshqa" />);
    expect(screen.getByRole('img', { name: 'Sabablar' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByRole('listitem', { name: 'Boshqa: 3 (37,5%)' })).toBeInTheDocument();
  });

  it('StackedBar va Sparkline: aria-label', () => {
    render(
      <>
        <StackedBar
          ariaLabel="Natijalar"
          data={[
            { key: 'a', label: 'Tasdiq', value: 1 },
            { key: 'b', label: 'Rad', value: 3 },
          ]}
        />
        <Sparkline values={[1, 2, 3]} ariaLabel="Trend" />
      </>,
    );
    expect(screen.getByRole('img', { name: 'Natijalar' })).toBeInTheDocument();
    expect(screen.getByText('3 · 75%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Trend' })).toBeInTheDocument();
  });

  it('Heatmap: har kun uchun katak (title bilan)', () => {
    const days = Array.from({ length: 10 }, (_, i) => ({
      date: `2025-03-${String(i + 1).padStart(2, '0')}`,
      value: i,
    }));
    const { container } = render(<Heatmap days={days} ariaLabel="Faollik" />);
    expect(screen.getByRole('img', { name: 'Faollik' })).toBeInTheDocument();
    expect(container.querySelectorAll('rect')).toHaveLength(10);
  });
});

describe('ChartFrame', () => {
  const table = { headers: ['Sana', 'Qiymat'], rows: [['01.03.2025', '2']] };
  it('"Jadval" — matnli muqobil, qayta bosilsa grafik', async () => {
    render(
      <ChartFrame title="Trend" table={table}>
        <svg role="img" aria-label="grafik" />
      </ChartFrame>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Jadval' }));
    expect(screen.getByRole('table', { name: 'Trend' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: '01.03.2025' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Grafik' }));
    expect(screen.getByRole('img', { name: 'grafik' })).toBeInTheDocument();
  });
  it('bo‘sh, yuklanish va xato holatlari', () => {
    const { rerender } = render(
      <ChartFrame title="T" table={table} empty>
        <span>x</span>
      </ChartFrame>,
    );
    expect(screen.getByText("Davr uchun ma'lumot yo'q")).toBeInTheDocument();
    rerender(
      <ChartFrame title="T" table={table} loading>
        <span>x</span>
      </ChartFrame>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    rerender(
      <ChartFrame title="T" table={table} error>
        <span>x</span>
      </ChartFrame>,
    );
    expect(screen.queryByText('x')).not.toBeInTheDocument();
  });
});
