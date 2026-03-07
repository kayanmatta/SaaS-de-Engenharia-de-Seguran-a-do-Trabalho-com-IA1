import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcrypt"

// ─── Rate limiting simples em memória ────────────────────────────────────────
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

function checkRateLimit(email: string): boolean {
  const now = Date.now()
  const key = email.toLowerCase().trim()
  const record = loginAttempts.get(key)
  if (!record || now - record.firstAttempt > WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttempt: now })
    return false
  }
  if (record.count >= MAX_ATTEMPTS) return true
  record.count++
  return false
}

function resetRateLimit(email: string) {
  loginAttempts.delete(email.toLowerCase().trim())
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        if (credentials.email.length > 255 || credentials.password.length > 512) return null

        if (checkRateLimit(credentials.email)) {
          throw new Error("Muitas tentativas. Tente novamente em 15 minutos.")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.trim() },
          include: { company: true },
        })

        if (!user) return null

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) return null

        resetRateLimit(credentials.email)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
          companyName: user.company.name,
        }
      },
    }),
  ],
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id          = (user as any).id
        token.role        = (user as any).role
        token.companyId   = (user as any).companyId
        token.companyName = (user as any).companyName
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id          = token.id
        ;(session.user as any).role       = token.role
        ;(session.user as any).companyId  = token.companyId
        ;(session.user as any).companyName = token.companyName
      }
      return session
    },
  },
}