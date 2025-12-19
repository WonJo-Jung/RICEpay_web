import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: ["/:path*"],
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Next 내부/정적 리소스는 통과
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/assets")
  ) {
    return NextResponse.next();
  }

  // ✅ 외부 공개 허용: /external/[id] (및 /external 하위)
  if (pathname === "/external" || pathname.startsWith("/external/")) {
    return NextResponse.next();
  }

  // 그 외는 전부 404처럼 처리
  const url = req.nextUrl.clone();
  url.pathname = "/NotFound";
  return NextResponse.rewrite(url);
}