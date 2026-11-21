import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { Branding } from "@/components/Branding";
import { ConfirmHost } from "@/components/confirm";
import { SyncErrorBanner } from "@/components/status";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Toaster } from "@/components/toast";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
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
  title: {
    default: "SideQuest: Toys and Figures",
    template: "%s · SideQuest: Toys and Figures",
  },
  description: "Inventory, transactions and expenses for a toy shop.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the inline theme script below sets
    // data-theme on <html> before React hydrates. It only covers this
    // element's own attributes, not its children.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* The app has its own light and dark themes; ask the Dark Reader
            extension not to restyle it on top of them. */}
        <meta name="darkreader-lock" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full md:flex">
        <Branding />
        <AppShell>{children}</AppShell>
        <ThemeToggle />
        <Toaster />
        <ConfirmHost />
        <SyncErrorBanner />
      </body>
    </html>
  );
}
