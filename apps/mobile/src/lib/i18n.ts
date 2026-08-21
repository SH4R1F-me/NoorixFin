import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import {
  defaultLocale,
  fallbackLng,
  isSupportedLocale,
  resources,
  type SupportedLanguage,
} from '@noorixfin/i18n';

const MOBILE_LOCALE_KEY = 'noorixfin.locale.v1';

function deviceLocale(): SupportedLanguage {
  const language = getLocales()[0]?.languageCode;
  return isSupportedLocale(language) ? language : defaultLocale;
}

void i18n.use(initReactI18next).init({
  resources,
  lng: deviceLocale(),
  fallbackLng,
  defaultNS: 'common',
  supportedLngs: ['en', 'bn'],
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export async function restoreMobileLocale(): Promise<SupportedLanguage> {
  const stored = await SecureStore.getItemAsync(MOBILE_LOCALE_KEY);
  const locale = isSupportedLocale(stored) ? stored : deviceLocale();
  await i18n.changeLanguage(locale);
  return locale;
}

export async function changeMobileLocale(locale: SupportedLanguage): Promise<void> {
  await SecureStore.setItemAsync(MOBILE_LOCALE_KEY, locale);
  await i18n.changeLanguage(locale);
}

export function activeMobileLocale(): SupportedLanguage {
  return isSupportedLocale(i18n.resolvedLanguage) ? i18n.resolvedLanguage : defaultLocale;
}

export default i18n;
