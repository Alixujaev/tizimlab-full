import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from './Spinner';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyText?: ReactNode;
}

export function Table<T>({ columns, rows, rowKey, loading, emptyText }: TableProps<T>) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`px-4 py-2 text-left font-medium text-slate-600 ${c.className ?? ''}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td colSpan={columns.length}>
                <Spinner />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-slate-500">
                {emptyText ?? t('common.noData')}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-slate-50">
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-2 ${c.className ?? ''}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
