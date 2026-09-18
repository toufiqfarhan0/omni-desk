import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /dashboard and all nested paths
  if (pathname.startsWith("/dashboard")) {
    const sessionCookie = request.cookies.get("omnidesk_session");
    const sessionToken = sessionCookie?.value?.trim();

    // If no active session cookie found, redirect to home with auth modal trigger
    if (!sessionToken) {
      const redirectUrl = new URL("/", request.url);
      redirectUrl.searchParams.set("auth", "required");
      redirectUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
