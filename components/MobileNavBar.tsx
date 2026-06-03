"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Home, Plus, MessageSquare, User, ShieldAlert } from "lucide-react";

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
      }
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        setIsAdmin(session.user.email === "admin@freeshare.in");
      } else {
        setUserId(null);
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const navItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Share", href: "/donate", icon: Plus },
    { label: "Dashboard", href: "/dashboard", icon: MessageSquare },
    { label: "Profile", href: userId ? `/profile/${userId}` : "/login", icon: User },
  ];

  if (isAdmin) {
    navItems.splice(3, 0, { label: "Admin", href: "/admin", icon: ShieldAlert });
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/75 backdrop-blur-lg border-t border-slate-900/80 px-4 py-2.5 flex items-center justify-around shadow-2xl selection:bg-transparent">
      {navItems.map((item) => {
        const IconComponent = item.icon;
        const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));

        return (
          <Link
            key={item.label}
            href={item.href}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3.5 rounded-xl transition-all cursor-pointer ${
              isActive 
                ? "text-teal-400 font-extrabold" 
                : "text-slate-500 hover:text-slate-350"
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${isActive ? "bg-teal-500/10 border border-teal-500/20 text-teal-400" : ""}`}>
              <IconComponent size={20} className={isActive ? "stroke-[2.5px]" : "stroke-[2px]"} />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
