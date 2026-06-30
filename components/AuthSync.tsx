"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthSync() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (session) {
          // Set access token cookie as long-lived (30 days) to prevent premature deletion by the browser.
          // The server-side middleware validates the token value and refreshes it if expired.
          document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=2592000; SameSite=Lax; Secure`;
        }
      } else if (event === "SIGNED_OUT") {
        document.cookie = `sb-access-token=; path=/; max-age=0; SameSite=Lax; Secure`;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}

