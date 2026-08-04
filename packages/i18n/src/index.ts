/**
 * @noorixfin/i18n — Shared i18n configuration and locale catalogs
 * Blueprint §13: i18next + react-i18next + Expo Localization
 */

import enCommon from '../locales/en/common.json';
import bnCommon from '../locales/bn/common.json';
import enErrors from '../locales/en/errors.json';
import bnErrors from '../locales/bn/errors.json';

export const defaultNS = 'common';
export const fallbackLng = 'en';
export const supportedLngs = ['en', 'bn'] as const;
export type SupportedLanguage = (typeof supportedLngs)[number];

export const resources = {
  en: { common: enCommon, errors: enErrors },
  bn: { common: bnCommon, errors: bnErrors },
} as const;

export const languageNames: Record<SupportedLanguage, string> = {
  en: 'English',
  bn: 'বাংলা',
};

export { enCommon, bnCommon, enErrors, bnErrors };
