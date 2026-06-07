import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only run check for admin panel paths
  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get("sb-access-token")?.value;

    if (!token) {
      // Not logged in -> return 404 behavior or redirect
      return NextResponse.redirect(new URL("/login?next=/admin", request.url));
    }

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });

      // Verify the JWT token and get user profile
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return NextResponse.redirect(new URL("/login?next=/admin", request.url));
      }

      // Verify if email is the admin email
      if (user.email !== "admin@freeshare.in") {
        // Not authorized -> redirect to home page
        return NextResponse.redirect(new URL("/", request.url));
      }
    } catch (e) {
      console.error("Middleware auth verification error:", e);
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

// Limit the middleware to execute ONLY on the admin paths for optimal site performance
export const config = {
  matcher: ["/admin/:path*"],
};
