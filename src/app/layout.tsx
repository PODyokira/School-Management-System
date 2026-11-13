import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Établissement · School Management PoC",
  description: "Secure vertical-slice demo: setup, attendance, grades, guardian portal, permission-aware AI",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const lang = (cookieStore.get("lang")?.value === "fr" ? "fr" : "en") as "en" | "fr";
  return (
    <html lang={lang} className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body className="min-h-full antialiased">
        <LanguageProvider initialLang={lang}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
