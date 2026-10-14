import { type KeyboardEvent, type ReactNode, useId, useRef } from 'react';
import { cx } from '../../lib/cx';

export interface TabItem<K extends string = string> {
  id: K;
  label: ReactNode;
  /** Son yoki belgi (masalan, kutilayotganlar soni). */
  badge?: ReactNode;
  disabled?: boolean;
  /** Berilsa — faol tabning paneli Tabs ichida chiziladi. */
  content?: ReactNode;
}

export interface TabsProps<K extends string = string> {
  items: ReadonlyArray<TabItem<K>>;
  value: K;
  onChange: (id: K) => void;
  /** Tablist nomi (ekran o'quvchilar uchun). */
  label: string;
  className?: string;
}

/** WAI-ARIA tabs (avtomatik faollashtirish): ←→ Home End bilan almashadi, faqat faol tab Tab tartibida. */
export function Tabs<K extends string = string>({
  items,
  value,
  onChange,
  label,
  className,
}: TabsProps<K>) {
  const baseId = useId();
  const tabId = (id: K) => `${baseId}-tab-${id}`;
  const panelId = (id: K) => `${baseId}-panel-${id}`;
  const refs = useRef(new Map<K, HTMLButtonElement | null>());
  const enabled = items.filter((i) => !i.disabled);
  const active = items.find((i) => i.id === value);
  const hasPanels = items.some((i) => i.content !== undefined);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const pos = enabled.findIndex((i) => i.id === value);
    const target = {
      ArrowRight: enabled[(pos + 1) % enabled.length],
      ArrowLeft: enabled[(pos - 1 + enabled.length) % enabled.length],
      Home: enabled[0],
      End: enabled.at(-1),
    }[e.key];
    if (!target) return;
    e.preventDefault();
    onChange(target.id);
    refs.current.get(target.id)?.focus();
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-line"
      >
        {items.map((item) => {
          const selected = item.id === value;
          return (
            <button
              key={item.id}
              ref={(el) => {
                refs.current.set(item.id, el);
              }}
              id={tabId(item.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={hasPanels ? panelId(item.id) : undefined}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => onChange(item.id)}
              className={cx(
                '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors motion-fast focus-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
                selected
                  ? 'border-primary text-primary-subtle-fg'
                  : 'border-transparent text-fg-muted hover:border-line-strong hover:text-fg',
              )}
            >
              {item.label}
              {item.badge !== undefined && (
                <span
                  className={cx(
                    'rounded-full px-1.5 text-xs tabular-nums',
                    selected ? 'bg-primary-subtle' : 'bg-surface-sunken',
                  )}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {hasPanels && active && (
        <div
          role="tabpanel"
          id={panelId(active.id)}
          aria-labelledby={tabId(active.id)}
          tabIndex={0}
          className="animate-fade-in pt-4 outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {active.content}
        </div>
      )}
    </div>
  );
}
