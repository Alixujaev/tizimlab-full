import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Spinner } from '@/components/ui/Spinner';
import { useExpenseCalendarQuery } from '@/hooks/useReagents';
import { formatDate } from '@/lib/date';
import type { ExpenseCalendarDayDto } from '@/types';

export function ReagentJournalPage() {
  const { t } = useTranslation();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<ExpenseCalendarDayDto | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // First day of month and last day of month
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const fromStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const toStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

  const { data: calendarData = [], isLoading } = useExpenseCalendarQuery(fromStr, toStr);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  };

  const today = () => {
    setCurrentDate(new Date());
    setSelectedDay(null);
  };

  // Month name formatting
  const monthNames = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
  ];

  // Map calendar data by date string YYYY-MM-DD
  const daysMap = new Map<string, ExpenseCalendarDayDto>();
  for (const item of calendarData) {
    daysMap.set(item.date, item);
  }

  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6;

  const totalDaysInMonth = lastDay.getDate();
  const calendarCells: Array<{ dayNum?: number; dateStr?: string; data?: ExpenseCalendarDayDto }> = [];

  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push({});
  }

  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({
      dayNum: d,
      dateStr: dStr,
      data: daysMap.get(dStr),
    });
  }

  return (
    <div className="space-y-6">
      {/* Sarlavha va Navigatsiya */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link to="/reagents" className="hover:text-indigo-600 hover:underline">
              {t('reagents.title')}
            </Link>
            <span>/</span>
            <span className="text-slate-700">{t('reagents.expenseLog')}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {t('reagents.expenseLog')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('reagents.journalSubtitle', "Reaktivlarning oylik sarf-xarajati kalendar ko'rinishida")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/expenses"
            className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {t('reagents.listView', "Ro'yxat ko'rinishi")}
          </Link>
        </div>
      </div>

      {/* Oylar nazorati */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900">
            {monthNames[month]} {year}
          </h2>
          <button
            onClick={today}
            className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
          >
            {t('calendar.today', 'Bugun')}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={prevMonth}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('calendar.prev', '← Oldingi')}
          </button>
          <button
            onClick={nextMonth}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('calendar.next', 'Keyingi →')}
          </button>
        </div>
      </div>

      {/* Kalendar jadvali */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-indigo-600" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Hafta kunlari */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-600 py-2">
            <div>{t('days.mon', 'Dush')}</div>
            <div>{t('days.tue', 'Sesh')}</div>
            <div>{t('days.wed', 'Chor')}</div>
            <div>{t('days.thu', 'Pay')}</div>
            <div>{t('days.fri', 'Jum')}</div>
            <div>{t('days.sat', 'Shan')}</div>
            <div>{t('days.sun', 'Yak')}</div>
          </div>

          {/* Kalendar kataklari */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100">
            {calendarCells.map((cell, idx) => {
              if (!cell.dayNum) {
                return <div key={`empty-${idx}`} className="h-28 bg-slate-50/50 p-2" />;
              }

              const hasExpense = cell.data && cell.data.itemsCount > 0;
              const isSelected = selectedDay?.date === cell.dateStr;

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => cell.data && setSelectedDay(cell.data)}
                  className={`h-28 p-2 flex flex-col justify-between transition-colors ${
                    hasExpense
                      ? 'cursor-pointer hover:bg-indigo-50/40'
                      : 'hover:bg-slate-50/60'
                  } ${isSelected ? 'bg-indigo-50 ring-2 ring-indigo-500 ring-inset' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      {cell.dayNum}
                    </span>
                    {hasExpense && (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-semibold text-amber-800">
                        {cell.data?.itemsCount} {t('reagents.expenseUnit', 'ta chiqim')}
                      </span>
                    )}
                  </div>

                  <div className="overflow-hidden space-y-1">
                    {hasExpense &&
                      cell.data?.reagents.slice(0, 2).map((r, rIdx) => (
                        <div
                          key={rIdx}
                          className="truncate rounded bg-amber-50 px-1 py-0.5 text-[10px] text-amber-900 font-medium"
                        >
                          {r.name} ({r.quantity} {r.unit})
                        </div>
                      ))}
                    {hasExpense && (cell.data?.reagents.length ?? 0) > 2 && (
                      <div className="text-[10px] text-slate-500 font-medium pl-0.5">
                        +{(cell.data?.reagents.length ?? 0) - 2} {t('common.more', 'boshqa')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tanlangan kun tafsiloti */}
      {selectedDay && (
        <div className="rounded-xl border border-indigo-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              {formatDate(selectedDay.date)} {t('reagents.expensesOnDate', 'sanasidagi xarajatlar')}
            </h3>
            <button
              onClick={() => setSelectedDay(null)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              {t('common.close', 'Yopish')}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {selectedDay.reagents.map((r, rIdx) => (
              <div
                key={rIdx}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex justify-between items-center"
              >
                <div>
                  <div className="font-semibold text-slate-800 text-sm">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.id.slice(0, 8)}</div>
                </div>
                <div className="font-bold text-amber-700 text-sm">
                  {r.quantity} {r.unit}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 text-right">
            <Link
              to={`/expenses?from=${selectedDay.date}&to=${selectedDay.date}`}
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              {t('reagents.viewInFullList', "To'liq ro'yxatda ko'rish →")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
