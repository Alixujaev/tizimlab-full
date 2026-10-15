import { cx } from '../../lib/cx';

// Geometriya docs/brand/ dagi asl logolardan olingan; ranglar faqat brend tokenlari orqali (yorug'/qorong'i rejim).

/** Uchta ustma-ust olti burchak (gorizontal logotip belgisi). */
export function LogoMark({ className }: { className?: string }) {
  const hex = (x: number, y: number) =>
    `${x + 43.3},${y} ${x + 86.6},${y + 25} ${x + 86.6},${y + 75} ${x + 43.3},${y + 100} ${x},${y + 75} ${x},${y + 25}`;
  return (
    <svg viewBox="0 0 180 158" aria-hidden="true" className={cx('shrink-0', className)}>
      <polygon points={hex(0, 0)} className="fill-brand" />
      <polygon points={hex(46.5, 28.8)} className="fill-brand-tint" fillOpacity={0.6} />
      <polygon points={hex(93, 57.6)} className="fill-brand-tint" fillOpacity={0.3} />
    </svg>
  );
}

/** Kvadrat ikon (ixcham sidebar, favicon bilan bir xil shakl). */
export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={cx('shrink-0', className)}>
      <polygon
        points="24.4,46.2 44.8,57.6 44.8,80.5 24.4,92 4.1,80.5 4.1,57.6"
        className="fill-brand"
        fillOpacity={0.3}
      />
      <polygon
        points="75.5,30.9 95.7,42.3 95.7,65.3 75.5,76.7 55.2,65.3 55.2,42.3"
        className="fill-brand"
        fillOpacity={0.55}
      />
      <polygon
        points="52.5,7.9 80.6,23.2 80.6,53.8 52.5,69.1 24.5,53.8 24.5,23.2"
        className="fill-brand"
      />
    </svg>
  );
}

export interface LogoProps {
  /** So'z belgisining birinchi qismi ("Tizim") — qalin. */
  primary: string;
  /** Ikkinchi qismi ("Lab") — ingichka, brend rangida. */
  secondary: string;
  size?: 'md' | 'lg';
  className?: string;
}

const sizes = {
  md: { mark: 'h-9', word: 'text-base leading-4' },
  lg: { mark: 'h-16', word: 'text-3xl leading-7' },
} as const;

/** To'liq logotip: belgi + ikki qatorli so'z belgisi. */
export function Logo({ primary, secondary, size = 'md', className }: LogoProps) {
  const s = sizes[size];
  return (
    <span className={cx('flex items-center gap-2.5 flex-nowrap shrink-0 select-none', className)}>
      <LogoMark className={cx('w-auto shrink-0', s.mark)} />
      <span className={cx('flex flex-col tracking-tight shrink-0', s.word)}>
        <span className="font-bold text-brand-word">{primary}</span>
        <span className="font-light text-brand-word-accent">{secondary}</span>
      </span>
    </span>
  );
}
