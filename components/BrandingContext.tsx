"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { 
  DEFAULT_APP_NAME, 
  DEFAULT_APP_SHORT_NAME,
  DEFAULT_APP_DESCRIPTION, 
  DEFAULT_SUPPORT_EMAIL, 
  DEFAULT_LOGO_URL, 
  DEFAULT_APP_DOMAIN,
  DEFAULT_ITEM_CATEGORIES,
  DEFAULT_SKILL_CATEGORIES
} from "@/lib/branding";

interface BrandingData {
  appName: string;
  appShortName: string;
  appDescription: string;
  supportEmail: string;
  appLogoUrl: string;
  appDomain: string;
  itemCategories: string[];
  skillCategories: string[];
  loading: boolean;
}

const BrandingContext = createContext<BrandingData>({
  appName: DEFAULT_APP_NAME,
  appShortName: DEFAULT_APP_SHORT_NAME,
  appDescription: DEFAULT_APP_DESCRIPTION,
  supportEmail: DEFAULT_SUPPORT_EMAIL,
  appLogoUrl: DEFAULT_LOGO_URL,
  appDomain: DEFAULT_APP_DOMAIN,
  itemCategories: DEFAULT_ITEM_CATEGORIES,
  skillCategories: DEFAULT_SKILL_CATEGORIES,
  loading: true
});

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingData>({
    appName: DEFAULT_APP_NAME,
    appShortName: DEFAULT_APP_SHORT_NAME,
    appDescription: DEFAULT_APP_DESCRIPTION,
    supportEmail: DEFAULT_SUPPORT_EMAIL,
    appLogoUrl: DEFAULT_LOGO_URL,
    appDomain: DEFAULT_APP_DOMAIN,
    itemCategories: DEFAULT_ITEM_CATEGORIES,
    skillCategories: DEFAULT_SKILL_CATEGORIES,
    loading: true
  });

  useEffect(() => {
    async function loadBranding() {
      try {
        const res = await fetch("/api/admin/settings");
        if (res.ok) {
          const settings = await res.json();
          // Extract app short name from app name or fallback
          const name = settings.app_name || DEFAULT_APP_NAME;
          const shortName = name.split(" ")[0] || DEFAULT_APP_SHORT_NAME;

          setBranding({
            appName: name,
            appShortName: shortName,
            appDescription: settings.app_description || DEFAULT_APP_DESCRIPTION,
            supportEmail: settings.support_email || DEFAULT_SUPPORT_EMAIL,
            appLogoUrl: settings.app_logo_url || DEFAULT_LOGO_URL,
            appDomain: settings.app_domain || DEFAULT_APP_DOMAIN,
            itemCategories: settings.item_categories || DEFAULT_ITEM_CATEGORIES,
            skillCategories: settings.skill_categories || DEFAULT_SKILL_CATEGORIES,
            loading: false
          });
        } else {
          setBranding(prev => ({ ...prev, loading: false }));
        }
      } catch (err) {
        console.error("Failed to load branding settings:", err);
        setBranding(prev => ({ ...prev, loading: false }));
      }
    }
    loadBranding();
  }, []);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
