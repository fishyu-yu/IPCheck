import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Middleware: If the request comes from curl to the root path, rewrite to /api/ipinfo with omit_readme
export function middleware(req: NextRequest) {
  try {
    const ua = (req.headers.get("user-agent") || "").toLowerCase();
    const isCurl = ua.includes("curl/");
    const { pathname } = req.nextUrl;

    if (isCurl && pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = "/api/ipinfo";
      url.searchParams.set("omit_readme", "1");
      return NextResponse.rewrite(url);
    }
  } catch {}
  return NextResponse.next();
}