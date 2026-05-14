import { NextResponse, type NextRequest } from "next/server"

/**
 * 부스 모드 — /demo 외 모든 페이지 경로는 /demo 로 redirect.
 * Next 16: middleware.ts 대신 proxy.ts.
 *
 * 통과: /demo, /demo/*, /api/*, /_next/*, 정적 자산
 * 리다이렉트: 그 외 모든 페이지 → /demo
 *
 * 해제: 이 파일의 proxy() 본문을 NextResponse.next() 한 줄로 비우거나
 *      config.matcher 를 빈 배열로.
 */

const STATIC_EXT = /\.(svg|png|jpg|jpeg|gif|webp|ico|pdf|woff2?|ttf|otf|css|js|map)$/i

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === "/demo" || pathname.startsWith("/demo/")) return NextResponse.next()
  if (pathname.startsWith("/api/")) return NextResponse.next()
  if (pathname.startsWith("/_next/")) return NextResponse.next()
  if (pathname === "/favicon.ico") return NextResponse.next()
  if (STATIC_EXT.test(pathname)) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = "/demo"
  url.search = ""
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
