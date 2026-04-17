import type { Metadata, Viewport } from "next";
import { Fira_Sans, Fira_Code, DM_Sans, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

// Import server initialization (only runs on server)
import "@/lib/server-init";

// Legacy fonts (keep during transition)
const firaSans = Fira_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fira-sans",
  display: "swap",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-fira-code",
  display: "swap",
});

// Precision Darkness fonts (Issue #76)
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "XDC SkyNet | Network Ownership Dashboard",
  description: "XDC SkyNet - Own Your Network. The definitive dashboard and API platform for XDC Network owners and operators.",
  manifest: "/manifest.json",
  icons: {
    icon: "/xdc-logo.png",
    apple: "/xdc-logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "XDC SkyNet",
  },
  applicationName: "XDC SkyNet",
  keywords: ["XDC", "blockchain", "network", "monitoring", "dashboard", "masternode", "validator"],
  authors: [{ name: "XDC Network" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1E90FF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="apple-touch-icon" href="/xdc-logo.png" />
      </head>
      <body className={`${firaSans.variable} ${firaCode.variable} ${dmSans.variable} ${jetbrainsMono.variable} antialiased`}>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="dark"
          enableSystem={true}
          disableTransitionOnChange={false}
        >
          {children}
        </ThemeProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
