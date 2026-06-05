"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Home, Plus, Calendar, LayoutDashboard, User, ShieldAlert } from "lucide-react";

export default function MobileNavBar() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        setIsAdmin(session.user.email === "admin@freeshare.in"); // Simple check matching admin console
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${session.expires_in || 3600}; SameSite=Lax; Secure`;
      }
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        setIsAdmin(session.user.email === "admin@freeshare.in");
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${session.expires_in || 3600}; SameSite=Lax; Secure`;
      } else {
        setUserId(null);
        setIsAdmin(false);
        document.cookie = "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const navItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Share", href: "/donate", icon: Plus },
    { label: "Events", href: "/events", icon: Calendar },
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: userId ? "Profile" : "Login", href: userId ? `/profile/${userId}` : "/login", icon: User },
  ];

  if (isAdmin) {
    navItems.splice(3, 0, { label: "Admin", href: "/admin", icon: ShieldAlert });
  }

  // When admin adds a 6th item, hide text labels to keep nav usable
  const showLabels = navItems.length <= 5;

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-lg border-t border-slate-900/80 px-2 pt-2 flex items-center justify-around shadow-2xl selection:bg-transparent"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 10px)' }}
    >
      {navItems.map((item) => {
        const IconComponent = item.icon;
        const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));

        return (
          <Link
            key={item.label}
            href={item.href}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 min-w-[56px] rounded-xl transition-all active:scale-95 cursor-pointer ${
              isActive
                ? "text-teal-400 font-extrabold"
                : "text-slate-500 hover:text-slate-350"
            }`}
          >
            <div className={`p-2 rounded-xl transition-all ${isActive ? "bg-teal-500/10 border border-teal-500/20 text-teal-400" : ""}`}>
              <IconComponent size={20} className={isActive ? "stroke-[2.5px]" : "stroke-[2px]"} />
            </div>
            {showLabels && (
              <span className="text-[11px] uppercase font-bold tracking-wide">{item.label}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
