import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { getLocale } from "../lib/i18n/locale";
import { LocaleProvider } from "../lib/i18n/locale-provider";
import { getSessionContext } from "../lib/session";

export const metadata: Metadata = {
  title: "NoorixFin — Personal Finance",
  description:
    "Track income, expenses, budgets, goals and debts in one private workspace. Bangla-first, privacy-safe finance management.",
  keywords: "finance, budget, expense tracker, bangla, personal finance",
};

/**
 * Root layout — resolves the language once, for the whole tree (DEC-021).
 *
 * The provider lives here rather than in the dashboard layout so that signed-out
 * pages (landing, login, forgot-password) share the same locale source as the
 * app. Previously each of those kept its own toggle, so a visitor who chose
 * English on the landing page was shown Bangla again the moment they reached
 * the login form.
 *
 * `<html lang>` follows the resolved locale instead of being pinned to "bn":
 * screen readers pick pronunciation from it, and a Bangla `lang` on English text
 * makes the page unusable with assistive technology (WCAG 3.1.1).
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, { profile }] = await Promise.all([
    getLocale(),
    getSessionContext(),
  ]);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <LocaleProvider initialLocale={locale} isAuthenticated={profile !== null}>
          <Providers>{children}</Providers>
        </LocaleProvider>
      </body>
    </html>
  );
}
