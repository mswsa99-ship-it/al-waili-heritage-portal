import type { Metadata } from "next";
import "./globals.css";
import "./najdi-design.css";

export const viewport = {width: 'device-width', initialScale: 1};

export const metadata: Metadata = {
  title: "بوابة أسرة الوايلي | الجذور التي تجمعنا",
  description: "بوابة توثيق النسب والذاكرة التاريخية والخدمات العائلية لأسرة الوايلي.",
  icons: {
    icon: "/waili-seal.png",
    shortcut: "/waili-seal.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head><link rel="preload" href="/fonts/Tajawal-Regular.ttf" as="font" type="font/ttf" crossOrigin="anonymous"/></head>
      <body className="antialiased najdi-platform">{children}</body>
    </html>
  );
}
