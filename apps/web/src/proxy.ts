import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const AUTH_PAGES = new Set(["/login", "/signup"]);
const PROTECTED_PREFIXES = ["/dashboard", "/profile", "/preferences", "/runs", "/admin"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);

  if (AUTH_PAGES.has(pathname)) {
    if (!session) return NextResponse.next();
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (isProtected && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/preferences/:path*",
    "/runs/:path*",
    "/admin/:path*",
    "/login",
    "/signup",
  ],
};
