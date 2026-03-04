import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "../../../lib/prisma"
import bcrypt from "bcrypt"

export async function POST(req: NextRequest) {
  // 1. Verifica se há sessão ativa e se o usuário é ADMIN
  const session = await getServerSession()

  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Acesso negado. Apenas administradores podem cadastrar usuários." },
      { status: 403 }
    )
  }

  // 2. Lê os dados do body
  const { email, password, company } = await req.json()

  if (!email || !password || !company) {
    return NextResponse.json(
      { error: "Todos os campos são obrigatórios." },
      { status: 400 }
    )
  }

  // 3. Cria a empresa e o usuário
  const hashedPassword = await bcrypt.hash(password, 10)

  try {
    await prisma.company.create({
      data: {
        name: company,
        users: {
          create: {
            email,
            password: hashedPassword,
            role: "USER",
          }
        }
      }
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: "Erro ao criar conta. E-mail já existe?" },
      { status: 500 }
    )
  }
}