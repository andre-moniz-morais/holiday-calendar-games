import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/session";

/** Optimistic auth gate: everything except the login screen needs a valid session cookie. */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const player = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    if (player) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }
  if (!player) {
    if (pathname.startsWith("/api/")) return Response.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything goes through the gate except build assets, the login API, PWA files and the
    // cartoon heads/icons (needed on the login screen). Our photos stay private.
    "/((?!_next/static|_next/image|api/login|heads/|icons/|sw\\.js|manifest\\.webmanifest|favicon\\.ico).*)",
  ],
};
