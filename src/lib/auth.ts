import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcrypt"

// ─── Rate limiting simples em memória ────────────────────────────────────────
// Máximo de 5 tentativas por email a cada 15 minutos
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutos

function checkRateLimit(email: string): { blocked: boolean; remaining: number } {
  const now = Date.now()
  const key = email.toLowerCase().trim()
  const record = loginAttempts.get(key)

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    // Janela expirada ou primeiro acesso — reseta
    loginAttempts.set(key, { count: 1, firstAttempt: now })
    return { blocked: false, remaining: MAX_ATTEMPTS - 1 }
  }

  if (record.count >= MAX_ATTEMPTS) {
    return { blocked: true, remaining: 0 }
  }

  record.count++
  return { blocked: false, remaining: MAX_ATTEMPTS - record.count }
}

function resetRateLimit(email: string) {
  loginAttempts.delete(email.toLowerCase().trim())
}

// ─── Auth Options ─────────────────────────────────────────────────────────────
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

        // Valida tamanho para evitar ataques de payload gigante
        if (credentials.email.length > 255 || credentials.password.length > 512) return null

        // Rate limiting por email
        const rateLimit = checkRateLimit(credentials.email)
        if (rateLimit.blocked) {
          throw new Error("Muitas tentativas. Tente novamente em 15 minutos.")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: { company: true },
        })

        // Sempre executa bcrypt mesmo se user não existe (evita timing attack)
        const dummyHash = "$2b$12$invalidhashfortimingprotection000000000000000000000000"
        const isValid = user
          ? await bcrypt.compare(credentials.password, user.password)
          : await bcrypt.compare(credentials.password, dummyHash).then(() => false)

        if (!user || !isValid) return null

        // Login bem sucedido — reseta contador
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
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 horas
  },
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