import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/** Joriy til bo'yicha son formati (default qiymat formatlovchisi). */
export function useNumberFormat(): (v: number) => string {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const nf = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });
    return (v: number) => nf.format(v);
  }, [i18n.language]);
}
