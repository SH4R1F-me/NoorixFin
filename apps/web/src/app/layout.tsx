import type { Metadata } from "next";
import { Inter, Hind_Siliguri } from "next/font/google";
// Imported BEFORE globals.css so the custom properties exist for anything that
// reads them. Custom-property resolution is order-independent, but keeping the
// declaration first is what a reader expects and costs nothing.
import "@noorixfin/design-tokens/tokens.css";
// Component styles depend on the tokens above, and the app's own globals may
// legitimately override a component, so the order is tokens → ui → globals.
import "@noorixfin/ui/ui.css";
import "./globals.css";
import { Providers } from "./providers";
import { getLocale } from "../lib/i18n/locale";
import { LocaleProvider } from "../lib/i18n/locale-provider";
import { getSessionContext } from "../lib/session";

/**
 * Fonts are self-hosted by `next/font`, not fetched from Google.
 *
 * `globals.css` used to `@import` them from fonts.googleapis.com. Three things
 * were wrong with that: the CSP added in this session blocked it outright; an
 * `@import` at the top of a stylesheet is render-blocking and serialises a
 * second round trip before any text paints; and every visitor's IP was handed
 * to a third party by a site whose own landing page advertises "0 trackers".
 *
 * `next/font` downloads the files at build time and serves them same-origin,
 * which fixes all three at once. The `variable` option exposes each as a CSS
 * custom property so `--font-ui` and `--font-bangla` keep working unchanged.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Hind Siliguri is not a variable font, so the weights the design uses have to
// be named explicitly — unlike Inter, where the whole 300–800 range is one file.
const hindSiliguri = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-hind-siliguri",
  display: "swap",
});

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
    <html
      lang={locale}
      className={`${inter.variable} ${hindSiliguri.variable}`}
      suppressHydrationWarning
    >
      <body>
        <LocaleProvider initialLocale={locale} isAuthenticated={profile !== null}>
          <Providers>{children}</Providers>
        </LocaleProvider>
      </body>
    </html>
  );
}
