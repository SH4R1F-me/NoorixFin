/**
 * i18n configuration for the web app.
 * Blueprint §13: i18next + react-i18next
 */
'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation catalogs
import enCommon from './locales/en/common.json';
import bnCommon from './locales/bn/common.json';

const resources = {
  en: { common: enCommon },
  bn: { common: bnCommon },
};

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      defaultNS: 'common',
      fallbackLng: 'en',
      supportedLngs: ['bn', 'en'],
      interpolation: {
        escapeValue: false,
      },
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
      },
    });
}

export default i18n;
