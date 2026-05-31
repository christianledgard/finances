import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/ThemeProvider";
import { APP_NAME } from '@/lib/config'

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#131313' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Your personal banking overview',
  applicationName: APP_NAME,
  appleWebApp: { capable: true, statusBarStyle: 'default', title: APP_NAME },
  // manifest link, favicon, and apple-touch-icon are auto-injected by Next
  // from manifest.ts / favicon.ico / apple-icon.svg
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body className="bg-background text-foreground min-h-screen antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
