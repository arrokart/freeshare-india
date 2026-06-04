"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Utility to convert VAPID base64 key to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PWARegister() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(true);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      };
    }

    setPermission(Notification.permission);

    const registerPWA = async () => {
      try {
        // 1. Register Service Worker
        const registration = await navigator.serviceWorker.register("/sw.js");
        console.log("[PWA] Service Worker registered with scope:", registration.scope);

        // Check for updates to the service worker and trigger automatic cache invalidation reload
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed") {
                if (navigator.serviceWorker.controller) {
                  console.log("[PWA] New service worker version detected. Reloading page to apply updates...");
                  window.location.reload();
                }
              }
            });
          }
        });

        // 2. Listen for Auth State changes to subscribe to Push Manager
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          syncPushSubscription(registration, session.user.id);
        }

        supabase.auth.onAuthStateChange((event, newSession) => {
          if (newSession?.user) {
            syncPushSubscription(registration, newSession.user.id);
          }
        });

      } catch (error) {
        console.error("[PWA] Service Worker registration failed:", error);
      }
    };

    registerPWA();

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const syncPushSubscription = async (registration: ServiceWorkerRegistration, userId: string) => {
    try {
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) {
        console.warn("[PWA] VAPID public key not found in env variables.");
        return;
      }

      // Check current subscription
      let subscription = await registration.pushManager.getSubscription();

      // If no subscription and permission is already granted, subscribe automatically
      if (!subscription && Notification.permission === "granted") {
        const convertedVapidKey = urlBase64ToUint8Array(publicVapidKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
      }

      if (subscription) {
        // Sync subscription with the backend DB
        await fetch("/api/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            subscription
          })
        });
        console.log("[PWA] Web Push subscription synchronized successfully.");
      }
    } catch (err) {
      console.error("[PWA] Push subscription sync failed:", err);
    }
  };

  const handleRequestPermission = async () => {
    if (!("Notification" in window)) return;
    const res = await Notification.requestPermission();
    setPermission(res);

    if (res === "granted" && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      const { data: { user } } = await supabase.auth.getUser();
      if (reg && user) {
        syncPushSubscription(reg, user.id);
      }
    }
  };

  // Render a subtle floating prompt for users who haven't enabled notifications yet
  if (permission === "default") {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:right-auto md:left-4 z-[9999] p-4 bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-2xl shadow-2xl flex flex-col gap-2.5 max-w-xs animate-in slide-in-from-bottom-5 duration-300">
        <div className="space-y-0.5">
          <p className="text-xs font-black text-slate-100 flex items-center gap-1.5">
            🔔 Enable Notifications
          </p>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Get instant updates on your claims, item requests, and direct chat messages from your neighbors.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setPermission("denied")}
            className="px-2.5 py-1 text-[9px] font-bold text-slate-500 hover:text-slate-400 transition-all uppercase"
          >
            Later
          </button>
          <button
            onClick={handleRequestPermission}
            className="px-3 py-1 text-[9px] font-extrabold bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 rounded-lg hover:from-teal-400 hover:to-emerald-400 transition-all uppercase cursor-pointer"
          >
            Enable
          </button>
        </div>
      </div>
    );
  }

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] User choice outcome: ${outcome}`);
    setDeferredPrompt(null);
  };

  // Render a floating prompt for app installation if available
  if (deferredPrompt && showInstallPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:right-auto md:left-4 z-[9999] p-4 bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-2xl shadow-2xl flex flex-col gap-2.5 max-w-xs animate-in slide-in-from-bottom-5 duration-300">
        <div className="space-y-0.5">
          <p className="text-xs font-black text-slate-100 flex items-center gap-1.5">
            📲 Install FreeShare App
          </p>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Add FreeShare India to your home screen for instant access and a faster, native app experience.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setShowInstallPrompt(false)}
            className="px-2.5 py-1 text-[9px] font-bold text-slate-500 hover:text-slate-400 transition-all uppercase"
          >
            Later
          </button>
          <button
            onClick={handleInstallClick}
            className="px-3 py-1 text-[9px] font-extrabold bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 rounded-lg hover:from-teal-400 hover:to-emerald-400 transition-all uppercase cursor-pointer"
          >
            Install
          </button>
        </div>
      </div>
    );
  }

  return null;
}
