"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthSync() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (session) {
          document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${session.expires_in}; SameSite=Lax; Secure`;
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
