import { Link } from 'react-router';

interface StatCardProps {
  label: string;
  value: number;
  to?: string;
  /** Diqqat talab qiladigan ko'rsatkich (masalan, tasdiq kutayotganlar). */
  highlight?: boolean;
}

export function StatCard({ label, value, to, highlight = false }: StatCardProps) {
  const body = (
    <>
      <span className="block text-sm text-slate-600">{label}</span>
      <span
        className={`mt-1 block text-3xl font-semibold ${highlight && value > 0 ? 'text-amber-600' : 'text-slate-900'}`}
      >
        {value}
      </span>
    </>
  );
  const cls = 'block rounded-lg border border-slate-200 bg-white p-4 shadow-sm';
  return to ? (
    <Link to={to} className={`${cls} hover:border-blue-300`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
