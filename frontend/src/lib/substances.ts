import type { SubstanceDto } from '../types/index.js';

/**
 * R-I18N-09: Modda nomini joriy tilga mos ravishda qaytaradi.
 * Tanlangan tilda mavjud bo'lmasa, `nameUz` ga fallback qiladi.
 */
export function getSubstanceName(
  substance: Pick<SubstanceDto, 'nameUz' | 'nameRu' | 'nameEn'>,
  lang: string,
): string {
  if (lang === 'ru' && substance.nameRu && substance.nameRu.trim()) {
    return substance.nameRu;
  }
  if (lang === 'en' && substance.nameEn && substance.nameEn.trim()) {
    return substance.nameEn;
  }
  return substance.nameUz;
}
