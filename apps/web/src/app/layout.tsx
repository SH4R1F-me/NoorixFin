import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyFin — Personal & Family Finance",
  description:
    "Track income, expenses, budgets, goals and debts across personal and family workspaces. Bangla-first, privacy-safe finance management.",
  keywords: "finance, budget, expense tracker, bangla, family finance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
