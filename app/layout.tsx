import "./globals.css"
import { Geist, Geist_Mono, /* Inter */ } from "next/font/google"
import type { Metadata } from "next"
import { ThemeProvider } from "@/components/theme-provider"
import { ToastProvider } from "./toast-provider"
import { cn } from "@/lib/utils"

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })


export const metadata: Metadata = {
  metadataBase: new URL("https://finance-tracking-visualizator.vercel.app"),
  title: "Personal Finance Tracker",
  description:
    "Track income and expenses and see spending trends in an interactive dashboard. Built with Next.js, TypeScript and MySQL.",
  openGraph: {
    title: "Personal Finance Tracker",
    description:
      "Track income and expenses and see spending trends in an interactive dashboard.",
    /*  url: "/", */
    type: "website",
    images: [{ url: "/og-dashboard.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
}

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
        "antialiased",
        fontSans.variable,
        "font-mono",
        geistMono.variable
      )}
    >
      <body>
        <ThemeProvider>
          {children}
          <ToastProvider />
        </ThemeProvider>
      </body>
    </html>
  )
}
