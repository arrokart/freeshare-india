import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// List of routes that require a verified session
const PROTECTED_ROUTES = ["/donate", "/chat", "/dashboard", "/admin"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  // 1. Initialize Supabase SSR server client to handle cookie sync and token refreshing
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Automatically refresh the session if it's expired
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Check if target route is protected
  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtected) {
    // Check for the user from server-side Supabase client
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      
      // Clear legacy token cookie if not logged in
      const redirectResponse = NextResponse.redirect(loginUrl);
      redirectResponse.cookies.set("sb-access-token", "", { maxAge: 0, path: "/" });
      return redirectResponse;
    }

    // Server-side block for /admin routes
    if (pathname.startsWith("/admin")) {
      const adminEmail = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      if (!adminEmail || user.email !== adminEmail) {
        // Block access if not the verified admin -> redirect to home page
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
  }

  // Sync access token to legacy cookie value if present to maintain backward compatibility
  const session = await supabase.auth.getSession();
  if (session?.data?.session?.access_token) {
    response.cookies.set("sb-access-token", session.data.session.access_token, {
      path: "/",
      maxAge: 2592000, // 30 days
      sameSite: "lax",
      secure: true,
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

