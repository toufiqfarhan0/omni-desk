import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /dashboard and all nested paths
  if (pathname.startsWith("/dashboard")) {
    const isDemo = request.nextUrl.searchParams.get("demo") === "true";
    const sessionCookie = request.cookies.get("omnidesk_session");
    const sessionToken = sessionCookie?.value?.trim();

    // If demo requested, auto-allow and ensure cookie is set
    if (isDemo) {
      const response = NextResponse.next();
      response.cookies.set("omnidesk_session", "owner_demo", {
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "lax",
        httpOnly: false,
      });
      return response;
    }

    // Unauthenticated user attempting to access dashboard -> redirect to home and prompt auth modal
    if (!sessionToken) {
      const redirectUrl = new URL("/?auth=required&redirect=/dashboard", request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
