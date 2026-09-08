import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicAuthPaths = ["/login", "/register"];
const publicGeneralPaths = ["/", "/pricing"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get("wellqc_session")?.value);

  // If user is on login/register and already logged in, send to dashboard
  if (publicAuthPaths.includes(pathname) && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Public general pages are accessible to everyone
  if (publicGeneralPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // All other pages require session
  if (!publicAuthPaths.includes(pathname) && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next|favicon.ico).*)"] };
