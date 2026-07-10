import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ThemeCustomizationSyncProvider } from "@/components/providers/theme-customization-sync";
import { SettingsSyncProvider } from "@/components/providers/settings-sync-provider";
import { ColorBlindFilters } from "@/components/providers/color-blind-filters";
import { SettingsToaster } from "@/components/providers/settings-toaster";
import { CliLaunchProvider } from "@/components/providers/cli-launch-provider";
import { GlobalShortcutProvider } from "@/components/providers/global-shortcut-provider";
import { AutostartProvider } from "@/components/providers/autostart-provider";
import { TauriSyncProvider } from "@/lib/tauri/TauriSyncProvider";
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
    default: "Cobalt Skymap - Interactive Star Map & Astronomy Planner",
    template: "%s | Cobalt Skymap",
  },
  description:
    "A powerful astronomy application for stargazing, observation planning, and astrophotography. Explore celestial objects with real-time sky rendering powered by Stellarium Web Engine.",
  keywords: [
    "star map",
    "astronomy",
    "stargazing",
    "astrophotography",
    "observation planning",
    "stellarium",
    "celestial",
    "telescope",
    "night sky",
  ],
  authors: [{ name: "AstroAir" }],
  creator: "AstroAir",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Cobalt Skymap",
    title: "Cobalt Skymap - Interactive Star Map & Astronomy Planner",
    description:
      "A powerful astronomy application for stargazing, observation planning, and astrophotography. Powered by Stellarium Web Engine.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cobalt Skymap - Interactive Star Map & Astronomy Planner",
    description:
      "Explore the universe with real-time sky rendering, observation planning, and astrophotography tools.",
  },
  applicationName: "Cobalt Skymap",
  category: "Science & Education",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ColorBlindFilters />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeCustomizationSyncProvider>
            <SettingsSyncProvider>
              <I18nProvider>
                <TauriSyncProvider>
                  <CliLaunchProvider>
                    <GlobalShortcutProvider />
                    <AutostartProvider />
                    {children}
                  </CliLaunchProvider>
                </TauriSyncProvider>
                <SettingsToaster />
              </I18nProvider>
            </SettingsSyncProvider>
          </ThemeCustomizationSyncProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
