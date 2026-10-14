import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useExpenseCalendarQuery } from '@/hooks/useReagents';
import { formatDate } from '@/lib/date';
import type { ExpenseCalendarDayDto } from '@/types';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  cx,
  IconButton,
  PageHeader,
  Pressable,
  Skeleton,
} from '@/ui';

const pad = (n: number) => String(n).padStart(2, '0');

export function ReagentJournalPage() {
  const { t, i18n } = useTranslation();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<ExpenseCalendarDayDto | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const fromStr = `${year}-${pad(month + 1)}-01`;
  const toStr = `${year}-${pad(month + 1)}-${pad(lastDay)}`;
  const { data: calendarData = [], isLoading } = useExpenseCalendarQuery(fromStr, toStr);

  const goTo = (date: Date) => {
    setCurrentDate(date);
    setSelectedDay(null);
  };

  // Oy va hafta kunlari nomlari joriy tilda (Intl)
  const monthLabel = new Intl.DateTimeFormat(i18n.language, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month, 1));
  const weekdayFmt = new Intl.DateTimeFormat(i18n.language, { weekday: 'short' });
  const weekdays = Array.from({ length: 7 }, (_, i) => weekdayFmt.format(new Date(2024, 0, 1 + i)));

  const daysMap = new Map(calendarData.map((d) => [d.date, d]));
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: Array<{ dayNum?: number; dateStr?: string; data?: ExpenseCalendarDayDto }> = [
    ...Array.from({ length: leading }, () => ({})),
    ...Array.from({ length: lastDay }, (_, i) => {
      const dateStr = `${year}-${pad(month + 1)}-${pad(i + 1)}`;
      return { dayNum: i + 1, dateStr, data: daysMap.get(dateStr) };
    }),
  ];

  return (
    <>
      <PageHeader
        back={{ to: '/reagents', label: t('reagents.title') }}
        title={t('reagents.expenseLog')}
        description={t(
          'reagents.journalSubtitle',
          "Reaktivlarning oylik sarf-xarajati kalendar ko'rinishida",
        )}
        actions={
          <ButtonLink to="/expenses" leftIcon="file-text">
            {t('reagents.listView', "Ro'yxat ko'rinishi")}
          </ButtonLink>
        }
      />

      <Card flush>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 aria-live="polite" className="text-lg font-semibold capitalize text-fg">
              {monthLabel}
            </h2>
            <Button variant="secondary" size="sm" onClick={() => goTo(new Date())}>
              {t('ui.date.today')}
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <IconButton
              icon="chevron-left"
              label={t('ui.date.prevMonth')}
              variant="secondary"
              size="sm"
              onClick={() => goTo(new Date(year, month - 1, 1))}
            />
            <IconButton
              icon="chevron-right"
              label={t('ui.date.nextMonth')}
              variant="secondary"
              size="sm"
              onClick={() => goTo(new Date(year, month + 1, 1))}
            />
          </div>
        </div>

        {isLoading ? (
          <div role="status" className="p-4">
            <span className="sr-only">{t('common.loading')}</span>
            <Skeleton variant="rect" className="h-96 w-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-2xl">
              <div className="grid grid-cols-7 border-b border-line bg-surface-muted py-2 text-center text-xs font-semibold capitalize text-fg-muted">
                {weekdays.map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((cell, idx) => {
                  if (!cell.dayNum) {
                    return (
                      <div
                        key={`empty-${idx}`}
                        className="h-28 border-b border-r border-line bg-surface-muted"
                      />
                    );
                  }
                  const hasExpense = !!cell.data && cell.data.itemsCount > 0;
                  const isSelected = selectedDay?.date === cell.dateStr;
                  const body = (
                    <>
                      <span className="flex w-full items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-fg">{cell.dayNum}</span>
                        {hasExpense && (
                          <Badge
                            tone="warning"
                            size="sm"
                          >{`${cell.data!.itemsCount} ${t('reagents.expenseUnit', 'ta chiqim')}`}</Badge>
                        )}
                      </span>
                      {hasExpense && (
                        <span className="flex w-full flex-col gap-1 overflow-hidden">
                          {cell.data!.reagents.slice(0, 2).map((r, i) => (
                            <span
                              key={i}
                              className="truncate rounded bg-warning-subtle px-1.5 py-0.5 text-xs text-warning-fg"
                            >
                              {r.name} ({r.quantity} {r.unit})
                            </span>
                          ))}
                          {cell.data!.reagents.length > 2 && (
                            <span className="text-xs text-fg-muted">
                              +{cell.data!.reagents.length - 2} {t('common.more', 'boshqa')}
                            </span>
                          )}
                        </span>
                      )}
                    </>
                  );
                  return hasExpense ? (
                    <Pressable
                      key={cell.dateStr}
                      variant="row"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedDay(cell.data!)}
                      className={cx(
                        'h-28 flex-col justify-between gap-1 border-b border-r border-line px-2 py-2',
                        isSelected && 'bg-primary-subtle',
                      )}
                    >
                      {body}
                    </Pressable>
                  ) : (
                    <div
                      key={cell.dateStr}
                      className="flex h-28 flex-col border-b border-r border-line p-2"
                    >
                      {body}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Card>

      {selectedDay && (
        <Card
          title={`${formatDate(selectedDay.date)} ${t('reagents.expensesOnDate', 'sanasidagi xarajatlar')}`}
          actions={
            <IconButton
              icon="x"
              label={t('common.close', 'Yopish')}
              size="sm"
              onClick={() => setSelectedDay(null)}
            />
          }
          footer={
            <div className="flex justify-end">
              <ButtonLink
                to={`/expenses?from=${selectedDay.date}&to=${selectedDay.date}`}
                variant="ghost"
                size="sm"
                rightIcon="chevron-right"
              >
                {t('reagents.viewInFullList', "To'liq ro'yxatda ko'rish")}
              </ButtonLink>
            </div>
          }
        >
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {selectedDay.reagents.map((r, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-muted px-3 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-fg">{r.name}</span>
                  <span className="block font-mono text-xs text-fg-subtle">{r.id.slice(0, 8)}</span>
                </span>
                <span className="text-sm font-semibold tabular-nums text-warning-fg">
                  {r.quantity} {r.unit}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
