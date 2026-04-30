import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"

import "./globals.css"
import { QueryProvider } from "@/components/query-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { RandomDailyProvider } from "@/components/random-daily-provider"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  applicationName: "Random Daily",
  description:
    "Shuffle tasks from pools into a daily plan — archive, random picks, and mandatory tasks.",
  appleWebApp: {
    capable: true,
    title: "Random Daily",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
}

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased font-sans",
        fontSans.variable,
        fontMono.variable,
      )}
    >
      <body>
        <QueryProvider>
          <ThemeProvider>
            <RandomDailyProvider>{children}</RandomDailyProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
