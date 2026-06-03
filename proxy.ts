import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
    
    if (!sbToken && process.env.NODE_ENV === "production") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
