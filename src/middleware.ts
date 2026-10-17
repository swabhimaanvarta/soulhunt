import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/jwt";

const PROTECTED_PLATFORM_PREFIXES = [
  "/dashboard",
  "/lost-and-found/report-lost",
  "/lost-and-found/report-found",
  "/investigations",
  "/rewards",
  "/notifications",
  "/profile",
  "/squads",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("aiem_session")?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login?redirect=/admin", req.url));
    }
    if (session.role !== "ADMIN" && session.role !== "MODERATOR") {
      return NextResponse.redirect(new URL("/dashboard?error=unauthorized_role", req.url));
    }
  }

  const requiresAuth = PROTECTED_PLATFORM_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  if (requiresAuth && !session) {
    return NextResponse.redirect(
      new URL(`/login?redirect=${encodeURIComponent(pathname)}`, req.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/dashboard/:path*",
    "/lost-and-found/report-lost",
    "/lost-and-found/report-found",
    "/investigations/:path*",
    "/rewards/:path*",
    "/notifications/:path*",
    "/profile/:path*",
    "/squads/:path*",
  ],
};
