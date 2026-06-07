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

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBrandingServer();
  const domainUrl = branding.appDomain.replace(/\/+$/, "");

  return {
    title: {
      default: branding.appName,
      template: `%s | ${branding.appName}`,
    },
    description: branding.appDescription,
    metadataBase: new URL(domainUrl),
    alternates: {
      canonical: "/",
    },
    openGraph: {
      title: branding.appName,
      description: branding.appDescription,
      url: domainUrl,
      siteName: branding.appName,
      images: [
        {
          url: branding.brandLogoUrl || branding.appLogoUrl,
          width: 800,
          height: 800,
          alt: branding.appName,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: branding.appName,
      description: branding.appDescription,
      images: [branding.brandLogoUrl || branding.appLogoUrl],
    },
    verification: {
      google: "aMZnTITfGYYhnaXrtCvo_jcmuKjhhR1SbhNGzwnnCZQ",
    },
  };
}

import PWARegister from "@/components/PWARegister";
import MobileNavBar from "@/components/MobileNavBar";
import AnalyticsManager from "@/components/AnalyticsManager";
import CookieConsent from "@/components/CookieConsent";
import { BrandingProvider } from "@/components/BrandingContext";
import { getBrandingServer } from "@/lib/brandingServer";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = await getBrandingServer();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <BrandingProvider initialData={branding}>
          <main className="flex-1 pb-20 md:pb-0">{children}</main>
          <AnalyticsManager />
          <CookieConsent />
          <PWARegister />
          <MobileNavBar />
        </BrandingProvider>
      </body>
    </html>
  );
}
