"use client";

import React, { useEffect, useState } from "react";
import Script from "next/script";

// Extend window interface to support Google analytics dataLayer
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

export default function AnalyticsManager() {
  const [gaId, setGaId] = useState<string | null>(null);
  const [adsenseId, setAdsenseId] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrackingConfigs = async () => {
      try {
        const res = await fetch("/api/admin/settings");
        if (res.ok) {
          const data = await res.json();
          const dbGa = data.ga_measurement_id;
          const dbAdsense = data.adsense_client_id;
          
          setGaId(dbGa || process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "");
          setAdsenseId(dbAdsense || process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || "");
        } else {
          setGaId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "");
          setAdsenseId(process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || "");
        }
      } catch (error) {
        console.error("Failed to fetch dynamic tracking configs:", error);
        setGaId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "");
        setAdsenseId(process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || "");
      }
    };

    fetchTrackingConfigs();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !gaId) return;

    // 1. Initialize dataLayer and gtag function
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function() {
      window.dataLayer.push(arguments);
    };

    // 2. Set default Google Consent Mode v2 (denied state)
    const consent = localStorage.getItem("freeshare_cookie_consent");
    const hasConsent = consent === "granted";

    window.gtag("consent", "default", {
      ad_storage: hasConsent ? "granted" : "denied",
      ad_user_data: hasConsent ? "granted" : "denied",
      ad_personalization: hasConsent ? "granted" : "denied",
      analytics_storage: hasConsent ? "granted" : "denied",
    });

    window.gtag("js", new Date());
    window.gtag("config", gaId);

    // 3. Listen for consent updates triggered by the Cookie Consent UI component
    const handleConsentUpdate = () => {
      const updatedConsent = localStorage.getItem("freeshare_cookie_consent");
      const isGranted = updatedConsent === "granted";

      if (window.gtag) {
        window.gtag("consent", "update", {
          ad_storage: isGranted ? "granted" : "denied",
          ad_user_data: isGranted ? "granted" : "denied",
          ad_personalization: isGranted ? "granted" : "denied",
          analytics_storage: isGranted ? "granted" : "denied",
        });
        console.log(`[Analytics] Google Consent Mode updated: ${updatedConsent}`);
      }
    };

    window.addEventListener("cookieConsentChanged", handleConsentUpdate);
    return () => {
      window.removeEventListener("cookieConsentChanged", handleConsentUpdate);
    };
  }, [gaId]);

  return (
    <>
      {/* 1. Google Analytics Tag (gtag.js) */}
      {gaId && (
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
          strategy="afterInteractive"
        />
      )}

      {/* 2. Google AdSense Script Tag */}
      {adsenseId && (
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      )}
    </>
  );
}
