import type { Metadata } from "next";
import { Fira_Sans, Fira_Code } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "XDC SkyNet | Network Ownership Dashboard",
  description: "XDC SkyNet - Own Your Network. The definitive dashboard and API platform for XDC Network owners and operators.",
  icons: {
    icon: "/xdc-logo.png",
    apple: "/xdc-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${firaSans.variable} ${firaCode.variable} antialiased`}>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="dark"
          enableSystem={true}
          disableTransitionOnChange={false}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
