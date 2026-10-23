import type { AppLocale } from '../config';
import { en, type Dictionary } from './en';
import { es } from './es';

const DICTIONARIES: Record<AppLocale, Dictionary> = { en, es };

export function getDictionary(locale: AppLocale): Dictionary {
  return DICTIONARIES[locale];
}

export type { Dictionary };
