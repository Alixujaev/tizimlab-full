import { useTranslation } from 'react-i18next';
import { type ThemePreference, useThemeStore } from '@/store/themeStore';
import { type IconName, IconButton, Menu } from '@/ui';

const OPTIONS: ReadonlyArray<{ id: ThemePreference; icon: IconName }> = [
  { id: 'light', icon: 'sun' },
  { id: 'dark', icon: 'moon' },
  { id: 'system', icon: 'monitor' },
];

/** Mavzu tanlovi (D-154): yorug' / qorong'i / tizim sozlamasi. */
export function ThemeToggle() {
  const { t } = useTranslation();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const current = OPTIONS.find((o) => o.id === preference) ?? OPTIONS[2]!;
  return (
    <Menu
      items={OPTIONS.map((o) => ({
        id: o.id,
        label: t(`theme.${o.id}`),
        icon: o.icon,
        checked: preference === o.id,
        onSelect: () => setPreference(o.id),
      }))}
      trigger={(props) => <IconButton {...props} icon={current.icon} label={t('topbar.theme')} />}
    />
  );
}
