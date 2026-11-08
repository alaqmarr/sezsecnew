import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE_NAME = "sezsec_member_session";

function isPublicPath(pathname: string): boolean {
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/unauthorized" ||
    pathname === "/events" ||
    pathname === "/menu" ||
    pathname === "/our-events" ||
    pathname === "/khidmat" ||
    pathname === "/join" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/setup/") ||
    pathname.startsWith("/api/bridge/") ||
    (pathname.startsWith("/api/uploads/") && pathname !== "/api/uploads")
  ) {
    return true;
  }

  if (/\.(png|jpg|jpeg|svg|gif|webp|ico|ttf|woff|woff2|json)$/i.test(pathname)) {
    return true;
  }

  return false;
}

async function hasValidJwtCookie(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    const secret =
      process.env.AUTH_SECRET ||
      process.env.NEXTAUTH_SECRET ||
      "sezsec-member-portal-local-dev-secret-2026";
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );
    return Boolean(payload.sub && payload.username && payload.role);
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const valid = await hasValidJwtCookie(request);
  if (!valid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Please sign in to continue." },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
