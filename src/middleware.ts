import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const pathname = req.nextUrl.pathname

  // Se não está logado, redireciona pro login
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // Rota /register → apenas SUPERADMIN ou ADMIN
  if (pathname.startsWith("/register")) {
    if (token.role !== "SUPERADMIN" && token.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/register/:path*",
    "/admin/:path*",
  ],
}