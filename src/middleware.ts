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

  const isOperationsRole =
    session?.role === "ADMIN" ||
    session?.role === "MODERATOR" ||
    session?.role === "SAFE_DESK_STAFF";

  if (pathname.startsWith("/api/admin") || pathname.startsWith("/api/staff")) {
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required.",
          },
        },
        { status: 401 }
      );
    }
    if (!isOperationsRole) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Forbidden: Operations access required.",
          },
        },
        { status: 403 }
      );
    }
  } else if (pathname.startsWith("/admin")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login?redirect=/admin", req.url));
    }
    if (!isOperationsRole) {
      return NextResponse.redirect(new URL("/dashboard?error=unauthorized_role", req.url));
    }
  } else if (pathname.startsWith("/staff")) {
    if (!session) {
      return NextResponse.redirect(
        new URL(`/login?redirect=${encodeURIComponent(pathname)}`, req.url)
      );
    }
    if (!isOperationsRole) {
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
    "/staff/:path*",
    "/api/staff/:path*",
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
