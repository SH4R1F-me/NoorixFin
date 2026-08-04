/**
 * i18n configuration for the web app.
 * Blueprint §13: i18next + react-i18next
 */
'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Catalogs come from the shared package — do not re-copy them into this app.
// `resources` carries both the `common` and `errors` namespaces for bn + en.
import { resources, defaultNS, fallbackLng, supportedLngs } from '@noorixfin/i18n';

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      defaultNS,
      fallbackLng,
      supportedLngs: [...supportedLngs],
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
