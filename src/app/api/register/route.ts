import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../lib/auth"
import { prisma } from "../../../lib/prisma"
import bcrypt from "bcrypt"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8
const MAX_EMAIL_LENGTH = 255

// Verifica força mínima da senha
function isStrongPassword(password: string): { ok: boolean; reason?: string } {
  if (password.length < MIN_PASSWORD_LENGTH)
    return { ok: false, reason: `Senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.` }
  if (!/[A-Z]/.test(password))
    return { ok: false, reason: "Senha deve conter ao menos uma letra maiúscula." }
  if (!/[0-9]/.test(password))
    return { ok: false, reason: "Senha deve conter ao menos um número." }
  return { ok: true }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session || ((session.user as any)?.role !== "ADMIN" && (session.user as any)?.role !== "SUPERADMIN")) {
    return NextResponse.json(
      { error: "Acesso negado. Apenas administradores podem cadastrar usuários." },
      { status: 403 }
    )
  }

  const companyId = (session.user as any)?.companyId
  if (!companyId) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 400 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 })
  }

  const { email, password } = body

  // ─── Validações ────────────────────────────────────────────────────────────
  if (!email || !password) {
    return NextResponse.json({ error: "E-mail e senha são obrigatórios." }, { status: 400 })
  }

  if (typeof email !== "string" || email.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 })
  }

  if (typeof password !== "string") {
    return NextResponse.json({ error: "Senha inválida." }, { status: 400 })
  }

  const passwordCheck = isStrongPassword(password)
  if (!passwordCheck.ok) {
    return NextResponse.json({ error: passwordCheck.reason }, { status: 400 })
  }

  // Verifica se e-mail já existe na empresa
  const existing = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim(), companyId },
  })
  if (existing) {
    return NextResponse.json({ error: "Este e-mail já está cadastrado." }, { status: 409 })
  }

  const hashedPassword = await bcrypt.hash(password, 12) // custo 12 em vez de 10

  try {
    await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: "USER",
        companyId,
      },
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro ao criar conta." }, { status: 500 })
  }
}