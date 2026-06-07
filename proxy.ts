import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// List of routes that require a verified session
const PROTECTED_ROUTES = ["/donate", "/chat", "/dashboard", "/admin"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if target route is protected
  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtected) {
    const sbToken = request.cookies.get("sb-access-token")?.value;
    
    if (!sbToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Server-side block for /admin routes
    if (pathname.startsWith("/admin")) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        });

        // Query the active user from token
        const { data: { user }, error } = await supabase.auth.getUser(sbToken);

        if (error || !user || user.email !== "admin@freeshare.in") {
          // Block access if not the verified admin -> redirect to home page
          return NextResponse.redirect(new URL("/", request.url));
        }
      } catch (e) {
        console.error("Proxy admin authorization error:", e);
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
