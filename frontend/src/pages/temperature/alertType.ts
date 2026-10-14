import type { TFunction } from 'i18next';

/** Harorat ogohlantirishi turi → tarjima (jadval va yopish modalida bir xil). */
export function alertTypeLabel(t: TFunction, type: string): string {
  switch (type) {
    case 'temp_high':
      return t('temperature.tempHigh', 'Harorat yuqori');
    case 'temp_low':
      return t('temperature.tempLow', 'Harorat past');
    case 'humidity_high':
      return t('temperature.humidityHigh', 'Namlik yuqori');
    case 'humidity_low':
      return t('temperature.humidityLow', 'Namlik past');
    default:
      return type;
  }
}
