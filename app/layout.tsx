import type { Metadata } from "next";
import { Inter, Manrope, Geist_Mono, Fredoka } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";

// Matches the locked mockup typography (UI Design Log.md): Manrope for
// headings/display, Inter for body. `--font-sans` was previously declared in
// globals.css's @theme block but nothing ever set it — Geist's variable was
// named `--font-geist-sans`, a different token, so `font-sans`/`body` fell
// back to the browser default the whole time.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-heading",
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Only used for the playful word-chips on the auth pages (see
// AuthShell) — everything else in the app stays on Manrope/Inter.
const fredoka = Fredoka({
  variable: "--font-fredoka",
  weight: ["600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vantage",
  description:
    "Guess the AI approach before you see the recommendation — a practice loop for consultants scoping client problems.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${manrope.variable} ${geistMono.variable} ${fredoka.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Applies the stored theme before first paint, avoiding a flash of
            the wrong theme. Defaults to dark for a first-time visitor with no
            stored preference yet; only an explicit 'light' choice (saved by
            components/theme-toggle.tsx) opts back out. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('vantage-theme')!=='light')document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
