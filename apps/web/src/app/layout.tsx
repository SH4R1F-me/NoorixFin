import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "NoorixFin — Personal Finance",
  description:
    "Track income, expenses, budgets, goals and debts in one private workspace. Bangla-first, privacy-safe finance management.",
  keywords: "finance, budget, expense tracker, bangla, personal finance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
