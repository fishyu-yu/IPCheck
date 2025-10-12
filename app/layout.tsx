import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IP CHECK",
  description: "CHECK YOUR IP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased theme-transition`}
      >
        {/* Initial theme script: applies dark based on saved mode, system or time */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
            try {
              var key = 'theme-preference';
              var val = localStorage.getItem(key);
              var isDark = false;
              if (val === 'dark') {
                isDark = true;
              } else if (val === 'light') {
                isDark = false;
              } else if (val === 'time') {
                var h = new Date().getHours();
                isDark = (h >= 19 || h < 6);
              } else {
                // system by default
                var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
                isDark = !!(mq && mq.matches);
              }
              var root = document.documentElement;
              root.classList.toggle('dark', isDark);
            } catch (e) {}
          `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
