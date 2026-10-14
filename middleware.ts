import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const authFormPaths = ["/login", "/register", "/forgot-password", "/reset-password"];
const publicVerificationPaths = ["/verify-email", "/verify-email-pending"];
const publicGeneralPaths = ["/", "/pricing"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get("wellqc_session")?.value);

  // Static assets, public images, and team photos must always bypass auth middleware
  if (
    pathname.startsWith("/team/") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // If user is on login/register and already logged in, send to dashboard
  if (authFormPaths.includes(pathname) && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Verification routes and public pages are accessible without session
  if (publicVerificationPaths.includes(pathname) || publicGeneralPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // All other pages require an authenticated session
  if (!authFormPaths.includes(pathname) && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
