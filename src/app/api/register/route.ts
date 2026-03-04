import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../lib/auth"
import { prisma } from "../../../lib/prisma"
import bcrypt from "bcrypt"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session || ((session.user as any)?.role !== "ADMIN" && (session.user as any)?.role !== "SUPERADMIN")) {
    return NextResponse.json(
      { error: "Acesso negado. Apenas administradores podem cadastrar usuários." },
      { status: 403 }
    )
  }

  // Pega o companyId do admin logado — adiciona à mesma empresa
  const companyId = (session.user as any)?.companyId

  if (!companyId) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 400 })
  }

  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: "E-mail e senha são obrigatórios." }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  try {
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: "USER",
        companyId, // mesma empresa do admin logado
      },
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro ao criar conta. E-mail já existe?" }, { status: 500 })
  }
}